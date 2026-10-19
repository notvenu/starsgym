import { adminDb } from "@/lib/supabase";
import { gymDate, gymDateIn, planName, prettyDay, type Plan } from "@/lib/gym";
import { notify } from "@/lib/push";

/**
 * Daily (vercel.json, 9:00 IST): a push to members whose plan ends in 3 days or today and who haven't bought the next
 * one yet. Vercel Cron calls it with "Authorization: Bearer $CRON_SECRET"; anyone else gets a 401.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });

  const db = adminDb();
  const today = gymDate();
  const soon = gymDateIn(3);
  const { data } = await db
    .from("subscriptions")
    .select("id,user_id,ends_on,plans(*)")
    .eq("status", "active")
    .in("ends_on", [today, soon]);
  const ending = (data ?? []) as unknown as { id: string; user_id: string; ends_on: string; plans: Plan }[];
  if (!ending.length) return Response.json({ sent: 0 });

  // already renewed: a plan of theirs runs past this one
  const { data: next } = await db.from("subscriptions").select("user_id,ends_on").eq("status", "active").gt("ends_on", soon).in("user_id", ending.map((e) => e.user_id));
  const renewed = new Set((next ?? []).map((n) => n.user_id as string));
  const todo = ending.filter((e) => !renewed.has(e.user_id) && e.plans.duration_days > 1); // day passes and trials just end

  await Promise.all(todo.map((e) => notify([e.user_id], {
    title: e.ends_on === today ? "Your plan ends today" : `Your plan ends ${prettyDay(e.ends_on)}`,
    body: `${planName(e.plans)} — renew now to keep your streak going.`,
    url: e.plans.active ? `/buy/${e.plans.id}` : "/#plans",
    tag: `ending-${e.id}`,
  })));
  return Response.json({ sent: todo.length });
}
