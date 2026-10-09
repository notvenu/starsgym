"use server";

import { redirect } from "next/navigation";
import { adminDb, requireUser } from "@/lib/supabase";
import { activateByOrder, createOrder, razorpayEnabled, verifyCheckout } from "@/lib/razorpay";

type Pending = { id: string; amount_paise: number };

async function createPending(planId: string, branchId: string, method: "razorpay" | "upi_qr") {
  const { supabase, user, profile } = await requireUser(`/buy/${planId}`);
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
  redirect(`/pay/${res.sub.id}`);
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
