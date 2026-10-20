import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminDb } from "@/lib/supabase";
import { branchUpi, inr, planName, type Plan } from "@/lib/gym";

type PendingSub = { branches: { upi_id?: string | null } | null; id: string; amount_paise: number; method: string; created_at: string; approval: string | null; standard_paise: number | null; plans: Plan; profiles: { full_name: string; email: string | null }; requester: { full_name: string } | null };

/** Orders waiting for payment (or, with onlyApprovals, for the owner to approve a staff discount), shaped for <PendingRow>. */
export async function getPending(supabase: SupabaseClient, limit = 100, branchId: string | null = null, onlyApprovals = false) {
  const q = supabase
    .from("subscriptions")
    .select("id,amount_paise,method,created_at,approval,standard_paise,plans(*),profiles!subscriptions_user_id_fkey(full_name,email),requester:profiles!subscriptions_requested_by_fkey(full_name),branches(*)", { count: "exact" })
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
    amountPaise: s.amount_paise,
    upiId: branchUpi(s.branches),
    createdAt: s.created_at,
    ask: s.approval === "pending" ? `${s.requester?.full_name || "Staff"} asked for ${inr(s.amount_paise)} · standard ${inr(s.standard_paise ?? s.amount_paise)}` : null,
    meta: `${inr(s.amount_paise)} · ${s.method === "razorpay" ? "online (unconfirmed)" : s.method === "upi_qr" ? "UPI at desk" : s.method} · REF ${s.id.slice(0, 8).toUpperCase()} · ${new Date(s.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`,
  }));
  return { rows, count: count ?? rows.length };
}

/** [id, name, their PT fee per month in paise — null = the standard PT price] */
export type Trainer = [id: string, name: string, feePaise: number | null];

/** Trainer cards for the PT trainer picker, this branch's plus both-branch ones. */
export async function getTrainers(supabase: SupabaseClient, branchId: string | null = null): Promise<Trainer[]> {
  // ponytail: * so the picker still works before the pt_fee_paise column is added
  const q = supabase.from("site_items").select("*").eq("kind", "trainer").order("sort");
  const { data } = await (branchId ? q.or(`branch_id.is.null,branch_id.eq.${branchId}`) : q);
  return (data ?? []).map((t) => [t.id as string, (t.title as string) || "Trainer", (t.pt_fee_paise as number | null) ?? null]);
}

/** One branch's day. Money fields are for the owner's eyes only (the page hides them from staff). */
export type BranchDay = { name: string; checkins: number; sales: number; renewed: number; newMembers: number; ended: number; expiringWeek: number; collected: number; cash: number; upi: number; online: number };

/** One plan sold that day, for the summary's lists. */
export type DaySale = { id: string; userId: string; name: string; plan: string; amount: number; branch: string; kind: "new" | "renewal" | "pass" };

export type DaySummary = {
  people: DaySale[];
  day: string; collected: number; cash: number; upi: number; online: number; sales: number; newMembers: number;
  renewed: number; checkins: number; byBranch: BranchDay[]; ended: number; expiringWeek: number;
  approvals: number; staffActions: number;
};

/** One gym day at a glance, for the owner: money in (by method), sales, sign-ups, visits, plans running out, and what's
 *  waiting on them. Gym days are Asia/Kolkata. */
export async function daySummary(supabase: SupabaseClient, day: string): Promise<DaySummary> {
  const next = new Date(Date.parse(`${day}T00:00:00+05:30`) + 864e5).toISOString();
  const from = `${day}T00:00:00+05:30`;
  const weekOut = new Date(Date.parse(`${day}T12:00:00+05:30`) + 8 * 864e5).toISOString().slice(0, 10);
  const [paid, visits, joined, ended, expiring, approvals, log, branches] = await Promise.all([
    supabase.from("subscriptions").select("id,user_id,created_at,amount_paise,cash_paise,method,branch_id,plans(track,duration_days),profiles!subscriptions_user_id_fkey(full_name)").eq("status", "active").gte("paid_at", from).lt("paid_at", next).limit(5000),
    supabase.from("checkins").select("branch_id").eq("day", day).limit(5000),
    supabase.from("profiles").select("home_branch_id").eq("role", "member").gte("created_at", from).lt("created_at", next).limit(5000),
    supabase.from("subscriptions").select("user_id,branch_id").eq("status", "active").eq("ends_on", day).limit(2000),
    supabase.from("subscriptions").select("branch_id").eq("status", "active").gt("ends_on", day).lte("ends_on", weekOut).limit(5000),
    supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "pending").eq("approval", "pending"),
    supabase.from("staff_log").select("id", { count: "exact", head: true }).gte("at", from).lt("at", next),
    supabase.from("branches").select("id,name").eq("active", true).order("created_at"),
  ]);
  const sales = (paid.data ?? []) as unknown as { id: string; user_id: string; created_at: string; amount_paise: number; cash_paise: number | null; method: string; branch_id: string | null; plans: Pick<Plan, "track" | "duration_days"> | null; profiles: { full_name: string } | null }[];
  // renewed = a membership (not a day pass) sold to someone who already had an earlier plan; the rest are first memberships
  const { data: before } = sales.length ? await supabase.from("subscriptions").select("id,user_id,created_at").eq("status", "active").in("user_id", [...new Set(sales.map((s) => s.user_id))]) : { data: [] };
  const earlier = (before ?? []) as { id: string; user_id: string; created_at: string }[];
  const renewal = (s: (typeof sales)[number]) => (s.plans?.duration_days ?? 0) > 1 && earlier.some((e) => e.user_id === s.user_id && e.id !== s.id && e.created_at < s.created_at);
  const sum = (f: (s: (typeof sales)[number]) => number) => sales.reduce((n, s) => n + f(s), 0);
  // plans that ended that day whose member hasn't bought another since
  const endedRows = (ended.data ?? []) as { user_id: string; branch_id: string | null }[];
  const endedIds = [...new Set(endedRows.map((r) => r.user_id))];
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
    renewed: sales.filter(renewal).length,
    // who bought what: first memberships, renewals, and day passes / trials
    people: sales.map((s) => ({
      id: s.id,
      userId: s.user_id,
      name: s.profiles?.full_name || "Member",
      plan: s.plans ? planName(s.plans) : "Plan",
      amount: s.amount_paise,
      branch: ((branches.data ?? []) as { id: string; name: string }[]).find((b) => b.id === s.branch_id)?.name ?? "",
      kind: (s.plans?.duration_days ?? 0) <= 1 ? "pass" : renewal(s) ? "renewal" : "new",
    })),
    newMembers: (joined.data ?? []).length,
    checkins: v.length,
    byBranch: ((branches.data ?? []) as { id: string; name: string }[]).map((b) => {
      const mine = sales.filter((s) => s.branch_id === b.id);
      const total = (f: (s: (typeof sales)[number]) => number) => mine.reduce((n, s) => n + f(s), 0);
      return {
        name: b.name,
        checkins: v.filter((x) => x.branch_id === b.id).length,
        sales: mine.length,
        renewed: mine.filter(renewal).length,
        newMembers: ((joined.data ?? []) as { home_branch_id: string | null }[]).filter((m) => m.home_branch_id === b.id).length,
        ended: new Set(endedRows.filter((r) => r.branch_id === b.id && !back.has(r.user_id)).map((r) => r.user_id)).size,
        expiringWeek: ((expiring.data ?? []) as { branch_id: string | null }[]).filter((x) => x.branch_id === b.id).length,
        collected: total((s) => s.amount_paise),
        cash: total((s) => (s.method === "cash" ? s.amount_paise : s.cash_paise ?? 0)),
        upi: total((s) => (s.method === "upi_qr" ? s.amount_paise - (s.cash_paise ?? 0) : 0)),
        online: total((s) => (s.method === "razorpay" ? s.amount_paise : 0)),
      };
    }),
    ended: endedIds.filter((id) => !back.has(id)).length,
    expiringWeek: (expiring.data ?? []).length,
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
