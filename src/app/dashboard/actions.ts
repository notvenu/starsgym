"use server";

import { revalidatePath } from "next/cache";
import { adminDb, requireUser, UUID } from "@/lib/supabase";
import { GENDERS, LOGIN_EMAIL_DOMAIN, phoneKey, readPersonalDetails } from "@/lib/gym";
import { formPhoto, removePhoto, uploadPhoto } from "@/lib/photo";

export type Result = { error?: string; ok?: string } | undefined;

export async function checkIn(branchId: string, lat?: number, lng?: number): Promise<Result & { streak?: number }> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("check_in", { p_branch: branchId, p_lat: lat ?? null, p_lng: lng ?? null });
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { ok: "Checked in", streak: data as number };
}

/** Date of birth, emergency contact and socials: members change these any time (phone and email are a request). */
export async function saveProfile(_: Result, form: FormData): Promise<Result> {
  const { supabase, user } = await requireUser();
  const instagram = String(form.get("instagram_url") ?? "").trim();
  if (instagram && !instagram.startsWith("https://")) return { error: "Social link must start with https://" };
  const read = readPersonalDetails(form);
  if ("error" in read) return read;
  const { error } = await supabase.from("profiles").update({ ...read.details, instagram_url: instagram || null }).eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { ok: "Saved" };
}

/**
 * Name, gender, home branch and photo are set once, and phone and email (how they sign in) are the desk's: a change is
 * a request the desk approves. Only what differs is sent.
 * Written with the service key after checking who's asking, so the photo path is always under their own folder.
 */
export async function requestChange(_: Result, form: FormData): Promise<Result> {
  const { user, profile } = await requireUser();
  const s = (k: string) => String(form.get(k) ?? "").trim();
  const name = s("full_name");
  const gender = s("gender");
  const branch = s("home_branch_id");
  const phone = s("phone");
  const email = s("email").toLowerCase();
  const change = {
    full_name: name && name !== profile.full_name ? name.slice(0, 80) : null,
    gender: gender && gender !== profile.gender ? gender : null,
    home_branch_id: branch && branch !== profile.home_branch_id ? branch : null,
    phone: phone && phoneKey(phone) !== phoneKey(profile.phone) ? phone.slice(0, 20) : null,
    email: email && email !== (profile.email ?? "") ? email : null,
  };
  if (change.gender && !GENDERS.some(([g]) => g === change.gender)) return { error: "Pick a gender." };
  if (change.home_branch_id && !UUID.test(change.home_branch_id)) return { error: "Pick a branch." };
  if (change.phone && phoneKey(change.phone).length < 10) return { error: "Enter a 10-digit phone number." };
  if (change.email && (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(change.email) || change.email.endsWith(`@${LOGIN_EMAIL_DOMAIN}`))) return { error: "Enter a valid email address." };
  const photo = formPhoto(form);
  if (photo.error) return { error: photo.error };
  if (!photo.file && !Object.values(change).some(Boolean)) return { error: "Change something first." };

  const admin = adminDb();
  await dropOpenRequest(user.id); // one open request: a new one replaces it
  let photo_path: string | null = null;
  try {
    if (photo.file) photo_path = await uploadPhoto(user.id, photo.file);
  } catch (e) {
    return { error: (e as Error).message };
  }
  const { error } = await admin.from("profile_requests").insert({ user_id: user.id, ...change, photo_path, note: s("note").slice(0, 300) || null });
  if (error) {
    await removePhoto(photo_path);
    return { error: /profile_requests/.test(error.message) ? "Requests aren't set up yet — ask the desk." : error.message };
  }
  revalidatePath("/dashboard");
  revalidatePath("/admin", "layout");
  return { ok: "Sent to the desk — you'll see it here once it's approved." };
}

export async function cancelRequest(): Promise<Result> {
  const { user } = await requireUser();
  await dropOpenRequest(user.id);
  revalidatePath("/dashboard");
  revalidatePath("/admin", "layout");
  return { ok: "Request withdrawn" };
}

async function dropOpenRequest(userId: string) {
  const admin = adminDb();
  const { data } = await admin.from("profile_requests").delete().eq("user_id", userId).eq("status", "pending").select("photo_path");
  await Promise.all((data ?? []).map((r) => removePhoto(r.photo_path as string | null)));
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
