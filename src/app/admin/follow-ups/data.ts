import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { adminDb, allRows } from "@/lib/supabase";
import { gymDate, gymDateIn, type Plan } from "@/lib/gym";
import { CLOSED } from "./outcomes";

type Past = { status: string; ends_on: string | null };
type Person = { full_name: string; phone: string | null; photo_path: string | null };
export type Lapsed = { id: string; user_id: string; ends_on: string; plans: Plan; profiles: (Person & { history?: Past[] }) | null };
export type Note = { member_id: string; at: string; actor_name: string | null; detail: string | null };

/** Every follow-up note since `since`, newest first, as member → latest note. One query, no long id lists in the URL. */
async function latestNotes(since: string) {
  const { data } = await allRows<Note>(() => adminDb().from("staff_log").select("member_id,at,actor_name,detail").eq("action", "Follow-up").gte("at", `${since}T00:00:00+05:30`).order("at", { ascending: false }));
  const last = new Map<string, Note>();
  for (const n of data) if (n.member_id && !last.has(n.member_id)) last.set(n.member_id, n);
  return last;
}

/**
 * Members whose plan ended in the last `days` days and who haven't bought again, with the latest follow-up made since
 * it ended. Shared by the page, the nav badge and the Overview — cached per request, so the layout and page share it.
 * ponytail: up to 1000 lapsed plans per window; page it if a branch ever lapses more than that in 90 days.
 */
export const loadFollowUps = cache(async (view: string | null, days: number) => {
  const today = gymDate();
  // service key: callers have passed requireStaff, and `view` scopes it like RLS would — and no cookies, so the badge below can be cached
  let q = adminDb()
    .from("subscriptions")
    .select("id,user_id,ends_on,plans(*),profiles!subscriptions_user_id_fkey(full_name,phone,photo_path,history:subscriptions!subscriptions_user_id_fkey(status,ends_on))")
    .eq("status", "active")
    .gte("ends_on", gymDateIn(-days))
    .lt("ends_on", today)
    // only plans still running today or later come back in history: any → they renewed
    .eq("profiles.history.status", "active")
    .gte("profiles.history.ends_on", today)
    .order("ends_on", { ascending: false })
    .limit(1000);
  if (view) q = q.eq("branch_id", view);
  const [{ data }, last] = await Promise.all([q, recentNotes()]);
  const rows = ((data ?? []) as unknown as Lapsed[])
    .filter((e) => e.profiles && e.plans.duration_days > 1 && !(e.profiles.history ?? []).length) // day passes and trials just end
    .filter((e, i, all) => all.findIndex((x) => x.user_id === e.user_id) === i); // newest plan per member

  const latest = (e: Lapsed) => {
    const n = last.get(e.user_id);
    return n && n.at.slice(0, 10) >= e.ends_on ? n : null;
  };
  const isDone = (e: Lapsed) => CLOSED.some((o) => latest(e)?.detail?.startsWith(o));
  return {
    today,
    rows,
    latest,
    todo: rows.filter((e) => !isDone(e)),
    closed: rows.filter(isDone),
    untouched: rows.filter((e) => !latest(e)).length,
  };
});

/** The nav badge: lapsed members nobody has contacted. Cached a minute across requests (the layout otherwise runs the whole lapsed query on every load); logContact expires it. */
export const untouchedCount = unstable_cache(async (view: string | null) => (await loadFollowUps(view, 60)).untouched, ["untouched"], { tags: ["followups"], revalidate: 60 });

export const MISSING_DAYS = 10;

/**
 * Members paying but not coming: a plan running today, started at least MISSING_DAYS ago, and no visit in that long.
 * They're the ones about to quit. Last visit is looked up over 60 days.
 * ponytail: reads 60 days of check-ins (paged); a last_visit column would make this one query if it ever gets slow.
 */
export async function loadMissing(view: string | null) {
  const today = gymDate();
  const cutoff = gymDateIn(-MISSING_DAYS);
  const admin = adminDb();
  const subs = await allRows<{ user_id: string; starts_on: string; ends_on: string; plans: Plan; profiles: Person | null }>(() => {
    const q = admin.from("subscriptions").select("user_id,starts_on,ends_on,plans(*),profiles!subscriptions_user_id_fkey(full_name,phone,photo_path)")
      .eq("status", "active").lte("starts_on", today).gte("ends_on", today).order("user_id");
    return view ? q.eq("branch_id", view) : q;
  });
  const visits = await allRows<{ user_id: string; day: string }>(() => admin.from("checkins").select("user_id,day").gte("day", gymDateIn(-60)).order("day", { ascending: false }).order("user_id"));
  const lastVisit = new Map<string, string>();
  for (const v of visits.data) if (!lastVisit.has(v.user_id)) lastVisit.set(v.user_id, v.day);
  const notes = await recentNotes();

  const seen = new Set<string>();
  const rows = subs.data
    .filter((s) => s.profiles && s.plans.duration_days > 1 && s.starts_on <= cutoff)
    .filter((s) => (lastVisit.get(s.user_id) ?? "") < cutoff)
    .filter((s) => !seen.has(s.user_id) && seen.add(s.user_id))
    .map((s) => ({ ...s, lastVisit: lastVisit.get(s.user_id) ?? null, note: ((n) => (n && n.at.slice(0, 10) >= cutoff ? n : null))(notes.get(s.user_id)) }))
    // longest away first
    .sort((a, b) => (a.lastVisit ?? "").localeCompare(b.lastVisit ?? ""));
  // fewer app check-ins in the window than a tenth of paying members: members aren't checking in with the app yet,
  // so "no visit" means "no app check-in", not "stopped coming" — the page says so
  const paying = new Set(subs.data.map((s) => s.user_id)).size;
  const tracked = visits.data.filter((v) => v.day >= cutoff).length >= Math.max(10, paying / 10);
  return { rows, tracked };
}

/** Won back: members the desk followed up who then bought a plan this month (paid after their first follow-up). */
export async function wonBackThisMonth(view: string | null) {
  const monthStart = `${gymDate().slice(0, 7)}-01T00:00:00+05:30`;
  const admin = adminDb();
  let notes = admin.from("staff_log").select("member_id,at").eq("action", "Follow-up").gte("at", new Date(Date.parse(monthStart) - 90 * 864e5).toISOString()).not("member_id", "is", null);
  if (view) notes = notes.eq("branch_id", view);
  const [{ data: n }, sold] = await Promise.all([
    notes,
    allRows<{ user_id: string; paid_at: string }>(() => admin.from("subscriptions").select("user_id,paid_at").eq("status", "active").gte("paid_at", monthStart).order("paid_at")),
  ]);
  const first = new Map<string, string>(); // each member's earliest follow-up in the window
  for (const x of (n ?? []) as { member_id: string; at: string }[]) if (!first.has(x.member_id) || x.at < first.get(x.member_id)!) first.set(x.member_id, x.at);
  return new Set(sold.data.filter((s) => first.has(s.user_id) && Date.parse(s.paid_at) > Date.parse(first.get(s.user_id)!)).map((s) => s.user_id)).size;
}

/** Each member's latest follow-up in the last 90 days — one read per request, shared by every list (each checks the date). */
export const recentNotes = cache(() => latestNotes(gymDateIn(-90)));

export type Referral = { id: number; at: string; inviterId: string; inviter: string; friendId: string; friend: string; joined: boolean; rewarded: boolean };

/** Bring-a-friend sign-ups (staff log "Referred": actor = who invited, member = the friend), and whether the friend has paid. */
export async function loadReferrals(): Promise<Referral[]> {
  const admin = adminDb();
  const { data } = await admin.from("staff_log").select("id,at,actor_id,actor_name,member_id,member_name,detail").eq("action", "Referred").order("at", { ascending: false }).limit(200);
  const rows = (data ?? []) as { id: number; at: string; actor_id: string; actor_name: string | null; member_id: string; member_name: string | null; detail: string | null }[];
  const friends = rows.map((r) => r.member_id);
  // ponytail: ≤200 friend ids in one filter; fine for a gym's referrals
  const { data: paid } = friends.length
    ? await admin.from("subscriptions").select("user_id,plans!inner(duration_days)").eq("status", "active").gt("plans.duration_days", 1).in("user_id", friends)
    : { data: [] };
  const joined = new Set((paid ?? []).map((p) => p.user_id as string));
  return rows.map((r) => ({
    id: r.id, at: r.at, inviterId: r.actor_id, inviter: r.actor_name ?? "A member", friendId: r.member_id, friend: r.member_name ?? "A friend",
    joined: joined.has(r.member_id), rewarded: !!r.detail?.includes("reward given"),
  }));
}
