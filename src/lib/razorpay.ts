import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { adminDb } from "./supabase";

const KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "";
const SECRET = process.env.RAZORPAY_KEY_SECRET ?? "";

/** Optional: without keys the site only offers pay-at-desk. */
export const razorpayEnabled = Boolean(KEY_ID && SECRET);

export async function createOrder(amountPaise: number, receipt: string) {
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${KEY_ID}:${SECRET}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amount: amountPaise, currency: "INR", receipt, notes: { subscription_id: receipt } }),
  });
  if (!res.ok) throw new Error(`Razorpay order failed: ${await res.text()}`);
  return (await res.json()) as { id: string; amount: number };
}

const hmacEqual = (payload: string, secret: string, signature: string) => {
  const expected = Buffer.from(createHmac("sha256", secret).update(payload).digest("hex"));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
};

/** Checkout success callback signature: HMAC(order_id|payment_id, key secret). */
export const verifyCheckout = (orderId: string, paymentId: string, signature: string) =>
  razorpayEnabled && hmacEqual(`${orderId}|${paymentId}`, SECRET, signature);

/** Webhook signature: HMAC(raw body, webhook secret). */
export const verifyWebhook = (rawBody: string, signature: string) =>
  !!process.env.RAZORPAY_WEBHOOK_SECRET && hmacEqual(rawBody, process.env.RAZORPAY_WEBHOOK_SECRET, signature);

/** Idempotent: the checkout callback and the webhook may both arrive. */
export async function activateByOrder(orderId: string, paymentId: string) {
  const supabase = adminDb();
  const { data: sub } = await supabase.from("subscriptions").select("id").eq("razorpay_order_id", orderId).single();
  if (!sub) throw new Error(`No subscription for order ${orderId}`);
  const { error } = await supabase.rpc("activate_subscription", { p_sub: sub.id, p_payment_id: paymentId });
  if (error) throw new Error(error.message);
  return sub.id as string;
}
