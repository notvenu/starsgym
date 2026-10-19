import Link from "next/link";
import { requireStaff, type Profile } from "@/lib/supabase";
import { ageOf, GENDERS, gymDate, gymDateIn, inr, planName, prettyDay, waLink, type Branch, type Holiday, type Offer, type Plan } from "@/lib/gym";
import { photoUrls } from "@/lib/photo";
import { Avatar, Empty, PageHeader, Panel, SESSION_LABEL, Stat, waNumber } from "./kit";
import { MemberActions, RequestRow } from "./ui";
import { getTrainers } from "./data";
import { siteOrigin } from "@/lib/pass";
import { ScanButton } from "@/components/scanner";
import { NotificationToggle } from "@/components/push";

type Visit = { created_at: string; session: string; branch_id: string; user_id: string; profiles: { full_name: string; photo_path: string | null } | null };
type Ending = { id: string; user_id: string; ends_on: string; plans: Plan; profiles: Profile | null };

export default async function Overview({ searchParams }: PageProps<"/admin">) {
  const scanNext = (await searchParams).scan === "1"; // "Scan next" on a checked pass comes back here
  const { supabase, profile, isOwner, branchId, view } = await requireStaff();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the generic query-builder type recurses too deep
  const only = (q: any) => (view ? q.eq("branch_id", view) : q);
  const today = gymDate();
  const monthStart = `${today.slice(0, 7)}-01`;
  const weekOut = gymDateIn(7);
  const monthAgo = gymDateIn(-30);

  const newSince = gymDateIn(-6); // the last 7 days, today included
  const [branches, checkins, active, paid, holidays, offers, enquiries, expiring, plans, requests, ended, trainers, joined] = await Promise.all([
    supabase.from("branches").select("*").eq("active", true).order("created_at"),
    only(supabase.from("checkins").select("created_at,session,branch_id,user_id,profiles(full_name,photo_path)").eq("day", today)).order("created_at", { ascending: false }).limit(200),
    // ponytail: counts distinct members client-side; switch to an SQL count past ~10k active plans
    only(supabase.from("subscriptions").select("user_id").eq("status", "active").lte("starts_on", today).gte("ends_on", today)).limit(10000),
    // the month's takings are the owner's; staff see who to renew instead
    isOwner ? only(supabase.from("subscriptions").select("amount_paise").eq("status", "active").gte("paid_at", `${monthStart}T00:00:00+05:30`)).limit(10000) : null,
    supabase.from("holidays").select("*").gte("day", today).order("day").limit(3),
    supabase.from("offers").select("*").eq("active", true).lte("starts_on", today).gte("ends_on", today),
    supabase.from("enquiries").select("id", { count: "exact", head: true }).eq("handled", false),
    only(supabase
      .from("subscriptions")
      .select("id,user_id,ends_on,plans(*),profiles!subscriptions_user_id_fkey(*)")
      .eq("status", "active")
      .gte("ends_on", today)
      .lte("ends_on", weekOut))
      .order("ends_on")
      .limit(50),
    supabase.from("plans").select("*").eq("active", true).order("track").order("duration_days"),
    // members' name / gender / branch / photo change requests this desk can see (RLS); none before 0015
    supabase.from("profile_requests").select("*,profiles!profile_requests_user_id_fkey(full_name,photo_path,gender,home_branch_id,phone,email)").eq("status", "pending").order("created_at"),
    // plans that ran out in the last 30 days — the renewal list (members who bought again are dropped below)
    only(supabase
      .from("subscriptions")
      .select("id,user_id,ends_on,plans(*),profiles!subscriptions_user_id_fkey(*)")
      .eq("status", "active")
      .gte("ends_on", monthAgo)
      .lt("ends_on", today))
      .order("ends_on", { ascending: false })
      .limit(300),
    getTrainers(supabase, view),
    // new joiners: paid plans that started in the last 7 days — the ones that are someone's first are kept below.
    // (Not account age: the GymPro import made hundreds of accounts in one day.)
    only(supabase
      .from("subscriptions")
      .select("id,user_id,starts_on,ends_on,plans(*),profiles!subscriptions_user_id_fkey(full_name,phone,photo_path,home_branch_id)")
      .eq("status", "active")
      .gte("starts_on", newSince)
      .lte("starts_on", today))
      .order("starts_on", { ascending: false })
      .limit(300),
  ]);
  const b = (branches.data ?? []) as Branch[];
  const members = new Set(((active.data ?? []) as { user_id: string }[]).map((r) => r.user_id)).size;
  const collected = ((paid?.data ?? []) as { amount_paise: number }[]).reduce((sum, r) => sum + r.amount_paise, 0);
  const origin = await siteOrigin();
  const visits = (checkins.data ?? []) as unknown as Visit[];
  const ending = (expiring.data ?? []) as unknown as Ending[];
  // lapsed: their latest plan ended in the last 30 days and nothing runs today or later
  const endedRows = (ended.data ?? []) as unknown as Ending[];
  const lapsedIds = [...new Set(endedRows.map((e) => e.user_id))];
  type Joiner = { id: string; user_id: string; starts_on: string; ends_on: string | null; plans: Plan; profiles: { full_name: string; phone: string | null; photo_path: string | null; home_branch_id: string | null } | null };
  const startedRows = (joined.data ?? []) as unknown as Joiner[];
  const startedIds = [...new Set(startedRows.map((j) => j.user_id))];
  // one round trip for both: who renewed after lapsing, and who already had a plan before this week
  const [{ data: renewed }, { data: earlier }] = await Promise.all([
    lapsedIds.length ? supabase.from("subscriptions").select("user_id").eq("status", "active").gte("ends_on", today).in("user_id", lapsedIds) : { data: [] },
    startedIds.length ? supabase.from("subscriptions").select("user_id").eq("status", "active").lt("starts_on", newSince).in("user_id", startedIds) : { data: [] },
  ]);
  const returning = new Set((earlier ?? []).map((r) => r.user_id as string));
  const joiners = startedRows.filter((j, i) => !returning.has(j.user_id) && startedRows.findIndex((x) => x.user_id === j.user_id) === i);
  const back = new Set((renewed ?? []).map((r) => r.user_id as string));
  const lapsed = endedRows.filter((e, i) => !back.has(e.user_id) && endedRows.findIndex((x) => x.user_id === e.user_id) === i);
  type Req = { id: string; user_id: string; full_name: string | null; gender: string | null; home_branch_id: string | null; photo_path: string | null; note: string | null;
    phone?: string | null; email?: string | null;
    profiles: { full_name: string; photo_path: string | null; gender: string | null; home_branch_id: string | null; phone: string | null; email: string | null } | null };
  const queue = (requests.data ?? []) as unknown as Req[];
  // an overview, not the full lists: the first few of each (with a link to all) keeps the page quick to open on a phone
  const TOP = 10;
  const shown = { visits: visits.slice(0, 12), ending: ending.slice(0, TOP), lapsed: lapsed.slice(0, TOP), joiners: joiners.slice(0, 30) }; // a week of new joiners is short: show them all
  const photos = await photoUrls([...shown.visits.map((v) => v.profiles?.photo_path), ...shown.ending.map((e) => e.profiles?.photo_path), ...shown.lapsed.map((e) => e.profiles?.photo_path), ...queue.flatMap((r) => [r.photo_path, r.profiles?.photo_path]), ...shown.joiners.map((j) => j.profiles?.photo_path)]);
  const more = (total: number, showing: number, href: string, what: string) =>
    total > showing && <Link href={href} className="block border-t border-line px-5 py-3 text-sm font-bold text-red hover:bg-steel/60 hover:text-chalk">All {total} {what} →</Link>;
  const pic = (p?: string | null) => (p ? photos.get(p) : null);
  const branchName = (id: string) => b.find((x) => x.id === id)?.name ?? "";
  const where = (h: Holiday) => (h.branch_id ? b.find((x) => x.id === h.branch_id)?.name ?? "One branch" : "All branches");
  const time = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

  // one row for the renewal lists: who, which plan, a badge, a one-tap WhatsApp renewal message, and the ⋯ menu
  const renewRow = (e: Ending, badge: string, message: string, runningSubId: string | null) => {
    const m = e.profiles;
    if (!m) return null;
    // the same plan, bought online (they sign in with their phone first); a plan since switched off → all plans
    const renew = `${origin}${e.plans.active ? `/buy/${e.plans.id}` : "/#plans"}`;
    const wa = m.phone ? waLink(waNumber(m.phone), `Hi ${m.full_name.split(" ")[0] || "there"}! ${message} Renew online: ${renew} — or at the desk.`) : null;
    return (
      <li key={e.id} className="flex items-center gap-2 pr-3 transition-colors hover:bg-steel/60 sm:pr-5">
        <Link href={`/admin/members/${e.user_id}`} className="flex min-w-0 flex-1 items-center gap-4 py-3 pl-5">
          <Avatar src={pic(m.photo_path)} name={m.full_name || "?"} size="size-12" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-bold">{m.full_name || "—"}</span>
            <span className="block truncate text-xs text-ash">{[branchName(m.home_branch_id ?? ""), ageOf(m) != null && `${ageOf(m)} yrs`, GENDERS.find(([k]) => k === m.gender)?.[1]].filter(Boolean).join(" · ")}</span>
            <span className="block truncate text-sm text-ash">{[m.phone, m.email].filter(Boolean).join(" · ")}</span>
            <span className="block truncate text-sm text-ash">{planName(e.plans)} · {runningSubId ? "till" : "ended"} {prettyDay(e.ends_on)}</span>
            <span className="mt-1 inline-block rounded-full border border-red px-2 py-0.5 text-[11px] font-bold tracking-wider text-red uppercase sm:hidden">{badge}</span>
          </span>
          <span className="shrink-0 rounded-full border border-red px-3 py-1 text-xs font-bold tracking-wider text-red uppercase max-sm:hidden">{badge}</span>
        </Link>
        {wa && (
          <a href={wa} target="_blank" rel="noreferrer" aria-label={`Send ${m.full_name} a renewal message on WhatsApp`} title="Renewal message on WhatsApp"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#25d366] text-ink transition-transform hover:scale-105">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3.5 20.5l1.3-4.2A8.5 8.5 0 1 1 8 19.4z" /><path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.5-2-1-1 .8a5 5 0 0 1-2.8-2.8l.8-1-1-2z" /></svg>
          </a>
        )}
        <MemberActions
          owner={isOwner}
          member={m}
          passId={runningSubId}
          cancelSubId={runningSubId}
          waHref={wa}
          branches={b.filter((x) => !branchId || x.id === branchId)}
          plans={(plans.data ?? []) as Plan[]}
          offers={(offers.data ?? []) as Offer[]}
          trainers={trainers}
          admissionPaise={null}
        />
      </li>
    );
  };

  return (
    <>
      {scanNext && <ScanButton kind="pass" autoOpen className="hidden">Scan</ScanButton>}
      <PageHeader title={`Hi, ${profile.full_name.split(" ")[0] || "coach"}`} intro={`Here's Stars Gym on ${prettyDay(today)}.`}>
        <Link href="/admin/members?new=1" className="btn-red">+ New member</Link>
        {isOwner && <Link href="/admin/pricing" className="btn-ghost">Edit prices</Link>}
        <Link href="/admin/branches?holiday=1#holidays" className="btn-ghost">Add holiday</Link>
      </PageHeader>

      {/* shows only on a device that hasn't turned them on yet: UPI screenshots, discount requests, enquiries */}
      <NotificationToggle nudge />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Active members" value={members} href="/admin/members?show=active" />
        <Stat label="Check-ins today" value={visits.length} href="#today" />
        <Stat label="New joiners · 7 days" value={joiners.length} href="#joiners" />
        <Stat label="Expiring in 7 days" value={ending.length} href="#expiring" tone={ending.length ? "red" : undefined} />
        <Stat label="Expired · not renewed" value={lapsed.length} href="#expired" tone={lapsed.length ? "red" : undefined} />
        {/* the month's takings are the owner's */}
        {isOwner
          ? <Stat label="Collected this month" value={inr(collected)} href="/admin/payments" />
          : <Stat label="New enquiries" value={enquiries.count ?? 0} href="/admin/enquiries" tone={enquiries.count ? "red" : undefined} />}
      </div>

      {queue.length > 0 && (
        <Panel title={`Change requests · ${queue.length}`} intro="Members asking to change their name, gender, branch, phone, email or photo." flush>
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

      <Panel id="expiring" title={`Expiring soon · ${ending.length}`} intro="Ending in the next 7 days. Tap the green button to send a renewal message." flush action={<Link href="/admin/members?show=expiring&sort=ending" className="text-sm font-bold text-red hover:text-chalk">All →</Link>}>
        {ending.length ? (
          <ul className="divide-y divide-line">
            {shown.ending.map((e) => {
              const days = Math.round((Date.parse(e.ends_on) - Date.parse(today)) / 864e5) + 1;
              return renewRow(e, days <= 1 ? "Ends today" : `${days}d left`, `Your Stars Gym ${planName(e.plans)} plan ends on ${prettyDay(e.ends_on)}. Renew to keep your streak going.`, e.id);
            })}
          </ul>
        ) : (
          <Empty>No plans ending in the next 7 days.</Empty>
        )}
        {more(ending.length, shown.ending.length, "/admin/members?show=expiring&sort=ending", "ending this week")}
      </Panel>

      <Panel id="expired" title={`Expired · ${lapsed.length}`} intro="Plan ended in the last 30 days and they haven't renewed. Win them back." flush action={<Link href="/admin/members?show=expired" className="text-sm font-bold text-red hover:text-chalk">All →</Link>}>
        {lapsed.length ? (
          <ul className="divide-y divide-line">
            {shown.lapsed.map((e) => {
              const ago = Math.round((Date.parse(today) - Date.parse(e.ends_on)) / 864e5);
              return renewRow(e, ago <= 1 ? "Ended yesterday" : `${ago}d ago`, `We miss you at Stars Gym! Your ${planName(e.plans)} plan ended on ${prettyDay(e.ends_on)}. Renew and pick up where you left off.`, null);
            })}
          </ul>
        ) : (
          <Empty>Nobody lapsed in the last 30 days.</Empty>
        )}
        {more(lapsed.length, shown.lapsed.length, "/admin/members?show=expired", "expired")}
      </Panel>

      <Panel id="joiners" title={`New joiners · ${joiners.length}`} intro="First membership started in the last 7 days. Say hello and make them feel at home." flush>
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
          {((offers.data ?? []) as Offer[]).map((o) => (
            <li key={o.id}><span className="font-bold text-red">{o.percent_off}% off</span> <span className="text-ash">· {o.title} till {prettyDay(o.ends_on)}</span></li>
          ))}
          {!holidays.data?.length && !offers.data?.length && <li className="text-ash">No holidays or live offers.</li>}
        </ul>
      </Panel>
    </>
  );
}
