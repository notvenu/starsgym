"use client";

import { useActionState, useState, useTransition } from "react";
import { Field, MemberDetailsFields, Price } from "@/components/client";
import { PhotoCapture } from "@/components/photo";
import { bestOffer, DAY_NAMES, DURATIONS, gymDate, hhmm, inr, planName, prettyDay, TRACKS, type Branch, type Holiday, type Offer, type Plan, type Track } from "@/lib/gym";
import { addHoliday, addMember, cancelSub, deleteHoliday, markPaid, replaceDoorKey, saveBranch, saveBranchAccess, saveLadiesHours, saveOffer, savePrices, setOfferActive, type Result } from "./actions";

function Status({ state }: { state: Result }) {
  if (state?.error) return <p role="alert" className="text-sm text-red">{state.error}</p>;
  if (state?.ok) return <p role="status" className="text-sm text-ash">{state.ok}</p>;
  return null;
}

export function PendingRow({ id, title, meta }: { id: string; title: string; meta: string }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<Result>();
  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="font-bold">{title}</p>
        <p className="text-sm text-ash">{meta}</p>
        <Status state={state} />
      </div>
      <div className="flex shrink-0 gap-2">
        <a href={`/pay/${id}`} className="btn-ghost min-h-10 px-3.5 text-xs">QR</a>
        <button disabled={pending} onClick={() => confirm("Cancel this order?") && start(async () => setState(await cancelSub(id)))} className="btn-ghost min-h-10 px-3.5 text-xs">Cancel</button>
        <button disabled={pending} onClick={() => start(async () => setState(await markPaid(id)))} className="btn-red min-h-10 px-4 text-xs">Mark paid</button>
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
const MEMBERSHIPS: Track[] = ["strength", "strength_cardio", "personal_training"];

/** Desk onboarding: details → pass → payment, then straight to the member's ticket. */
export function AddMemberForm({ branches, plans, offers }: { branches: Branch[]; plans: Plan[]; offers: Offer[] }) {
  const [state, action, pending] = useActionState(addMember, undefined);
  const [kind, setKind] = useState<Kind>("membership");
  const [track, setTrack] = useState<Track>("strength");
  const [days, setDays] = useState(30);
  const [payment, setPayment] = useState("cash");
  const plan =
    kind === "none" ? undefined : plans.find((p) => (kind === "membership" ? p.track === track && p.duration_days === days : p.track === kind));

  return (
    <form action={action} className="flex flex-col gap-8">
      <Step n="01" title="Member details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" name="full_name" required />
          <Field label="Email" name="email" type="email" required />
          <Select label="Branch" name="branch_id" options={branches.map((b) => [b.id, b.name])} />
          <MemberDetailsFields />
          <div className="sm:col-span-2">
            <PhotoCapture label="Member photo · take it now, or they'll be asked at first sign-in" />
          </div>
        </div>
      </Step>

      <Step n="02" title="Pass">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {KINDS.map(([k, label, sub]) => (
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
          <p className="flex flex-wrap items-center gap-3 text-ash">
            Price <Price paise={plan.price_paise} offer={bestOffer(offers, plan.track)} />
          </p>
        )}
        {kind !== "none" && !plan && <p className="text-red">That plan isn&apos;t available.</p>}
        <input type="hidden" name="plan_id" value={plan?.id ?? ""} />
      </Step>

      {plan && (
        <Step n="03" title="Payment">
          <div className="grid gap-2 sm:grid-cols-3">
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
          {pending ? "Saving…" : !plan ? "Create account" : payment === "qr" ? "Create & show QR" : "Create & issue pass"}
        </button>
        <Status state={state} />
      </div>
    </form>
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

function Segmented({ label, options, value, onChange }: { label: string; options: [string, string][]; value: string; onChange: (v: string) => void }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1 rounded-md border border-line bg-panel p-1">
      {options.map(([v, l]) => (
        <button
          key={v}
          type="button"
          aria-pressed={v === value}
          onClick={() => onChange(v)}
          className={`min-h-11 flex-1 cursor-pointer rounded px-3 font-label text-sm font-bold uppercase tracking-[0.1em] ${v === value ? "bg-red text-white" : "text-ash hover:text-chalk"}`}
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
      <div className="grid gap-4 sm:grid-cols-2">
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
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <span>
        <span className="block font-bold">{prettyDay(holiday.day)}{holiday.note && ` — ${holiday.note}`}</span>
        <span className="text-sm text-ash">{where}</span>
      </span>
      <button disabled={pending} onClick={() => confirm("Remove this holiday?") && start(async () => void (await deleteHoliday(holiday.id)))} className="btn-ghost">
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
        {state?.error && <p role="alert" className="text-sm text-red">{state.error}</p>}
        {state?.ok && <p role="status" className="text-sm text-ash">{state.ok}</p>}
      </div>
    </form>
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
      <div className="grid gap-3 sm:grid-cols-2">
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
        {state?.error && <p role="alert" className="text-sm text-red">{state.error}</p>}
        {state?.ok && <p role="status" className="text-sm text-ash">{state.ok}</p>}
      </div>
    </form>
  );
}

export function ReplaceDoorKey({ branchId }: { branchId: string }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<Result>();
  return (
    <div className="flex flex-col gap-1">
      <button disabled={pending} onClick={() => confirm("Replace this code? The printed QR at the entrance stops working until you put up the new one.") && start(async () => setState(await replaceDoorKey(branchId)))} className="btn-ghost min-h-10 px-4 text-xs">
        {pending ? "…" : "Replace code"}
      </button>
      {state?.error && <p role="alert" className="text-xs text-red">{state.error}</p>}
      {state?.ok && <p role="status" className="text-xs text-ash">{state.ok}</p>}
    </div>
  );
}

export function OfferForm() {
  const [state, action, pending] = useActionState(saveOffer, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
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
      <div className="grid gap-4 sm:grid-cols-2">
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
          <button disabled={pending} onClick={() => start(async () => void (await setOfferActive(offer.id, !offer.active)))} className="btn-ghost">
            {offer.active ? "Pause" : "Resume"}
          </button>
        )}
      </span>
    </li>
  );
}

const GRID_TRACKS: Track[] = ["strength", "strength_cardio", "personal_training"];

/** Pricing grid: tracks × plan lengths, plus trial and day pass. Each price has an on/off switch. */
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
      <div className="-mx-5 overflow-x-auto px-5">
        <table className="w-full min-w-[720px] border-separate border-spacing-x-3 border-spacing-y-0 text-left">
          <thead>
            <tr>
              <th className="w-48 pb-3" />
              {DURATIONS.map((d) => (
                <th key={d.days} className="pb-3 font-label text-sm font-bold tracking-[0.14em] text-ash uppercase">{d.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GRID_TRACKS.map((t) => {
              const monthly = Number(values[find(t, 30)?.id ?? ""]?.rupees) || undefined;
              return (
                <tr key={t}>
                  <th scope="row" className="border-t border-line py-4 pr-2 align-top font-display text-2xl leading-none uppercase">{TRACKS[t]}</th>
                  {DURATIONS.map((d) => (
                    <td key={d.days} className="border-t border-line py-4 align-top">{cell(find(t, d.days), d.days === 30 ? undefined : monthly)}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
        {(["trial", "day_pass"] as Track[]).map((t) => (
          <div key={t} className="flex items-start justify-between gap-4 rounded-md border border-line bg-ink/50 p-4">
            <div>
              <p className="font-display text-2xl uppercase">{TRACKS[t]}</p>
              <p className="text-xs text-ash">{t === "trial" ? "First visit, once per person" : "One day, any branch"}</p>
            </div>
            <div className="w-40">{cell(find(t, 1))}</div>
          </div>
        ))}
      </div>

      <div className={`sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 transition-colors ${dirty ? "border-red bg-redwash" : "border-line bg-carbon"}`}>
        <span className="text-sm" role="status">
          {state?.error ? <span className="text-red">{state.error}</span> : dirty ? "You have unsaved price changes." : state?.ok ?? "All prices saved."}
        </span>
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
    <form action={action} className={`flex flex-col gap-4 rounded-md border p-6 ${b ? "border-line bg-carbon" : "border-dashed border-strong"}`}>
      <h3 className="font-display text-2xl uppercase">{b ? b.name : "New branch"}</h3>
      {b && <input type="hidden" name="id" value={b.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
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
