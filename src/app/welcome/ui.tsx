"use client";

import { useActionState } from "react";
import { Field, MemberDetailsFields } from "@/components/client";
import { ResultToast, keepFields } from "@/components/feedback";
import { PhotoCapture } from "@/components/photo";
import type { Profile } from "@/lib/supabase";
import { LEVELS } from "@/lib/workouts";
import { saveDetails } from "./actions";

export function WelcomeForm({ profile, photo, next }: { profile: Profile | null; photo: string | null; next: string }) {
  const [state, action, pending] = useActionState(saveDetails, undefined);
  return (
    <form noValidate onSubmit={keepFields(action)} className="flex w-full max-w-md flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <PhotoCapture current={photo} label="Your photo" />
      <Field label="Full name" name="full_name" autoComplete="name" defaultValue={profile?.full_name ?? ""} required />
      <MemberDetailsFields d={profile} />
      {profile && "experience" in profile && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="label mb-1.5">Gym experience</legend>
          <input type="hidden" name="ask_experience" value="1" />
          <div className="flex flex-col gap-2">
            {LEVELS.map((l) => (
              <label key={l.key} className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded border border-strong px-4 has-checked:border-red has-checked:bg-redwash has-focus-visible:outline-2 has-focus-visible:outline-red">
                <input type="radio" name="experience" value={l.key} defaultChecked={profile.experience === l.key} required className="sr-only" />
                <span className="font-bold">{l.label}</span>
                <span className="text-sm text-ash">{l.span}</span>
              </label>
            ))}
          </div>
          <p className="text-sm text-ash">We use it to suggest your workout split.</p>
        </fieldset>
      )}
      <ResultToast state={state} />
      <button disabled={pending} className="btn-red mt-2 min-h-14 text-base">{pending ? "Saving…" : "Continue"}</button>
    </form>
  );
}
