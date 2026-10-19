"use server";

import { revalidatePath } from "next/cache";
import { requireUser, UUID } from "@/lib/supabase";
import { formPhoto, saveProof } from "@/lib/photo";
import { allow, SLOW_DOWN } from "@/lib/rate-limit";

export type Result = { error?: string; ok?: string } | undefined;

/** Member paid a website order by UPI: their screenshot goes to the desk, who check it and mark the order paid. */
export async function sendPaymentProof(_: Result, form: FormData): Promise<Result> {
  const { supabase, user } = await requireUser();
  const subId = String(form.get("id") ?? "");
  if (!UUID.test(subId)) return { error: "Reload the page and try again." };
  if (!(await allow([`proof:${user.id}`], 10, 3600))) return { error: SLOW_DOWN };
  // RLS: a member only sees their own orders (the desk sees its branch's)
  const { data: sub } = await supabase.from("subscriptions").select("status").eq("id", subId).maybeSingle();
  if (!sub) return { error: "Order not found." };
  if (sub.status !== "pending") return { error: "This order is already settled." };
  const proof = formPhoto(form, "proof");
  if (proof.error) return { error: proof.error };
  if (!proof.file) return { error: "Add the screenshot of your payment." };
  try {
    await saveProof(subId, proof.file);
  } catch (e) {
    return { error: `Couldn't upload it: ${(e as Error).message}` };
  }
  revalidatePath(`/pay/${subId}`);
  revalidatePath("/admin", "layout");
  return { ok: "Screenshot sent — the desk will check it and start your plan." };
}
