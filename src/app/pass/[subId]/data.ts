import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Plan } from "@/lib/gym";

export type PassData = {
  id: string;
  status: "pending" | "active" | "cancelled";
  starts_on: string | null;
  ends_on: string | null;
  pass_token: string;
  amount_paise: number;
  list_price_paise: number | null;
  admission_paise: number;
  cash_paise: number | null;
  method: string;
  paid_at: string | null;
  plans: Plan;
  profiles: { full_name: string; phone: string | null } | null;
  branches: { name: string } | null;
};

/** Everything a pass shows — the dashboard reads its plans with it, so passes need no second query. */
export const PASS_FIELDS = "id,status,starts_on,ends_on,pass_token,amount_paise,list_price_paise,admission_paise,cash_paise,method,paid_at,plans(*),profiles!subscriptions_user_id_fkey(full_name,phone),branches(name)";

/** RLS limits this to the member's own passes (or any pass for admins). */
export async function getPass(supabase: SupabaseClient, id: string) {
  const { data } = await supabase
    .from("subscriptions")
    .select(PASS_FIELDS)
    .eq("id", id)
    .maybeSingle();
  return data as unknown as PassData | null;
}
