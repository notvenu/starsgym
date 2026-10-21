import Link from "next/link";
import { requireUser } from "@/lib/supabase";
import { gymDate } from "@/lib/gym";
import { BODY_FIELDS, bodySeries, type BodyLog } from "@/lib/body";
import { lifts, volume, weeklyVolume, type Log } from "@/lib/workouts";
import { ColumnChart } from "../../admin/charts";
import { TrendChart } from "../workouts/charts";
import { Icon, ICONS, PageHead, Stat } from "../kit";
import { LiftTrend } from "./ui";

export const metadata = { title: "Insights — Stars Gym" };

const num = (v: number) => v.toLocaleString("en-IN", { maximumFractionDigits: 1 });
const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${num(Math.abs(v))}`;
const shortDay = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/** A faded stand-in for a chart that needs more data: what it will show, and what unlocks it. */
function Ghost({ title, need, bars }: { title: string; need: string; bars?: boolean }) {
  return (
    <div className="card flex flex-col gap-3 p-5">
      <p className="label">{title}</p>
      <div className="relative h-28 opacity-40" aria-hidden="true">
        {bars ? (
          <div className="flex h-full items-end gap-1.5">{[30, 45, 40, 60, 55, 70, 65, 85].map((h, i) => <div key={i} className="flex-1 rounded-t-sm bg-strong" style={{ height: `${h}%` }} />)}</div>
        ) : (
          <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="size-full"><path d="M0,32 L14,28 L28,30 L42,22 L57,20 L71,14 L85,12 L100,6" fill="none" stroke="var(--color-strong)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeDasharray="5 4" /></svg>
        )}
      </div>
      <p className="text-sm text-ash">{need}</p>
    </div>
  );
}

/** Body weight, measurements and strength — nothing else. */
export default async function InsightsPage() {
  const { supabase } = await requireUser();
  const today = gymDate();
  const [body, work] = await Promise.all([
    supabase.from("body_logs").select("*").order("day").limit(1000),
    supabase.from("workout_logs").select("day,title,exercises,note").order("day").limit(1000),
  ]);
  if (body.error || work.error) return <div className="wrap pt-6"><p className="card p-6 text-ash">Insights aren&apos;t set up yet.</p></div>;
  const bodyLogs = (body.data ?? []) as BodyLog[];
  const logs = (work.data ?? []) as Log[];

  const weight = bodySeries(bodyLogs, "weight_kg");
  const measures = BODY_FIELDS.filter((f) => f.key !== "weight_kg").map((f) => ({ ...f, points: bodySeries(bodyLogs, f.key) })).filter((f) => f.points.length);
  const month = new Date(Date.parse(today) - 29 * 864e5).toISOString().slice(0, 10);
  const recent = logs.filter((l) => l.day >= month);
  const all = lifts(logs);
  const prs = all.filter((l) => l.best.day >= month && l.sessions > 1).length;
  const weeks = weeklyVolume(logs, today);
  const steps = [
    { done: weight.length > 0, label: "Log your weight", href: "/dashboard/body" },
    { done: logs.length > 0, label: "Finish your first workout", href: "/dashboard" },
    { done: logs.length > 1 || weight.length > 1, label: "Come back for a second — that's when trends start", href: "/dashboard" },
  ];
  const started = steps.some((s) => s.done);

  return (
    <div className="wrap flex flex-col gap-8 pt-6">
      <PageHead title="Insights" sub="Your body and your strength, over time." />

      {!steps.every((s) => s.done) && (
        <section className="card flex flex-col gap-4 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-lg font-bold">{started ? "Almost there" : "Get your insights going"}</p>
            <p className="text-sm text-ash tabular-nums">{steps.filter((s) => s.done).length}/{steps.length}</p>
          </div>
          <ol className="flex flex-col gap-2">
            {steps.map((s, i) => (
              <li key={s.label}>
                <Link href={s.href} className={`flex items-center gap-3 rounded-md border px-4 py-3 ${s.done ? "border-line text-ash" : "border-strong hover:border-red"}`}>
                  <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${s.done ? "bg-red text-white" : "border border-strong text-ash"}`}>
                    {s.done ? <Icon d={ICONS.check} size={15} /> : i + 1}
                  </span>
                  <span className={`flex-1 ${s.done ? "line-through decoration-faint" : "font-bold"}`}>{s.label}</span>
                  {!s.done && <span aria-hidden="true" className="text-red">→</span>}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* --- strength --- */}
      <section className="flex flex-col gap-4">
        <h2 className="label">Strength</h2>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Workouts" value={String(recent.length)} sub="last 30 days" muted={!recent.length} />
          <Stat label="Lifted" value={num(Math.round(recent.reduce((t, l) => t + volume(l), 0) / 100) / 10)} unit="t" sub="last 30 days" muted={!recent.length} />
          <Stat label="New bests" value={String(prs)} sub="last 30 days" muted={!prs} />
        </div>
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {all.length ? <LiftTrend lifts={all.slice(0, 8).map((l) => ({ name: l.name, points: l.points }))} /> : <Ghost title="Estimated 1RM" need="Shows how strong you're getting on each lift — log a workout with weights." />}
          {logs.length ? (
            <div className="card flex flex-col gap-3 p-5">
              <p className="label">Weekly volume · kg lifted</p>
              <ColumnChart data={weeks.map((w) => ({ label: shortDay(w.week), v: w.v }))} format="count" unit="kg" />
            </div>
          ) : <Ghost title="Weekly volume" need="Total kg you lift each week, for the last 12 weeks." bars />}
        </div>
        {all.length > 0 && (
          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="label px-5 pt-4 pb-2 text-left">Best lifts</caption>
              <thead className="text-xs tracking-wider text-ash uppercase">
                <tr><th className="px-5 py-2 font-bold">Exercise</th><th className="px-3 py-2 text-right font-bold">Best set</th><th className="px-3 py-2 text-right font-bold">Est. 1RM</th><th className="px-5 py-2 text-right font-bold">Since start</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {all.map((l) => (
                  <tr key={l.name}>
                    <td className="px-5 py-2.5"><span className="font-bold">{l.name}</span><span className="block text-xs text-ash">{shortDay(l.best.day)}</span></td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{num(l.best.kg)} × {l.best.reps}</td>
                    <td className="px-3 py-2.5 text-right font-bold tabular-nums">{num(l.best.e1rm)} kg</td>
                    <td className="px-5 py-2.5 text-right text-ash tabular-nums">{l.sessions > 1 ? `${signed(Math.round(((l.best.e1rm - l.first) / l.first) * 100))}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-5 pb-4 text-xs text-ash">Est. 1RM: the most you could lift once, worked out from your sets of 1–12 reps.</p>
          </div>
        )}
      </section>

      {/* --- body --- */}
      <section className="flex flex-col gap-4">
        <h2 className="label">Body</h2>
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {weight.length > 1 ? (
            <div className="card flex flex-col gap-4 p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="label">Body weight</p>
                  <p className="font-display text-5xl leading-none tabular-nums">{num(weight.at(-1)!.v)} <span className="text-2xl text-ash">kg</span></p>
                </div>
                <p className="text-sm text-ash"><b className="text-chalk tabular-nums">{signed(weight.at(-1)!.v - weight[0].v)} kg</b> since {shortDay(weight[0].day)}</p>
              </div>
              <TrendChart points={weight} unit="kg" label="Body weight" />
            </div>
          ) : (
            <Ghost title="Body weight" need={weight.length ? `${num(weight[0].v)} kg logged — one more entry and the trend appears.` : "Your weight over time — log it on the Body tab."} />
          )}
          {measures.length ? (
            <div className="card divide-y divide-line">
              {measures.map((m) => (
                <details key={m.key} className="group px-5 py-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                    <span className="font-bold">{m.label}</span>
                    <span className="flex items-center gap-3 text-sm tabular-nums">
                      {m.points.length > 1 && <span className="text-ash">{signed(m.points.at(-1)!.v - m.points[0].v)} {m.unit}</span>}
                      <span className="font-bold">{num(m.points.at(-1)!.v)} {m.unit}</span>
                      <span aria-hidden="true" className="text-ash transition-transform group-open:rotate-180">⌄</span>
                    </span>
                  </summary>
                  <div className="pt-3">
                    {m.points.length > 1 ? <TrendChart points={m.points} unit={m.unit} label={m.label} height={120} /> : <p className="text-sm text-ash">One entry so far — add another to see the trend.</p>}
                  </div>
                </details>
              ))}
            </div>
          ) : (
            <Ghost title="Measurements" need="Waist, chest, arms and more — add them under More measurements on the Body tab." />
          )}
        </div>
      </section>
    </div>
  );
}
