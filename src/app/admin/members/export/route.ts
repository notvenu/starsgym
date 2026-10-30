import { allRows, requireAdmin } from "@/lib/supabase";
import { GENDERS, gymDate, planName, toCsv, type Plan } from "@/lib/gym";

type Row = {
  full_name: string; email: string | null; phone: string | null; gender: string | null; date_of_birth: string | null; age: number | null;
  emergency_contact: string | null; home_branch_id: string | null; created_at: string; role: string;
  subscriptions: { starts_on: string | null; ends_on: string | null; amount_paise: number; plans: Plan }[];
};

/** Owner only: every member as a spreadsheet — a backup, and for the accountant. Follows the branch switch. */
export async function GET() {
  const { supabase, view } = await requireAdmin();
  const today = gymDate();
  // every member, 1000 per request (allRows)
  const q = () => supabase
    .from("profiles")
    .select("full_name,email,phone,gender,date_of_birth,age,emergency_contact,home_branch_id,created_at,role,subscriptions!subscriptions_user_id_fkey(starts_on,ends_on,amount_paise,plans(*))")
    .eq("role", "member")
    .eq("subscriptions.status", "active")
    .order("full_name")
    .order("id");
  const [{ data, error }, { data: branches }] = await Promise.all([allRows(() => (view ? q().eq("home_branch_id", view) : q())), supabase.from("branches").select("id,name")]);
  if (error) return new Response(error.message, { status: 500 });
  const branch = new Map((branches ?? []).map((b) => [b.id as string, b.name as string]));

  const rows = ((data ?? []) as unknown as Row[]).map((m) => {
    const last = m.subscriptions.filter((s) => s.ends_on).sort((a, b) => b.ends_on!.localeCompare(a.ends_on!))[0];
    const state = !last ? "No plan" : last.ends_on! < today ? "Expired" : last.starts_on && last.starts_on > today ? "Starts later" : "Active";
    const paid = m.subscriptions.reduce((sum, s) => sum + s.amount_paise, 0) / 100;
    return [
      m.full_name, m.phone, m.email, GENDERS.find(([k]) => k === m.gender)?.[1], m.date_of_birth ?? m.age, branch.get(m.home_branch_id ?? ""),
      state, last && planName(last.plans), last?.starts_on, last?.ends_on, paid, m.emergency_contact, m.created_at.slice(0, 10),
    ];
  });
  const head = ["Name", "Phone", "Email", "Gender", "Date of birth / age", "Branch", "Status", "Latest plan", "Plan start", "Plan end", "Total paid (₹)", "Emergency contact", "Joined"];
  // BOM so Excel reads ₹ and Telugu names as UTF-8
  return new Response(`﻿${toCsv([head, ...rows])}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="stars-gym-members-${today}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
