"use client";

import { useActionState, useState } from "react";
import { ResultToast } from "@/components/feedback";
import { logFollowUp, type Result } from "./actions";
import { OUTCOMES } from "./outcomes";

/** "Log follow-up" on a row: one tap for what they said, an optional note, save. Closes itself once saved. */
export function FollowUpForm({ memberId }: { memberId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(async (prev: Result, form: FormData) => {
    const r = await logFollowUp(prev, form);
    if (r?.ok) setOpen(false);
    return r;
  }, undefined);

  if (!open) return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost min-h-9 px-3 text-xs">Log follow-up</button>
      <ResultToast state={state} />
    </>
  );
  return (
    <form action={action} className="flex w-full flex-col gap-3 rounded-md border border-line bg-panel p-3">
      <input type="hidden" name="member_id" value={memberId} />
      <fieldset className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        <legend className="label mb-2 text-xs">What did they say?</legend>
        {OUTCOMES.map((o, i) => (
          <label key={o} className="flex min-h-10 cursor-pointer items-center justify-center rounded border border-line px-2 text-center text-xs font-bold has-checked:border-red has-checked:bg-redwash">
            <input type="radio" name="outcome" value={o} defaultChecked={i === 0} className="sr-only" />{o}
          </label>
        ))}
      </fieldset>
      <input name="note" maxLength={200} placeholder="Note (optional) — e.g. back after exams" className="field" aria-label="Note" />
      <div className="flex gap-2">
        <button disabled={pending} className="btn-red min-h-10 flex-1 sm:flex-none">{pending ? "Saving…" : "Save"}</button>
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost min-h-10 flex-1 sm:flex-none">Cancel</button>
      </div>
      <ResultToast state={state} />
    </form>
  );
}
