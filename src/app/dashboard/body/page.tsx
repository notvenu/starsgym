import { requireUser } from "@/lib/supabase";
import { gymDate } from "@/lib/gym";
import { BODY_FIELDS, bodySeries, type BodyLog } from "@/lib/body";
import { TrendChart } from "../workouts/charts";
import { Empty, ICONS, PageHead, Stat } from "../kit";
import { BodyForm, BodyHistory } from "./ui";

export const metadata = { title: "Body — Stars Gym" };

const num = (v: number) => v.toLocaleString("en-IN", { maximumFractionDigits: 1 });
const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${num(Math.abs(v))}`;

/** Log body weight and measurements; latest numbers and the weight trend beside the form. */
export default async function BodyPage() {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("body_logs").select("*").order("day", { ascending: false }).limit(365);
  if (error) return <div className="wrap pt-6"><p className="card p-6 text-ash">Body tracking isn&apos;t set up yet.</p></div>;
  const logs = (data ?? []) as BodyLog[];
  const series = BODY_FIELDS.map((f) => ({ ...f, points: bodySeries(logs, f.key) }));
  const weight = series[0].points;
  // weight always; the other measurements once they've been taken
  const tiles = series.filter((f) => f.key === "weight_kg" || f.points.length);

  return (
    <div className="wrap flex flex-col gap-6 pt-6">
      <PageHead title="Body" sub="Weight and measurements — one entry a day, whatever you measured." />
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_1.15fr]">
        <BodyForm logs={logs} today={gymDate()} />
        <div className="flex flex-col gap-4">
          {logs.length === 0 ? (
            <Empty icon={ICONS.scale} title="Start with your weight"
              body="Log it today, then once a week. Add measurements whenever you take them — the Insights tab charts every one."
              tips={["Weigh in the morning, before food or water", "Same scale, same spot, every time", "Measure your waist at the belly button, relaxed"]} />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {tiles.map((f) => {
                  const p = f.points;
                  return p.length ? (
                    <Stat key={f.key} label={f.label} value={num(p.at(-1)!.v)} unit={f.unit}
                      sub={p.length > 1 ? `${signed(p.at(-1)!.v - p[0].v)} ${f.unit} since first` : "first entry"} />
                  ) : (
                    <Stat key={f.key} label={f.label} value="—" muted sub="not logged yet" />
                  );
                })}
              </div>
              {weight.length > 1 && (
                <div className="card flex flex-col gap-3 p-5">
                  <p className="label">Weight trend</p>
                  <TrendChart points={weight} unit="kg" label="Body weight" height={140} />
                </div>
              )}
              <BodyHistory logs={logs} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
