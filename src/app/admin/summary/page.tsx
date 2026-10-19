import Link from "next/link";
import { requireStaff } from "@/lib/supabase";
import { gymDate, gymDateIn, inr, prettyDay } from "@/lib/gym";
import { daySummary } from "../data";
import { PageHeader, Panel } from "../kit";

export const metadata = { title: "Daily summary — Stars Gym admin" };

/** One gym day at a glance (today by default). Staff see the same day without the money (their branch, by RLS). */
export default async function SummaryPage({ searchParams }: PageProps<"/admin/summary">) {
  const { supabase, isOwner } = await requireStaff();
  const asked = (await searchParams).day;
  const today = gymDate();
  const day = typeof asked === "string" && /^\d{4}-\d{2}-\d{2}$/.test(asked) && asked <= today ? asked : today;
  const s = await daySummary(supabase, day);
  const quick: [string, string][] = [[today, "Today so far"], [gymDateIn(-1), "Yesterday"]];

  const stats: [string, string, string?][] = [
    ...(isOwner ? [
      ["Collected", inr(s.collected), `${s.sales} sale${s.sales === 1 ? "" : "s"}`],
      ["Cash", inr(s.cash)],
      ["UPI + online", inr(s.upi + s.online), s.online ? `${inr(s.online)} online` : undefined],
    ] as [string, string, string?][] : [["Plans sold", String(s.sales)] as [string, string]]),
    ["Renewed", String(s.renewed), s.sales ? `${s.sales - s.renewed} first-time` : undefined],
    ["Check-ins", String(s.checkins)],
    ["New members", String(s.newMembers)],
    ["Ran out, not renewed", String(s.ended)],
    ["Ending in the next 7 days", String(s.expiringWeek)],
    ["Staff actions", String(s.staffActions)],
  ];

  return (
    <>
      <PageHeader title="Daily summary" intro={`${prettyDay(day)}${day === today ? " · so far" : ""}`}>
        {quick.map(([d, label]) => (
          <Link key={d} href={`/admin/summary?day=${d}`} className={d === day ? "btn-red" : "btn-ghost"}>{label}</Link>
        ))}
        <form className="flex items-center gap-2">
          <input type="date" name="day" defaultValue={day} max={today} aria-label="Pick a day" className="field min-h-11" />
          <button className="btn-ghost">Show</button>
        </form>
      </PageHeader>

      {isOwner && s.approvals > 0 && (
        <Link href="/admin/payments" className="self-start rounded-full border border-red bg-redwash px-4 py-2 text-sm font-bold text-chalk hover:bg-red">
          {s.approvals} discount request{s.approvals === 1 ? "" : "s"} waiting for you →
        </Link>
      )}

      <Panel title="At a glance">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
          {stats.map(([label, value, sub]) => (
            <div key={label}>
              <dt className="label">{label}</dt>
              <dd className="font-display text-3xl leading-tight">{value}</dd>
              {sub && <dd className="text-xs text-ash">{sub}</dd>}
            </div>
          ))}
        </dl>
      </Panel>

      {/* who bought what that day — tap a group to see the names */}
      {s.people.length > 0 && (
        <Panel title="Who joined and renewed" intro="Tap a group to see the people." flush>
          <div className="divide-y divide-line">
            {([["new", "New joiners", "First membership"], ["renewal", "Renewals", "Had a plan before"], ["pass", "Day passes & trials", "One-day visits"]] as const).map(([kind, label, sub]) => {
              const list = s.people.filter((x) => x.kind === kind);
              if (!list.length) return null;
              return (
                <details key={kind} className="group">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 hover:bg-steel/60 [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0"><span className="block font-bold">{label} · {list.length}</span><span className="block text-xs text-ash">{sub}</span></span>
                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="shrink-0 text-ash transition-transform group-open:rotate-180"><path d="M6 9l6 6 6-6" /></svg>
                  </summary>
                  <ul className="divide-y divide-line border-t border-line bg-panel">
                    {list.map((x) => (
                      <li key={x.id}>
                        <Link href={`/admin/members/${x.userId}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-steel/60">
                          <span className="min-w-0"><span className="block truncate font-semibold">{x.name}</span><span className="block truncate text-xs text-ash">{[x.plan, s.byBranch.length > 1 && x.branch].filter(Boolean).join(" · ")}</span></span>
                          {isOwner && <span className="shrink-0 text-sm tabular-nums text-ash">{inr(x.amount)}</span>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </details>
              );
            })}
          </div>
        </Panel>
      )}

      {s.byBranch.length > 1 && (
        <Panel title="By branch" intro="Tap a branch for its detail." flush>
          <div className="divide-y divide-line">
            {s.byBranch.map((b) => {
              const rows: [string, string][] = [
                ["Check-ins", String(b.checkins)],
                ["Plans sold", String(b.sales)],
                ["Renewed", String(b.renewed)],
                ["New members", String(b.newMembers)],
                ["Ran out, not renewed", String(b.ended)],
                ["Ending in the next 7 days", String(b.expiringWeek)],
                ...(isOwner ? [["Collected", inr(b.collected)], ["Cash", inr(b.cash)], ["UPI", inr(b.upi)], ...(b.online ? [["Online", inr(b.online)] as [string, string]] : [])] as [string, string][] : []),
              ];
              return (
                <details key={b.name} className="group">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 hover:bg-steel/60 [&::-webkit-details-marker]:hidden">
                    <span className="font-bold">{b.name}</span>
                    <span className="flex items-center gap-3 text-sm text-ash tabular-nums">
                      {b.checkins} check-ins{isOwner && ` · ${inr(b.collected)}`}
                      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="shrink-0 transition-transform group-open:rotate-180"><path d="M6 9l6 6 6-6" /></svg>
                    </span>
                  </summary>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line bg-panel px-5 py-4 sm:grid-cols-3">
                    {rows.map(([label, value]) => (
                      <div key={label} className="min-w-0">
                        <dt className="label">{label}</dt>
                        <dd className="font-display text-2xl leading-tight">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              );
            })}
          </div>
        </Panel>
      )}

      {isOwner && <p className="text-sm text-ash">
        Who did what that day: <Link href="/admin/log" className="font-bold text-red hover:text-chalk">Staff log →</Link> · Trends over weeks and months: <Link href="/admin/analytics" className="font-bold text-red hover:text-chalk">Analytics →</Link>
      </p>}
    </>
  );
}
