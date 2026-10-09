"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase";
import { reelEmbed, videoEmbed, type ItemKind } from "@/lib/gym";

export type Result = { error?: string; ok?: string } | undefined;
const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const KINDS: ItemKind[] = ["trainer", "client", "gallery", "reel"];
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
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

  // a photo is an upload ("photo" / "after_photo") or a pasted URL ("image_url" / "after_image_url"); blank keeps the current one
  async function photo(fileKey: string, urlKey: string): Promise<{ path?: string; error?: string }> {
    const file = form.get(fileKey);
    if (file instanceof File && file.size) {
      if (!TYPES[file.type]) return { error: "Photos must be JPG, PNG or WebP." };
      if (file.size > 5 * 1024 * 1024) return { error: "Each photo must be under 5 MB." };
      const path = `${kind}/${crypto.randomUUID()}.${TYPES[file.type]}`;
      const up = await supabase.storage.from("site").upload(path, file, { contentType: file.type });
      return up.error ? { error: up.error.message } : { path };
    }
    const pasted = s(form, urlKey);
    if (pasted && !pasted.startsWith("https://")) return { error: "Photo URLs must start with https://" };
    return { path: pasted || undefined };
  }
  const before = await photo("photo", "image_url");
  const after = await photo("after_photo", "after_image_url");
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

export async function markEnquiry(id: string): Promise<Result> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("enquiries").update({ handled: true }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin", "layout"); // inbox badge
  return { ok: "Done" };
}
