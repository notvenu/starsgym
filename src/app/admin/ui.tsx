"use client";

import Link from "next/link";
import { Sheet } from "@/components/sheet";
export { Sheet };
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Field, MemberDetailsFields } from "@/components/client";
import { confirmDialog, ResultToast, toast, toastResult, keepFields } from "@/components/feedback";
import QRCode from "qrcode";
import { PhotoCapture } from "@/components/photo";
import { ProofCheck, ProofInput, ReceiptScan } from "@/components/receipt";
import type { Profile } from "@/lib/supabase";
import { offerLabel, OFFER_LENGTHS, bestOffer, DAY_NAMES, discounted, DURATIONS, gymDate, gymDateIn, hhmm, inr, planName, prettyDay, TRACKS, type Branch, type Holiday, type Offer, type Plan, type Track } from "@/lib/gym";
import { addHoliday, addMember, adminChangePhoto, adminSaveMember, assignTrainer, decideDiscount, resetPassword, cancelPlan, cancelSub, decideRequest, switchBranch, deleteHoliday, deleteMember, markPaid, renewMember, replaceDoorKey, setOrderPrice, saveAdmission, saveBranch, saveOffer, savePrices, setOfferActive, type Created, type Result } from "./actions";

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

/** An unpaid order. Staff take the money; the owner can also reprice, cancel, and settle staff discount requests. */
export function PendingRow({ id, title, meta, method, approval, ask, owner, proof, amountPaise, createdAt, upiId }: { id: string; title: string; meta: string; method: string; approval: string | null; ask: string | null; owner: boolean; proof: string | null; amountPaise: number; createdAt: string; upiId: string }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<Result>();
  const [editing, setEditing] = useState(false);
  const [paying, setPaying] = useState(false);
  const waiting = approval === "pending";
  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="font-bold">{title}</p>
        <p className="text-sm text-ash">{meta}</p>
        {ask && <p className="mt-1 text-sm font-semibold text-red">Discount request · {ask}</p>}
        {proof && !paying && (
          <a href={proof} target="_blank" rel="noreferrer" className="mt-2 flex w-fit items-center gap-3 text-sm font-bold text-chalk hover:text-red">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={proof} alt="" className="size-11 shrink-0 rounded-md border border-red object-cover" />
            Payment screenshot sent · check it
          </a>
        )}
        {owner && (editing ? (
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
        ))}
        <Status state={state} />
        {paying && <MarkPaidForm id={id} cash={method === "cash"} sent={proof} amountPaise={amountPaise} createdAt={createdAt} upiId={upiId} onClose={() => setPaying(false)} />}
      </div>
      {!paying && <div className="flex shrink-0 flex-wrap gap-2 [&>*]:whitespace-nowrap max-sm:[&>*]:flex-1">
        {owner && waiting ? (
          <>
            <button disabled={pending} onClick={() => start(async () => toastResult(await decideDiscount(id, false)))} className="btn-ghost min-h-10 px-3.5 text-xs">Turn down</button>
            <button disabled={pending} onClick={() => start(async () => toastResult(await decideDiscount(id, true)))} className="btn-red min-h-10 px-4 text-xs">Approve</button>
          </>
        ) : waiting ? (
          <span className="flex min-h-10 items-center text-sm text-ash">Waiting for the owner</span>
        ) : (
          <>
            <a href={`/pay/${id}`} className="btn-ghost min-h-10 px-3.5 text-xs">QR</a>
            {owner && <button disabled={pending} onClick={async () => (await confirmDialog({ title: "Cancel this order?", body: meta, confirm: "Cancel order", danger: true })) && start(async () => toastResult(await cancelSub(id)))} className="btn-ghost min-h-10 px-3.5 text-xs">Cancel</button>}
            <button disabled={pending} onClick={() => setPaying(true)} className="btn-red min-h-10 px-4 text-xs">{proof ? "Verify & mark paid" : "Mark paid"}</button>
          </>
        )}
      </div>}
    </div>
  );
}

/** "Mark paid" on an order: the payment photo (UPI screenshot required, a cash receipt optional), then confirm.
 *  A screenshot the member already sent counts — the desk checks it against their UPI app first. */
function MarkPaidForm({ id, cash, sent, amountPaise, createdAt, upiId, onClose }: { id: string; cash: boolean; sent: string | null; amountPaise: number; createdAt: string; upiId: string; onClose: () => void }) {
  const [state, action, pending] = useActionState(async (prev: Result, form: FormData) => {
    const r = await markPaid(prev, form);
    if (r?.ok) toastResult(r); // the paid row leaves the list with the refresh, taking its own toast with it
    return r?.ok ? undefined : r;
  }, undefined);
  return (
    <form noValidate onSubmit={keepFields(action)} className="mt-3 flex flex-col gap-3 rounded-md border border-line bg-panel p-3">
      <input type="hidden" name="id" value={id} />
      {sent && (
        <a href={sent} target="_blank" rel="noreferrer" className="flex flex-col gap-2">
          <span className="label">Member&apos;s screenshot</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={sent} alt="Payment screenshot the member sent" className="max-h-80 w-full rounded-md border border-line bg-ink object-contain" />
          <span className="text-xs text-ash">Tap to open full size.</span>
        </a>
      )}
      {sent && <ProofCheck src={sent} amountPaise={amountPaise} createdAt={createdAt} upiId={upiId} />}
      <ProofInput required={!cash && !sent} hint={sent ? "Only if you want to replace theirs." : cash ? "A photo of the paper receipt, if you wrote one." : "Screenshot of the UPI payment."} />
      <div className="flex flex-wrap items-center gap-2">
        <button disabled={pending} className="btn-red min-h-11 px-5 text-xs whitespace-nowrap max-sm:flex-1">{pending ? "Saving…" : "Confirm paid"}</button>
        <button type="button" onClick={onClose} className="btn-ghost min-h-11 px-4 text-xs max-sm:flex-1">Cancel</button>
        <Status state={state} />
      </div>
    </form>
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
type NewMemberProps = { branches: Branch[]; plans: Plan[]; offers: Offer[]; trainers: [string, string][]; owner: boolean; admissionPaise?: number };

/** "+ New member": the form, then the account-created screen. "Add another" starts a fresh, empty form. */
export function AddMemberForm(props: NewMemberProps) {
  const [round, setRound] = useState(0);
  return <NewMemberForm key={round} {...props} onAnother={() => setRound((n) => n + 1)} />;
}

function NewMemberForm({ branches, plans, offers, trainers, owner, admissionPaise = 0, onAnother }: NewMemberProps & { onAnother: () => void }) {
  const [state, action, pending] = useActionState(addMember, undefined);
  if (state?.created) return <AccountCreated c={state.created} onAnother={onAnother} />;
  return (
    <form noValidate onSubmit={keepFields(action)} className="flex flex-col gap-8">
      <ReceiptScan />
      <Step n="01" title="Member details">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Full name" name="full_name" required />
          <Field label="Email (optional)" name="email" type="email" inputMode="email" autoComplete="off" placeholder="They can sign in with their phone" />
          <Select label="Branch" name="branch_id" options={branches.map((b) => [b.id, b.name])} />
          <MemberDetailsFields />
          <div className="sm:col-span-2">
            <PhotoCapture label="Member photo · staff check it when they scan the pass" required />
          </div>
        </div>
      </Step>
      <PlanSteps plans={plans} offers={offers} trainers={trainers} owner={owner} admissionPaise={admissionPaise} kinds={KINDS} first={2} verb="Create" pending={pending} state={state} />
    </form>
  );
}

/** After "+ New member": who was created, the temporary password (shown once), a QR that signs the member in on their
 *  own phone so they can set their own password, and where the plan stands. */
function AccountCreated({ c, onAnother }: { c: Created; onAnother: () => void }) {
  const [qr, setQr] = useState<string>();
  useEffect(() => {
    if (c.loginUrl) void QRCode.toDataURL(c.loginUrl, { margin: 1, width: 440, color: { dark: "#0a0a0a", light: "#ffffff" } }).then(setQr);
  }, [c.loginUrl]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(c.password ?? "");
      toast("Password copied");
    } catch {
      toast("Couldn't copy — read it out instead", "error");
    }
  };
  const plan = c.plan;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-red text-xl font-bold text-white">✓</span>
        <div className="min-w-0">
          <p className="font-display text-3xl leading-none uppercase">{c.password ? "Account created" : "Member updated"}</p>
          <p className="truncate text-ash">{c.name}</p>
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-3 rounded-lg border border-line bg-panel p-4 text-sm sm:grid-cols-2">
        <div className="min-w-0"><dt className="label">Email</dt><dd className={`mt-0.5 truncate font-semibold ${c.email ? "" : "text-ash"}`}>{c.email || "None — added later"}</dd></div>
        <div><dt className="label">Phone</dt><dd className="mt-0.5 font-semibold">{c.phone}</dd></div>
        <p className="text-xs text-ash sm:col-span-2">{c.email ? "They can sign in with either, plus the password below." : "They sign in with their phone, plus the password below."}</p>
      </dl>

      {c.password ? (
        // phones: the QR centred on top, everything else on the same left edge as the rest of the screen
        <div className="flex flex-col gap-5 rounded-lg border border-redline bg-redwash p-4 sm:flex-row sm:items-center sm:p-5">
          {c.loginUrl && (qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="Sign-in QR for the member" width={176} height={176} className="size-44 shrink-0 self-center rounded-lg bg-white p-2" />
          ) : (
            <div className="size-44 shrink-0 animate-pulse self-center rounded-lg bg-steel" />
          ))}
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <p className="label text-chalk">Temporary password</p>
            <div className="flex items-center justify-between gap-3 rounded-md border border-redline bg-ink py-1.5 pr-1.5 pl-4">
              <span className="min-w-0 truncate font-mono text-2xl font-bold tracking-wider select-all">{c.password}</span>
              <button type="button" onClick={copy} className="btn-ghost min-h-10 shrink-0 px-4 text-xs">Copy</button>
            </div>
            <p className="text-sm text-body">
              {c.loginUrl ? "Have them scan the QR with their phone camera: it signs them in straight away and asks them to set their own password — no typing this one." : "Give them this password. They'll be asked to set their own when they sign in."}
            </p>
            <p className="text-xs text-ash">Shown only now. {c.loginUrl && "The QR works once and expires after a while."}</p>
          </div>
        </div>
      ) : (
        <p className="rounded-lg border border-line px-4 py-3 text-sm text-ash">They already had an account, so their password hasn&apos;t changed.</p>
      )}

      {c.planError && (
        <p role="alert" className="rounded-lg border border-redline bg-redwash px-4 py-3 text-sm font-semibold">
          The plan wasn&apos;t sold: {c.planError} Sell it from the member&apos;s ⋯ menu → Renew.
        </p>
      )}
      {plan && (
        <div className="flex flex-col gap-3 rounded-lg border border-line p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="font-bold">{plan.label} · {inr(plan.amount)}</p>
            <p className="text-sm text-ash">
              {plan.state === "paid" ? `Paid · active${plan.endsOn ? ` till ${prettyDay(plan.endsOn)}` : ""}` : plan.state === "pay" ? "Waiting for payment" : "Waiting for the owner to approve the price"}
            </p>
          </div>
          {plan.state === "pay" && <Link href={`/pay/${plan.subId}`} className="btn-red min-h-11 shrink-0 px-4 text-xs">Show UPI QR</Link>}
          {plan.state === "paid" && <a href={`/pass/${plan.subId}/receipt`} download className="btn-red min-h-11 shrink-0 px-4 text-xs">Download receipt</a>}
        </div>
      )}

      <button type="button" onClick={onAnother} className="btn-ghost min-h-12">Add another member</button>
    </div>
  );
}

/** Members list → Renew: sell an existing member their next plan. Starts the day after their current one ends. */
export function RenewForm({ userId, branchId, plans, offers, trainers, owner, admissionPaise, onDone }: { userId: string; branchId: string | null; plans: Plan[]; offers: Offer[]; trainers: [string, string][]; owner: boolean; admissionPaise: number | null; onDone?: () => void }) {
  const [state, action, pending] = useActionState(async (prev: Result, form: FormData) => {
    const r = await renewMember(prev, form);
    if (r?.ok) {
      toastResult(r); // the sheet closes, so the confirmation can't live inside it
      onDone?.();
    }
    return r?.ok ? undefined : r;
  }, undefined);
  return (
    <form noValidate onSubmit={keepFields(action)} className="flex flex-col gap-8">
      <input type="hidden" name="user_id" value={userId} />
      <input type="hidden" name="branch_id" value={branchId ?? ""} />
      <PlanSteps plans={plans} offers={offers} trainers={trainers} owner={owner} admissionPaise={admissionPaise} kinds={KINDS.filter(([k]) => k === "membership" || k === "day_pass")} first={1} verb="Renew" pending={pending} state={state} />
    </form>
  );
}

/** Pass → payment → submit. admissionPaise null = they've had a membership, so no admission field. */
function PlanSteps({ plans, offers, trainers, owner, admissionPaise, kinds, first, verb, pending, state }: {
  plans: Plan[]; offers: Offer[]; trainers: [string, string][]; owner: boolean; admissionPaise: number | null; kinds: typeof KINDS; first: number; verb: string; pending: boolean; state: Result;
}) {
  const [kind, setKind] = useState<Kind>("membership");
  const [track, setTrack] = useState<Track>("strength");
  const [days, setDays] = useState(30);
  const [payment, setPayment] = useState("cash");
  const [asking, setAsking] = useState(false); // staff priced it below standard: it waits for the owner, nothing is paid yet
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
            standard={discounted(plan.price_paise, bestOffer(offers, plan.track, plan.duration_days), plan.duration_days)}
            list={plan.price_paise}
            admission={MEMBERSHIPS.includes(plan.track) ? admissionPaise : null}
            owner={owner}
            onAsk={setAsking}
          />
        )}
        {plan?.track === "personal_training" && trainers.length > 0 && <Select label="Trainer" name="trainer_id" options={[["", "Not assigned yet"], ...trainers]} />}
        {plan && (
          // blank = today, or the day after their current plan ends; pick one to backdate (any past date) or start later (up to 60 days)
          <label className="flex flex-col gap-1.5 sm:max-w-64">
            <span className="label">Start date (optional)</span>
            <input type="date" name="start_on" max={gymDateIn(60)} className="field" />
            <span className="text-xs text-ash">Leave blank to start today — or the day after their current plan ends.</span>
          </label>
        )}
        {kind !== "none" && !plan && <p className="text-red">That plan isn&apos;t available.</p>}
        <input type="hidden" name="plan_id" value={plan?.id ?? ""} />
      </Step>

      {plan && (
        <Step n={n(1)} title="Payment">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["cash", "Cash received", "Activates now"],
              ["upi_paid", "UPI received", "Activates now"],
              ["split", "Cash + UPI", "Part of each"],
              ["qr", "Show UPI QR", "Mark paid after"],
            ].map(([v, label, sub]) => (
              <Choice key={v} name="payment" value={v} checked={payment === v} onChange={() => setPayment(v)} label={label} sub={sub} />
            ))}
          </div>
          {payment === "split" && (
            <label className="flex flex-col gap-1.5 sm:w-64">
              <span className="label">Cash part</span>
              <span className="flex items-center rounded border border-line bg-ink focus-within:border-red">
                <span className="pl-3 text-ash">₹</span>
                <input name="cash" type="number" inputMode="decimal" min="1" step="any" required className="min-h-11 w-full min-w-0 bg-transparent px-2 font-bold text-chalk outline-none" />
              </span>
              <span className="text-xs text-ash">The rest is recorded as UPI.</span>
            </label>
          )}
          {/* taken now: UPI needs its screenshot, cash may have the paper receipt. A QR (or an owner approval) is paid later */}
          {payment !== "qr" && !asking && (
            <ProofInput required={payment !== "cash"} hint={payment === "cash" ? "A photo of the paper receipt, if you wrote one." : "Screenshot of the UPI payment on their phone or yours."} />
          )}
        </Step>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button disabled={pending || (kind !== "none" && !plan)} className="btn-red min-h-14 px-8 text-base max-sm:w-full">
          {pending ? "Saving…" : !plan ? "Create account" : payment === "qr" ? `${verb} & show QR` : `${verb} & issue pass`}
        </button>
        <Status state={state} />
      </div>
    </>
  );
}

/** Desk pricing: starts at the standard price (offer applied) and admission; staff can change either after negotiating. */
function NegotiatedPrice({ standard, list, admission, owner, onAsk }: { standard: number; list: number; admission: number | null; owner: boolean; onAsk: (asking: boolean) => void }) {
  const [price, setPrice] = useState(String(standard / 100));
  const [fee, setFee] = useState(admission !== null ? String(admission / 100) : "0");
  const changed = Math.round(Number(price) * 100) !== standard;
  // the server's rule (sellPlan): staff below the standard price, or a changed admission, waits for the owner
  const asking = !owner && (changed || (admission !== null && Math.round(Number(fee) * 100) !== admission));
  useEffect(() => onAsk(asking), [asking, onAsk]);
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
      {!owner && <p className="-mt-1 text-sm font-semibold text-red">Any price below the standard goes to the owner to approve before you take the money.</p>}
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

/** Upcoming holidays → "+ Add holiday": the form in a pop-up. Opens straight away from /admin/branches?holiday=1. */
export function HolidayModal({ branches, emailEnabled, canEmail, startOpen }: { branches: Branch[]; emailEnabled: boolean; canEmail: boolean; startOpen?: boolean }) {
  const [open, setOpen] = useState(!!startOpen);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-red min-h-10 px-4 text-xs">+ Add holiday</button>
      <Sheet title="Add a holiday" open={open} onClose={() => setOpen(false)}>
        {open && <HolidayForm branches={branches} emailEnabled={emailEnabled} canEmail={canEmail} onDone={() => setOpen(false)} />}
      </Sheet>
    </>
  );
}

function HolidayForm({ branches, emailEnabled, canEmail, onDone }: { branches: Branch[]; emailEnabled: boolean; canEmail: boolean; onDone: () => void }) {
  const [state, action, pending] = useActionState(async (prev: Result, form: FormData) => {
    const res = await addHoliday(prev, form);
    if (res?.ok) {
      toastResult(res); // shown here: a form that closes on success takes its own message with it
      onDone();
    }
    return res?.ok ? undefined : res;
  }, undefined);
  return (
    <form noValidate onSubmit={keepFields(action)} className="flex flex-col gap-4">
      <p className="-mt-1 text-sm text-ash">Members see it on the site and dashboard. Check-in is blocked that day; streaks are safe.</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Date" name="day" type="date" min={gymDate()} required />
        <Select label="Branch" name="branch_id" options={[...(branches.length > 1 ? [["", "All branches"] as [string, string]] : []), ...branches.map((b) => [b.id, b.name] as [string, string])]} />
      </div>
      <Field label="Reason (shown to members)" name="note" placeholder="Diwali" />
      {canEmail && (
        <label className={`flex min-h-11 items-center gap-2 ${emailEnabled ? "" : "text-ash"}`}>
          <input type="checkbox" name="email" defaultChecked={emailEnabled} disabled={!emailEnabled} className="size-5 accent-red" />
          Also email all members {!emailEnabled && "(set RESEND_API_KEY + EMAIL_FROM to enable)"}
        </label>
      )}
      <div className="flex items-center gap-4">
        <button disabled={pending} className="btn-red">{pending ? "Saving…" : "Add holiday"}</button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function HolidayRow({ holiday, where, canRemove }: { holiday: Holiday; where: string; canRemove: boolean }) {
  const [pending, start] = useTransition();
  const title = `${prettyDay(holiday.day)}${holiday.note ? ` — ${holiday.note}` : ""}`;
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <span className="min-w-0">
        <span className="block font-bold">{title}</span>
        <span className="text-sm text-ash">{where}</span>
      </span>
      {canRemove && <button disabled={pending} onClick={async () => (await confirmDialog({ title: "Remove this holiday?", body: `${title} · ${where}. The gym counts as open that day again.`, confirm: "Remove", danger: true })) && start(async () => toastResult((await deleteHoliday(holiday.id)) ?? { ok: "Holiday removed" }))} className="btn-ghost">
        Remove
      </button>}
    </li>
  );
}

/** Women-only windows for one branch. Blank pair = no window. */
/** Member page: staff retake the photo with the camera (or upload). */
export function MemberPhotoForm({ id, url }: { id: string; url: string | null }) {
  const [state, action, pending] = useActionState(adminChangePhoto, undefined);
  return (
    <form noValidate onSubmit={keepFields(action)} className="flex flex-col gap-3">
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
    <form noValidate onSubmit={keepFields(action)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
export function MemberActions({ member, passId, cancelSubId, waHref, branches, plans, offers, trainers, admissionPaise, owner }: {
  owner: boolean; member: Profile; passId: string | null; cancelSubId?: string | null; waHref: string | null; branches: Branch[]; plans: Plan[]; offers: Offer[]; trainers: [string, string][]; admissionPaise: number | null;
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
            {owner && member.role === "member" && (
              <button type="button" className={MENU_ITEM}
                onClick={async () => (close(), (await confirmDialog({ title: `Reset ${member.full_name}'s password?`, body: "It goes back to the starting password (first 4 letters of their name, without initials, + last 4 phone digits). You'll see it next. They'll be asked to change it.", confirm: "Reset password" })) && start(async () => toastResult(await resetPassword(member.id))))}>
                Reset password
              </button>
            )}
            {owner && cancelSubId && (
              <button type="button" className={`${MENU_ITEM} text-red`}
                onClick={async () => (close(), (await confirmDialog({ title: `Cancel ${member.full_name}'s plan?`, body: "The plan stops now. Payment records stay.", confirm: "Cancel plan", danger: true })) && start(async () => toastResult(await cancelPlan(cancelSubId))))}>
                Cancel plan
              </button>
            )}
            {owner && member.role === "member" && (
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
            <RenewForm userId={member.id} branchId={member.home_branch_id} plans={plans} offers={offers} trainers={trainers} owner={owner} admissionPaise={admissionPaise} onDone={() => setSheet(null)} />
          )}
        </Sheet>
      )}
    </>
  );
}

/** Owner and both-branch staff: which branch the desk shows. A compact pill in the top bar / sidebar. */
export function BranchSwitch({ branches, value }: { branches: [string, string][]; value: string }) {
  const [pending, start] = useTransition();
  // while the page reloads for the new branch: a progress bar and a dimmed, untappable page (globals.css [data-busy])
  useEffect(() => {
    document.documentElement.toggleAttribute("data-busy", pending);
    return () => document.documentElement.removeAttribute("data-busy");
  }, [pending]);
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

/** Members list search: results update as you type (a short pause, then the list reloads), and the server matches
 *  fuzzily — typos, initials, part of a phone number. Keeps the current tab, sort and filters; back to page 1. */
export function MemberSearch({ initial }: { initial: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [value, setValue] = useState(initial);
  const timer = useRef(0);
  const go = (q: string) => {
    const p = new URLSearchParams(location.search);
    if (q.trim()) p.set("q", q.trim());
    else p.delete("q");
    p.delete("page");
    start(() => router.replace(`/admin/members${p.size ? `?${p}` : ""}`, { scroll: false }));
  };
  return (
    <form role="search" className="relative flex w-full sm:w-72" onSubmit={(e) => { e.preventDefault(); clearTimeout(timer.current); go(value); }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ash">
        <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => {
          const q = e.target.value;
          setValue(q);
          clearTimeout(timer.current);
          timer.current = window.setTimeout(() => go(q), 250);
        }}
        placeholder="Search name, email or phone"
        aria-label="Search members"
        className="field min-h-10 w-full pr-9 pl-9"
      />
      {pending && <span aria-hidden="true" className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin rounded-full border-2 border-ash border-t-transparent" />}
    </form>
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

const SHORT_LENGTH: Record<number, string> = { 30: "Monthly", 90: "Quarterly", 180: "6 months", 365: "Yearly", 1: "Day pass" };

export function OfferForm() {
  const [state, action, pending] = useActionState(saveOffer, undefined);
  const [mode, setMode] = useState<"same" | "length">("same");
  return (
    <form noValidate onSubmit={keepFields(action)} className="flex flex-col gap-4">
      <input type="hidden" name="mode" value={mode} />
      <Field label="Reason — shown big on the site" name="title" placeholder="Dussehra offer" required maxLength={60} />
      <Field label="Details (optional)" name="description" placeholder="On new memberships and renewals" maxLength={140} />
      <div className="flex flex-col gap-3">
        <span className="label">Discount</span>
        <Segmented label="Discount" options={[["same", "Same for every plan"], ["length", "Different per length"]]} value={mode} onChange={(v) => setMode(v as "same" | "length")} />
        {mode === "same" ? (
          <div className="sm:w-40"><Field label="% off" name="percent_off" type="number" inputMode="numeric" min="1" max="100" required /></div>
        ) : (
          <>
            {/* one line per label, the % inside the box: the five boxes line up at any width */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {OFFER_LENGTHS.map(([d]) => (
                <label key={d} className="flex min-w-0 flex-col gap-1.5">
                  <span className="label truncate">{SHORT_LENGTH[d] ?? `${d} days`}</span>
                  <span className="flex items-center rounded border border-line bg-ink focus-within:border-red">
                    <input name={`pct_${d}`} type="number" inputMode="numeric" min="0" max="100" placeholder="0" className="min-h-11 w-full min-w-0 bg-transparent pl-3 font-bold text-chalk outline-none" />
                    <span className="pr-3 text-ash">%</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="-mt-1 text-xs text-ash">e.g. 10 · 15 · 20 · 25 for monthly to yearly. Leave a length blank for no discount on it.</p>
          </>
        )}
      </div>
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

export function OfferRow({ offer, canEdit }: { offer: Offer; canEdit: boolean }) {
  const [pending, start] = useTransition();
  const today = gymDate();
  const status = !offer.active ? "Paused" : offer.ends_on < today ? "Ended" : offer.starts_on > today ? "Scheduled" : "Live";
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <span>
        <span className="block font-bold">{offer.title}</span>
        <span className="block text-sm font-semibold text-red">{offerLabel(offer)}</span>
        <span className="text-sm text-ash">
          {offer.tracks ? offer.tracks.map((t) => TRACKS[t]).join(", ") : "All plans"} · {prettyDay(offer.starts_on)} → {prettyDay(offer.ends_on)}
        </span>
      </span>
      <span className="flex items-center gap-3">
        <span className={`font-label text-sm font-bold uppercase tracking-widest ${status === "Live" ? "text-red" : "text-ash"}`}>{status}</span>
        {canEdit && status !== "Ended" && (
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
    <form noValidate onSubmit={keepFields(action)} className="flex flex-wrap items-end gap-3">
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
    <form noValidate onSubmit={keepFields(action)} className="flex flex-col gap-6">
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

/** Branches → Edit / + New branch: every branch setting, ladies' timings included, in a pop-up. */
export function BranchModal({ branch, label, className }: { branch?: Branch; label: string; className: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>{label}</button>
      <Sheet title={branch ? `Edit ${branch.name}` : "New branch"} open={open} onClose={() => setOpen(false)}>
        {open && <BranchForm branch={branch} onDone={() => setOpen(false)} />}
      </Sheet>
    </>
  );
}

function BranchForm({ branch: b, onDone }: { branch?: Branch; onDone: () => void }) {
  const [state, action, pending] = useActionState(async (prev: Result, form: FormData) => {
    const res = await saveBranch(prev, form);
    if (res?.ok) {
      toastResult(res); // shown here: a form that closes on success takes its own message with it
      onDone();
    }
    return res?.ok ? undefined : res;
  }, undefined);
  const t = (v: string | null | undefined) => (v ? hhmm(v) : "");
  return (
    <form noValidate onSubmit={keepFields(action)} className="flex flex-col gap-6">
      {b && <input type="hidden" name="id" value={b.id} />}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name" name="name" defaultValue={b?.name} required />
        <Field label="Address" name="address" defaultValue={b?.address} />
        <Field label="UPI ID for this branch (optional)" name="upi_id" defaultValue={b?.upi_id ?? ""} placeholder={process.env.NEXT_PUBLIC_UPI_ID || "stargym@okaxis"} autoComplete="off" spellCheck={false} />
      </div>

      <fieldset className="flex flex-col gap-4">
        <legend className="label mb-3 text-chalk">Opening hours</legend>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Morning opens" name="morning_open" type="time" defaultValue={b ? hhmm(b.morning_open) : "05:00"} required />
          <Field label="Morning closes" name="morning_close" type="time" defaultValue={b ? hhmm(b.morning_close) : "11:00"} required />
          <Field label="Evening opens" name="evening_open" type="time" defaultValue={b ? t(b.evening_open) : "16:00"} />
          <Field label="Evening closes" name="evening_close" type="time" defaultValue={b ? t(b.evening_close) : "22:00"} />
        </div>
        <p className="-mt-2 text-xs text-ash">Leave both evening times blank for a branch with one session.</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span className="label w-full">Weekly off</span>
          {DAY_NAMES.map((d, i) => (
            <label key={d} className="flex min-h-11 items-center gap-2">
              <input type="checkbox" name="closed_days" value={i} defaultChecked={b ? b.closed_days.includes(i) : i === 0} className="size-5 accent-red" /> {d}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="label mb-3 text-chalk">Ladies&apos; timings</legend>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Morning from" name="ladies_morning_open" type="time" defaultValue={t(b?.ladies_morning_open)} />
          <Field label="Morning till" name="ladies_morning_close" type="time" defaultValue={t(b?.ladies_morning_close)} />
          <Field label="Evening from" name="ladies_evening_open" type="time" defaultValue={t(b?.ladies_evening_open)} />
          <Field label="Evening till" name="ladies_evening_close" type="time" defaultValue={t(b?.ladies_evening_close)} />
        </div>
        <p className="-mt-2 text-xs text-ash">Women-only windows. Women can also check in during general hours; men can&apos;t during these. Leave a window blank if there isn&apos;t one.</p>
      </fieldset>

      <details className="group rounded-lg border border-line">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 text-sm font-semibold text-ash">
          Location, check-in and website <span className="transition-transform group-open:rotate-180" aria-hidden="true">▾</span>
        </summary>
        <div className="grid grid-cols-1 gap-4 border-t border-line p-4 sm:grid-cols-2">
          <Field label="Google Maps link" name="maps_url" type="url" defaultValue={b?.maps_url ?? ""} />
          <Field label="Photo URL" name="image_url" type="url" defaultValue={b?.image_url ?? ""} />
          <Field label="Google place ID (reviews)" name="google_place_id" defaultValue={b?.google_place_id ?? ""} />
          <Field label="Check-in grace after closing (min)" name="grace_minutes" type="number" min="0" max="120" defaultValue={b?.grace_minutes ?? 20} />
          <Field label="Latitude" name="lat" type="number" step="any" defaultValue={b?.lat ?? ""} />
          <Field label="Longitude" name="lng" type="number" step="any" defaultValue={b?.lng ?? ""} />
          <Field label="Check-in radius (m)" name="radius_m" type="number" min="20" defaultValue={b?.radius_m ?? 150} />
          <label className="flex min-h-11 items-center gap-2 self-end"><input type="checkbox" name="require_location" defaultChecked={b?.require_location} className="size-5 accent-red" /> Require location to check in</label>
        </div>
      </details>

      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="active" defaultChecked={b?.active ?? true} className="size-5 accent-red" /> Active (shown on the site, members can check in)</label>
      <div className="flex items-center gap-4">
        <button disabled={pending} className="btn-red">{pending ? "Saving…" : b ? "Save branch" : "Add branch"}</button>
        <Status state={state} />
      </div>
    </form>
  );
}

/** Team → Personal training: move a client to another trainer, saved as soon as it changes. */
export function TrainerPick({ subId, value, trainers }: { subId: string; value: string; trainers: [string, string][] }) {
  const [pending, start] = useTransition();
  return (
    <select aria-label="Trainer" defaultValue={value} disabled={pending} className="field min-h-10 w-full sm:w-44"
      onChange={(e) => { const v = e.target.value; start(async () => toastResult(await assignTrainer(subId, v))); }}>
      <option value="">Not assigned</option>
      {trainers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
    </select>
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

