import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** A site photo from a form: an upload (`fileKey`) or a pasted https URL (`urlKey`). Blank keeps the current one. */
export async function sitePhoto(supabase: SupabaseClient, form: FormData, folder: string, fileKey: string, urlKey: string): Promise<{ path?: string; error?: string }> {
  const file = form.get(fileKey);
  if (file instanceof File && file.size) {
    if (!TYPES[file.type]) return { error: "Photos must be JPG, PNG or WebP." };
    if (file.size > 5 * 1024 * 1024) return { error: "Each photo must be under 5 MB." };
    const path = `${folder}/${crypto.randomUUID()}.${TYPES[file.type]}`;
    const up = await supabase.storage.from("site").upload(path, file, { contentType: file.type });
    return up.error ? { error: up.error.message } : { path };
  }
  const pasted = String(form.get(urlKey) ?? "").trim();
  if (pasted && !pasted.startsWith("https://")) return { error: "Photo URLs must start with https://" };
  return { path: pasted || undefined };
}
