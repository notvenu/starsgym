"use server";

import { revalidatePath } from "next/cache";
import { requireUser, UUID } from "@/lib/supabase";
import { gymDate } from "@/lib/gym";
import { cleanLog, cleanPlan } from "@/lib/workouts";
import { cleanBody } from "@/lib/body";

export type Result = { error?: string; ok?: string } | undefined;

/** Their split: an edit (id), or a new one (no id) that replaces whatever they had. A new split's progression counts from
 *  today; `restart` resets that clock on an edit. */
export async function savePlan(input: unknown, id?: string, restart = false): Promise<Result> {
  const { supabase, user } = await requireUser();
  const plan = cleanPlan(input);
  if ("error" in plan) return plan;
  const { error } = id
    ? UUID.test(id)
      ? await supabase.from("workout_plans").update({ ...plan, ...(restart && { started_on: gymDate() }) }).eq("id", id).eq("user_id", user.id)
      : { error: { message: "Plan not found." } }
    : await supabase.from("workout_plans").upsert({ ...plan, user_id: user.id, started_on: gymDate() }, { onConflict: "user_id" });
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  revalidatePath("/dashboard", "layout");
  return { ok: "Plan saved" };
}

export async function deletePlan(id: string): Promise<Result> {
  const { supabase, user } = await requireUser();
  if (!UUID.test(id)) return { error: "Plan not found." };
  const { error } = await supabase.from("workout_plans").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  revalidatePath("/dashboard", "layout");
  return { ok: "Plan deleted" };
}

export async function saveLog(input: unknown, id?: string): Promise<Result> {
  const { supabase, user } = await requireUser();
  const log = cleanLog(input);
  if ("error" in log) return log;
  if (log.day > gymDate()) return { error: "That date hasn't happened yet." };
  const { error } = id
    ? UUID.test(id)
      ? await supabase.from("workout_logs").update(log).eq("id", id).eq("user_id", user.id)
      : { error: { message: "Workout not found." } }
    : await supabase.from("workout_logs").insert({ ...log, user_id: user.id });
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  revalidatePath("/dashboard", "layout");
  return { ok: "Workout saved" };
}

export async function deleteLog(id: string): Promise<Result> {
  const { supabase, user } = await requireUser();
  if (!UUID.test(id)) return { error: "Workout not found." };
  const { error } = await supabase.from("workout_logs").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  revalidatePath("/dashboard", "layout");
  return { ok: "Workout deleted" };
}

/** Body weight / measurements for a day; saving the same day again replaces it. */
export async function saveBody(_: Result, form: FormData): Promise<Result> {
  const { supabase, user } = await requireUser();
  const row = cleanBody((k) => form.get(k), gymDate());
  if ("error" in row) return row;
  const { error } = await supabase.from("body_logs").upsert({ ...row, user_id: user.id }, { onConflict: "user_id,day" });
  if (error) return { error: error.message };
  revalidatePath("/dashboard", "layout");
  return { ok: "Saved" };
}

export async function deleteBody(id: string): Promise<Result> {
  const { supabase, user } = await requireUser();
  if (!UUID.test(id)) return { error: "Entry not found." };
  const { error } = await supabase.from("body_logs").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard", "layout");
  return { ok: "Deleted" };
}
