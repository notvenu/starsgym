import "server-only";
import { adminDb } from "@/lib/supabase";

/** The trainer cards (site_items) linked to this account: a trainer who also has desk access coaches the clients assigned to them. */
export async function myTrainerIds(profileId: string): Promise<string[]> {
  const { data } = await adminDb().from("site_items").select("id").eq("kind", "trainer").eq("active", true).eq("profile_id", profileId);
  return (data ?? []).map((r) => r.id as string);
}
