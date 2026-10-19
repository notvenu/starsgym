"use client";

import { useActionState } from "react";
import { keepFields, ResultToast } from "@/components/feedback";
import { ProofInput } from "@/components/receipt";
import { sendPaymentProof } from "./actions";

/** "Paid by UPI? Send the screenshot": the desk verifies it and activates the plan. Shows the one already sent. */
export function ProofUpload({ subId, sent }: { subId: string; sent: string | null }) {
  const [state, action, pending] = useActionState(sendPaymentProof, undefined);
  return (
    <form noValidate onSubmit={keepFields(action)} className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-line bg-carbon p-5 text-left">
      <input type="hidden" name="id" value={subId} />
      {sent ? (
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={sent} alt="Your payment screenshot" className="size-16 shrink-0 rounded-md border border-red object-cover" />
          <p className="min-w-0 text-sm"><b className="block text-chalk">Screenshot sent</b><span className="text-ash">The desk is checking it. Your plan starts once they confirm.</span></p>
        </div>
      ) : (
        <p className="text-sm text-body"><b className="block text-chalk">Paid by UPI?</b>Send the payment screenshot. The desk checks it and starts your plan.</p>
      )}
      <ProofInput required hint={sent ? "Wrong one? Send it again." : "The screen your UPI app shows after paying, with the amount and UTR."} />
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="btn-red min-h-12 max-sm:w-full">{pending ? "Sending…" : sent ? "Send again" : "Send screenshot"}</button>
        <ResultToast state={state} />
      </div>
    </form>
  );
}
