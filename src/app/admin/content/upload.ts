import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Storage's own errors ("new row violates row-level security policy") say nothing useful to the owner: say what to do. */
function why(message: string) {
  if (/bucket not found/i.test(message)) return "The photo storage isn't set up: create a public Storage bucket named “site” in Supabase.";
  if (/row-level security|not authorized|unauthorized|permission|policy/i.test(message))
    return "The photo storage refused the upload: the “site” bucket needs an insert policy for the owner account in Supabase (Storage → Policies).";
  if (/maximum allowed size|too large|payload/i.test(message)) return "That photo is too large for the storage. Use one under 5 MB.";
  if (/mime|content.?type|not supported/i.test(message)) return "The storage doesn't accept that file type. Use JPG, PNG or WebP.";
  if (/fetch failed|network|timeout|ENOTFOUND|ECONN/i.test(message)) return "Couldn't reach the photo storage. Check the connection and try again.";
  return `The photo didn't upload (${message}).`;
}

/** A site photo uploaded from a form (`fileKey`). Blank keeps the current one. */
export async function sitePhoto(supabase: SupabaseClient, form: FormData, folder: string, fileKey: string): Promise<{ path?: string; error?: string }> {
  const file = form.get(fileKey);
  if (file instanceof File && file.size) {
    if (!TYPES[file.type]) return { error: `“${file.name}” isn't a JPG, PNG or WebP photo${file.type ? ` (it's ${file.type})` : ""}.` };
    if (file.size > 5 * 1024 * 1024) return { error: `“${file.name}” is ${(file.size / 1048576).toFixed(1)} MB. Photos must be under 5 MB.` };
    const path = `${folder}/${crypto.randomUUID()}.${TYPES[file.type]}`;
    try {
      const up = await supabase.storage.from("site").upload(path, file, { contentType: file.type });
      return up.error ? { error: why(up.error.message) } : { path };
    } catch (e) {
      console.error("[site photo] upload threw:", e);
      return { error: why((e as Error).message || "unknown error") };
    }
  }
  return {};
}

/** Deletes an uploaded photo again (a save that failed after its photo went up). Pasted URLs aren't ours to delete. */
export async function dropPhoto(supabase: SupabaseClient, path: string | undefined) {
  if (path && !path.startsWith("https://")) await supabase.storage.from("site").remove([path]).catch(() => {});
}
