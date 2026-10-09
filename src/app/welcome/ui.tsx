"use client";

import { useActionState } from "react";
import { Field, MemberDetailsFields } from "@/components/client";
import type { Profile } from "@/lib/supabase";
import { saveDetails } from "./actions";

export function WelcomeForm({ profile, next }: { profile: Profile | null; next: string }) {
  const [state, action, pending] = useActionState(saveDetails, undefined);
  return (
    <form action={action} className="flex w-full max-w-md flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Full name" name="full_name" autoComplete="name" defaultValue={profile?.full_name ?? ""} required />
      <MemberDetailsFields d={profile} />
      {state?.error && <p role="alert" className="text-red">{state.error}</p>}
      <button disabled={pending} className="btn-red mt-2 min-h-14 text-base">{pending ? "Saving…" : "Continue"}</button>
    </form>
  );
}
