import "server-only";
import { revalidatePath } from "next/cache";
import type { db } from "@/lib/supabase";

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Puts a picture on the Streak Wall: the public "showcase" bucket plus a post (RLS: their own). Server-only: callers
 *  have already checked who's asking and the file. Used by the dashboard form and by progress photos. */
export async function toWall(supabase: Awaited<ReturnType<typeof db>>, userId: string, file: Blob, link: string | null) {
  const type = TYPES[file.type] ? file.type : "image/jpeg";
  const path = `${userId}/${crypto.randomUUID()}.${TYPES[type]}`;
  const up = await supabase.storage.from("showcase").upload(path, file, { contentType: type });
  if (up.error) return { error: up.error.message };
  const { error } = await supabase.from("showcase_posts").insert({ user_id: userId, image_path: path, link_url: link || null });
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  revalidatePath("/");
  return { ok: "Posted — you're on the Streak Wall for 7 days." };
}
