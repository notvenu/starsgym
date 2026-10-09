"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase";
import { readMemberDetails } from "@/lib/gym";

export type Result = { error?: string; ok?: string } | undefined;

export async function checkIn(branchId: string, lat?: number, lng?: number): Promise<Result & { streak?: number }> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("check_in", { p_branch: branchId, p_lat: lat ?? null, p_lng: lng ?? null });
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { ok: "Checked in", streak: data as number };
}

export async function saveProfile(_: Result, form: FormData): Promise<Result> {
  const { supabase, user } = await requireUser();
  const instagram = String(form.get("instagram_url") ?? "").trim();
  if (instagram && !instagram.startsWith("https://")) return { error: "Social link must start with https://" };
  const read = readMemberDetails(form);
  if ("error" in read) return read;
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: String(form.get("full_name") ?? "").trim(),
      ...read.details,
      instagram_url: instagram || null,
      home_branch_id: String(form.get("home_branch_id") ?? "") || null,
    })
    .eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { ok: "Saved" };
}

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function postShowcase(_: Result, form: FormData): Promise<Result> {
  const { supabase, user, profile } = await requireUser();
  const file = form.get("photo");
  if (!(file instanceof File) || !file.size) return { error: "Pick a photo first." };
  if (!TYPES[file.type]) return { error: "JPG, PNG or WebP only." };
  if (file.size > MAX_BYTES) return { error: "Photo must be under 5 MB." };
  const link = String(form.get("link_url") ?? "").trim() || profile.instagram_url;
  if (link && !link.startsWith("https://")) return { error: "Link must start with https://" };

  const path = `${user.id}/${crypto.randomUUID()}.${TYPES[file.type]}`;
  const up = await supabase.storage.from("showcase").upload(path, file, { contentType: file.type });
  if (up.error) return { error: up.error.message };
  const { error } = await supabase.from("showcase_posts").insert({ user_id: user.id, image_path: path, link_url: link || null });
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  revalidatePath("/");
  return { ok: "Posted — you're on the Streak Wall for 7 days." };
}
