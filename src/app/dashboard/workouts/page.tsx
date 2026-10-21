import { requireUser } from "@/lib/supabase";
import { gymDate } from "@/lib/gym";
import { volume } from "@/lib/workouts";
import { ICONS, Jump, PageHead } from "../kit";
import { loadWorkouts, sharedPlan } from "./section";
import { Workouts } from "./ui";

export const metadata = { title: "Workouts — Stars Gym" };

/** Today's workout, history, plan editing, switching splits, sharing and export; this week and shortcuts beside it. */
export default async function WorkoutsPage({ searchParams }: PageProps<"/dashboard/workouts">) {
  const sp = await searchParams;
  const { supabase, user, profile } = await requireUser(sp.plan ? `/dashboard/workouts?plan=${encodeURIComponent(String(sp.plan))}` : undefined);
  const today = gymDate();
  const [data, checkin] = await Promise.all([
    loadWorkouts(supabase),
    supabase.from("checkins").select("day").eq("user_id", user.id).eq("day", today).limit(1).maybeSingle(),
  ]);
  if (!data) return <div className="wrap pt-6"><p className="card p-6 text-ash">Workouts aren&apos;t set up yet.</p></div>;

  // Monday → Sunday of this week
  const offset = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  const week = Array.from({ length: 7 }, (_, i) => new Date(Date.parse(`${today}T00:00:00Z`) + (i - offset) * 864e5).toISOString().slice(0, 10));
  const thisWeek = data.logs.filter((l) => l.day >= week[0]);
  const tonnes = Math.round(thisWeek.reduce((t, l) => t + volume(l), 0) / 100) / 10;

  return (
    <div className="wrap flex flex-col gap-6 pt-6">
      <PageHead title="Workouts" sub={data.plan ? `On ${data.plan.name} · ${data.logs.length} workout${data.logs.length === 1 ? "" : "s"} logged` : "Pick a split, then log each session as you train."} />
      <div className="grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Workouts plan={data.plan} level={profile.experience ?? null} logs={data.logs} today={today} checkedIn={!!checkin.data} shared={sharedPlan(sp.plan)} />
        <aside className="flex flex-col gap-4">
          <section className="card flex flex-col gap-4 p-5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="label">This week</p>
              <p className="text-sm text-ash tabular-nums">{thisWeek.length} workout{thisWeek.length === 1 ? "" : "s"}{tonnes ? ` · ${tonnes} t` : ""}</p>
            </div>
            <ol className="grid grid-cols-7 gap-1.5">
              {week.map((d) => {
                const done = data.logs.some((l) => l.day === d);
                return (
                  <li key={d} className="flex flex-col items-center gap-1.5">
                    <span className={`flex aspect-square w-full max-w-10 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-red text-white" : d === today ? "border-2 border-dashed border-red text-chalk" : "border border-strong text-faint"}`}>
                      {new Date(`${d}T12:00:00`).getDate()}
                    </span>
                    <span className="font-label text-xs font-bold text-ash">{"MTWTFSS"[week.indexOf(d)]}</span>
                  </li>
                );
              })}
            </ol>
          </section>
          <Jump href="/dashboard/body" icon={ICONS.scale} title="Log your weight" sub="Weight and measurements" />
          <Jump href="/dashboard/photos" icon={ICONS.camera} title="Progress photo" sub="Private — or post it to the Streak Wall" />
          <Jump href="/dashboard/insights" icon={ICONS.chart} title="Insights" sub="Strength and body trends" />
        </aside>
      </div>
    </div>
  );
}
