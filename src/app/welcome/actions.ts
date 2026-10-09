"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/supabase";
import { readMemberDetails } from "@/lib/gym";

export type WelcomeState = { error?: string } | undefined;

export async function saveDetails(_: WelcomeState, form: FormData): Promise<WelcomeState> {
  const supabase = await db();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const read = readMemberDetails(form);
  if ("error" in read) return read;
  const full_name = String(form.get("full_name") ?? "").trim();
  if (!full_name) return { error: "Tell us your name." };
  const { error } = await supabase.from("profiles").update({ full_name, ...read.details }).eq("id", data.user.id);
  if (error) return { error: error.message };
  const next = String(form.get("next") ?? "");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
}
