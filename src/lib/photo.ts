import "server-only";
import { adminDb, type db } from "@/lib/supabase";

// Member photos live in the private "faces" bucket. Only the server touches it (service key), and the
// browser only ever gets short-lived signed URLs — never a public link to someone's face.
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/webp": "webp", "image/png": "png" };
const MAX = 2 * 1024 * 1024;

/** The photo from a form (field "photo", or `field`), checked. null = none attached. */
export function formPhoto(form: FormData, field = "photo"): { file: File | null; error?: string } {
  const f = form.get(field);
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

// Payment proof (a UPI screenshot, or the paper receipt) for an order: faces/payments/<order id>, private like faces.
// Keyed by the order, so it needs no column: one per order, a later one replaces it.
export const proofPath = (subId: string) => `payments/${subId}`;
export async function saveProof(subId: string, file: File) {
  const { error } = await adminDb().storage.from("faces").upload(proofPath(subId), file, { contentType: file.type, upsert: true });
  if (error) throw new Error(error.message);
}
export async function hasProof(subId: string) {
  const { data } = await adminDb().storage.from("faces").list("payments", { search: subId, limit: 1 });
  return !!data?.some((f) => f.name === subId);
}
/** order id → signed URL of its proof, for the orders that have one. */
export async function proofUrls(subIds: string[]) {
  const urls = await photoUrls(subIds.map(proofPath));
  return new Map(subIds.filter((id) => urls.has(proofPath(id))).map((id) => [id, urls.get(proofPath(id))!]));
}

/** Signed URLs for many photos in one request: path → url. */
export async function photoUrls(paths: (string | null | undefined)[]) {
  const list = [...new Set(paths.filter((p): p is string => !!p))];
  if (!list.length) return new Map<string, string>();
  const { data } = await adminDb().storage.from("faces").createSignedUrls(list, 600);
  return new Map((data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path!, d.signedUrl]));
}
