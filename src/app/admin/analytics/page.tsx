import Link from "next/link";
import { requireAdmin } from "@/lib/supabase";
import { gymDate, inr, planName, prettyDay, TRACKS, waLink, type Track } from "@/lib/gym";
import { BarList, ColumnChart, Heatmap, type Point } from "../charts";
import { Empty, PageHeader, Panel } from "../kit";

export const metadata = { title: "Analytics — Stars Gym admin" };

type Stats = {
  revenue: number;
  sales: number;
  checkins: number;
  visitors: number;
  new_members: number;
  revenue_by_day: { day: string; v: number }[];
  checkins_by_day: { day: string; v: number }[];
  heatmap: { dow: number; h: number; v: number }[];
  by_branch: Point[];
  by_plan: { track: Track; days: number; n: number; v: number }[];
  by_method: { method: string; n: number; v: number }[];
  active_members: number;
  expiring: { sub_id: string; name: string; phone: string | null; track: Track; days: number; ends_on: string }[];
};

const RANGES = { "7d": { days: 7, label: "7 days" }, "30d": { days: 30, label: "30 days" }, "90d": { days: 90, label: "90 days" }, "12m": { days: 365, label: "12 months" } } as const;
type Range = keyof typeof RANGES;
const METHOD: Record<string, string> = { razorpay: "Online (Razorpay)", upi_qr: "UPI at desk", cash: "Cash" };

const shift = (iso: string, days: number) => gymDate(new Date(Date.parse(`${iso}T12:00:00+05:30`) + days * 864e5));
const short = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/** Fill every day/week/month in range (zeros included) so gaps show as gaps. */
function series(daily: { day: string; v: number }[], from: string, to: string, range: Range): Point[] {
  const byDay = new Map(daily.map((d) => [d.day, d.v]));
  const buckets = new Map<string, Point>();
  for (let d = from; d <= to; d = shift(d, 1)) {
    const date = new Date(`${d}T12:00:00`);
    let key = d, label = short(d);
    if (range === "90d") {
      const monday = shift(d, -((date.getDay() + 6) % 7));
      key = monday;
      label = `Wk ${short(monday < from ? from : monday)}`;
    } else if (range === "12m") {
      key = d.slice(0, 7);
      label = date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
    }
    const b = buckets.get(key) ?? { label, v: 0 };
    b.v += byDay.get(d) ?? 0;
    buckets.set(key, b);
  }
  return [...buckets.values()];
}

function Kpi({ label, value, prev, format = "count" }: { label: string; value: number; prev?: number; format?: "inr" | "count" | "decimal" }) {
  const shown = format === "inr" ? inr(value) : format === "decimal" ? value.toFixed(1) : new Intl.NumberFormat("en-IN").format(value);
  const delta = prev === undefined ? null : prev === 0 ? (value > 0 ? 100 : 0) : Math.round(((value - prev) / prev) * 100);
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-line bg-carbon p-5">
      <span className="label">{label}</span>
      <span className="truncate font-display text-[clamp(30px,6vw,44px)] leading-none">{shown}</span>
      {delta !== null && (
        <span className={`text-sm ${delta < 0 ? "text-red" : delta > 0 ? "text-chalk" : "text-ash"}`}>
          {delta > 0 ? "▲" : delta < 0 ? "▼" : "•"} {Math.abs(delta)}% <span className="text-ash">vs previous period</span>
        </span>
      )}
    </div>
  );
}

export default async function AnalyticsPage({ searchParams }: PageProps<"/admin/analytics">) {
  const { supabase } = await requireAdmin();
  const param = (await searchParams).range;
  const range: Range = typeof param === "string" && param in RANGES ? (param as Range) : "30d";
  const days = RANGES[range].days;
  const to = gymDate();
  const from = shift(to, -(days - 1));

  const [cur, prev] = await Promise.all([
    supabase.rpc("admin_analytics", { p_from: from, p_to: to }),
    supabase.rpc("admin_analytics", { p_from: shift(from, -days), p_to: shift(from, -1) }),
  ]);
  if (cur.error) {
    return (
      <>
        <PageHeader title="Analytics" />
        <Panel title="Not set up yet"><p className="text-ash">Run <code className="text-chalk">supabase/migrations/0005_admin_analytics.sql</code> in the Supabase SQL editor, then reload. ({cur.error.message})</p></Panel>
      </>
    );
  }
  const s = cur.data as Stats;
  const p = (prev.data ?? undefined) as Stats | undefined;

  const revenue = series(s.revenue_by_day, from, to, range);
  const checkins = series(s.checkins_by_day, from, to, range);
  const plans = s.by_plan.map((x) => ({ label: planName({ track: x.track, duration_days: x.days }), v: x.v, n: x.n }));
  const methods = s.by_method.map((x) => ({ label: METHOD[x.method] ?? x.method, v: x.v, n: x.n }));

  return (
    <>
      <PageHeader title="Analytics" intro={`${prettyDay(from)} – ${prettyDay(to)}. Compared with the ${RANGES[range].label} before.`} />

      {/* one filter row scopes everything below */}
      <nav aria-label="Date range" className="-mt-2 flex flex-wrap gap-1 self-start rounded-md border border-line bg-panel p-1">
        {(Object.keys(RANGES) as Range[]).map((r) => (
          <Link key={r} href={`/admin/analytics?range=${r}`} aria-current={r === range ? "true" : undefined}
            className={`flex min-h-10 items-center rounded px-4 font-label text-sm font-bold tracking-[0.12em] uppercase ${r === range ? "bg-red text-white" : "text-ash hover:text-chalk"}`}>
            {RANGES[r].label}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Revenue" value={s.revenue} prev={p?.revenue} format="inr" />
        <Kpi label="Plans sold" value={s.sales} prev={p?.sales} />
        <Kpi label="New members" value={s.new_members} prev={p?.new_members} />
        <Kpi label="Check-ins" value={s.checkins} prev={p?.checkins} />
        <Kpi label="Avg check-ins / day" value={s.checkins / days} prev={p ? p.checkins / days : undefined} format="decimal" />
        <Kpi label="Active members now" value={s.active_members} />
      </div>

      <Panel title="Revenue" intro={`Payments collected, by ${range === "12m" ? "month" : range === "90d" ? "week" : "day"}.`}>
        <ColumnChart data={revenue} format="inr" unit="Revenue" />
      </Panel>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Panel title="Check-ins" intro={`${new Intl.NumberFormat("en-IN").format(s.visitors)} different members trained in this period.`}>
          <ColumnChart data={checkins} format="count" unit="Check-ins" />
        </Panel>
        <Panel title="Peak hours" intro="When members check in. Plan staff and cleaning around the dark squares.">
          <Heatmap cells={s.heatmap} />
        </Panel>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <Panel title="Sales by plan">
          <BarList rows={plans} format="inr" unit="revenue" sub={Object.fromEntries(plans.map((x) => [x.label, `· ${x.n} sold`]))} />
        </Panel>
        <Panel title="Payment methods">
          <BarList rows={methods} format="inr" unit="revenue" sub={Object.fromEntries(methods.map((x) => [x.label, `· ${x.n}`]))} />
        </Panel>
        <Panel title="Check-ins by branch">
          <BarList rows={s.by_branch} format="count" unit="check-ins" />
        </Panel>
      </div>

      <Panel title={`Renewals due · ${s.expiring.length}`} intro="Plans ending in the next 7 days with no renewal lined up. A quick WhatsApp keeps them training." flush>
        {s.expiring.length ? (
          <ul className="divide-y divide-line">
            {s.expiring.map((m) => (
              <li key={m.sub_id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <span className="min-w-0">
                  <span className="block font-bold">{m.name || "Member"}</span>
                  <span className="text-sm text-ash">{TRACKS[m.track]} · ends {prettyDay(m.ends_on)}</span>
                </span>
                <span className="flex gap-2">
                  {m.phone && (
                    <a href={waLink(m.phone.length === 10 ? `91${m.phone}` : m.phone, `Hi ${m.name.split(" ")[0]}! Your Stars Gym plan ends on ${prettyDay(m.ends_on)}. Renew at the desk or online to keep your streak going.`)}
                      target="_blank" rel="noreferrer" className="btn-red min-h-10 px-4 text-xs">WhatsApp</a>
                  )}
                  <Link href={`/pass/${m.sub_id}`} className="btn-ghost min-h-10 px-4 text-xs">Pass</Link>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No plans ending this week without a renewal.</Empty>
        )}
      </Panel>
    </>
  );
}
