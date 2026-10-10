"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/supabase";
import { readMemberDetails } from "@/lib/gym";
import { formPhoto, setMyPhoto } from "@/lib/photo";

export type WelcomeState = { error?: string } | undefined;

export async function saveDetails(_: WelcomeState, form: FormData): Promise<WelcomeState> {
  const supabase = await db();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const read = readMemberDetails(form);
  if ("error" in read) return read;
  const full_name = String(form.get("full_name") ?? "").trim();
  if (!full_name) return { error: "Tell us your name." };
  const { file, error: photoError } = formPhoto(form);
  if (photoError) return { error: photoError };
  const { data: me } = await supabase.from("profiles").select("photo_path").eq("id", data.user.id).single();
  if (!file && !me?.photo_path) return { error: "Add a photo of your face — staff check it when they scan your pass." };

  const { error } = await supabase.from("profiles").update({ full_name, ...read.details }).eq("id", data.user.id);
  if (error) return { error: error.message };
  if (file) {
    const res = await setMyPhoto(supabase, data.user.id, file);
    if (res.error) return { error: res.error };
  }
  const next = String(form.get("next") ?? "");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
}

