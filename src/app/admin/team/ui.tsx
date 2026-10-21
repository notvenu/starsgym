"use client";

import { useActionState, useState, useTransition } from "react";
import { Field } from "@/components/client";
import { confirmDialog, ResultToast, toastResult, keepFields } from "@/components/feedback";
import type { Branch, SiteItem } from "@/lib/gym";
import { deleteItem } from "../content/actions";
import { PhotoInput } from "../content/ui";
import { Segmented, Sheet } from "../ui";
import { resetStaffPassword, saveTeam, type Result } from "./actions";

const showPassword = (password: string) =>
  confirmDialog({ title: "Temporary password", body: `${password}

Give it to them in person. It won't be shown again; they'll be asked to set their own when they sign in.`, confirm: "Done" });

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

const ROLES: [string, string][] = [["trainer", "Trainer"], ["staff", "Desk staff"], ["both", "Trainer + desk"], ["admin", "Admin"]];
const ROLE_HINT: Record<string, string> = {
  trainer: "Shown on the website. No sign-in.",
  staff: "Signs in to the front desk: members, renewals, payments, check-ins.",
  both: "On the website, and signs in to the front desk.",
  admin: "Everything, at every branch, including this page.",
};

const startRole = (p?: Person) =>
  !p ? "trainer" : p.role === "admin" ? "admin" : p.role === "staff" ? (p.item?.active ? "both" : "staff") : "trainer";

/** One person: name, one role choice, then only the fields that role needs. */
export function TeamForm({ person, branches, onDone }: { person?: Person; branches: Branch[]; onDone?: () => void }) {
  const [role, setRole] = useState(startRole(person));
  const [adminCard, setAdminCard] = useState(!!person?.item?.active); // an admin who also coaches
  const [pending, start] = useTransition();
  const [state, action, saving] = useActionState(async (prev: Result, form: FormData) => {
    const res = await saveTeam(prev, form);
    if (res?.password) await showPassword(res.password);
    if (res?.ok) {
      toastResult(res); // shown here: a form that closes on success takes its own message with it
      onDone?.();
    }
    return res?.ok ? undefined : res;
  }, undefined);
  const item = person?.item;
  const access = role === "trainer" ? "none" : role === "admin" ? "admin" : "staff";
  const trainer = role === "trainer" || role === "both" || (role === "admin" && adminCard);
  const needsEmail = access !== "none" && !person?.profileId;

  return (
    <form noValidate onSubmit={keepFields(action)} className="flex flex-col gap-5">
      {person?.profileId && <input type="hidden" name="profile_id" value={person.profileId} />}
      {item && <input type="hidden" name="item_id" value={item.id} />}
      <input type="hidden" name="access" value={access} />
      {trainer && <input type="hidden" name="trainer" value="on" />}

      <Field label="Name" name="name" defaultValue={person?.name} required autoComplete="off" />

      {person?.self ? (
        <p className="text-sm text-ash">That&apos;s you — you keep admin access.</p>
      ) : (
        <div className="flex flex-col gap-2">
          <span className="label">Role</span>
          <Segmented label="Role" options={ROLES} value={role} onChange={setRole} />
          <p className="text-sm text-ash">{ROLE_HINT[role]}</p>
        </div>
      )}

      {needsEmail && (
        <>
          <Field label="Email — they sign in with it" name="email" type="email" required autoComplete="off" inputMode="email" />
          {/* the owner sets it here and tells them; no temporary password to pass along and change */}
          <Field label="Password — at least 8 characters" name="password" type="text" required minLength={8} autoComplete="new-password" spellCheck={false} />
        </>
      )}
      {access !== "none" && person?.email && <p className="-mt-2 text-sm text-ash">Signs in as {person.email}</p>}

      {role === "admin" && (
        <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4">
          <span className="font-semibold">Also show on the website as a trainer</span>
          <input type="checkbox" checked={adminCard} onChange={(e) => setAdminCard(e.target.checked)} className="size-6 shrink-0 cursor-pointer accent-red" />
        </label>
      )}

      {(role !== "admin" || adminCard) && (
        <label className="flex flex-col gap-1.5">
          <span className="label">Branch</span>
          <select name="branch" defaultValue={person?.branch ?? branches[0]?.id ?? "all"} className="field">
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            <option value="all">Both branches</option>
          </select>
        </label>
      )}
      {role === "admin" && !adminCard && <input type="hidden" name="branch" value="all" />}

      {trainer && (
        <>
          <Field label="Speciality" name="subtitle" defaultValue={item?.subtitle} placeholder="Head coach · Strength" />
          <label className="flex flex-col gap-1.5">
            <span className="label">Personal training fee per month</span>
            <span className="flex items-center rounded border border-line bg-ink focus-within:border-red">
              <span className="pl-3 text-ash">₹</span>
              <input name="pt_fee" type="number" inputMode="decimal" min="0" step="any" defaultValue={item?.pt_fee_paise ? item.pt_fee_paise / 100 : ""} placeholder="Standard PT price" className="min-h-11 w-full min-w-0 bg-transparent px-2 font-bold text-chalk outline-none" />
            </span>
            <span className="text-xs text-ash">The desk charges this × months when they&apos;re picked for PT. Blank = the standard price from Pricing.</span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">Their UPI ID (optional)</span>
            <input name="upi_id" defaultValue={item?.upi_id ?? ""} placeholder="name@okaxis" autoComplete="off" spellCheck={false} className="field" />
            <span className="text-xs text-ash">PT orders with them as trainer show a QR for this ID, so the PT fee goes straight to them. Blank = the branch&apos;s UPI.</span>
          </label>
          <PhotoInput label="Photo" file="photo" url="image_url" current={item?.image_path ?? null} />
          <details className="group rounded-lg border border-line">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 text-sm font-semibold text-ash">
              More for the website <span className="transition-transform group-open:rotate-180" aria-hidden="true">▾</span>
            </summary>
            <div className="flex flex-col gap-4 border-t border-line p-4">
              <Field label="Instagram link" name="url" type="url" defaultValue={item?.url ?? ""} placeholder="https://instagram.com/…" />
              <label className="flex flex-col gap-1.5">
                <span className="label">Short bio</span>
                <textarea name="body" rows={3} defaultValue={item?.body} className="field py-3" />
              </label>
              <Field label="Order on the page (lower first)" name="sort" type="number" inputMode="numeric" defaultValue={item?.sort ?? 0} />
            </div>
          </details>
        </>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button disabled={saving || pending} className="btn-red min-h-12">{saving ? "Saving…" : person ? "Save" : "Add to team"}</button>
        {item && (
          <button type="button" disabled={saving || pending} className="min-h-11 cursor-pointer text-sm font-semibold text-ash hover:text-red"
            onClick={async () => (await confirmDialog({ title: `Delete ${item.title}'s trainer card?`, body: "It comes off the website for good. Sign-in access isn't touched. Pick “Desk staff” to just hide the card.", confirm: "Delete card", danger: true }))
              && start(async () => { const r = await deleteItem(item.id); toastResult(r); if (r?.ok) onDone?.(); })}>
            Delete trainer card
          </button>
        )}
        {person?.profileId && person.role && !person.self && (
          <button type="button" disabled={saving || pending} className="min-h-11 cursor-pointer text-sm font-semibold text-ash hover:text-red"
            onClick={async () => (await confirmDialog({ title: `Reset ${person.name}'s password?`, body: "You'll get a one-time password to give them. Their old one stops working.", confirm: "Reset password" }))
              && start(async () => { const r = await resetStaffPassword(person.profileId!); if (r?.password) await showPassword(r.password); else toastResult(r); })}>
            Reset password
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
          <img src={p.photo} alt="" loading="lazy" decoding="async" className="size-12 shrink-0 rounded-full border border-line object-cover" />
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
