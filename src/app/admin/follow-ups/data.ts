import "server-only";
import { cache } from "react";
import { adminDb, db } from "@/lib/supabase";
import { gymDate, gymDateIn, type Plan } from "@/lib/gym";
import { CLOSED } from "./outcomes";

type Past = { status: string; ends_on: string | null };
export type Lapsed = { id: string; user_id: string; ends_on: string; plans: Plan; profiles: { full_name: string; phone: string | null; photo_path: string | null; history?: Past[] } | null };
export type Note = { member_id: string; at: string; actor_name: string | null; detail: string | null };

/**
 * Members whose plan ended in the last `days` days and who haven't bought again, with the latest follow-up made since
 * it ended. Shared by the page, the nav badge and the Overview — cached per request, so the layout and page share it.
 * ponytail: up to 1000 lapsed plans per window; page it if a branch ever lapses more than that in 90 days.
 */
export const loadFollowUps = cache(async (view: string | null, days: number) => {
  const supabase = await db();
  const today = gymDate();
  let q = supabase
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
  const { data } = await q;
  const rows = ((data ?? []) as unknown as Lapsed[])
    .filter((e) => e.profiles && e.plans.duration_days > 1 && !(e.profiles.history ?? []).length) // day passes and trials just end
    .filter((e, i, all) => all.findIndex((x) => x.user_id === e.user_id) === i); // newest plan per member

  // follow-ups since each member's plan ended (service key: staff can't read the owner's log directly)
  const ids = rows.map((r) => r.user_id);
  const { data: logged } = ids.length
    ? await adminDb().from("staff_log").select("member_id,at,actor_name,detail").eq("action", "Follow-up").in("member_id", ids).order("at", { ascending: false })
    : { data: [] };
  const last = new Map<string, Note>();
  for (const n of (logged ?? []) as Note[]) if (!last.has(n.member_id)) last.set(n.member_id, n);
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

/** Won back: members the desk followed up who then bought a plan this month (paid after the follow-up). */
export async function wonBackThisMonth(view: string | null) {
  const monthStart = `${gymDate().slice(0, 7)}-01T00:00:00+05:30`;
  const admin = adminDb();
  let notes = admin.from("staff_log").select("member_id,at").eq("action", "Follow-up").gte("at", new Date(Date.parse(monthStart) - 90 * 864e5).toISOString()).not("member_id", "is", null);
  if (view) notes = notes.eq("branch_id", view);
  const { data: n } = await notes;
  const first = new Map<string, string>(); // each member's earliest follow-up in the window
  for (const x of (n ?? []) as { member_id: string; at: string }[]) if (!first.has(x.member_id) || x.at < first.get(x.member_id)!) first.set(x.member_id, x.at);
  if (!first.size) return 0;
  const { data: sold } = await admin.from("subscriptions").select("user_id,paid_at").eq("status", "active").gte("paid_at", monthStart).in("user_id", [...first.keys()]);
  return new Set(((sold ?? []) as { user_id: string; paid_at: string }[]).filter((s) => Date.parse(s.paid_at) > Date.parse(first.get(s.user_id)!)).map((s) => s.user_id)).size;
}
