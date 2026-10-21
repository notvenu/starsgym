import type { db } from "@/lib/supabase";
import { cleanPlan, type Log, type Plan } from "@/lib/workouts";

type Db = Awaited<ReturnType<typeof db>>;

/** Their split and recent workouts; null before the workouts migration has run. */
export async function loadWorkouts(supabase: Db) {
  const [plan, logs] = await Promise.all([
    supabase.from("workout_plans").select("id,name,days,started_on").maybeSingle(),
    supabase.from("workout_logs").select("id,day,title,exercises,note").order("day", { ascending: false }).order("created_at", { ascending: false }).limit(200),
  ]);
  return plan.error ? null : { plan: plan.data as Plan | null, logs: (logs.data ?? []) as Log[] };
}

/** A plan someone shared: it travels in the link (see planLink), cleaned like anything typed in. */
export function sharedPlan(param: unknown): Plan | null {
  if (typeof param !== "string") return null;
  try {
    const p = cleanPlan(JSON.parse(param));
    return "error" in p ? null : p;
  } catch {
    return null;
  }
}
