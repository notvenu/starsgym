import Link from "next/link";
import { requireAdmin } from "@/lib/supabase";
import { gymDate, gymDateIn, inr, prettyDay } from "@/lib/gym";
import { daySummary } from "../data";
import { PageHeader, Panel } from "../kit";

export const metadata = { title: "Daily summary — Stars Gym admin" };

/** Owner only: one gym day at a glance (yesterday by default). */
export default async function SummaryPage({ searchParams }: PageProps<"/admin/summary">) {
  const { supabase } = await requireAdmin();
  const asked = (await searchParams).day;
  const today = gymDate();
  const day = typeof asked === "string" && /^\d{4}-\d{2}-\d{2}$/.test(asked) && asked <= today ? asked : gymDateIn(-1);
  const s = await daySummary(supabase, day);
  const quick: [string, string][] = [[gymDateIn(-1), "Yesterday"], [today, "Today so far"]];

  const stats: [string, string, string?][] = [
    ["Collected", inr(s.collected), `${s.sales} sale${s.sales === 1 ? "" : "s"}`],
    ["Cash", inr(s.cash)],
    ["UPI + online", inr(s.upi + s.online), s.online ? `${inr(s.online)} online` : undefined],
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

      {s.approvals > 0 && (
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

      {s.byBranch.length > 1 && (
        <Panel title="By branch" flush>
          <ul className="divide-y divide-line">
            {s.byBranch.map((b) => (
              <li key={b.name} className="flex items-baseline justify-between gap-4 px-5 py-3">
                <span className="font-bold">{b.name}</span>
                <span className="text-sm text-ash tabular-nums">{b.checkins} check-ins · {inr(b.collected)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <p className="text-sm text-ash">
        Who did what that day: <Link href="/admin/log" className="font-bold text-red hover:text-chalk">Staff log →</Link> · Trends over weeks and months: <Link href="/admin/analytics" className="font-bold text-red hover:text-chalk">Analytics →</Link>
      </p>
    </>
  );
}
