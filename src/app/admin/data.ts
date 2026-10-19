import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminDb } from "@/lib/supabase";
import { inr, planName, type Plan } from "@/lib/gym";

type PendingSub = { id: string; amount_paise: number; method: string; created_at: string; approval: string | null; standard_paise: number | null; plans: Plan; profiles: { full_name: string; email: string | null }; requester: { full_name: string } | null };

/** Orders waiting for payment (or, with onlyApprovals, for the owner to approve a staff discount), shaped for <PendingRow>. */
export async function getPending(supabase: SupabaseClient, limit = 100, branchId: string | null = null, onlyApprovals = false) {
  const q = supabase
    .from("subscriptions")
    .select("id,amount_paise,method,created_at,approval,standard_paise,plans(*),profiles!subscriptions_user_id_fkey(full_name,email),requester:profiles!subscriptions_requested_by_fkey(full_name)", { count: "exact" })
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(limit);
  const scoped = onlyApprovals ? q.eq("approval", "pending") : q;
  const { data, count } = await (branchId ? scoped.eq("branch_id", branchId) : scoped);
  const rows = ((data ?? []) as unknown as PendingSub[]).map((s) => ({
    id: s.id,
    title: `${s.profiles.full_name || s.profiles.email} · ${planName(s.plans)}`,
    approval: s.approval,
    method: s.method,
    ask: s.approval === "pending" ? `${s.requester?.full_name || "Staff"} asked for ${inr(s.amount_paise)} · standard ${inr(s.standard_paise ?? s.amount_paise)}` : null,
    meta: `${inr(s.amount_paise)} · ${s.method === "razorpay" ? "online (unconfirmed)" : s.method === "upi_qr" ? "UPI at desk" : s.method} · REF ${s.id.slice(0, 8).toUpperCase()} · ${new Date(s.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`,
  }));
  return { rows, count: count ?? rows.length };
}

/** Trainer cards for the PT trainer picker: [id, name], this branch's plus both-branch ones. */
export async function getTrainers(supabase: SupabaseClient, branchId: string | null = null): Promise<[string, string][]> {
  const q = supabase.from("site_items").select("id,title").eq("kind", "trainer").order("sort");
  const { data } = await (branchId ? q.or(`branch_id.is.null,branch_id.eq.${branchId}`) : q);
  return (data ?? []).map((t) => [t.id as string, (t.title as string) || "Trainer"]);
}

export type DaySummary = {
  day: string; collected: number; cash: number; upi: number; online: number; sales: number; newMembers: number;
  checkins: number; byBranch: { name: string; checkins: number; collected: number }[]; ended: number; expiringWeek: number;
  approvals: number; staffActions: number;
};

/** One gym day at a glance, for the owner: money in (by method), sales, sign-ups, visits, plans running out, and what's
 *  waiting on them. Gym days are Asia/Kolkata. */
export async function daySummary(supabase: SupabaseClient, day: string): Promise<DaySummary> {
  const next = new Date(Date.parse(`${day}T00:00:00+05:30`) + 864e5).toISOString();
  const from = `${day}T00:00:00+05:30`;
  const weekOut = new Date(Date.parse(`${day}T12:00:00+05:30`) + 8 * 864e5).toISOString().slice(0, 10);
  const [paid, visits, joined, ended, expiring, approvals, log, branches] = await Promise.all([
    supabase.from("subscriptions").select("amount_paise,cash_paise,method,branch_id").eq("status", "active").gte("paid_at", from).lt("paid_at", next).limit(5000),
    supabase.from("checkins").select("branch_id").eq("day", day).limit(5000),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "member").gte("created_at", from).lt("created_at", next),
    supabase.from("subscriptions").select("user_id").eq("status", "active").eq("ends_on", day).limit(2000),
    supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active").gt("ends_on", day).lte("ends_on", weekOut),
    supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "pending").eq("approval", "pending"),
    supabase.from("staff_log").select("id", { count: "exact", head: true }).gte("at", from).lt("at", next),
    supabase.from("branches").select("id,name").eq("active", true).order("created_at"),
  ]);
  const sales = (paid.data ?? []) as { amount_paise: number; cash_paise: number | null; method: string; branch_id: string | null }[];
  const sum = (f: (s: (typeof sales)[number]) => number) => sales.reduce((n, s) => n + f(s), 0);
  // plans that ended that day whose member hasn't bought another since
  const endedIds = [...new Set(((ended.data ?? []) as { user_id: string }[]).map((r) => r.user_id))];
  const { data: renewed } = endedIds.length
    ? await supabase.from("subscriptions").select("user_id").eq("status", "active").gt("ends_on", day).in("user_id", endedIds)
    : { data: [] };
  const back = new Set((renewed ?? []).map((r) => r.user_id as string));
  const v = (visits.data ?? []) as { branch_id: string }[];
  return {
    day,
    collected: sum((s) => s.amount_paise),
    cash: sum((s) => (s.method === "cash" ? s.amount_paise : s.cash_paise ?? 0)),
    upi: sum((s) => (s.method === "upi_qr" ? s.amount_paise - (s.cash_paise ?? 0) : 0)),
    online: sum((s) => (s.method === "razorpay" ? s.amount_paise : 0)),
    sales: sales.length,
    newMembers: joined.count ?? 0,
    checkins: v.length,
    byBranch: ((branches.data ?? []) as { id: string; name: string }[]).map((b) => ({
      name: b.name,
      checkins: v.filter((x) => x.branch_id === b.id).length,
      collected: sales.filter((s) => s.branch_id === b.id).reduce((n, s) => n + s.amount_paise, 0),
    })),
    ended: endedIds.filter((id) => !back.has(id)).length,
    expiringWeek: expiring.count ?? 0,
    approvals: approvals.count ?? 0,
    staffActions: log.count ?? 0,
  };
}

/** Open enquiries a desk can see (count): a single-branch staff member gets their branch's plus the "any branch" ones; the
 *  owner and both-branch staff get all, or the switched-to branch's. Service key — enquiries are owner-only in the
 *  database — so call it only after requireStaff. */
export async function openEnquiries(branchId: string | null, view: string | null) {
  const scope = branchId ?? view;
  const q = adminDb().from("enquiries").select("id", { count: "exact", head: true }).eq("handled", false);
  return scope ? q.or(`branch_id.is.null,branch_id.eq.${scope}`) : q;
}
