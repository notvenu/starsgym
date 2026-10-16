"use client";

import { useActionState } from "react";
import { Field, MemberDetailsFields } from "@/components/client";
import { ResultToast } from "@/components/feedback";
import { magicLink, signIn, signUp } from "./actions";

const ACTIONS = { signin: signIn, signup: signUp, link: magicLink };

export function AuthForm({ mode, next }: { mode: keyof typeof ACTIONS; next: string }) {
  const [state, action, pending] = useActionState(ACTIONS[mode], undefined);

  return (
    <form action={action} className="flex max-w-md flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      {mode === "signup" && (
        <>
          <Field label="Full name" name="full_name" autoComplete="name" required />
          <MemberDetailsFields />
        </>
      )}
      <Field label="Email" name="email" type="email" autoComplete="email" required />
      {mode !== "link" && (
        <Field label="Password" name="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={mode === "signup" ? 8 : undefined} required />
      )}
      <ResultToast state={state} />
      <button disabled={pending} className="btn-red mt-2 min-h-14 text-base">
        {pending ? "One sec…" : mode === "signup" ? "Create account" : mode === "link" ? "Email me a link" : "Sign in"}
      </button>
    </form>
  );
}
