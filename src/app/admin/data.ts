import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { inr, planName, type Plan } from "@/lib/gym";

type PendingSub = { id: string; amount_paise: number; method: string; created_at: string; plans: Plan; profiles: { full_name: string; email: string | null } };

/** Orders waiting for staff to confirm payment, shaped for <PendingRow>. */
export async function getPending(supabase: SupabaseClient, limit = 100) {
  const { data, count } = await supabase
    .from("subscriptions")
    .select("id,amount_paise,method,created_at,plans(*),profiles!subscriptions_user_id_fkey(full_name,email)", { count: "exact" })
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(limit);
  const rows = ((data ?? []) as unknown as PendingSub[]).map((s) => ({
    id: s.id,
    title: `${s.profiles.full_name || s.profiles.email} · ${planName(s.plans)}`,
    meta: `${inr(s.amount_paise)} · ${s.method === "razorpay" ? "online (unconfirmed)" : s.method === "upi_qr" ? "UPI at desk" : s.method} · REF ${s.id.slice(0, 8).toUpperCase()} · ${new Date(s.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`,
  }));
  return { rows, count: count ?? rows.length };
}
