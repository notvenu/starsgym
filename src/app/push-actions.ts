"use server";

import { adminDb, currentUserId } from "@/lib/supabase";
import { allow, SLOW_DOWN } from "@/lib/rate-limit";
import { notify } from "@/lib/push";

type Sub = { endpoint: string; keys?: { p256dh?: string; auth?: string } };

/** This device's push subscription, saved for the signed-in person (a device that signs in as someone else moves over). */
export async function savePush(sub: Sub): Promise<{ error?: string }> {
  const uid = await currentUserId();
  if (!uid) return { error: "Sign in first." };
  if (!(await allow([`push:${uid}`], 20, 3600))) return { error: SLOW_DOWN };
  const { endpoint, keys } = sub ?? {};
  if (typeof endpoint !== "string" || !endpoint.startsWith("https://") || endpoint.length > 1000 || !keys?.p256dh || !keys?.auth) return { error: "That browser gave an invalid subscription." };
  const db = adminDb();
  const { data: had } = await db.from("push_subscriptions").select("user_id").eq("endpoint", endpoint).maybeSingle();
  const { error } = await db.from("push_subscriptions").upsert({ endpoint, user_id: uid, p256dh: keys.p256dh, auth: keys.auth });
  if (error) return { error: /push_subscriptions/.test(error.message) ? "Notifications aren't set up yet — ask the gym." : error.message };
  // a first "it works" ping, only when this device is new for this person (the page re-saves it on every visit)
  if (had?.user_id !== uid) await notify([uid], { title: "Notifications on", body: "You'll hear from Stars Gym about payments, your plan and holidays.", url: "/app", tag: "welcome" });
  return {};
}

export async function removePush(endpoint: string) {
  const uid = await currentUserId();
  if (!uid || typeof endpoint !== "string") return;
  await adminDb().from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", uid);
}
