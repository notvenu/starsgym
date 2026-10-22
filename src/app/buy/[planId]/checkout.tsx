"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/feedback";
import { inr, type Branch } from "@/lib/gym";
import { ProofUpload } from "../../pay/[subId]/proof";
import { startUpi } from "./actions";

export type UpiOrder = { id: string; amount: number; ref: string; link: string; qr: string };

/** Paying a member's own order: UPI app (or the QR), then the screenshot — required; the desk checks it and starts the plan. */
export function UpiPay({ order, onSent }: { order: UpiOrder; onSent: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <p className="font-display text-6xl leading-none">{inr(order.amount)}</p>
      <p className="font-label text-lg font-bold tracking-[0.2em]">REF {order.ref}</p>
      {/* phones: straight into GPay / PhonePe / Paytm with the amount filled in */}
      <a href={order.link} className="btn-red min-h-14 w-full max-w-sm text-base">Pay with a UPI app</a>
      <details className="w-full max-w-sm text-sm text-ash">
        <summary className="min-h-11 cursor-pointer list-none py-3 font-semibold hover:text-chalk">Paying from another phone? Show the QR</summary>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={order.qr} alt={`UPI QR for ${inr(order.amount)}`} width={240} height={240} className="mx-auto rounded-lg border-8 border-chalk" />
      </details>
      <p className="text-sm text-ash">After paying, send the screenshot. It&apos;s needed — the desk matches it with the payment before starting your plan.</p>
      <ProofUpload subId={order.id} sent={null} onSent={onSent} />
    </div>
  );
}

/** /buy checkout: UPI only — the order, the UPI step, then the dashboard once the screenshot is sent. */
export function Checkout({ planId, branches, homeBranch }: { planId: string; branches: Branch[]; homeBranch: string | null }) {
  const router = useRouter();
  const [branchId, setBranchId] = useState(homeBranch ?? branches[0]?.id ?? "");
  const [order, setOrder] = useState<UpiOrder>();
  const [pending, start] = useTransition();

  const upi = () =>
    start(async () => {
      const r = await startUpi(planId, branchId);
      if ("error" in r) return void toast(r.error!, "error");
      setOrder(r.order);
    });

  return (
    <div className="card flex flex-col gap-6 self-start p-6 sm:p-8">
      {order ? (
        <UpiPay order={order} onSent={() => router.push("/dashboard")} />
      ) : (
        <>
          {branches.length > 1 && (
            <label className="flex flex-col gap-1.5">
              <span className="label">Branch</span>
              <select className="field" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
          )}
          <button onClick={upi} disabled={pending} className="btn-red min-h-16 text-lg">{pending ? "Working…" : "Pay by UPI"}</button>
          <p className="-mt-3 text-center text-sm text-ash">Pay, then send the screenshot. Your plan starts once the desk confirms it.</p>
        </>
      )}
    </div>
  );
}
