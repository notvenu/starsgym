"use client";

import Link from "next/link";
import { Sheet } from "@/components/sheet";
export { Sheet };
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Field, MemberDetailsFields } from "@/components/client";
import { confirmDialog, ResultToast, toastResult } from "@/components/feedback";
import { PhotoCapture } from "@/components/photo";
import type { Profile } from "@/lib/supabase";
import { bestOffer, DAY_NAMES, discounted, DURATIONS, gymDate, hhmm, inr, planName, prettyDay, TRACKS, type Branch, type Holiday, type Offer, type Plan, type Track } from "@/lib/gym";
import { addHoliday, addMember, adminChangePhoto, adminSaveMember, cancelPlan, cancelSub, decideRequest, switchBranch, deleteHoliday, deleteMember, markPaid, renewMember, replaceDoorKey, setOrderPrice, saveAdmission, saveBranch, saveBranchAccess, saveLadiesHours, saveOffer, savePrices, setOfferActive, type Result } from "./actions";

const Status = ResultToast; // results show as toasts

/** A button that opens its content in a pop-up (a sheet from the bottom on phones). `startOpen` for deep links like ?new=1. */
export function AdminModal({ label, title, className = "btn-red", startOpen, children }: { label: React.ReactNode; title: string; className?: string; startOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(!!startOpen);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>{label}</button>
      <Sheet title={title} open={open} onClose={() => setOpen(false)}>{children}</Sheet>
    </>
  );
}

export function PendingRow({ id, title, meta }: { id: string; title: string; meta: string }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<Result>();
  const [editing, setEditing] = useState(false);
  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="font-bold">{title}</p>
        <p className="text-sm text-ash">{meta}</p>
        {editing ? (
          // agreed a different price at the desk (admission, if any, stays on top)
          <form
            className="mt-2 flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const rupees = Number(new FormData(e.currentTarget).get("rupees"));
              start(async () => {
                const r = await setOrderPrice(id, rupees);
                setState(r);
                if (!r?.error) setEditing(false);
              });
            }}
          >
            <span className="flex items-center rounded border border-line bg-ink focus-within:border-red">
              <span className="pl-3 text-ash">₹</span>
              <input name="rupees" type="number" inputMode="decimal" min="0" step="any" required autoFocus placeholder="Plan price" className="min-h-10 w-32 bg-transparent px-2 font-bold text-chalk outline-none" />
            </span>
            <button disabled={pending} className="btn-red min-h-10 px-4 text-xs">Save</button>
            <button type="button" onClick={() => setEditing(false)} className="btn-ghost min-h-10 px-3 text-xs">Close</button>
          </form>
        ) : (
          <button type="button" onClick={() => setEditing(true)} className="mt-1 cursor-pointer text-sm font-bold text-red hover:text-chalk">Change price</button>
        )}
        <Status state={state} />
      </div>
      <div className="flex shrink-0 gap-2 [&>*]:whitespace-nowrap max-sm:[&>*]:flex-1">
        <a href={`/pay/${id}`} className="btn-ghost min-h-10 px-3.5 text-xs">QR</a>
        <button disabled={pending} onClick={async () => (await confirmDialog({ title: "Cancel this order?", body: meta, confirm: "Cancel order", danger: true })) && start(async () => toastResult(await cancelSub(id)))} className="btn-ghost min-h-10 px-3.5 text-xs">Cancel</button>
        <button disabled={pending} onClick={() => start(async () => toastResult(await markPaid(id)))} className="btn-red min-h-10 px-4 text-xs">Mark paid</button>
      </div>
    </div>
  );
}

type Kind = "membership" | "day_pass" | "trial" | "none";
const KINDS: [Kind, string, string][] = [
  ["membership", "Membership", "Monthly to yearly"],
  ["day_pass", "Day pass", "One day"],
  ["trial", "Trial day", "First visit"],
  ["none", "Account only", "Sell later"],
];
const MEMBERSHIPS: Track[] = ["strength", "strength_cardio", "couples", "personal_training"];

/** Desk onboarding: details → pass → payment, then straight to the member's ticket. */
export function AddMemberForm({ branches, plans, offers, admissionPaise = 0 }: { branches: Branch[]; plans: Plan[]; offers: Offer[]; admissionPaise?: number }) {
  const [state, action, pending] = useActionState(addMember, undefined);
  return (
    <form action={action} className="flex flex-col gap-8">
      <Step n="01" title="Member details">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Full name" name="full_name" required />
          <Field label="Email" name="email" type="email" required />
          <Select label="Branch" name="branch_id" options={branches.map((b) => [b.id, b.name])} />
          <MemberDetailsFields />
          <div className="sm:col-span-2">
            <PhotoCapture label="Member photo · take it now, or they'll be asked at first sign-in" />
          </div>
        </div>
      </Step>
      <PlanSteps plans={plans} offers={offers} admissionPaise={admissionPaise} kinds={KINDS} first={2} verb="Create" pending={pending} state={state} />
    </form>
  );
}

/** Members list → Renew: sell an existing member their next plan. Starts the day after their current one ends. */
export function RenewForm({ userId, branchId, plans, offers, admissionPaise }: { userId: string; branchId: string | null; plans: Plan[]; offers: Offer[]; admissionPaise: number | null }) {
  const [state, action, pending] = useActionState(renewMember, undefined);
  return (
    <form action={action} className="flex flex-col gap-8">
      <input type="hidden" name="user_id" value={userId} />
      <input type="hidden" name="branch_id" value={branchId ?? ""} />
      <PlanSteps plans={plans} offers={offers} admissionPaise={admissionPaise} kinds={KINDS.filter(([k]) => k === "membership" || k === "day_pass")} first={1} verb="Renew" pending={pending} state={state} />
    </form>
  );
}

/** Pass → payment → submit. admissionPaise null = they've had a membership, so no admission field. */
function PlanSteps({ plans, offers, admissionPaise, kinds, first, verb, pending, state }: {
  plans: Plan[]; offers: Offer[]; admissionPaise: number | null; kinds: typeof KINDS; first: number; verb: string; pending: boolean; state: Result;
}) {
  const [kind, setKind] = useState<Kind>("membership");
  const [track, setTrack] = useState<Track>("strength");
  const [days, setDays] = useState(30);
  const [payment, setPayment] = useState("cash");
  const plan =
    kind === "none" ? undefined : plans.find((p) => (kind === "membership" ? p.track === track && p.duration_days === days : p.track === kind));
  const n = (i: number) => String(first + i).padStart(2, "0");

  return (
    <>
      <Step n={n(0)} title="Pass">
        <div className={`grid grid-cols-2 gap-2 ${kinds.length > 2 ? "sm:grid-cols-4" : ""}`}>
          {kinds.map(([k, label, sub]) => (
            <Choice key={k} name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} label={label} sub={sub} />
          ))}
        </div>
        {kind === "membership" && (
          <div className="flex flex-col gap-2">
            <Segmented label="Track" options={MEMBERSHIPS.map((t) => [t, TRACKS[t]])} value={track} onChange={(v) => setTrack(v as Track)} />
            <Segmented label="Length" options={DURATIONS.map((d) => [String(d.days), d.label])} value={String(days)} onChange={(v) => setDays(Number(v))} />
          </div>
        )}
        {plan && (
          <NegotiatedPrice
            key={plan.id}
            standard={discounted(plan.price_paise, bestOffer(offers, plan.track))}
            list={plan.price_paise}
            admission={MEMBERSHIPS.includes(plan.track) ? admissionPaise : null}
          />
        )}
        {kind !== "none" && !plan && <p className="text-red">That plan isn&apos;t available.</p>}
        <input type="hidden" name="plan_id" value={plan?.id ?? ""} />
      </Step>

      {plan && (
        <Step n={n(1)} title="Payment">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {[
              ["cash", "Cash received", "Activates now"],
              ["upi_paid", "UPI received", "Activates now"],
              ["qr", "Show UPI QR", "Mark paid after"],
            ].map(([v, label, sub]) => (
              <Choice key={v} name="payment" value={v} checked={payment === v} onChange={() => setPayment(v)} label={label} sub={sub} />
            ))}
          </div>
        </Step>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button disabled={pending || (kind !== "none" && !plan)} className="btn-red min-h-14 px-8 text-base">
          {pending ? "Saving…" : !plan ? "Create account" : payment === "qr" ? `${verb} & show QR` : `${verb} & issue pass`}
        </button>
        <Status state={state} />
      </div>
    </>
  );
}

/** Desk pricing: starts at the standard price (offer applied) and admission; staff can change either after negotiating. */
function NegotiatedPrice({ standard, list, admission }: { standard: number; list: number; admission: number | null }) {
  const [price, setPrice] = useState(String(standard / 100));
  const [fee, setFee] = useState(admission !== null ? String(admission / 100) : "0");
  const changed = Math.round(Number(price) * 100) !== standard;
  const total = (Number(price) || 0) + (admission !== null ? Number(fee) || 0 : 0);
  const money = (label: string, name: string, value: string, set: (v: string) => void, hint: React.ReactNode) => (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="label">{label}</span>
      <span className="flex items-center rounded border border-line bg-ink focus-within:border-red">
        <span className="pl-3 text-ash">₹</span>
        <input name={name} type="number" inputMode="decimal" min="0" step="any" value={value} onChange={(e) => set(e.target.value)} className="min-h-11 w-full min-w-0 bg-transparent px-2 font-bold text-chalk outline-none" />
      </span>
      <span className="text-xs text-ash">{hint}</span>
    </label>
  );
  return (
    <div className="flex flex-col gap-3 rounded-md border border-line bg-panel p-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {money("Plan price", "price", price, setPrice, changed ? <span className="text-red">Negotiated · standard {inr(standard)}</span> : standard < list ? <>Offer applied · list {inr(list)}</> : "Change it if you've agreed a different price")}
        {admission !== null && money("Admission", "admission", fee, setFee, "Only charged on their first membership · 0 = waived")}
      </div>
      <p className="flex items-baseline justify-between border-t border-line pt-3">
        <span className="label">To collect</span>
        <span className="font-display text-3xl">{inr(Math.round(total * 100))}</span>
      </p>
      {admission !== null && <p className="-mt-2 text-xs text-ash">If they&apos;ve had a membership before, admission is skipped automatically.</p>}
    </div>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-4 flex items-center gap-3">
        <span className="font-display text-2xl text-red">{n}</span>
        <span className="label text-chalk">{title}</span>
      </legend>
      {children}
    </fieldset>
  );
}

function Choice({ label, sub, checked, ...input }: { label: string; sub: string; checked: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`flex cursor-pointer flex-col gap-0.5 rounded border p-3 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-red ${checked ? "border-red bg-redwash" : "border-line hover:border-strong"}`}>
      <input type="radio" className="sr-only" checked={checked} {...input} />
      <span className="font-bold">{label}</span>
      <span className="text-xs text-ash">{sub}</span>
    </label>
  );
}

export function Segmented({ label, options, value, onChange }: { label: string; options: [string, string][]; value: string; onChange: (v: string) => void }) {
  return (
    // phones: an even 2-column grid (an odd last option spans both) instead of ragged wrapping
    <div role="group" aria-label={label} className="grid grid-cols-2 gap-1 rounded-md border border-line bg-panel p-1 sm:flex sm:flex-wrap [&>*:last-child:nth-child(odd)]:col-span-2">
      {options.map(([v, l]) => (
        <button
          key={v}
          type="button"
          aria-pressed={v === value}
          onClick={() => onChange(v)}
          className={`min-h-11 flex-1 cursor-pointer rounded px-2 font-label text-xs font-bold uppercase tracking-[0.08em] sm:px-3 sm:text-sm sm:tracking-[0.1em] ${v === value ? "bg-red text-white" : "text-ash hover:text-chalk"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export function HolidayForm({ branches, emailEnabled }: { branches: Branch[]; emailEnabled: boolean }) {
  const [state, action, pending] = useActionState(addHoliday, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Date" name="day" type="date" min={gymDate()} required />
        <Select label="Branch" name="branch_id" options={[["", "All branches"], ...branches.map((b) => [b.id, b.name] as [string, string])]} />
      </div>
      <Field label="Reason (shown to members)" name="note" placeholder="Diwali" />
      <label className={`flex min-h-11 items-center gap-2 ${emailEnabled ? "" : "text-ash"}`}>
        <input type="checkbox" name="email" defaultChecked={emailEnabled} disabled={!emailEnabled} className="size-5 accent-red" />
        Also email all members {!emailEnabled && "(set RESEND_API_KEY + EMAIL_FROM to enable)"}
      </label>
      <div className="flex items-center gap-4">
        <button disabled={pending} className="btn-red">{pending ? "Saving…" : "Declare holiday"}</button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function HolidayRow({ holiday, where }: { holiday: Holiday; where: string }) {
  const [pending, start] = useTransition();
  const title = `${prettyDay(holiday.day)}${holiday.note ? ` — ${holiday.note}` : ""}`;
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <span>
        <span className="block font-bold">{title}</span>
        <span className="text-sm text-ash">{where}</span>
      </span>
      <button disabled={pending} onClick={async () => (await confirmDialog({ title: "Remove this holiday?", body: `${title} · ${where}. The gym counts as open that day again.`, confirm: "Remove", danger: true })) && start(async () => toastResult((await deleteHoliday(holiday.id)) ?? { ok: "Holiday removed" }))} className="btn-ghost">
        Remove
      </button>
    </li>
  );
}

/** Women-only windows for one branch. Blank pair = no window. */
export function LadiesHoursForm({ branch: b }: { branch: Branch }) {
  const [state, action, pending] = useActionState(saveLadiesHours, undefined);
  const t = (v: string | null) => (v ? hhmm(v) : "");
  return (
    <form action={action} className="flex flex-col gap-4 rounded-md border border-line bg-panel p-5">
      <input type="hidden" name="id" value={b.id} />
      <p className="font-display text-2xl uppercase">{b.name}</p>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Morning from" name="ladies_morning_open" type="time" defaultValue={t(b.ladies_morning_open)} />
        <Field label="Morning till" name="ladies_morning_close" type="time" defaultValue={t(b.ladies_morning_close)} />
        <Field label="Evening from" name="ladies_evening_open" type="time" defaultValue={t(b.ladies_evening_open)} />
        <Field label="Evening till" name="ladies_evening_close" type="time" defaultValue={t(b.ladies_evening_close)} />
      </div>
      <div className="flex items-center gap-4">
        <button disabled={pending} className="btn-red">{pending ? "Saving…" : "Save ladies' timings"}</button>
        <ResultToast state={state} />
      </div>
    </form>
  );
}

/** Member page: staff retake the photo with the camera (or upload). */
export function MemberPhotoForm({ id, url }: { id: string; url: string | null }) {
  const [state, action, pending] = useActionState(adminChangePhoto, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <PhotoCapture current={url} label="Retake photo" />
      <div className="flex items-center gap-3">
        <button disabled={pending} className="btn-ghost min-h-10 px-4 text-sm">{pending ? "Saving…" : "Save photo"}</button>
        <ResultToast state={state} />
      </div>
    </form>
  );
}

/** Member page: edit details and home branch. */
export function MemberEditForm({ member, branches }: { member: Profile; branches: Branch[] }) {
  const [state, action, pending] = useActionState(adminSaveMember, undefined);
  return (
    <form action={action} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <input type="hidden" name="id" value={member.id} />
      <Field label="Full name" name="full_name" defaultValue={member.full_name} required />
      <label className="flex flex-col gap-1.5">
        <span className="label">Home branch</span>
        <select name="home_branch_id" defaultValue={member.home_branch_id ?? ""} className="field">
          <option value="">—</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </label>
      <MemberDetailsFields d={member} />
      <Field label="Age (if no date of birth)" name="age" type="number" min="1" max="120" defaultValue={member.age ?? ""} />
      <div className="flex items-center gap-4 sm:col-span-2">
        <button disabled={pending} className="btn-red">{pending ? "Saving…" : "Save details"}</button>
        <ResultToast state={state} />
      </div>
    </form>
  );
}

/** An icon button that opens a small panel in the top layer (never clipped by the list), pinned under the button —
 *  or above it near the bottom of the screen. Escape and tapping outside close it (native popover). */
function Pop({ id, label, icon, active, badge, disabled, width = "w-52", children }: {
  id: string; label: string; icon: React.ReactNode; active?: boolean; badge?: number; disabled?: boolean; width?: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const below = useRef(true); // decided on open, so the panel doesn't flip sides mid-scroll
  // one stable function: a fresh one each render never matched removeEventListener, so every menu ever opened kept
  // a scroll listener that crashed once its row was gone
  const place = useCallback(() => {
    if (!button.current || !panel.current) return;
    const r = button.current.getBoundingClientRect();
    const s = panel.current.style;
    s.right = `${Math.max(8, innerWidth - r.right)}px`;
    s.top = below.current ? `${r.bottom + 6}px` : "auto";
    s.bottom = below.current ? "auto" : `${innerHeight - r.top + 6}px`;
  }, []);
  const unfollow = useCallback(() => {
    removeEventListener("scroll", place, { capture: true });
    removeEventListener("resize", place);
  }, [place]);
  useEffect(() => unfollow, [unfollow]); // unmounted while open
  // fixed-position panel: follow the button while the page scrolls or resizes
  const onToggle = (e: React.ToggleEvent<HTMLDivElement>) => {
    if (e.newState === "open") {
      fit(panel.current?.offsetHeight ?? 340); // now it's visible, with its real height
      addEventListener("scroll", place, { capture: true, passive: true });
      addEventListener("resize", place);
    } else unfollow();
  };
  const fit = (height: number) => {
    if (!button.current) return;
    below.current = innerHeight - button.current.getBoundingClientRect().bottom > height + 16;
    place();
  };
  const open = () => fit(340); // a first guess before it opens (hidden panels measure 0)
  return (
    <>
      <button ref={button} type="button" popoverTarget={id} onClick={open} disabled={disabled} aria-label={label} title={label}
        className={`relative flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors disabled:opacity-40 ${active ? "border-red bg-redwash text-chalk" : "border-line text-ash hover:border-red hover:text-chalk"}`}>
        {icon}
        {!!badge && <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-red text-[11px] font-bold text-white tabular-nums">{badge}</span>}
      </button>
      <div ref={panel} id={id} popover="auto" onToggle={onToggle} className={`fixed inset-auto m-0 ${width} max-w-[calc(100vw-1rem)] rounded-lg border border-line bg-carbon p-1.5 text-chalk shadow-2xl shadow-black/60`}>
        {children(() => document.getElementById(id)?.hidePopover())}
      </div>
    </>
  );
}

const MENU_ITEM = "flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded px-3 text-left text-sm font-semibold hover:bg-steel";
const Icon = ({ d, size = 18 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);

/** Members list: the ⋯ menu on each row. Edit and renew open in a pop-up without leaving the list. */
export function MemberActions({ member, passId, cancelSubId, waHref, branches, plans, offers, admissionPaise, canDelete }: {
  canDelete: boolean; member: Profile; passId: string | null; cancelSubId?: string | null; waHref: string | null; branches: Branch[]; plans: Plan[]; offers: Offer[]; admissionPaise: number | null;
}) {
  const [sheet, setSheet] = useState<"edit" | "renew" | null>(null);
  const [pending, start] = useTransition();
  const remove = async () => {
    const ok = await confirmDialog({
      title: `Delete ${member.full_name}?`,
      body: "Their account, plans, payments, visit history and photo are deleted. This can't be undone.",
      confirm: "Delete member",
      danger: true,
    });
    if (ok) start(async () => toastResult(await deleteMember(member.id))); // direct: the row is gone before an effect could run
  };

  return (
    <>
      <Pop id={`actions-${member.id}`} label={`Actions for ${member.full_name}`} disabled={pending}
        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>}>
        {(close) => (
          <>
            <Link href={`/admin/members/${member.id}`} className={MENU_ITEM}>View profile</Link>
            <button type="button" onClick={() => (close(), setSheet("edit"))} className={MENU_ITEM}>Edit details</button>
            <button type="button" onClick={() => (close(), setSheet("renew"))} className={MENU_ITEM}>{passId ? "Renew plan" : "Sell a plan"}</button>
            {passId && <Link href={`/pass/${passId}`} className={MENU_ITEM}>Show pass</Link>}
            {waHref && <a href={waHref} target="_blank" rel="noreferrer" className={MENU_ITEM}>WhatsApp</a>}
            {member.phone && <a href={`tel:${member.phone}`} className={MENU_ITEM}>Call</a>}
            {cancelSubId && (
              <button type="button" className={`${MENU_ITEM} text-red`}
                onClick={async () => (close(), (await confirmDialog({ title: `Cancel ${member.full_name}'s plan?`, body: "The plan stops now. Payment records stay.", confirm: "Cancel plan", danger: true })) && start(async () => toastResult(await cancelPlan(cancelSubId))))}>
                Cancel plan
              </button>
            )}
            {canDelete && member.role === "member" && (
              <>
                <hr className="my-1 border-line" />
                <button type="button" onClick={() => (close(), remove())} className={`${MENU_ITEM} text-red`}>Delete member</button>
              </>
            )}
          </>
        )}
      </Pop>
      {sheet && (
        <Sheet title={sheet === "edit" ? member.full_name || "Edit member" : `${passId ? "Renew" : "Sell a plan"} · ${member.full_name}`} open onClose={() => setSheet(null)}>
          {sheet === "edit" ? (
            <MemberEditForm member={member} branches={branches} />
          ) : (
            <RenewForm userId={member.id} branchId={member.home_branch_id} plans={plans} offers={offers} admissionPaise={admissionPaise} />
          )}
        </Sheet>
      )}
    </>
  );
}

/** Owner and both-branch staff: which branch the desk shows. A compact pill in the top bar / sidebar. */
export function BranchSwitch({ branches, value }: { branches: [string, string][]; value: string }) {
  const [pending, start] = useTransition();
  return (
    <label className={`relative flex min-w-0 shrink items-center text-chalk ${pending ? "opacity-60" : ""}`}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="pointer-events-none absolute left-3 text-red">
        <path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" />
      </svg>
      <select aria-label="Branch" defaultValue={value} disabled={pending} onChange={(e) => start(() => switchBranch(e.target.value))}
        className="h-9 w-full min-w-0 cursor-pointer appearance-none truncate rounded-full border border-line bg-steel pr-8 pl-8 text-sm font-semibold outline-none hover:border-strong focus-visible:border-red">
        <option value="">Both branches</option>
        {branches.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true" className="pointer-events-none absolute right-3 text-ash"><path d="M6 9l6 6 6-6" /></svg>
    </label>
  );
}

/** A member's change request: what they have now beside what they asked for. */
export function RequestRow({ id, name, href, photo, newPhoto, changes, note }: {
  id: string; name: string; href: string; photo: string | null; newPhoto: string | null; changes: [string, string, string][]; note: string | null;
}) {
  const [pending, start] = useTransition();
  const decide = (approve: boolean) => start(async () => toastResult(await decideRequest(id, approve)));
  const face = (src: string | null, label: string, red?: boolean) =>
    src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={label} loading="lazy" className={`size-14 shrink-0 rounded-full border-2 object-cover ${red ? "border-red" : "border-line"}`} />
    ) : (
      <span className={`flex size-14 shrink-0 items-center justify-center rounded-full border-2 bg-steel font-display text-xl text-ash uppercase ${red ? "border-red" : "border-line"}`}>{name[0]}</span>
    );
  return (
    <li className={`flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5 ${pending ? "opacity-50" : ""}`}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex shrink-0 items-center gap-1.5">
          {face(photo, `${name} now`)}
          {newPhoto && (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true" className="text-red"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              {face(newPhoto, `${name}'s new photo`, true)}
            </>
          )}
        </div>
        <div className="min-w-0">
          <Link href={href} className="block truncate font-bold hover:text-red">{name}</Link>
          <ul className="text-sm text-ash">
            {changes.map(([field, from, to]) => <li key={field} className="truncate">{field}: <s className="text-faint">{from}</s> → <b className="text-chalk">{to}</b></li>)}
            {newPhoto && <li>New photo</li>}
            {note && <li className="truncate italic">“{note}”</li>}
          </ul>
        </div>
      </div>
      <div className="flex gap-2 max-sm:[&>*]:flex-1">
        <button type="button" disabled={pending} onClick={() => decide(true)} className="btn-red min-h-11 px-5">Approve</button>
        <button type="button" disabled={pending} onClick={() => decide(false)} className="btn-ghost min-h-11 px-4">Decline</button>
      </div>
    </li>
  );
}

/** Members list: sort and filter icon buttons, each opening its own panel. Choices apply at once and reset the page. */
export function MemberFilters({ query, sorts, branches, defaultSort }: { defaultSort: string; query: Record<string, string>; sorts: readonly (readonly [string, string])[]; branches: [string, string][] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const go = (over: Record<string, string>) => {
    const p = new URLSearchParams(Object.entries({ ...query, ...over, page: "" }).filter(([k, v]) => v && !(k === "sort" && v === defaultSort) && !(k === "show" && v === "all")));
    start(() => router.push(`/admin/members${p.size ? `?${p}` : ""}`, { scroll: false }));
  };
  const sort = query.sort || defaultSort;
  const narrowed = [query.gender, query.branch, query.photo].filter(Boolean).length;
  // remember the list as it's set up (tab, search, sort, filters, page) so "← Members" on a profile comes back to it
  useEffect(() => {
    document.cookie = `members_view=${location.search}; path=/admin; max-age=43200; samesite=lax`; // query strings are already cookie-safe
  });
  const group = (label: string, k: string, options: [string, string][]) => (
    <div role="group" aria-label={label} className="flex flex-col gap-1.5 px-3 py-2">
      <span className="label">{label}</span>
      <div className="grid gap-1 rounded-md border border-line bg-panel p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map(([v, l]) => {
          const on = (query[k] || "") === v;
          return (
            <button key={v} type="button" aria-pressed={on} onClick={() => go({ [k]: v })}
              className={`min-h-9 cursor-pointer truncate rounded px-2 text-sm font-semibold transition-colors ${on ? "bg-red text-white" : "text-ash hover:text-chalk"}`}>
              {l}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className={`flex shrink-0 items-center gap-1.5 transition-opacity ${pending ? "opacity-50" : ""}`} aria-busy={pending}>
      <Pop id="member-sort" label={`Sort: ${sorts.find(([v]) => v === sort)?.[1]}`} active={sort !== defaultSort}
        icon={<Icon d="M7 4v16m0 0-3-3m3 3 3-3M17 20V4m0 0-3 3m3-3 3 3" />}>
        {(close) => (
          <>
            <p className="px-3 pt-2 pb-1 font-display text-xl uppercase">Sort by</p>
            {sorts.map(([v, l]) => (
              <button key={v} type="button" aria-pressed={sort === v} onClick={() => (close(), go({ sort: v }))} className={`${MENU_ITEM} ${sort === v ? "text-chalk" : "text-ash"}`}>
                {l}
                {sort === v && <span className="text-red"><Icon d="m5 12 5 5 9-10" size={16} /></span>}
              </button>
            ))}
          </>
        )}
      </Pop>
      <Pop id="member-filter" label={narrowed ? `Filters (${narrowed} on)` : "Filter"} active={narrowed > 0} badge={narrowed} width="w-80"
        icon={<Icon d="M3 5h18l-7 8.5V19l-4 2v-7.5z" />}>
        {() => (
          <>
            <p className="px-3 pt-2 pb-1 font-display text-xl uppercase">Filter members</p>
            {group("Gender", "gender", [["", "All"], ["male", "Men"], ["female", "Women"]])}
            {branches.length > 1 && group("Home branch", "branch", [["", "All"], ...branches])}
            {group("Photo", "photo", [["", "Any"], ["none", "Missing"]])}
            {narrowed > 0 && (
              <button type="button" onClick={() => go({ gender: "", branch: "", photo: "" })} className={`${MENU_ITEM} mt-1 justify-center border-t border-line text-red`}>
                Clear filters
              </button>
            )}
          </>
        )}
      </Pop>
    </div>
  );
}

export function BranchAccessForm({ mode }: { mode: "any" | "home" }) {
  const [state, action, pending] = useActionState(saveBranchAccess, undefined);
  const options: ["any" | "home", string, string][] = [
    ["any", "Any branch", "Members can check in at every branch with one membership."],
    ["home", "Home branch only", "Each member checks in only at their home branch. If none is set, their first check-in sets it. Only the desk can move them."],
  ];
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {options.map(([v, title, desc]) => (
          <label key={v} className="flex cursor-pointer flex-col gap-1 rounded-md border border-strong p-4 has-checked:border-red has-checked:bg-redwash">
            <span className="flex items-center gap-2 font-bold">
              <input type="radio" name="branch_access" value={v} defaultChecked={mode === v} className="size-4 accent-red" />
              {title}
            </span>
            <span className="text-sm text-ash">{desc}</span>
          </label>
        ))}
      </div>
      <div className="flex items-center gap-4">
        <button disabled={pending} className="btn-red">{pending ? "Saving…" : "Save"}</button>
        <ResultToast state={state} />
      </div>
    </form>
  );
}

export function ReplaceDoorKey({ branchId }: { branchId: string }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<Result>();
  return (
    <div className="flex flex-col gap-1">
      <button disabled={pending} onClick={async () => (await confirmDialog({ title: "Replace the entrance code?", body: "The printed QR at the entrance stops working until you put up the new one.", confirm: "Replace code", danger: true })) && start(async () => setState(await replaceDoorKey(branchId)))} className="btn-ghost min-h-11 w-full px-3 text-xs whitespace-nowrap">
        {pending ? "…" : "Replace code"}
      </button>
      <ResultToast state={state} />
    </div>
  );
}

export function OfferForm() {
  const [state, action, pending] = useActionState(saveOffer, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_8rem]">
        <Field label="Title" name="title" placeholder="Diwali offer" required />
        <Field label="% off" name="percent_off" type="number" min="1" max="100" required />
      </div>
      <Field label="Details (optional)" name="description" placeholder="Valid on new memberships" />
      <fieldset className="flex flex-wrap gap-x-4 gap-y-1">
        <legend className="label mb-2">Applies to (none ticked = every plan)</legend>
        {(Object.keys(TRACKS) as Track[]).map((t) => (
          <label key={t} className="flex min-h-11 items-center gap-2">
            <input type="checkbox" name="tracks" value={t} className="size-5 accent-red" /> {TRACKS[t]}
          </label>
        ))}
      </fieldset>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Starts" name="starts_on" type="date" defaultValue={gymDate()} required />
        <Field label="Ends" name="ends_on" type="date" min={gymDate()} required />
      </div>
      <div className="flex items-center gap-4">
        <button disabled={pending} className="btn-red">{pending ? "Saving…" : "Launch offer"}</button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function OfferRow({ offer }: { offer: Offer }) {
  const [pending, start] = useTransition();
  const today = gymDate();
  const status = !offer.active ? "Paused" : offer.ends_on < today ? "Ended" : offer.starts_on > today ? "Scheduled" : "Live";
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <span>
        <span className="block font-bold">{offer.title} · {offer.percent_off}% off</span>
        <span className="text-sm text-ash">
          {offer.tracks ? offer.tracks.map((t) => TRACKS[t]).join(", ") : "All plans"} · {prettyDay(offer.starts_on)} → {prettyDay(offer.ends_on)}
        </span>
      </span>
      <span className="flex items-center gap-3">
        <span className={`font-label text-sm font-bold uppercase tracking-widest ${status === "Live" ? "text-red" : "text-ash"}`}>{status}</span>
        {status !== "Ended" && (
          <button disabled={pending} onClick={() => start(async () => toastResult(await setOfferActive(offer.id, !offer.active)))} className="btn-ghost">
            {offer.active ? "Pause" : "Resume"}
          </button>
        )}
      </span>
    </li>
  );
}

const GRID_TRACKS: Track[] = ["strength", "strength_cardio", "couples", "personal_training"];

/** Pricing grid: tracks × plan lengths, plus trial and day pass. Each price has an on/off switch. */
/** One-time admission fee, added automatically to a member's first membership. */
export function AdmissionForm({ paise }: { paise: number }) {
  const [state, action, pending] = useActionState(saveAdmission, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="label">Admission fee (₹)</span>
        <span className="flex items-center rounded border border-line bg-ink focus-within:border-red">
          <span className="pl-3 text-ash">₹</span>
          <input name="admission" type="number" inputMode="numeric" min="0" step="1" defaultValue={paise / 100} className="min-h-11 w-32 bg-transparent px-2 font-bold text-chalk outline-none" />
        </span>
      </label>
      <button disabled={pending} className="btn-red min-h-11">{pending ? "Saving…" : "Save"}</button>
      <Status state={state} />
    </form>
  );
}

export function PriceForm({ plans }: { plans: Plan[] }) {
  const [state, action, pending] = useActionState(savePrices, undefined);
  const initial = Object.fromEntries(plans.map((p) => [p.id, { rupees: String(p.price_paise / 100), active: p.active }]));
  const [values, setValues] = useState(initial);
  const dirty = plans.some((p) => values[p.id].rupees !== initial[p.id].rupees || values[p.id].active !== initial[p.id].active);
  const set = (id: string, patch: Partial<{ rupees: string; active: boolean }>) => setValues((v) => ({ ...v, [id]: { ...v[id], ...patch } }));
  const find = (track: Track, days: number) => plans.find((p) => p.track === track && p.duration_days === days);

  // a render function, not a component: a component declared here would remount the inputs on every keystroke
  const cell = (plan?: Plan, monthly?: number) => {
    if (!plan) return <span className="text-ash">—</span>;
    const v = values[plan.id];
    const rupees = Number(v.rupees) || 0;
    const months = plan.duration_days / 30;
    const perMonth = months > 1 ? rupees / months : 0;
    const saving = monthly && months > 1 && rupees ? Math.round((1 - rupees / (monthly * months)) * 100) : 0;
    return (
      <div className={`flex flex-col gap-1.5 ${v.active ? "" : "opacity-45"}`}>
        <input type="hidden" name="id" value={plan.id} />
        <label className="flex items-center rounded border border-line bg-ink focus-within:border-red">
          <span className="pl-3 text-ash">₹</span>
          <input
            name={`price_${plan.id}`}
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            value={v.rupees}
            onChange={(e) => set(plan.id, { rupees: e.target.value })}
            aria-label={`${planName(plan)} price in rupees`}
            className="min-h-11 w-full min-w-0 bg-transparent px-2 font-bold text-chalk outline-none"
          />
        </label>
        <span className="min-h-4 text-xs text-ash">
          {perMonth > 0 && `${inr(perMonth * 100)}/mo`}
          {saving > 0 && <span className="text-chalk"> · save {saving}%</span>}
          {saving < 0 && <span className="text-red"> · {-saving}% above monthly</span>}
        </span>
        <label className="flex min-h-8 cursor-pointer items-center gap-2 text-xs text-ash">
          <input type="checkbox" name={`active_${plan.id}`} checked={v.active} onChange={(e) => set(plan.id, { active: e.target.checked })} className="peer sr-only" />
          <span className="relative h-5 w-9 rounded-full bg-strong transition-colors peer-checked:bg-red peer-focus-visible:outline-2 peer-focus-visible:outline-red after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-chalk after:transition-transform peer-checked:after:translate-x-4" />
          {v.active ? "On sale" : "Hidden"}
        </label>
      </div>
    );
  };

  return (
    <form action={action} className="flex flex-col gap-6">
      {/* one set of inputs, laid out by CSS: a row per track on desktop, a 2×2 card per track on phones */}
      <div>
        <div className="hidden gap-3 pb-3 md:grid md:grid-cols-[11rem_repeat(4,minmax(0,1fr))]">
          <span />
          {DURATIONS.map((d) => (
            <span key={d.days} className="font-label text-sm font-bold tracking-[0.14em] text-ash uppercase">{d.label}</span>
          ))}
        </div>
        {GRID_TRACKS.map((t) => {
          const monthly = Number(values[find(t, 30)?.id ?? ""]?.rupees) || undefined;
          return (
            <div key={t} className="grid grid-cols-2 gap-x-3 gap-y-4 border-t border-line py-4 md:grid-cols-[11rem_repeat(4,minmax(0,1fr))]">
              <p className="col-span-2 font-display text-2xl leading-none uppercase md:col-span-1">{TRACKS[t]}</p>
              {DURATIONS.map((d) => (
                <div key={d.days} className="min-w-0">
                  <p className="label mb-1.5 md:hidden">{d.label}</p>
                  {cell(find(t, d.days), d.days === 30 ? undefined : monthly)}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 border-t border-line pt-5 sm:grid-cols-2">
        {(["trial", "day_pass"] as Track[]).map((t) => (
          <div key={t} className="flex items-start justify-between gap-4 rounded-md border border-line bg-ink/50 p-4">
            <div className="min-w-0">
              <p className="font-display text-2xl uppercase">{TRACKS[t]}</p>
              <p className="text-xs text-ash">{t === "trial" ? "First visit, once per person" : "One day, any branch"}</p>
            </div>
            <div className="w-32 shrink-0 sm:w-40">{cell(find(t, 1))}</div>
          </div>
        ))}
      </div>

      {/* sits above the phone tab bar */}
      <div className={`sticky bottom-20 z-10 flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 transition-colors lg:bottom-4 ${dirty ? "border-red bg-redwash" : "border-line bg-carbon"}`}>
        <span className="text-sm">{dirty ? "You have unsaved price changes." : "All prices saved."}</span>
        <Status state={state} />
        <div className="flex gap-2">
          {dirty && <button type="button" onClick={() => setValues(initial)} className="btn-ghost min-h-10">Reset</button>}
          <button disabled={pending || !dirty} className="btn-red min-h-10">{pending ? "Saving…" : "Save prices"}</button>
        </div>
      </div>
    </form>
  );
}

export function BranchForm({ branch }: { branch?: Branch }) {
  const [state, action, pending] = useActionState(saveBranch, undefined);
  const b = branch;
  return (
    // a new branch is added from a pop-up, which already has the title and frame
    <form action={action} className={`flex flex-col gap-4 ${b ? "rounded-md border border-line bg-carbon p-4 sm:p-6" : ""}`}>
      {b && <h3 className="font-display text-2xl uppercase">{b.name}</h3>}
      {b && <input type="hidden" name="id" value={b.id} />}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name" name="name" defaultValue={b?.name} required />
        <Field label="Address" name="address" defaultValue={b?.address} />
        <Field label="Morning opens" name="morning_open" type="time" defaultValue={b ? hhmm(b.morning_open) : "05:00"} required />
        <Field label="Morning closes" name="morning_close" type="time" defaultValue={b ? hhmm(b.morning_close) : "11:00"} required />
        <Field label="Evening opens (blank = none)" name="evening_open" type="time" defaultValue={b ? (b.evening_open ? hhmm(b.evening_open) : "") : "16:00"} />
        <Field label="Evening closes" name="evening_close" type="time" defaultValue={b ? (b.evening_close ? hhmm(b.evening_close) : "") : "22:00"} />
        <Field label="Check-in grace after closing (min)" name="grace_minutes" type="number" min="0" max="120" defaultValue={b?.grace_minutes ?? 20} />
        <Field label="Google Maps link" name="maps_url" type="url" defaultValue={b?.maps_url ?? ""} />
        <Field label="Google place ID (reviews)" name="google_place_id" defaultValue={b?.google_place_id ?? ""} />
        <Field label="Photo URL" name="image_url" type="url" defaultValue={b?.image_url ?? ""} />
        <Field label="Check-in radius (m)" name="radius_m" type="number" min="20" defaultValue={b?.radius_m ?? 150} />
        <Field label="Latitude" name="lat" type="number" step="any" defaultValue={b?.lat ?? ""} />
        <Field label="Longitude" name="lng" type="number" step="any" defaultValue={b?.lng ?? ""} />
      </div>
      <fieldset className="flex flex-wrap gap-x-4 gap-y-2">
        <legend className="label mb-2">Weekly off</legend>
        {DAY_NAMES.map((d, i) => (
          <label key={d} className="flex min-h-11 items-center gap-2">
            <input type="checkbox" name="closed_days" value={i} defaultChecked={b ? b.closed_days.includes(i) : i === 0} className="size-5 accent-red" /> {d}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap gap-6">
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="require_location" defaultChecked={b?.require_location} className="size-5 accent-red" /> Require location to check in</label>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="active" defaultChecked={b?.active ?? true} className="size-5 accent-red" /> Active</label>
      </div>
      <div className="flex items-center gap-4">
        <button disabled={pending} className={b ? "btn-ghost" : "btn-red"}>{pending ? "Saving…" : b ? "Save branch" : "Add branch"}</button>
        <Status state={state} />
      </div>
    </form>
  );
}

function Select({ label, name, options }: { label: string; name: string; options: [string, string][] }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label">{label}</span>
      <select name={name} className="field">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

