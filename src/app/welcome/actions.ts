"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminDb, currentUserId, db, UUID, type Profile } from "@/lib/supabase";
import { logAction } from "@/lib/log";
import { REF_COOKIE, REFERRALS_ON } from "@/lib/referral";
import { readMemberDetails, safeNext } from "@/lib/gym";
import { formPhoto, setMyPhoto } from "@/lib/photo";
import { isLevel } from "@/lib/workouts";

export type WelcomeState = { error?: string } | undefined;

export async function saveDetails(_: WelcomeState, form: FormData): Promise<WelcomeState> {
  const supabase = await db();
  const uid = await currentUserId();
  if (!uid) redirect("/login");
  const read = readMemberDetails(form);
  if ("error" in read) return read;
  const full_name = String(form.get("full_name") ?? "").trim();
  if (!full_name) return { error: "Tell us your name." };
  const { file, error: photoError } = formPhoto(form);
  if (photoError) return { error: photoError };
  // only asked once the workouts migration has run (the form leaves the question out before that)
  const asked = form.has("ask_experience");
  const experience = form.get("experience");
  if (asked && !isLevel(experience)) return { error: "Pick how long you've been training." };
  const { data: me } = await supabase.from("profiles").select("photo_path").eq("id", uid).single();
  if (!file && !me?.photo_path) return { error: "Add a photo of your face — staff check it when they scan your pass." };

  const { error } = await supabase.from("profiles").update({ full_name, ...read.details, ...(asked && { experience }) }).eq("id", uid);
  if (error) return { error: error.message };
  if (file) {
    const res = await setMyPhoto(supabase, uid, file);
    if (res.error) return { error: res.error };
  }
  if (REFERRALS_ON) await creditReferral(uid, full_name);
  redirect(safeNext(form.get("next")));
}

/** Came in through a member's invite link (/r/…): log who invited them, once — the desk rewards it after they join. */
async function creditReferral(uid: string, name: string) {
  const jar = await cookies();
  const inviter = jar.get(REF_COOKIE)?.value;
  if (!inviter) return;
  jar.delete(REF_COOKIE);
  if (!UUID.test(inviter) || inviter === uid) return;
  const admin = adminDb();
  const [{ data: who }, { data: already }] = await Promise.all([
    admin.from("profiles").select("id,full_name,home_branch_id,role").eq("id", inviter).maybeSingle(),
    admin.from("staff_log").select("id").eq("action", "Referred").eq("member_id", uid).limit(1).maybeSingle(),
  ]);
  if (!who || who.role !== "member" || already) return;
  // the inviter is the log's actor: "<inviter> Referred <friend>"
  await logAction(who as Pick<Profile, "id" | "full_name" | "home_branch_id">, "Referred", { memberId: uid, memberName: name, detail: "Invited a friend" });
}

