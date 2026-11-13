"use server";

import { revalidatePath } from "next/cache";
import { adminDb, requireStaff, UUID } from "@/lib/supabase";
import { gymDate } from "@/lib/gym";
import { REFERRAL_DAYS } from "@/lib/referral";
import { logAction } from "@/lib/log";
import { OUTCOMES } from "./outcomes";

export type Result = { error?: string; ok?: string } | undefined;

/**
 * The follow-up popup: the desk messaged or called a member, with an optional outcome and note typed before tapping.
 * Saved as a "Follow-up" (detail: "<outcome> · <WhatsApp|Call> · <note>"), so the lists move them to "contacted".
 */
export async function logContact(memberId: string, channel: "whatsapp" | "call", outcome: string | null, note: string): Promise<Result> {
  const { profile, view } = await requireStaff();
  if (!UUID.test(memberId)) return { error: "Reload and try again." };
  if (outcome && !(OUTCOMES as readonly string[]).includes(outcome)) return { error: "Pick what they said." };
  const how = channel === "call" ? "Called" : "WhatsApp";
  const detail = [outcome, how, note.trim().slice(0, 200) || null].filter(Boolean).join(" · ");
  await logAction(profile, "Follow-up", { memberId, branchId: view, detail });
  revalidatePath("/admin");
  revalidatePath("/admin/follow-ups");
  revalidatePath(`/admin/members/${memberId}`);
  return { ok: "Saved." };
}

/** Referral reward: the friend joined, so the member who invited them gets REFERRAL_DAYS more on their running plan. */
export async function giveReferralReward(logId: number): Promise<Result> {
  const { profile, view } = await requireStaff();
  const db = adminDb();
  const { data: ref } = await db.from("staff_log").select("id,actor_id,actor_name,member_id,member_name,detail").eq("id", logId).eq("action", "Referred").maybeSingle();
  if (!ref?.actor_id) return { error: "Reload and try again." };
  if ((ref.detail as string | null)?.includes("reward given")) return { error: "Already given." };
  // the inviter's plan run: its last plan gets the days
  const { data: run } = await db.from("subscriptions").select("id,ends_on").eq("user_id", ref.actor_id).eq("status", "active").gte("ends_on", gymDate()).order("ends_on", { ascending: false }).limit(1).maybeSingle();
  if (!run) return { error: `${ref.actor_name ?? "They"} has no running plan — give it when they renew.` };
  const ends = new Date(Date.parse(`${run.ends_on}T12:00:00Z`) + REFERRAL_DAYS * 864e5).toISOString().slice(0, 10);
  const { error } = await db.from("subscriptions").update({ ends_on: ends }).eq("id", run.id);
  if (error) return { error: error.message };
  await db.from("staff_log").update({ detail: `${ref.detail ?? "Invited a friend"} · reward given` }).eq("id", logId);
  await logAction(profile, "Referral reward", { memberId: ref.actor_id as string, branchId: view, detail: `+${REFERRAL_DAYS} days for inviting ${ref.member_name ?? "a friend"} · now till ${ends}` });
  revalidatePath("/admin/follow-ups");
  return { ok: `+${REFERRAL_DAYS} days added to ${ref.actor_name ?? "their"} plan.` };
}
