"use server";

import { redirect } from "next/navigation";
import { adminDb, requireUser } from "@/lib/supabase";
import { allow, SLOW_DOWN } from "@/lib/rate-limit";
import { activateByOrder, createOrder, razorpayEnabled, verifyCheckout } from "@/lib/razorpay";
import { deskIds, notifyAfter } from "@/lib/push";
import QRCode from "qrcode";
import { branchUpi, inr, upiLink } from "@/lib/gym";

type Pending = { id: string; amount_paise: number };

async function createPending(planId: string, branchId: string, method: "razorpay" | "upi_qr") {
  const { supabase, user, profile } = await requireUser(`/buy/${planId}`);
  if (!(await allow([`order:${user.id}`], 10, 3600))) return { error: SLOW_DOWN } as const; // unpaid orders pile up at the desk
  const { data, error } = await supabase.rpc("create_pending_subscription", {
    p_plan: planId,
    p_branch: branchId || null,
    p_method: method,
  });
  if (error) return { error: error.message } as const;
  return { sub: data as Pending, user, profile } as const;
}

export async function payAtDesk(planId: string, branchId: string) {
  const res = await createPending(planId, branchId, "upi_qr");
  if ("error" in res) return { error: res.error };
  // so the desk expects them (and has the UPI screenshot to verify when it arrives)
  notifyAfter(() => deskIds(branchId || null), { title: "Order waiting for payment", body: `${res.profile.full_name || "A member"} chose pay at the desk · ${inr(res.sub.amount_paise)}.`, url: "/admin/payments", tag: `order-${res.sub.id}` });
  redirect(`/pay/${res.sub.id}`);
}

/**
 * Dashboard renew / upgrade by UPI, without leaving the page: the unpaid order plus what to pay it with — the branch's
 * UPI link (opens their UPI app on a phone) and its QR. The screenshot then goes to the desk to verify (sendPaymentProof).
 */
export async function startUpi(planId: string, branchId: string) {
  const res = await createPending(planId, branchId, "upi_qr");
  if ("error" in res) return { error: res.error };
  const { sub } = res;
  const { data: branch } = await adminDb().from("branches").select("upi_id").eq("id", branchId || "").maybeSingle();
  const upi = branchUpi(branch);
  if (!upi) {
    await adminDb().from("subscriptions").update({ status: "cancelled" }).eq("id", sub.id).eq("status", "pending");
    return { error: "UPI isn't set up for this branch yet — pay at the desk." };
  }
  const ref = sub.id.slice(0, 8).toUpperCase();
  const link = upiLink(sub.amount_paise, ref, upi);
  const qr = await QRCode.toDataURL(link, { margin: 1, width: 560, color: { dark: "#0a0a0a", light: "#f4f2ee" } });
  return { order: { id: sub.id, amount: sub.amount_paise, ref, link, qr } };
}

export async function startOnline(planId: string, branchId: string) {
  if (!razorpayEnabled) return { error: "Online payment isn't set up yet — pay at the desk." };
  const res = await createPending(planId, branchId, "razorpay");
  if ("error" in res) return { error: res.error };
  const { sub, user, profile } = res;
  if (sub.amount_paise < 100) return { error: "Online price isn't set for this plan yet — pay at the desk." };

  const order = await createOrder(sub.amount_paise, sub.id);
  await adminDb().from("subscriptions").update({ razorpay_order_id: order.id }).eq("id", sub.id);
  return {
    order: {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
      orderId: order.id,
      amount: order.amount,
      name: profile.full_name,
      email: user.email ?? "",
      phone: profile.phone ?? "",
    },
  };
}

export async function confirmOnline(orderId: string, paymentId: string, signature: string) {
  await requireUser();
  if (!verifyCheckout(orderId, paymentId, signature)) return { error: "Payment couldn't be verified. If money was taken, show the desk your payment ID." };
  const subId = await activateByOrder(orderId, paymentId);
  redirect(`/dashboard?pass=${subId}`); // dashboard opens the new pass as a pop-up
}
