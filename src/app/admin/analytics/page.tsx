import Link from "next/link";
import { requireAdmin } from "@/lib/supabase";
import { GENDERS, gymDate, inr, planName, prettyDay, waLink, type Track } from "@/lib/gym";
import { BarList, ColumnChart, Heatmap, type Point } from "../charts";
import { Empty, PageHeader, Panel, waNumber } from "../kit";

export const metadata = { title: "Analytics — Stars Gym admin" };

type Series = { day: string; v: number }[];
type Insights = {
  revenue: number; sales: number; new_members: number; checkins: number; visitors: number; active_members: number;
  ended: number; renewed: number;
  revenue_by_day: Series; checkins_by_day: Series;
  heatmap: { dow: number; h: number; v: number }[];
  by_plan: { track: Track; days: number; n: number; v: number }[];
  by_method: { method: string; n: number; v: number }[];
  by_branch: { name: string; revenue: number; checkins: number }[];
  gender: { k: string; n: number }[];
  ages: { k: string; n: number }[];
  quiet: { id: string; name: string; phone: string | null; last: string | null }[];
};

const RANGES = { "7d": { days: 7, label: "7 days" }, "30d": { days: 30, label: "30 days" }, "90d": { days: 90, label: "90 days" }, "12m": { days: 365, label: "12 months" } } as const;
type Range = keyof typeof RANGES;
const METHOD: Record<string, string> = { razorpay: "Online", upi_qr: "UPI at desk", cash: "Cash" };
const AGE_ORDER = ["Under 18", "18–24", "25–34", "35–44", "45+", "~ Not given"];

const shift = (iso: string, days: number) => gymDate(new Date(Date.parse(`${iso}T12:00:00+05:30`) + days * 864e5));
const short = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const num = (n: number) => new Intl.NumberFormat("en-IN").format(n);

/** Every day/week/month in range, zeros included, so gaps show as gaps. */
function series(daily: Series, from: string, to: string, range: Range): Point[] {
  const byDay = new Map(daily.map((d) => [d.day, d.v]));
  const buckets = new Map<string, Point>();
  for (let d = from; d <= to; d = shift(d, 1)) {
    const date = new Date(`${d}T12:00:00`);
    let key = d, label = short(d);
    if (range === "90d") {
      key = shift(d, -((date.getDay() + 6) % 7));
      label = `Wk ${short(key < from ? from : key)}`;
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

/** A headline number with its change against the period before. */
function Kpi({ label, value, now, before, hint }: { label: string; value: string; now?: number; before?: number; hint?: string }) {
  const delta = now === undefined || before === undefined ? null : before === 0 ? (now > 0 ? 100 : 0) : Math.round(((now - before) / before) * 100);
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-line bg-carbon p-4 sm:p-5">
      <span className="label">{label}</span>
      <span className="truncate font-display text-[clamp(26px,7vw,40px)] leading-none lg:text-[clamp(26px,2.4vw,40px)]">{value}</span>
      {delta !== null ? (
        <span className={`text-xs ${delta < 0 ? "text-red" : delta > 0 ? "text-chalk" : "text-ash"}`}>
          {delta > 0 ? "▲" : delta < 0 ? "▼" : "•"} {Math.abs(delta)}% <span className="text-ash">vs before</span>
        </span>
      ) : hint ? <span className="truncate text-xs text-ash">{hint}</span> : null}
    </div>
  );
}

export default async function AnalyticsPage({ searchParams }: PageProps<"/admin/analytics">) {
  const { supabase, view } = await requireAdmin();
  const param = (await searchParams).range;
  const range: Range = typeof param === "string" && param in RANGES ? (param as Range) : "30d";
  const days = RANGES[range].days;
  const to = gymDate();
  const from = shift(to, -(days - 1));

  const [cur, prev, branch] = await Promise.all([
    supabase.rpc("admin_insights", { p_from: from, p_to: to, p_branch: view }),
    supabase.rpc("admin_insights", { p_from: shift(from, -days), p_to: shift(from, -1), p_branch: view }),
    view ? supabase.from("branches").select("name").eq("id", view).maybeSingle() : null,
  ]);
  if (cur.error) {
    return (
      <>
        <PageHeader title="Analytics" />
        <Panel title="One step left"><p className="text-ash">Run <code className="text-chalk">supabase/migrations/0014_team_insights.sql</code> in the Supabase SQL editor, then reload. ({cur.error.message})</p></Panel>
      </>
    );
  }
  const s = cur.data as Insights;
  const p = (prev.data ?? undefined) as Insights | undefined;
  const where = branch?.data?.name ?? "Both branches";
  const rate = (x?: Insights) => (x && x.ended ? Math.round((x.renewed / x.ended) * 100) : undefined);
  const per = range === "12m" ? "month" : range === "90d" ? "week" : "day";

  const plans = s.by_plan.map((x) => ({ label: planName({ track: x.track, duration_days: x.days }), v: x.v, n: x.n }));
  const methods = s.by_method.map((x) => ({ label: METHOD[x.method] ?? x.method, v: x.v, n: x.n }));
  const genders = s.gender.map((g) => ({ label: GENDERS.find(([k]) => k === g.k)?.[1] ?? "Not given", v: g.n }));
  const ages = [...s.ages].sort((a, b) => AGE_ORDER.indexOf(a.k) - AGE_ORDER.indexOf(b.k)).map((a) => ({ label: a.k.replace("~ ", ""), v: a.n }));

  return (
    <>
      <PageHeader title="Analytics" intro={`${where} · ${prettyDay(from)} – ${prettyDay(to)}`} />

      {/* one control scopes the page; it scrolls sideways on narrow phones */}
      <nav aria-label="Period" className="-mt-2 flex gap-1 self-start overflow-x-auto rounded-full border border-line bg-panel p-1 [scrollbar-width:none] max-sm:self-stretch">
        {(Object.keys(RANGES) as Range[]).map((r) => (
          <Link key={r} href={`/admin/analytics?range=${r}`} aria-current={r === range ? "page" : undefined} scroll={false}
            className={`flex min-h-10 flex-1 shrink-0 items-center justify-center rounded-full px-4 text-sm font-bold whitespace-nowrap ${r === range ? "bg-red text-white" : "text-ash hover:text-chalk"}`}>
            {RANGES[r].label}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Revenue" value={inr(s.revenue)} now={s.revenue} before={p?.revenue} />
        <Kpi label="Plans sold" value={num(s.sales)} now={s.sales} before={p?.sales} />
        <Kpi label="New members" value={num(s.new_members)} now={s.new_members} before={p?.new_members} />
        <Kpi label="Active now" value={num(s.active_members)} hint="hold a plan today" />
        <Kpi label="Check-ins" value={num(s.checkins)} now={s.checkins} before={p?.checkins} />
        <Kpi label="Visits a day" value={(s.checkins / days).toFixed(1)} hint={`${num(s.visitors)} members trained`} />
        <Kpi label="Renewal rate" value={rate(s) === undefined ? "—" : `${rate(s)}%`} now={rate(s)} before={rate(p)} hint="no plans ended yet" />
        <Kpi label="Average sale" value={s.sales ? inr(Math.round(s.revenue / s.sales)) : "—"} hint="per plan sold" />
      </div>

      <Panel title="Revenue" intro={`Collected per ${per}.`}>
        <ColumnChart data={series(s.revenue_by_day, from, to, range)} format="inr" unit="revenue" />
      </Panel>

      <Panel title={`Gone quiet · ${s.quiet.length}`} intro="Have a plan but haven't trained in 10+ days. A quick message brings most of them back." flush>
        {s.quiet.length ? (
          <ul className="divide-y divide-line">
            {s.quiet.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <Link href={`/admin/members/${m.id}`} className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{m.name || "Member"}</span>
                  <span className="block truncate text-sm text-ash">{m.last ? `Last in ${prettyDay(m.last)}` : "Not checked in yet"}</span>
                </Link>
                {m.phone && (
                  <a href={waLink(waNumber(m.phone), `Hi ${(m.name || "there").split(" ")[0]}! We've missed you at Stars Gym — see you on the floor this week?`)}
                    target="_blank" rel="noreferrer" className="btn-ghost min-h-10 shrink-0 px-4 text-xs">WhatsApp</a>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Everyone with a plan has trained in the last 10 days.</Empty>
        )}
      </Panel>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Panel title="Check-ins" intro={`Visits per ${per}.`}>
          <ColumnChart data={series(s.checkins_by_day, from, to, range)} format="count" unit="check-ins" />
        </Panel>
        <Panel title="Peak hours" intro="When members check in. Staff the dark squares.">
          <Heatmap cells={s.heatmap} />
        </Panel>
      </div>

      {!view && s.by_branch.length > 1 && (
        <div className="grid items-start gap-6 md:grid-cols-2">
          <Panel title="Revenue by branch">
            <BarList rows={s.by_branch.map((b) => ({ label: b.name, v: b.revenue }))} format="inr" unit="revenue" />
          </Panel>
          <Panel title="Check-ins by branch">
            <BarList rows={s.by_branch.map((b) => ({ label: b.name, v: b.checkins }))} format="count" unit="check-ins" />
          </Panel>
        </div>
      )}

      <div className="grid items-start gap-6 md:grid-cols-2">
        <Panel title="Plans sold">
          <BarList rows={plans} format="inr" unit="revenue" sub={Object.fromEntries(plans.map((x) => [x.label, `· ${x.n}`]))} />
        </Panel>
        <Panel title="Paid by">
          <BarList rows={methods} format="inr" unit="revenue" sub={Object.fromEntries(methods.map((x) => [x.label, `· ${x.n}`]))} />
        </Panel>
        <Panel title="Members by age" intro="Everyone holding a plan today.">
          <BarList rows={ages} format="count" unit="members" />
        </Panel>
        <Panel title="Members by gender" intro="Everyone holding a plan today.">
          <BarList rows={genders} format="count" unit="members" />
        </Panel>
      </div>
    </>
  );
}
