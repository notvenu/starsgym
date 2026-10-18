"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { Field, MemberDetailsFields } from "@/components/client";
import { checkFields } from "@/components/feedback";
import { signIn, signUp } from "./actions";

const ACTIONS = { signin: signIn, signup: signUp };

export function AuthForm({ mode, next }: { mode: keyof typeof ACTIONS; next: string }) {
  const [state, action, pending] = useActionState(ACTIONS[mode], undefined);
  const password = useRef<HTMLInputElement>(null);

  // wrong password: the email / phone stays, the password clears and gets the cursor for another go
  useEffect(() => {
    if (mode === "signin" && state?.error && password.current) {
      password.current.value = "";
      password.current.focus();
    }
  }, [state, mode]);

  return (
    <form
      // submitted by hand rather than with action={…}: React resets a form after its action runs, which wiped every
      // field whenever the server answered with an error. This way nothing typed is lost.
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!checkFields(e.currentTarget)) return; // our own messages under each field, not the browser's bubbles
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      className="flex max-w-md flex-col gap-4"
    >
      <input type="hidden" name="next" value={next} />
      {mode === "signup" ? (
        <>
          <Field label="Full name" name="full_name" autoComplete="name" required />
          <MemberDetailsFields />
          <Field label="Email" name="email" type="email" autoComplete="email" required />
        </>
      ) : (
        <Field label="Email or phone" name="identifier" autoComplete="username" inputMode="email" placeholder="you@email.com or 98765 43210" required />
      )}
      <Field ref={password} label="Password" name="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={mode === "signup" ? 8 : undefined} required />
      {mode === "signin" && (
        <p className="-mt-1 text-sm text-ash">Joined at the desk? Use the starting password the desk gave you. Forgot it? The desk can reset it.</p>
      )}
      {/* the answer stays on the page next to the button, not just in a toast that fades */}
      {state?.error && !pending && (
        <p role="alert" className="flex items-start gap-2 rounded-md border border-redline bg-redwash px-4 py-3 text-sm font-semibold text-chalk">
          <span aria-hidden="true" className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-red text-[11px] font-bold text-white">!</span>
          {state.error}
        </p>
      )}
      {state?.message && !pending && (
        <p role="status" className="rounded-md border border-line bg-panel px-4 py-3 text-sm font-semibold text-chalk">{state.message}</p>
      )}
      <button disabled={pending} className="btn-red mt-2 min-h-14 text-base">
        {pending ? "One sec…" : mode === "signup" ? "Create account" : "Sign in"}
      </button>
    </form>
  );
}
