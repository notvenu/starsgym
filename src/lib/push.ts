import "server-only";
import { after } from "next/server";
import webpush from "web-push";
import { adminDb } from "@/lib/supabase";

// Web push. Keys: NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT (generate with
// `npx web-push generate-vapid-keys`). Subscriptions live in push_subscriptions (0021), written only by the server.
export const pushEnabled = !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
if (pushEnabled) webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:admin@stars-gym.invalid", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);

export type PushMessage = { title: string; body: string; url?: string; tag?: string };

/**
 * Sends to every device these people turned notifications on for. Never throws and never blocks the action that
 * triggered it: a failed push is only logged, and devices that unsubscribed (404/410) are forgotten.
 * ponytail: sends one by one; batch through a queue if a broadcast ever goes past a few thousand devices.
 */
export async function notify(userIds: (string | null | undefined)[], msg: PushMessage) {
  const ids = [...new Set(userIds.filter((id): id is string => !!id))];
  if (!pushEnabled || !ids.length) return;
  try {
    const db = adminDb();
    const { data: subs } = await db.from("push_subscriptions").select("endpoint,p256dh,auth").in("user_id", ids);
    const payload = JSON.stringify(msg);
    const gone: string[] = [];
    await Promise.all((subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24 });
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) gone.push(s.endpoint);
        else console.error("push failed", code, (e as Error).message);
      }
    }));
    if (gone.length) await db.from("push_subscriptions").delete().in("endpoint", gone);
  } catch (e) {
    console.error("push skipped", (e as Error).message); // e.g. 0021 not run yet
  }
}

/** notify() once the response has gone out: a push never slows down the action that triggered it. `who` can be a
 *  lookup (desk staff, a branch's members), which then runs after the response too. */
export function notifyAfter(who: (string | null | undefined)[] | (() => Promise<string[]>), msg: PushMessage) {
  after(async () => notify(typeof who === "function" ? await who() : who, msg));
}

/** The owner(s), plus the staff who work at this branch (all-branch staff always). null branch = every desk. */
export async function deskIds(branchId: string | null) {
  const { data } = await adminDb().from("profiles").select("id,role,home_branch_id,all_branches").in("role", ["admin", "staff"]);
  return (data ?? []).filter((p) => p.role === "admin" || p.all_branches || !branchId || p.home_branch_id === branchId).map((p) => p.id as string);
}

export const ownerIds = async () => ((await adminDb().from("profiles").select("id").eq("role", "admin")).data ?? []).map((p) => p.id as string);
