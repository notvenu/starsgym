"use client";

import { useActionState } from "react";
import { Field } from "@/components/client";
import { ResultToast, keepFields } from "@/components/feedback";
import type { Branch } from "@/lib/gym";
import { sendEnquiry } from "./actions";

const TOPICS = [
  ["general", "General question"],
  ["membership", "Membership"],
  ["personal_training", "Personal training"],
  ["corporate", "Corporate / group"],
];

export function EnquiryForm({ branches, topic }: { branches: Branch[]; topic: string }) {
  const [state, action, pending] = useActionState(sendEnquiry, undefined);
  if (state?.ok)
    return (
      <div role="status" className="flex min-h-80 flex-col items-center justify-center gap-3 rounded-md border border-red bg-redwash p-8 text-center">
        <p className="font-display text-5xl uppercase">Got it.</p>
        <p className="text-body">We&apos;ll call or WhatsApp you within a working day.</p>
      </div>
    );

  return (
    <form noValidate onSubmit={keepFields(action)} className="flex flex-col gap-4 rounded-md border border-line bg-carbon p-6 sm:p-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name" name="name" autoComplete="name" required maxLength={100} />
        <Field label="Phone / WhatsApp" name="phone" type="tel" autoComplete="tel" required />
      </div>
      <Field label="Email (optional)" name="email" type="email" autoComplete="email" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="label">About</span>
          <select name="topic" defaultValue={topic} className="field">
            {TOPICS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="label">Branch</span>
          <select name="branch_id" className="field">
            <option value="">Any</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="label">Message</span>
        <textarea name="message" rows={4} maxLength={2000} className="field py-3" />
      </label>
      {/* honeypot, hidden from people */}
      <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <ResultToast state={state} />
      <button disabled={pending} className="btn-red min-h-14 text-base">{pending ? "Sending…" : "Send"}</button>
    </form>
  );
}
