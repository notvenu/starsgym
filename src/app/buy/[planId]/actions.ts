"use server";

import { adminDb, requireUser } from "@/lib/supabase";
import { allow, SLOW_DOWN } from "@/lib/rate-limit";
import QRCode from "qrcode";
import { proofUrls } from "@/lib/photo";
import { branchUpi, upiLink } from "@/lib/gym";

type Pending = { id: string; amount_paise: number };

async function createPending(planId: string, branchId: string, method: "upi_qr") {
  const { supabase, user, profile } = await requireUser(`/buy/${planId}`);
  if (!(await allow([`order:${user.id}`], 10, 3600))) return { error: SLOW_DOWN } as const; // unpaid orders pile up at the desk
  // one request at a time: picking again replaces the unpaid one (an edit) — unless its screenshot is already with the
  // desk, which must settle it first (money may have been sent for it)
  const { data: open } = await supabase.from("subscriptions").select("id").eq("user_id", user.id).eq("status", "pending");
  const ids = (open ?? []).map((o) => o.id as string);
  if ((await proofUrls(ids)).size) return { error: "You've already sent a payment for your last request — the desk is checking it. You can renew again once they confirm it." } as const;
  if (ids.length) await adminDb().from("subscriptions").update({ status: "cancelled" }).in("id", ids).eq("status", "pending");
  const { data, error } = await supabase.rpc("create_pending_subscription", {
    p_plan: planId,
    p_branch: branchId || null,
    p_method: method,
  });
  if (error) return { error: error.message } as const;
  return { sub: data as Pending, user, profile } as const;
}

/**
 * Dashboard renew / upgrade and /buy checkout — UPI is the only way members pay online, without leaving the page: the unpaid order plus what to pay it with — the branch's
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
    return { error: "UPI isn't set up for this branch yet — ask at the desk." };
  }
  const ref = sub.id.slice(0, 8).toUpperCase();
  const link = upiLink(sub.amount_paise, ref, upi);
  const qr = await QRCode.toDataURL(link, { margin: 1, width: 560, color: { dark: "#0a0a0a", light: "#f4f2ee" } });
  return { order: { id: sub.id, amount: sub.amount_paise, ref, link, qr } };
}
