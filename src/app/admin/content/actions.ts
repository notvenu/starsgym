"use server";

import { revalidatePath } from "next/cache";
import { adminDb, requireAdmin, requireStaff } from "@/lib/supabase";
import { logAction } from "@/lib/log";
import { reelEmbed, videoEmbed, type ItemKind } from "@/lib/gym";
import { sitePhoto } from "./upload";

export type Result = { error?: string; ok?: string } | undefined;
const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const KINDS: ItemKind[] = ["trainer", "client", "gallery", "reel"];
const refresh = (ok: string): Result => (revalidatePath("/", "layout"), { ok });

const https = (v: string) => !v || v.startsWith("https://");

export async function saveSettings(_: Result, form: FormData): Promise<Result> {
  const { supabase } = await requireAdmin();
  const row = {
    instagram_url: s(form, "instagram_url") || null,
    facebook_url: s(form, "facebook_url") || null,
    youtube_url: s(form, "youtube_url") || null,
    whatsapp: s(form, "whatsapp").replace(/\D/g, "") || null,
    phone: s(form, "phone") || null,
    email: s(form, "email") || null,
    updated_at: new Date().toISOString(),
  };
  if (![row.instagram_url, row.facebook_url, row.youtube_url].every((v) => https(v ?? ""))) return { error: "Social links must start with https://" };
  const { error } = await supabase.from("site_settings").update(row).eq("id", 1);
  return error ? { error: error.message } : refresh("Saved");
}

/** Create or update a trainer / client story / gallery item / reel. A new photo replaces the old one. */
export async function saveItem(_: Result, form: FormData): Promise<Result> {
  const { supabase } = await requireAdmin();
  const kind = s(form, "kind") as ItemKind;
  if (!KINDS.includes(kind)) return { error: "Unknown section." };
  const url = s(form, "url");
  if (!https(url)) return { error: "Links must start with https://" };
  if (kind === "reel" && !reelEmbed(url)) return { error: "Paste an Instagram reel link, e.g. https://www.instagram.com/reel/…" };
  if (kind === "gallery" && url && !videoEmbed(url)) return { error: "Video links must be YouTube or a direct .mp4 / .webm file." };

  const before = await sitePhoto(supabase, form, kind, "photo", "image_url");
  const after = await sitePhoto(supabase, form, kind, "after_photo", "after_image_url");
  if (before.error || after.error) return { error: before.error ?? after.error };
  const image_path = before.path;
  const trainer_id = s(form, "trainer_id");
  if (trainer_id && !/^[0-9a-f-]{36}$/i.test(trainer_id)) return { error: "Pick a coach from the list." };

  const id = s(form, "id");
  if (kind === "gallery" && !id && !image_path && !url) return { error: "Add a photo or a video link." };
  if ((kind === "trainer" || kind === "client") && !s(form, "title")) return { error: "Name is required." };

  const row = {
    kind,
    title: s(form, "title"),
    subtitle: s(form, "subtitle"),
    body: s(form, "body"),
    url: url || null,
    sort: Number(s(form, "sort")) || 0,
    ...(image_path !== undefined && { image_path }),
    ...(after.path !== undefined && { after_image_path: after.path }),
    ...(kind === "client" && { duration: s(form, "duration"), trainer_id: trainer_id || null }),
  };
  const { error } = id ? await supabase.from("site_items").update(row).eq("id", id) : await supabase.from("site_items").insert(row);
  return error ? { error: error.message } : refresh(id ? "Saved" : "Added");
}

export async function setItemActive(id: string, active: boolean): Promise<Result> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("site_items").update({ active }).eq("id", id);
  return error ? { error: error.message } : refresh(active ? "Shown" : "Hidden");
}

export async function deleteItem(id: string): Promise<Result> {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("site_items").select("image_path,after_image_path").eq("id", id).single();
  const { error } = await supabase.from("site_items").delete().eq("id", id);
  if (error) return { error: error.message };
  const uploads = [data?.image_path, data?.after_image_path].filter((p): p is string => !!p && !p.startsWith("https://"));
  if (uploads.length) await supabase.storage.from("site").remove(uploads);
  return refresh("Deleted");
}

/** Desk: an enquiry was called back. Staff only for their branch's (or "any branch") enquiries. */
export async function markEnquiry(id: string): Promise<Result> {
  const { profile: me, branchId } = await requireStaff();
  const db = adminDb(); // enquiries are owner-only in the database; checked here instead
  const { data: e } = await db.from("enquiries").select("name,branch_id").eq("id", id).maybeSingle();
  if (!e || (branchId && e.branch_id && e.branch_id !== branchId)) return { error: "That enquiry isn't for your branch." };
  const { error } = await db.from("enquiries").update({ handled: true }).eq("id", id);
  if (error) return { error: error.message };
  await logAction(me, "Handled enquiry", { memberName: e.name as string, branchId: (e.branch_id as string | null) ?? null });
  revalidatePath("/admin", "layout"); // inbox badge
  return { ok: "Done" };
}
