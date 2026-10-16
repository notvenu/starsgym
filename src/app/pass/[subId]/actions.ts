"use server";

import { currentUserId, db } from "@/lib/supabase";
import { passCode, verifyUrl } from "@/lib/pass";

/** A fresh, short-lived QR URL for the member's own pass (called every ~30 s by the ticket). */
export async function livePassUrl(subId: string) {
  // polled every ~30 s while a pass is open: just the signed-in check (local) and one query; RLS keeps it to their own
  // passes (and the desk's)
  if (!(await currentUserId())) return null;
  const supabase = await db();
  const { data } = await supabase.from("subscriptions").select("pass_token").eq("id", subId).eq("status", "active").maybeSingle();
  return data ? verifyUrl(passCode(data.pass_token, true)) : null;
}
