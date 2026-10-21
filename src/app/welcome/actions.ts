"use server";

import { redirect } from "next/navigation";
import { currentUserId, db } from "@/lib/supabase";
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
  redirect(safeNext(form.get("next")));
}

