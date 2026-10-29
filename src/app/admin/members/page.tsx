import Link from "next/link";
import { requireStaff, ROLE_LABEL, type Profile } from "@/lib/supabase";
import { fuzzyScore, gymDate, gymDateIn } from "@/lib/gym";
import { photoUrls } from "@/lib/photo";
import { Avatar, Empty, PageHeader, Panel, SESSION_LABEL } from "../kit";
import { AddMemberForm, AdminModal, Desk, MemberActions, MemberSearch, SortSelect, WhatsAppButton } from "../ui";
import { deskRef, trainersFor } from "../data";

export const metadata = { title: "Members — Stars Gym admin" };

type Member = Profile & {
  created_at: string;
  checkins: { session: string }[];
  subscriptions: { id: string; status: string; starts_on: string | null; ends_on: string | null; plan_id: string }[];
};

const FILTERS = [
  ["all", "All"],
  ["active", "Active"],
  ["expiring", "Expiring soon"],
  ["expired", "Expired"],
] as const;
type Show = (typeof FILTERS)[number][0];

const SORTS = [
  ["ending_late", "Plan end date"],
  ["ending", "Expired → ending last"],
  ["new", "Newest first"],
  ["name", "Name A–Z"],
] as const;

const PER_PAGE = 25; // a phone screenful or three; more made the page slow to open on phones
const pick = <T extends string>(list: readonly (readonly [T, string])[], v: unknown, fallback: T) =>
  list.some(([k]) => k === v) ? (v as T) : fallback;

export default async function MembersPage({ searchParams }: PageProps<"/admin/members">) {
  const { supabase, branchId, view, isOwner } = await requireStaff();
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : "");
  const q = str("q").toLowerCase();
  const show = pick(FILTERS, sp.show, "all");
  const sort = pick(SORTS, sp.sort, "ending_late");
  const today = gymDate();
  const weekOut = gymDateIn(7);

  // ponytail: loads every member and filters/sorts here — a gym has hundreds, not tens of thousands.
  // Supabase caps a response at 1000 rows by default; page the query with .range() past that.
  const [list, ref] = await Promise.all([
    supabase
      .from("profiles")
      .select("*,checkins(session),subscriptions!subscriptions_user_id_fkey(id,status,starts_on,ends_on,plan_id)")
      .eq("checkins.day", today) // only today's visits
      .eq("subscriptions.status", "active") // paid plans only; pending/cancelled orders don't make anyone a member
      .order("created_at", { ascending: false })
      .limit(5000),
    deskRef(),
  ]);
  const trainers = trainersFor(ref.trainers, view);

  const planList = ref.plans;
  const gymPlan = new Set(planList.filter((p) => p.track !== "personal_training" && p.duration_days > 1).map((p) => p.id));
  // each member's plan state: the plan covering today, else the next one, else the last one that ended
  const everyone = ((list.data ?? []) as unknown as Member[]).map((m) => {
    const subs = m.subscriptions.filter((s) => s.ends_on);
    const current = subs.find((s) => s.ends_on! >= today && (!s.starts_on || s.starts_on <= today));
    const upcoming = subs.filter((s) => s.starts_on && s.starts_on > today).sort((a, b) => a.starts_on!.localeCompare(b.starts_on!))[0];
    const lastEnd = subs.reduce<string | null>((max, s) => (!max || s.ends_on! > max ? s.ends_on! : max), null);
    // a run of back-to-back plans (e.g. 2 × 1 month) counts as one: days left run to the last end date
    const endsOn = current ? lastEnd : null;
    const state = current ? "active" : upcoming ? "upcoming" : subs.length ? "expired" : "none";
    // the pass to show: today's, else the next one
    // what Renew pre-picks: their latest membership (not PT or a day pass)
    const lastPlanId = subs.filter((s) => gymPlan.has(s.plan_id)).sort((a, b) => b.ends_on!.localeCompare(a.ends_on!))[0]?.plan_id ?? null;
    return { ...m, state, endsOn, startsOn: upcoming?.starts_on ?? null, lastEnd, passId: (current ?? upcoming)?.id ?? null, hadPlan: subs.length > 0, lastPlanId };
  });

  // expiring soon: a running plan that ends in the next 7 days
  const matches = (m: (typeof everyone)[number], s: Show) =>
    s === "all" || (s === "expiring" ? m.state === "active" && m.endsOn! <= weekOut : m.state === s);
  // fuzzy search: typos, initials and partial phone numbers still find them; best matches first
  const score = new Map(q ? everyone.map((m) => [m.id, fuzzyScore(q, m.full_name, m.email, m.phone)]) : []);
  const base = everyone.filter(
    (m) =>
      (!q || score.get(m.id) != null) &&
      (!view || m.home_branch_id === view || (!m.home_branch_id && m.role === "member")),
  );
  const counts = Object.fromEntries(FILTERS.map(([k]) => [k, base.filter((m) => matches(m, k)).length])) as Record<Show, number>;
  const byEnd = (m: (typeof everyone)[number]) => m.endsOn ?? m.lastEnd ?? "";
  // best search match first, then the picked order
  const filtered = base
    .filter((m) => matches(m, show))
    .sort((a, b) =>
      q && score.get(a.id) !== score.get(b.id) ? score.get(a.id)! - score.get(b.id)!
      : sort === "name" ? (a.full_name || "").localeCompare(b.full_name || "")
      // plan end date: on Expiring soon the one ending first is on top; elsewhere the latest end date (no plan last)
      // every end date, earliest first: expired, then expiring soon, then the plans ending last (no plan at the bottom)
      : sort === "ending" ? (byEnd(a) || "9999").localeCompare(byEnd(b) || "9999")
      : sort === "ending_late" ? (show === "expiring" ? byEnd(a).localeCompare(byEnd(b)) : byEnd(b).localeCompare(byEnd(a)))
      : b.created_at.localeCompare(a.created_at),
    );

  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const page = Math.min(pages, Math.max(1, Number(str("page")) || 1));
  const rows = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const photos = await photoUrls(rows.map((m) => m.photo_path));

  const params = { show, sort, q: str("q") };
  const href = (over: Partial<typeof params> & { page?: number }) => {
    const all = { ...params, ...over } as Record<string, string | number>;
    const out = Object.entries(all).filter(([k, v]) => v && !(k === "show" && v === "all") && !(k === "sort" && v === "ending_late") && !(k === "page" && v === 1));
    return `/admin/members${out.length ? `?${new URLSearchParams(out.map(([k, v]) => [k, String(v)]))}` : ""}`;
  };
  const branchList = ref.branches.filter((b) => b.active && (!branchId || b.id === branchId)); // staff: just theirs
  const offerList = ref.offers;
  const fee = ref.admissionPaise;

  return (
    <>
      <PageHeader title="Members">
        {isOwner && <a href="/admin/members/export" download className="btn-ghost">Download CSV</a>}
        <AdminModal label="+ New member" title="New member">
          <AddMemberForm branches={branchList} plans={planList} offers={offerList} trainers={trainers} admissionPaise={fee} />
        </AdminModal>
      </PageHeader>

      <Desk owner={isOwner} branches={branchList} plans={planList} offers={offerList} trainers={trainers}>
      <Panel
        title={params.q ? `Results for “${params.q}”` : "Members"}
        intro={`${filtered.length} of ${everyone.length} members`}
        flush
        action={
          <MemberSearch initial={params.q} />
        }
      >
        {/* plan-state tabs (scroll sideways on phones), then the sort order */}
        <div className="flex items-center gap-3 border-b border-line py-3 pr-5">
          <nav aria-label="Filter members" className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pl-5 [scrollbar-width:none]">
            {FILTERS.map(([k, label]) => (
              <Link key={k} href={href({ show: k, page: 1 })} aria-current={show === k ? "page" : undefined}
                className={`min-h-9 shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold ${show === k ? "border-red bg-redwash text-chalk" : "border-line text-ash hover:text-chalk"}`}>
                {label} <span className="tabular-nums opacity-60">{counts[k]}</span>
              </Link>
            ))}
          </nav>
          <SortSelect value={sort} options={SORTS} />
        </div>
        {rows.length ? (
          <ul className="divide-y divide-line">
            {rows.map((m) => {
              const daysLeft = m.endsOn ? Math.round((Date.parse(m.endsOn) - Date.parse(today)) / 864e5) + 1 : 0;
              return (
                // name and phone get the full width; the plan tag and the buttons sit on the line below
                <li key={m.id} className="flex flex-wrap items-center gap-1.5 pr-2 pb-2 transition-colors hover:bg-steel/60 sm:gap-2 sm:pr-5">
                  <Link href={`/admin/members/${m.id}`} className="flex min-w-0 basis-full items-center gap-3 pt-2 pl-3 sm:pl-5">
                    <Avatar src={m.photo_path ? photos.get(m.photo_path) : null} name={m.full_name || "?"} size="size-10" />
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-bold">{m.full_name || "—"}</span>
                        {m.role !== "member" && <span className="shrink-0 rounded bg-steel px-1.5 text-[11px] font-bold tracking-wider text-ash uppercase">{ROLE_LABEL[m.role]}</span>}
                        {!m.photo_path && m.role === "member" && <span className="shrink-0 rounded border border-redline px-1.5 text-[11px] font-bold tracking-wider text-red uppercase">No photo</span>}
                      </span>
                      {m.phone && <span className="block truncate text-sm text-ash">{m.phone}</span>}
                      {m.checkins.length > 0 && (
                        <span className="block text-xs font-bold tracking-wider text-red uppercase">In today: {m.checkins.map((c) => SESSION_LABEL[c.session] ?? c.session).join(" + ")}</span>
                      )}
                    </span>
                  </Link>
                  {/* lined up under the name */}
                  <span className="mr-auto pl-16 sm:pl-[4.5rem]">
                    {m.state === "active" ? (
                      <span className={`inline-block rounded-full border px-3 py-1 text-xs font-bold tracking-wider whitespace-nowrap uppercase ${daysLeft <= 7 ? "border-red text-red" : "border-redline bg-redwash"}`}>
                        {daysLeft <= 7 ? `${daysLeft}d left` : `Till ${m.endsOn}`}
                      </span>
                    ) : (
                      <span className="inline-block rounded-full border border-line px-3 py-1 text-xs font-bold tracking-wider whitespace-nowrap text-ash uppercase">
                        {m.state === "upcoming" ? `From ${m.startsOn}` : m.state === "expired" ? `Ended ${m.lastEnd}` : "No plan"}
                      </span>
                    )}
                  </span>
                  <WhatsAppButton member={m} endsOn={m.endsOn ?? m.lastEnd} expired={m.state === "expired"} />
                  <MemberActions
                    member={m}
                    passId={m.passId}
                    cancelSubId={m.state === "active" ? m.passId : null}
                    admissionPaise={m.hadPlan ? null : fee}
                    lastPlanId={m.lastPlanId}
                    currentEnd={m.lastEnd}
                  />
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>No members match.</Empty>
        )}
        {pages > 1 && (
          <nav aria-label="Pages" className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-sm">
            <span className="text-ash tabular-nums">
              {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length}
            </span>
            <span className="flex gap-2">
              {page > 1 && <Link href={href({ page: page - 1 })} className="btn-ghost min-h-10 px-4">← Prev</Link>}
              {page < pages && <Link href={href({ page: page + 1 })} className="btn-ghost min-h-10 px-4">Next →</Link>}
            </span>
          </nav>
        )}
      </Panel>
      </Desk>
    </>
  );
}
