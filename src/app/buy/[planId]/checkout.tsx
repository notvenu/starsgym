"use client";

import { useState, useTransition } from "react";
import Script from "next/script";
import { toast, toastResult } from "@/components/feedback";
import type { Branch } from "@/lib/gym";
import { confirmOnline, payAtDesk, startOnline } from "./actions";

type RazorpayResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
declare global {
  interface Window {
    Razorpay: new (opts: Record<string, unknown>) => { open(): void; on(e: string, cb: (r: { error: { description: string } }) => void): void };
  }
}

export function Checkout({ online: onlineEnabled, planId, branches, homeBranch }: { online: boolean; planId: string; branches: Branch[]; homeBranch: string | null }) {
  const [branchId, setBranchId] = useState(homeBranch ?? branches[0]?.id ?? "");
  const [pending, start] = useTransition();

  const online = () =>
    start(async () => {
      const res = await startOnline(planId, branchId);
      if ("error" in res) return toast(res.error!, "error");
      const { order } = res;
      const rzp = new window.Razorpay({
        key: order.key,
        order_id: order.orderId,
        amount: order.amount,
        currency: "INR",
        name: "Stars Gym",
        description: "The Fitness Arena",
        image: "/logo.png",
        prefill: { name: order.name, email: order.email, contact: order.phone },
        theme: { color: "#E3141C" },
        handler: (r: RazorpayResponse) =>
          start(async () => {
            const done = await confirmOnline(r.razorpay_order_id, r.razorpay_payment_id, r.razorpay_signature);
            toastResult(done);
          }),
      });
      rzp.on("payment.failed", (r) => toast(r.error.description, "error"));
      rzp.open();
    });

  const desk = () =>
    start(async () => {
      const res = await payAtDesk(planId, branchId);
      toastResult(res);
    });

  return (
    <div className="card flex flex-col gap-6 self-start p-6 sm:p-8">
      {onlineEnabled && <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />}
      {branches.length > 1 && (
        <label className="flex flex-col gap-1.5">
          <span className="label">Branch</span>
          <select className="field" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
      )}
      {onlineEnabled && (
        <>
          <button onClick={online} disabled={pending} className="btn-red min-h-16 text-lg">
            {pending ? "Working…" : "Pay online"}
          </button>
          <p className="-mt-3 text-center text-sm text-ash">UPI, cards, netbanking — via Razorpay</p>
          <div className="flex items-center gap-3 text-sm text-ash"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
        </>
      )}
      <button onClick={desk} disabled={pending} className={onlineEnabled ? "btn-ghost min-h-14" : "btn-red min-h-16 text-lg"}>
        {pending && !onlineEnabled ? "Working…" : "Pay at the desk"}
      </button>
    </div>
  );
}
