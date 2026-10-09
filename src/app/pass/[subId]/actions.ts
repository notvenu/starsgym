"use server";

import { requireUser } from "@/lib/supabase";
import { passCode, verifyUrl } from "@/lib/pass";

/** A fresh, short-lived QR URL for the member's own pass (called every ~30 s by the ticket). */
export async function livePassUrl(subId: string) {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("subscriptions").select("pass_token").eq("id", subId).eq("status", "active").maybeSingle();
  return data ? verifyUrl(passCode(data.pass_token, true)) : null;
}
