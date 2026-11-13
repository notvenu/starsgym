import Link from "next/link";
import { allRows, requireStaff, type Profile } from "@/lib/supabase";
import { GENDERS, gymDate, gymDateIn, inr, planName, prettyDay, reminderText, type Holiday, type Plan } from "@/lib/gym";
import { photoUrls } from "@/lib/photo";
import { Avatar, Empty, PageHeader, Panel, SESSION_LABEL, Stat } from "./kit";
import { AddMemberForm, AdminModal, Desk, MemberActions, RequestRow } from "./ui";
import { deskRef, trainersFor } from "./data";
import { loadFollowUps, recentNotes, wonBackThisMonth } from "./follow-ups/data";
import { FollowUpQueue, type FollowItem } from "./follow-ups/queue";
import { ScanButton } from "@/components/scanner";
import { NotificationToggle } from "@/components/push";

type Visit = { created_at: string; session: string; branch_id: string; user_id: string; profiles: { full_name: string; photo_path: string | null } | null };
type Past = { status: string; starts_on: string | null; ends_on: string | null; paid_at: string | null };
type Ending = { id: string; user_id: string; ends_on: string; plans: Plan; profiles: (Profile & { history?: Past[] }) | null };

// saves on this page (new member, renew, edit, photo) talk to Supabase many times in a row: give them a minute, not 10 s
export const maxDuration = 60;

export default async function Overview({ searchParams }: PageProps<"/admin">) {
  const sp = await searchParams;
  const scanNext = sp.scan === "1"; // "Scan next" on a checked pass comes back here
  // "Show 10 more" on the expiring / expired lists: how many rows each shows (only those get photos signed)
  const upTo = (v: unknown) => Math.min(500, Math.max(10, Number(v) || 10));
  const count = { expiring: upTo(sp.expiring), expired: upTo(sp.expired) };
  const { supabase, profile, isOwner, branchId, view } = await requireStaff();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the generic query-builder type recurses too deep
  const only = (q: any) => (view ? q.eq("branch_id", view) : q);
  const today = gymDate();
  const monthStart = `${today.slice(0, 7)}-01`;
  const weekOut = gymDateIn(7);
  const monthAgo = gymDateIn(-30);
  const weekAgo = gymDateIn(-7);

  const newSince = gymDateIn(-6); // the last 7 days, today included
  const monthFrom = `${monthStart}T00:00:00+05:30`;
  const weekFrom = `${newSince}T00:00:00+05:30`;
  // what the list rows (and their ⋯ menu / Edit form) use of a member — not every column
  const MEMBER = "id,full_name,phone,email,home_branch_id,role,gender,date_of_birth,age,emergency_contact,photo_path";

  // the headline numbers, counted in the database (0023). Before it's run: counted here, the slow way.
  const countsP = (async () => {
    const { data, error } = await supabase.rpc("desk_overview", { p_branch: view, p_today: today, p_month_start: monthFrom, p_week_start: weekFrom });
    const row = (data as { active_members: number; collected_paise: number; renewals: number }[] | null)?.[0];
    if (!error && row) return { members: Number(row.active_members), collected: Number(row.collected_paise), renewals: Number(row.renewals) };
    const [active, paid, sold] = await Promise.all([
      allRows(() => only(supabase.from("subscriptions").select("user_id").eq("status", "active").lte("starts_on", today).gte("ends_on", today)).order("id")),
      isOwner ? allRows(() => only(supabase.from("subscriptions").select("amount_paise").eq("status", "active").gte("paid_at", monthFrom)).order("id")) : null,
      allRows(() => only(supabase.from("subscriptions").select("user_id,plans!inner(track,duration_days),profiles!subscriptions_user_id_fkey(history:subscriptions!subscriptions_user_id_fkey(status,paid_at))").eq("status", "active").gte("paid_at", weekFrom).gt("plans.duration_days", 1).neq("plans.track", "personal_training")).order("id")),
    ]);
    const weekStart = Date.parse(weekFrom);
    type Sold = { user_id: string; profiles: { history?: Past[] } | null };
    return {
      members: new Set(((active.data ?? []) as { user_id: string }[]).map((r) => r.user_id)).size,
      collected: ((paid?.data ?? []) as { amount_paise: number }[]).reduce((sum, r) => sum + r.amount_paise, 0),
      // bought this week, had a plan before it (imported plans have no paid_at)
      renewals: new Set(((sold.data ?? []) as unknown as Sold[]).filter((r) => (r.profiles?.history ?? []).some((h) => h.status === "active" && (!h.paid_at || Date.parse(h.paid_at) < weekStart))).map((r) => r.user_id)).size,
    };
  })();
  const restP = Promise.all([
    deskRef(),
    countsP,
    supabase.from("holidays").select("*").gte("day", today).order("day").limit(3),
    supabase.from("enquiries").select("id", { count: "exact", head: true }).eq("handled", false),
    // orders waiting for the desk to take the money / check the UPI screenshot
    only(supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "pending")),
    loadFollowUps(view, 60),
    wonBackThisMonth(view),
  ]);

  // the lists the page draws. Each row's plan history comes filtered to just the plans that decide the question (an
  // embedded filter), not the member's whole history: e.g. for "lapsed", only plans that still run today or later.
  const [checkins, expiring, requests, ended, joined, notes] = await Promise.all([
    only(supabase.from("checkins").select("created_at,session,branch_id,user_id,profiles(full_name,photo_path)").eq("day", today)).order("created_at", { ascending: false }).limit(200),
    only(supabase
      .from("subscriptions")
      .select(`id,user_id,ends_on,plans(*),profiles!subscriptions_user_id_fkey(${MEMBER})`)
      .eq("status", "active")
      .gte("ends_on", today)
      .lte("ends_on", weekOut))
      .order("ends_on")
      .limit(300),
    // members' name / gender / branch / photo change requests this desk can see (RLS); none before 0015
    supabase.from("profile_requests").select("*,profiles!profile_requests_user_id_fkey(full_name,photo_path,gender,home_branch_id,phone,email)").eq("status", "pending").order("created_at"),
    // plans that ran out in the last 30 days — the renewal list (members who bought again are dropped below)
    only(supabase
      .from("subscriptions")
      .select(`id,user_id,ends_on,plans(*),profiles!subscriptions_user_id_fkey(${MEMBER},history:subscriptions!subscriptions_user_id_fkey(status,starts_on,ends_on,paid_at))`)
      .eq("status", "active")
      .gte("ends_on", monthAgo)
      .lt("ends_on", today)
      .eq("profiles.history.status", "active")
      .gte("profiles.history.ends_on", today))
      .order("ends_on", { ascending: false })
      .limit(300),
    // new joiners: paid plans that started in the last 7 days — the ones that are someone's first are kept below.
    // (Not account age: the GymPro import made hundreds of accounts in one day.)
    only(supabase
      .from("subscriptions")
      .select("id,user_id,starts_on,ends_on,plans(*),profiles!subscriptions_user_id_fkey(full_name,phone,photo_path,home_branch_id,history:subscriptions!subscriptions_user_id_fkey(status,starts_on,ends_on,paid_at))")
      .eq("status", "active")
      .gte("starts_on", newSince)
      .lte("starts_on", today)
      .eq("profiles.history.status", "active")
      .lt("profiles.history.starts_on", newSince))
      .order("starts_on", { ascending: false })
      .limit(300),
    recentNotes(), // who the desk has already followed up — they sort to the bottom
  ]);
  const visits = (checkins.data ?? []) as unknown as Visit[];
  // contacted: a follow-up in the last week (expiring), or since their plan ended (expired) — they go to the bottom
  const contactOf = (e: Ending, since: string) => ((n) => (n && n.at.slice(0, 10) >= since ? n : null))(notes.get(e.user_id));
  const last = <T,>(list: T[], done: (x: T) => boolean) => [...list.filter((x) => !done(x)), ...list.filter(done)];
  const ending = last((expiring.data ?? []) as unknown as Ending[], (e) => !!contactOf(e, weekAgo));
  // lapsed: their latest plan ended in the last 30 days and nothing runs today or later
  const endedRows = (ended.data ?? []) as unknown as Ending[];
  type Joiner = { id: string; user_id: string; starts_on: string; ends_on: string | null; plans: Plan; profiles: { full_name: string; phone: string | null; photo_path: string | null; home_branch_id: string | null; history?: Past[] } | null };
  const startedRows = (joined.data ?? []) as unknown as Joiner[];
  // each row carries just the matching part of the member's plan history (same query, no second round trip)
  const had = (h: Past[] | undefined, test: (p: Past) => boolean) => (h ?? []).some((p) => p.status === "active" && test(p));
  const joiners = startedRows.filter((j, i) => !had(j.profiles?.history, (p) => !!p.starts_on && p.starts_on < newSince) && startedRows.findIndex((x) => x.user_id === j.user_id) === i);
  const lapsed = last(endedRows.filter((e, i) => !had(e.profiles?.history, (p) => !!p.ends_on && p.ends_on >= today) && endedRows.findIndex((x) => x.user_id === e.user_id) === i), (e) => !!contactOf(e, e.ends_on));
  type Req = { id: string; user_id: string; full_name: string | null; gender: string | null; home_branch_id: string | null; photo_path: string | null; note: string | null;
    phone?: string | null; email?: string | null;
    profiles: { full_name: string; photo_path: string | null; gender: string | null; home_branch_id: string | null; phone: string | null; email: string | null } | null };
  const queue = (requests.data ?? []) as unknown as Req[];
  // an overview, not the full lists: the first few of each (with a link to all) keeps the page quick to open on a phone
  const shown = { visits: visits.slice(0, 12), ending: ending.slice(0, count.expiring), lapsed: lapsed.slice(0, count.expired), joiners: joiners.slice(0, 30) }; // a week of new joiners is short: show them all
  // photos are signed as soon as the lists are in, while the numbers and the rest finish
  const [[ref, { members, collected, renewals }, holidays, enquiries, toConfirm, followUps, wonBack], photos] = await Promise.all([
    restP,
    photoUrls([...shown.visits.map((v) => v.profiles?.photo_path), ...shown.ending.map((e) => e.profiles?.photo_path), ...shown.lapsed.map((e) => e.profiles?.photo_path), ...queue.flatMap((r) => [r.photo_path, r.profiles?.photo_path]), ...shown.joiners.map((j) => j.profiles?.photo_path)]),
  ]);
  const b = ref.branches.filter((x) => x.active);
  const deskBranches = b.filter((x) => !branchId || x.id === branchId); // staff: just theirs
  const liveOffers = ref.offers.filter((o) => o.starts_on <= today && o.ends_on >= today);
  const trainers = trainersFor(ref.trainers, view);
  const more = (total: number, showing: number, href: string, what: string) =>
    total > showing && <Link href={href} className="block border-t border-line px-5 py-3 text-sm font-bold text-red hover:bg-steel/60 hover:text-chalk">All {total} {what} →</Link>;
  // the renewal lists grow 10 at a time right here — the members list counts "expired" differently (ever, not 30 days)
  const toggle = (list: "expiring" | "expired", total: number) => {
    if (total <= count[list]) return null;
    const next = new URLSearchParams(Object.entries({ ...count, [list]: count[list] + 10 }).filter(([, n]) => n > 10).map(([k, n]) => [k, String(n)]));
    return (
      <Link href={`/admin?${next}`} scroll={false} className="block border-t border-line px-5 py-3 text-center text-sm font-bold text-red hover:bg-steel/60 hover:text-chalk">
        Show 10 more · {total - count[list]} left
      </Link>
    );
  };
  const pic = (p?: string | null) => (p ? photos.get(p) : null);
  const branchName = (id: string) => b.find((x) => x.id === id)?.name ?? "";
  const where = (h: Holiday) => (h.branch_id ? b.find((x) => x.id === h.branch_id)?.name ?? "One branch" : "All branches");
  const time = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

  // each list's badge, and when a follow-up counts as "contacted" — shared by the rows and the follow-up popup
  const endingBadge = (e: Ending) => ((d) => (d <= 1 ? "Ends today" : `${d}d left`))(Math.round((Date.parse(e.ends_on) - Date.parse(today)) / 864e5) + 1);
  const lapsedBadge = (e: Ending) => ((d) => (d <= 1 ? "Ended yesterday" : `${d}d ago`))(Math.round((Date.parse(today) - Date.parse(e.ends_on)) / 864e5));
  const ago = (iso: string) => ((m) => (m < 60 ? `${Math.max(1, m)}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`))(Math.round((Date.parse(new Date().toISOString()) - Date.parse(iso)) / 6e4));
  const followItem = (e: Ending, badge: string, since: string): FollowItem => ({
    memberId: e.user_id, name: e.profiles!.full_name || "Member", phone: e.profiles!.phone, badge,
    sub: `${planName(e.plans)} · ${e.ends_on >= today ? "ends" : "ended"} ${prettyDay(e.ends_on)}`,
    last: ((n) => n && `${n.detail} — ${n.actor_name ?? "Desk"}, ${ago(n.at)}`)(contactOf(e, since)),
    text: reminderText(e.profiles!.full_name, e.plans, e.ends_on, today),
  });
  // "Follow up one by one": the whole list (not just the rows shown), not contacted yet, in list order
  const queueOf = (list: Ending[], badge: (e: Ending) => string, since: (e: Ending) => string) =>
    list.filter((e) => e.profiles && !contactOf(e, since(e))).map((e) => followItem(e, badge(e), since(e)));

  // one row for the renewal lists: who, a badge, whether the desk has followed up, the follow-up popup, and the ⋯ menu
  const renewRow = (e: Ending, badge: string, runningSubId: string | null, since: string) => {
    const m = e.profiles;
    if (!m) return null;
    const done = contactOf(e, since);
    return (
      // name and phone get the full width; the badge and the buttons sit on the line below
      <li key={e.id} className="flex flex-wrap items-center gap-1.5 pr-2 pb-2 transition-colors hover:bg-steel/60 sm:gap-2 sm:pr-5">
        <Link href={`/admin/members/${e.user_id}`} className="flex min-w-0 basis-full items-center gap-3 pt-2 pl-3 sm:pl-5">
          <Avatar src={pic(m.photo_path)} name={m.full_name || "?"} size="size-10" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-bold">{m.full_name || "—"}</span>
            {m.phone && <span className="block truncate text-sm text-ash">{m.phone}</span>}
          </span>
        </Link>
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 pl-3 sm:pl-[4.5rem]">
          <span className="shrink-0 rounded-full border border-red px-2 py-0.5 text-[11px] font-bold tracking-wider text-red uppercase">{badge}</span>
          {done && <span className="min-w-0 truncate text-xs text-ash" title={done.detail ?? ""}><b className="text-[#25d366]">✓ Contacted</b> · {done.detail} · {ago(done.at)}</span>}
        </span>
        <FollowUpQueue items={[followItem(e, badge, since)]} label={done ? "Again" : "Follow up"}
          className={`${done ? "btn-ghost" : "btn-red"} min-h-9 shrink-0 px-3 text-xs`} />
        <MemberActions member={m} passId={runningSubId} cancelSubId={runningSubId} admissionPaise={null} lastPlanId={e.plans.id} currentEnd={runningSubId ? e.ends_on : null} />
      </li>
    );
  };

  return (
    <>
      {scanNext && <ScanButton kind="pass" autoOpen className="hidden">Scan</ScanButton>}
      <PageHeader title={`Hi, ${profile.full_name.split(" ")[0] || "coach"}`} intro={`Here's Stars Gym on ${prettyDay(today)}.`}>
        {/* the desk's everyday jobs, one tap each */}
        <AdminModal label="+ New member" title="New member">
          <AddMemberForm branches={deskBranches} plans={ref.plans} offers={ref.offers} trainers={trainers} admissionPaise={ref.admissionPaise} markup={ref.markupPct} />
        </AdminModal>
        <Link href="/admin/payments" className="btn-ghost">Confirm payments</Link>
        <Link href="/admin/branches?holiday=1#holidays" className="btn-ghost">Add holiday</Link>
      </PageHeader>

      {/* shows only on a device that hasn't turned them on yet: UPI screenshots, discount requests, enquiries */}
      <NotificationToggle nudge />

      {/* phones: an odd last tile spans the row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-5 max-sm:[&>*:last-child:nth-child(odd)]:col-span-2">
        <Stat label="Active members" value={members} href="/admin/members?show=active" />
        <Stat label="Check-ins today" value={visits.length} href="#today" />
        <Stat label="New joiners · 7 days" value={joiners.length} href="#joiners" />
        <Stat label="Renewed · 7 days" value={renewals} />
        <Stat label="Expiring in 7 days" value={ending.length} href="#expiring" tone={ending.length ? "red" : undefined} />
        <Stat label="Expired · not renewed" value={lapsed.length} href="#expired" tone={lapsed.length ? "red" : undefined} />
        {/* the month's takings are the owner's */}
        {isOwner
          ? <Stat label="Collected this month" value={inr(collected)} href="/admin/payments" />
          : <Stat label="New enquiries" value={enquiries.count ?? 0} href="/admin/enquiries" tone={enquiries.count ? "red" : undefined} />}
        <Stat label="Won back · this month" value={wonBack} href="/admin/follow-ups?show=done" />
        <Stat label="Lapsed · not contacted" value={followUps.untouched} href="/admin/follow-ups" tone={followUps.untouched ? "red" : undefined} />
        <Stat label="Payments to confirm" value={toConfirm.count ?? 0} href="/admin/payments" tone={toConfirm.count ? "red" : undefined} />
      </div>

      {queue.length > 0 && (
        <Panel title={`Change requests · ${queue.length}`} flush>
          <ul className="divide-y divide-line">
            {queue.map((r) => {
              const g = (x: string | null) => GENDERS.find(([k]) => k === x)?.[1] ?? "—";
              const changes: [string, string, string][] = [
                ...(r.full_name ? [["Name", r.profiles?.full_name || "—", r.full_name] as [string, string, string]] : []),
                ...(r.gender ? [["Gender", g(r.profiles?.gender ?? null), g(r.gender)] as [string, string, string]] : []),
                ...(r.home_branch_id ? [["Branch", branchName(r.profiles?.home_branch_id ?? "") || "—", branchName(r.home_branch_id) || "—"] as [string, string, string]] : []),
                ...(r.phone ? [["Phone", r.profiles?.phone || "—", r.phone] as [string, string, string]] : []),
                ...(r.email ? [["Email", r.profiles?.email || "—", r.email] as [string, string, string]] : []),
              ];
              return (
                <RequestRow key={r.id} id={r.id} name={r.profiles?.full_name || "Member"} href={`/admin/members/${r.user_id}`}
                  photo={pic(r.profiles?.photo_path) ?? null} newPhoto={pic(r.photo_path) ?? null} changes={changes} note={r.note} />
              );
            })}
          </ul>
        </Panel>
      )}

      <Desk owner={isOwner} branches={deskBranches} plans={ref.plans} offers={ref.offers} trainers={trainers} markup={ref.markupPct}>
      <Panel id="expiring" title={`Expiring soon · ${ending.length}`} intro="Ending in the next 7 days." flush
        action={((q) => <FollowUpQueue items={q} label={`Follow up one by one · ${q.length}`} />)(queueOf(ending, endingBadge, () => weekAgo))}>
        {ending.length ? (
          <ul className="divide-y divide-line">
            {shown.ending.map((e) => renewRow(e, endingBadge(e), e.id, weekAgo))}
          </ul>
        ) : (
          <Empty>No plans ending in the next 7 days.</Empty>
        )}
        {toggle("expiring", ending.length)}
      </Panel>

      <Panel id="expired" title={`Expired · ${lapsed.length}`} intro="Ended in the last 30 days, not renewed." flush
        action={
          <span className="flex flex-wrap items-center justify-end gap-3">
            {((q) => <FollowUpQueue items={q} label={`Follow up one by one · ${q.length}`} />)(queueOf(lapsed, lapsedBadge, (e) => e.ends_on))}
            <Link href="/admin/follow-ups" className="text-sm font-bold text-red hover:text-chalk">Follow-ups →</Link>
          </span>
        }>
        {lapsed.length ? (
          <ul className="divide-y divide-line">
            {shown.lapsed.map((e) => renewRow(e, lapsedBadge(e), null, e.ends_on))}
          </ul>
        ) : (
          <Empty>Nobody lapsed in the last 30 days.</Empty>
        )}
        {toggle("expired", lapsed.length)}
      </Panel>
      </Desk>

      {/* who walked in today, with their photo — staff can match faces at a glance */}
      <Panel id="today" title="Checked in today" intro={b.length > 1 ? b.map((x) => `${x.name} ${visits.filter((v) => v.branch_id === x.id).length}`).join(" · ") : undefined} flush>
        {visits.length ? (
          <ul className="grid gap-px bg-line sm:grid-cols-2 xl:grid-cols-3">
            {shown.visits.map((v) => (
              <li key={`${v.user_id}-${v.session}`} className="bg-carbon">
                <Link href={`/admin/members/${v.user_id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-steel/60">
                  <Avatar src={pic(v.profiles?.photo_path)} name={v.profiles?.full_name ?? "?"} size="size-14" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{v.profiles?.full_name || "Member"}</span>
                    <span className="block truncate text-sm text-ash">
                      {time(v.created_at)} · {SESSION_LABEL[v.session] ?? v.session}
                      {b.length > 1 && ` · ${branchName(v.branch_id)}`}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No check-ins yet today.</Empty>
        )}
        {more(visits.length, shown.visits.length, "/admin/checkins", "check-ins today")}
      </Panel>

      <Panel id="joiners" title={`New joiners · ${joiners.length}`} intro="First plan, started this week." flush>
        {joiners.length ? (
          <ul className="divide-y divide-line">
            {shown.joiners.map((j) => (
              <li key={j.id}>
                <Link href={`/admin/members/${j.user_id}`} className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-steel/60">
                  <Avatar src={pic(j.profiles?.photo_path)} name={j.profiles?.full_name || "?"} size="size-12" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{j.profiles?.full_name || "—"}</span>
                    <span className="block truncate text-sm text-ash">{[j.profiles?.phone, branchName(j.profiles?.home_branch_id ?? "")].filter(Boolean).join(" · ")}</span>
                    <span className="block truncate text-sm text-ash">{planName(j.plans)}{j.ends_on && ` · till ${prettyDay(j.ends_on)}`}</span>
                  </span>
                  <span className="shrink-0 text-xs text-ash">{j.starts_on === today ? "Today" : prettyDay(j.starts_on)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Nobody new in the last 7 days.</Empty>
        )}
      </Panel>

      <Panel title="Coming up" action={<Link href="/admin/branches#holidays" className="text-sm font-bold text-red hover:text-chalk">Manage →</Link>}>
        <ul className="flex flex-col gap-2 text-sm">
          {((holidays.data ?? []) as Holiday[]).map((h) => (
            <li key={h.id}><span className="font-bold">Closed {prettyDay(h.day)}</span> <span className="text-ash">· {where(h)}{h.note && ` · ${h.note}`}</span></li>
          ))}
          {liveOffers.map((o) => (
            <li key={o.id}><span className="font-bold text-red">{o.percent_off}% off</span> <span className="text-ash">· {o.title} till {prettyDay(o.ends_on)}</span></li>
          ))}
          {!holidays.data?.length && !liveOffers.length && <li className="text-ash">No holidays or live offers.</li>}
        </ul>
      </Panel>
    </>
  );
}
