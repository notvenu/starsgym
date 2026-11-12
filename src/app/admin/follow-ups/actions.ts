"use server";

import { revalidatePath } from "next/cache";
import { requireStaff, UUID } from "@/lib/supabase";
import { logAction } from "@/lib/log";
import { OUTCOMES } from "./outcomes";

export type Result = { error?: string; ok?: string } | undefined;

/** The desk reached out to a lapsed member: what they said goes in the staff log (action "Follow-up"), which the list reads back. */
export async function logFollowUp(_: Result, form: FormData): Promise<Result> {
  const { profile, view } = await requireStaff();
  const memberId = String(form.get("member_id") ?? "");
  const outcome = String(form.get("outcome") ?? "");
  const note = String(form.get("note") ?? "").trim().slice(0, 200);
  if (!UUID.test(memberId)) return { error: "Reload and try again." };
  if (!(OUTCOMES as readonly string[]).includes(outcome)) return { error: "Pick what they said." };
  await logAction(profile, "Follow-up", { memberId, branchId: view, detail: note ? `${outcome} · ${note}` : outcome });
  revalidatePath("/admin/follow-ups");
  revalidatePath(`/admin/members/${memberId}`); // its timeline
  return { ok: "Saved." };
}
