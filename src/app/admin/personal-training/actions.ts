"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { gymDate } from "@/lib/gym";
import { logAction } from "@/lib/log";
import { adminDb, requireStaff } from "@/lib/supabase";
import { myTrainerIds } from "./access";

export type Result = { error?: string; ok?: string } | undefined;
const UUID = /^[0-9a-f-]{36}$/i;
const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const SETUP = "Run supabase/migrations/0030_pt_clients.sql in the Supabase SQL editor first.";
const NOT_YOURS = { error: "That isn't one of your personal-training clients." } as const;

const why = (message: string) => (/pt_details|pt_notes|relation|schema cache/i.test(message) ? SETUP : message);

/**
 * The owner may coach-edit any running PT plan; a trainer only their own clients' (the plans assigned to a trainer card
 * linked to their account); single-branch staff only at their branch. Service key afterwards, so this check is the gate.
 */
async function coach(subId: string) {
  const ctx = await requireStaff();
  if (!UUID.test(subId)) return { error: "Reload and try again." } as const;
  const { data } = await adminDb().from("subscriptions").select("id,user_id,trainer_id,branch_id,plans!inner(track)").eq("id", subId).maybeSingle();
  const sub = data as unknown as { id: string; user_id: string; trainer_id: string | null; branch_id: string | null; plans: { track: string } } | null;
  if (!sub || sub.plans.track !== "personal_training") return NOT_YOURS;
  if (ctx.branchId && sub.branch_id !== ctx.branchId) return NOT_YOURS;
  if (!ctx.isOwner && !(sub.trainer_id && (await myTrainerIds(ctx.profile.id)).includes(sub.trainer_id))) return NOT_YOURS;
  return { ctx, sub };
}

async function safe(name: string, run: () => Promise<Result>): Promise<Result> {
  try {
    return await run();
  } catch (e) {
    unstable_rethrow(e);
    console.error(`[pt] ${name} failed:`, e);
    return { error: `Couldn't save${e instanceof Error && e.message ? ` (${e.message.slice(0, 160)})` : ""}. Try again.` };
  }
}

/** A client's training days, time, session length and goal. */
export async function savePtDetails(_: Result, form: FormData): Promise<Result> {
  return safe("savePtDetails", async () => {
    const c = await coach(s(form, "sub_id"));
    if ("error" in c) return c;
    const days = [...new Set(form.getAll("days").map((d) => Number(d)))].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort();
    const time = s(form, "start_time");
    if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return { error: "Enter the time like 06:30." };
    const minutes = s(form, "minutes") === "" ? null : Number(s(form, "minutes"));
    if (minutes !== null && !(Number.isInteger(minutes) && minutes >= 10 && minutes <= 240)) return { error: "A session is between 10 and 240 minutes." };
    const goal = s(form, "goal");
    if (goal.length > 300) return { error: "Keep the goal under 300 characters." };
    if (days.length && !time) return { error: "Pick a time for those days." };

    const { error } = await adminDb().from("pt_details").upsert({ sub_id: c.sub.id, goal, days, start_time: time || null, minutes, updated_at: new Date().toISOString(), updated_by: c.ctx.profile.id });
    if (error) return { error: why(error.message) };
    await logAction(c.ctx.profile, "PT schedule saved", { memberId: c.sub.user_id });
    revalidatePath("/admin/personal-training");
    return { ok: "Saved" };
  });
}

/** A note about the client, or a session held (with an optional note about it). */
export async function addPtEntry(_: Result, form: FormData): Promise<Result> {
  return safe("addPtEntry", async () => {
    const c = await coach(s(form, "sub_id"));
    if ("error" in c) return c;
    const kind = s(form, "kind");
    if (kind !== "note" && kind !== "session") return { error: "Reload and try again." };
    const body = s(form, "body");
    const day = s(form, "day") || gymDate();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day > gymDate()) return { error: "Pick today or an earlier day." };
    if (kind === "note" && !body) return { error: "Write the note first." };
    if (body.length > 1000) return { error: "Keep it under 1000 characters." };

    const { error } = await adminDb().from("pt_notes").insert({ sub_id: c.sub.id, author_id: c.ctx.profile.id, author_name: c.ctx.profile.full_name, kind, day, body });
    if (error) return { error: why(error.message) };
    await logAction(c.ctx.profile, kind === "session" ? "PT session logged" : "PT note added", { memberId: c.sub.user_id });
    revalidatePath("/admin/personal-training");
    return { ok: kind === "session" ? "Session logged" : "Note added" };
  });
}

/** Removes an entry: the owner any, a trainer their own. */
export async function deletePtEntry(id: string): Promise<Result> {
  return safe("deletePtEntry", async () => {
    const { profile, isOwner } = await requireStaff();
    if (!UUID.test(id)) return { error: "Reload and try again." };
    const { data: row, error: readErr } = await adminDb().from("pt_notes").select("id,sub_id,author_id").eq("id", id).maybeSingle();
    if (readErr) return { error: why(readErr.message) };
    if (!row) return { ok: "Already gone" };
    if (!isOwner && row.author_id !== profile.id) return { error: "You can only delete your own entries." };
    const c = await coach(row.sub_id as string); // still their client (or the owner)
    if ("error" in c) return c;
    const { error } = await adminDb().from("pt_notes").delete().eq("id", id);
    if (error) return { error: why(error.message) };
    revalidatePath("/admin/personal-training");
    return { ok: "Removed" };
  });
}
