import "server-only";
import { adminDb, type db } from "@/lib/supabase";

// Member photos live in the private "faces" bucket. Only the server touches it (service key), and the
// browser only ever gets short-lived signed URLs — never a public link to someone's face.
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/webp": "webp", "image/png": "png" };
const MAX = 2 * 1024 * 1024;

/** The photo from a form (field "photo"), checked. null = none attached. */
export function formPhoto(form: FormData): { file: File | null; error?: string } {
  const f = form.get("photo");
  if (!(f instanceof File) || !f.size) return { file: null };
  if (!TYPES[f.type]) return { file: null, error: "Photo must be JPG, PNG or WebP." };
  if (f.size > MAX) return { file: null, error: "Photo must be under 2 MB." };
  return { file: f };
}

/** Uploads to faces/<userId>/<random>; returns the storage path. */
export async function uploadPhoto(userId: string, file: File) {
  const path = `${userId}/${crypto.randomUUID()}.${TYPES[file.type]}`;
  const { error } = await adminDb().storage.from("faces").upload(path, file, { contentType: file.type });
  if (error) throw new Error(error.message);
  return path;
}

export const removePhoto = async (path: string | null | undefined) => {
  if (path) await adminDb().storage.from("faces").remove([path]);
};

/** A signed URL that expires in 10 minutes (enough to view the page). */
export async function photoUrl(path: string | null | undefined) {
  if (!path) return null;
  const { data } = await adminDb().storage.from("faces").createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}

/** Upload, then record it through set_my_photo() (which enforces the two-change limit); tidy up either way. */
export async function setMyPhoto(supabase: Awaited<ReturnType<typeof db>>, userId: string, file: File): Promise<{ error?: string; left?: number }> {
  let path: string;
  try {
    path = await uploadPhoto(userId, file);
  } catch (e) {
    return { error: (e as Error).message };
  }
  const { data, error } = await supabase.rpc("set_my_photo", { p_path: path });
  if (error) {
    await removePhoto(path);
    return { error: error.message };
  }
  const row = (data as { old_path: string | null; changes_left: number }[])[0];
  await removePhoto(row.old_path);
  return { left: row.changes_left };
}
