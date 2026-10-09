"use server";

import { db } from "@/lib/supabase";

export type DoorResult = { error?: string; name?: string; branch?: string; streak?: number; already?: boolean };

/** Entrance-QR check-in. `by` = how the member identifies themselves; "me" uses the signed-in session. */
export async function doorCheckIn(key: string, by: "me" | "phone" | "ref", value = ""): Promise<DoorResult> {
  const supabase = await db();
  const { data, error } = await supabase.rpc("check_in_at_door", {
    p_key: key,
    p_phone: by === "phone" ? value : null,
    p_ref: by === "ref" ? value : null,
  });
  if (error) return { error: error.message };
  const r = (data as { first_name: string; branch: string; streak: number; already: boolean }[])[0];
  return { name: r.first_name, branch: r.branch, streak: r.streak, already: r.already };
}
