"use server";

import { revalidatePath } from "next/cache";
import { adminDb, requireUser, UUID } from "@/lib/supabase";
import { gymDate } from "@/lib/gym";
import { formPhoto, removePhoto, uploadPhoto } from "@/lib/photo";
import { toWall } from "@/lib/wall";

export type Result = { error?: string; ok?: string } | undefined;
const BUCKET = "progress";

/** A progress photo for a day; ticking "Streak Wall" also posts it there. */
export async function uploadProgress(_: Result, form: FormData): Promise<Result> {
  const { supabase, user, profile } = await requireUser();
  const { file, error: bad } = formPhoto(form);
  if (bad) return { error: bad };
  if (!file) return { error: "Take or pick a photo first." };
  const day = String(form.get("day") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(day)) || day > gymDate()) return { error: "Pick a date up to today." };
  const note = String(form.get("note") ?? "").trim().slice(0, 200);

  let path: string;
  try {
    path = await uploadPhoto(user.id, file, BUCKET);
  } catch (e) {
    return { error: (e as Error).message };
  }
  const { error } = await supabase.from("progress_photos").insert({ user_id: user.id, day, path, note });
  if (error) {
    await removePhoto(path, BUCKET); // don't leave a file with no row
    return { error: error.message };
  }
  revalidatePath("/dashboard/photos");
  if (form.get("wall") === "on") {
    const wall = await toWall(supabase, user.id, file, profile.instagram_url);
    if (wall.error) return { error: `Photo saved, but the Streak Wall post didn't go through: ${wall.error}` };
    return { ok: "Saved and posted to the Streak Wall" };
  }
  return { ok: "Photo saved" };
}

/** An earlier progress photo onto the Streak Wall. */
export async function shareProgress(id: string): Promise<Result> {
  const { supabase, user, profile } = await requireUser();
  if (!UUID.test(id)) return { error: "Photo not found." };
  const { data: row } = await supabase.from("progress_photos").select("path").eq("id", id).maybeSingle(); // RLS: only theirs
  if (!row) return { error: "Photo not found." };
  const { data: file, error } = await adminDb().storage.from(BUCKET).download(row.path);
  if (error || !file) return { error: "Couldn't read that photo." };
  return toWall(supabase, user.id, file, profile.instagram_url);
}

export async function deleteProgress(id: string): Promise<Result> {
  const { supabase } = await requireUser();
  if (!UUID.test(id)) return { error: "Photo not found." };
  const { data: row } = await supabase.from("progress_photos").delete().eq("id", id).select("path").maybeSingle(); // RLS: only theirs
  if (!row) return { error: "Photo not found." };
  await removePhoto(row.path, BUCKET);
  revalidatePath("/dashboard/photos");
  return { ok: "Photo deleted" };
}
