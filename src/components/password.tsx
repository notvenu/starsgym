"use client";

import { useActionState, useState } from "react";
import { finishAccount } from "@/app/login/actions";
import { Field } from "@/components/client";
import { ResultToast, keepFields } from "@/components/feedback";
import { Sheet } from "@/components/sheet";

/** Pops up after signing in while the account still needs its own password and/or an email. "Later" closes it for now;
 *  it's back on the next visit until it's done. */
export function AccountNudge({ password, email }: { password: boolean; email: boolean }) {
  const [later, setLater] = useState(false);
  const [state, action, pending] = useActionState(finishAccount, undefined);
  const open = !later && !state?.message; // closes once saved
  return (
    <Sheet title={password && email ? "Finish your account" : password ? "Set your own password" : "Add your email"} open={open} onClose={() => setLater(true)}>
      <form noValidate onSubmit={keepFields(action)} className="flex flex-col gap-4">
        {password && <p className="text-sm text-body">You&apos;re signed in with the starting password from the desk. Anyone who knows your name and phone number could guess it, so pick your own.</p>}
        {email && <p className="text-sm text-body">Add your email so you can also sign in with it, and so we can reach you about holidays and your plan.</p>}
        {email && <Field label={password ? "Email (optional)" : "Email"} name="email" type="email" autoComplete="email" inputMode="email" required={!password} />}
        {password && (
          <>
            <Field label="New password" name="password" type="password" autoComplete="new-password" minLength={8} required />
            <Field label="Type it again" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
          </>
        )}
        <ResultToast state={state} />
        <div className="flex flex-wrap gap-3">
          <button disabled={pending} className="btn-red min-h-12 flex-1">{pending ? "Saving…" : "Save"}</button>
          <button type="button" onClick={() => setLater(true)} className="btn-ghost min-h-12">Later</button>
        </div>
      </form>
    </Sheet>
  );
}
