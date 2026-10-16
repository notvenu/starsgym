"use client";

import { useActionState, useState, useTransition } from "react";
import { Field } from "@/components/client";
import { confirmDialog, ResultToast, toastResult } from "@/components/feedback";
import type { Branch, SiteItem } from "@/lib/gym";
import { deleteItem } from "../content/actions";
import { PhotoInput } from "../content/ui";
import { Segmented, Sheet } from "../ui";
import { saveTeam, type Result } from "./actions";

export type Person = {
  key: string;
  name: string;
  email: string | null;
  photo: string | null;
  profileId: string | null;
  role: "admin" | "staff" | null; // desk access; null = none
  branch: string; // a branch id, or "all"
  branchLabel: string;
  item: SiteItem | null; // their trainer card
  self: boolean;
};

const ACCESS: [string, string][] = [["none", "No desk access"], ["staff", "Staff"], ["admin", "Admin"]];

/** One person: name and branch, then the two switches — desk access and a trainer card on the website. */
export function TeamForm({ person, branches, onDone }: { person?: Person; branches: Branch[]; onDone?: () => void }) {
  const [access, setAccess] = useState<string>(person?.role ?? "none");
  const [trainer, setTrainer] = useState(person ? !!person.item?.active : true);
  const [pending, start] = useTransition();
  const [state, action, saving] = useActionState(async (prev: Result, form: FormData) => {
    const res = await saveTeam(prev, form);
    if (res?.ok) onDone?.();
    return res;
  }, undefined);
  const item = person?.item;

  return (
    <form action={action} className="flex flex-col gap-5">
      {person?.profileId && <input type="hidden" name="profile_id" value={person.profileId} />}
      {item && <input type="hidden" name="item_id" value={item.id} />}
      <input type="hidden" name="access" value={access} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" name="name" defaultValue={person?.name} required autoComplete="off" />
        <label className="flex flex-col gap-1.5">
          <span className="label">Branch</span>
          <select name="branch" defaultValue={person?.branch ?? branches[0]?.id ?? "all"} className="field">
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            <option value="all">Both branches</option>
          </select>
        </label>
      </div>

      <fieldset className="flex flex-col gap-3 rounded-lg border border-line p-4">
        <legend className="label px-1">Front desk</legend>
        {person?.self ? (
          <p className="text-sm text-ash">That&apos;s you — you keep admin access.</p>
        ) : (
          <>
            <Segmented label="Desk access" options={ACCESS} value={access} onChange={setAccess} />
            {access !== "none" && !person?.profileId && <Field label="Email (they sign in with it)" name="email" type="email" required autoComplete="off" />}
            {person?.profileId && person.email && <p className="text-sm text-ash">Signs in as {person.email}</p>}
            <p className="text-sm text-ash">
              {access === "staff" ? "Members, renewals, payments and check-ins at their branch — or both. No prices, website or analytics."
                : access === "admin" ? "Everything, at every branch, including this page."
                : "No sign-in to the desk."}
            </p>
          </>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-4 rounded-lg border border-line p-4">
        <legend className="label px-1">Website</legend>
        <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4">
          <span>
            <span className="block font-semibold">Show as a trainer</span>
            <span className="block text-sm text-ash">On Our Trainers, Personal Training and the homepage.</span>
          </span>
          <input type="checkbox" name="trainer" checked={trainer} onChange={(e) => setTrainer(e.target.checked)} className="size-6 shrink-0 cursor-pointer accent-red" />
        </label>
        {trainer && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Role / speciality" name="subtitle" defaultValue={item?.subtitle} placeholder="Head coach · Strength" />
              <Field label="Instagram link" name="url" type="url" defaultValue={item?.url ?? ""} placeholder="https://instagram.com/…" />
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="label">Short bio</span>
              <textarea name="body" rows={3} defaultValue={item?.body} className="field py-3" />
            </label>
            <PhotoInput label="Photo" file="photo" url="image_url" current={item?.image_path ?? null} />
            <Field label="Order (lower shows first)" name="sort" type="number" inputMode="numeric" defaultValue={item?.sort ?? 0} />
          </>
        )}
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button disabled={saving || pending} className="btn-red max-sm:flex-1">{saving ? "Saving…" : person ? "Save" : "Add to team"}</button>
        {item && (
          <button type="button" disabled={saving || pending} className="btn-ghost max-sm:flex-1"
            onClick={async () => (await confirmDialog({ title: `Delete ${item.title}'s trainer card?`, body: "It comes off the website for good. Desk access isn't touched. Untick “Show as a trainer” to just hide it.", confirm: "Delete card", danger: true }))
              && start(async () => { const r = await deleteItem(item.id); toastResult(r); if (r?.ok) onDone?.(); })}>
            Delete card
          </button>
        )}
        <ResultToast state={state} />
      </div>
    </form>
  );
}

const CHIP = "rounded px-1.5 text-[11px] font-bold tracking-wider uppercase";

/** A team row: tap anywhere to edit. */
export function TeamRow({ person, branches }: { person: Person; branches: Branch[] }) {
  const [open, setOpen] = useState(false);
  const p = person;
  return (
    <li>
      <button type="button" onClick={() => setOpen(true)} className="flex w-full cursor-pointer items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-steel/60 sm:px-5">
        {p.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.photo} alt="" className="size-12 shrink-0 rounded-full border border-line object-cover" />
        ) : (
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full border border-line bg-steel font-display text-lg text-ash uppercase">{p.name.trim()[0] ?? "?"}</span>
        )}
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="truncate font-bold">{p.name}</span>
            {p.role === "admin" && <span className={`${CHIP} bg-red text-white`}>Admin</span>}
            {p.role === "staff" && <span className={`${CHIP} bg-steel text-chalk`}>Staff</span>}
            {p.item && <span className={`${CHIP} border ${p.item.active ? "border-redline text-red" : "border-line text-ash line-through"}`}>Trainer</span>}
          </span>
          <span className="block truncate text-sm text-ash">{[p.branchLabel, p.item?.active && p.item.subtitle, p.email].filter(Boolean).join(" · ")}</span>
        </span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="shrink-0 text-ash"><path d="M9 6l6 6-6 6" /></svg>
      </button>
      {open && (
        <Sheet title={p.name} open onClose={() => setOpen(false)}>
          <TeamForm person={p} branches={branches} onDone={() => setOpen(false)} />
        </Sheet>
      )}
    </li>
  );
}
