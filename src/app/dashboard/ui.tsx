"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, Field, OpenStatus, WeekHolidays } from "@/components/client";
import type { Profile } from "@/lib/supabase";
import { GENDERS, ladiesLabel, weekHolidays, type Branch, type Holiday, type Session } from "@/lib/gym";
import { PhotoCapture } from "@/components/photo";
import { Sheet } from "@/components/sheet";
import { ScanButton } from "@/components/scanner";
import { ResultToast, toast, toastResult, keepFields } from "@/components/feedback";
import { cancelRequest, checkIn, postShowcase, requestChange, saveProfile, type Result } from "./actions";

const MILESTONES = [7, 30, 60, 100, 200, 365];
const R = 88;
const C = 2 * Math.PI * R;

export function CheckInPanel(props: {
  branches: Branch[];
  homeBranch: string | null;
  holidays: Holiday[];
  streak: number;
  todaySessions: Session[];
  nowSession: Record<string, Session | "ladies_only" | null>;
  photo: string | null;
  name: string;
  hasPlan: boolean;
  week: { iso: string; label: string; done: boolean; today: boolean }[];
}) {
  const { branches } = props;
  const [branchId, setBranchId] = useState(props.homeBranch ?? branches[0]?.id ?? "");
  const branch = branches.find((b) => b.id === branchId);
  const [useLocation, setUseLocation] = useState(true);
  const [pending, start] = useTransition();
  const [streak, setStreak] = useState(props.streak);
  const [visits, setVisits] = useState(props.todaySessions);
  const sess = props.nowSession[branchId];
  const done = !!sess && sess !== "ladies_only" && visits.includes(sess); // already in for this session (morning and evening count separately)

  const goal = MILESTONES.find((m) => m > streak) ?? streak + 100;
  const mustLocate = !!branch?.require_location;

  function submit() {
    const send = (lat?: number, lng?: number) =>
      start(async () => {
        const res = await checkIn(branchId, lat, lng);
        if (res.error) return toast(res.error, "error");
        setStreak(res.streak ?? streak + 1);
        if (sess && sess !== "ladies_only") setVisits((v) => [...v, sess]);
        navigator.vibrate?.(60);
      });

    if (!(useLocation || mustLocate)) return send();
    if (!navigator.geolocation) return mustLocate ? toast("Your browser can't share location.", "error") : send();
    navigator.geolocation.getCurrentPosition(
      (pos) => send(pos.coords.latitude, pos.coords.longitude),
      () => (mustLocate ? toast("Allow location access to check in at this branch.", "error") : send()),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    <section className="flex flex-col gap-7 rounded-lg border border-line bg-panel p-6 sm:p-9">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* the member's photo — the same face staff see when they scan the pass */}
          {props.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={props.photo} alt="" className={`size-12 rounded-full border-2 object-cover ${done ? "border-red" : "border-strong"}`} />
          ) : (
            <span className="flex size-12 items-center justify-center rounded-full border-2 border-strong font-display text-xl uppercase">{props.name[0]}</span>
          )}
          <div className="leading-tight">
            <p className="label">Daily check-in</p>
            <p className="font-bold">{props.name.split(" ")[0] || "Athlete"}</p>
          </div>
        </div>
        {branch && <p className="font-label text-sm font-bold uppercase tracking-[0.12em]"><OpenStatus branch={branch} holidays={props.holidays} withHours /></p>}
      </div>

      <div className="relative mx-auto flex size-56 items-center justify-center">
        <svg viewBox="0 0 200 200" className="absolute inset-0 -rotate-90" aria-hidden="true">
          <circle cx="100" cy="100" r={R} fill="none" stroke="#1e1e1e" strokeWidth="12" />
          <circle cx="100" cy="100" r={R} fill="none" stroke="var(--color-red)" strokeWidth="12" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - Math.min(streak / goal, 1))}
            className="transition-[stroke-dashoffset] duration-900 ease-lift" />
        </svg>
        <div className="text-center">
          <p key={streak} className="animate-rise font-display text-[84px] leading-none [animation-duration:.5s]">{streak}</p>
          <p className="label">Day streak</p>
          <p className="mt-1 text-[13px] text-ash">{goal - streak} to {goal}-day badge</p>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {props.week.map((d) => {
          const filled = d.done || (d.today && visits.length > 0);
          return (
            <div key={d.iso} className="flex flex-col items-center gap-2">
              <div className={`flex aspect-square w-full max-w-12 items-center justify-center rounded-full ${filled ? "bg-red" : d.today ? "border-2 border-dashed border-red" : "border border-strong"}`}>
                {filled && <Check className="text-white" />}
              </div>
              <span className="font-label text-sm font-bold text-ash">{d.label}</span>
            </div>
          );
        })}
      </div>

      {branches.length > 1 && (
        <label className="flex flex-col gap-1.5">
          <span className="label">Branch</span>
          <select className="field" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
      )}

      <label className="flex min-h-11 items-center gap-3 text-sm text-ash">
        <input type="checkbox" className="size-5 accent-red" checked={useLocation || mustLocate} disabled={mustLocate} onChange={(e) => setUseLocation(e.target.checked)} />
        Verify with my location {mustLocate && "(required at this branch)"}
      </label>

      <WeekHolidays holidays={weekHolidays(props.holidays, branchId)} />

      {visits.length > 0 && (
        <p className="flex flex-wrap items-center justify-center gap-2 text-sm text-ash">
          Today:
          {(["morning", "ladies", "evening"] as const).filter((v) => visits.includes(v)).map((v) => (
            <span key={v} className="inline-flex items-center gap-1 rounded-full border border-redline bg-redwash px-3 py-1 font-label font-bold tracking-wider text-chalk uppercase">
              <Check className="text-red" /> {v === "ladies" ? "Ladies' hours" : v}
            </span>
          ))}
        </p>
      )}

      {done ? (
        <p className="flex min-h-16 items-center justify-center gap-2.5 rounded-md border border-red bg-redwash font-display text-2xl uppercase">
          <Check /> Checked in{sess === "ladies" ? " · ladies' hours" : ` · ${sess}`}
        </p>
      ) : sess === "ladies_only" ? (
        <p className="flex min-h-16 flex-col items-center justify-center rounded-md border border-strong px-4 py-3 text-center">
          <span className="font-display text-2xl uppercase">Ladies&apos; hours now</span>
          <span className="text-sm text-ash">Women only {branch && ladiesLabel(branch)}. Check in during general hours.</span>
        </p>
      ) : (
        <button onClick={submit} disabled={pending || !props.hasPlan || !branch} className="btn-red min-h-16 animate-pulse-red font-display text-2xl font-normal tracking-wider">
          {pending ? "Checking in…" : props.hasPlan ? "Check in now" : "Buy a plan to check in"}
        </button>
      )}

      {/* at the gym: scan the poster by the door instead (proves you're there, no location needed) */}
      {props.hasPlan && !done && (
        <ScanButton kind="door" className="btn-ghost -mt-3 min-h-12 gap-2.5">
          <ScanIcon /> Scan the entrance QR
        </ScanButton>
      )}
    </section>
  );
}

export function ScanIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16" />
    </svg>
  );
}

export function ShowcaseForm({ defaultLink }: { defaultLink: string }) {
  const [state, action, pending] = useActionState(postShowcase, undefined);
  const [preview, setPreview] = useState<string>();

  return (
    <form noValidate onSubmit={keepFields(action)} className="flex flex-col gap-3">
      <label className="flex cursor-pointer items-center gap-4 rounded border border-dashed border-strong p-3 hover:border-red">
        <span className="stripes flex size-16 shrink-0 items-center justify-center overflow-hidden rounded text-2xl text-ash">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {preview ? <img src={preview} alt="" className="size-full object-cover" /> : "+"}
        </span>
        <span className="text-sm text-ash">Add a photo (JPG, PNG, WebP · under 5 MB)</span>
        <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required className="sr-only"
          onChange={(e) => { const f = e.target.files?.[0]; setPreview(f ? URL.createObjectURL(f) : undefined); }} />
      </label>
      <input name="link_url" type="url" placeholder="https://instagram.com/you" defaultValue={defaultLink} className="field" aria-label="Social link" />
      <ResultToast state={state} />
      <button disabled={pending} className="btn-red">{pending ? "Uploading…" : "Post to the wall"}</button>
    </form>
  );
}

export type ChangeRequest = {
  id: string; full_name: string | null; gender: string | null; home_branch_id: string | null; photo_path: string | null;
  status: "pending" | "approved" | "rejected"; created_at: string; decided_at: string | null; photoUrl: string | null;
  recent: boolean; // decided in the last week
};

/**
 * "Edit" next to their name opens the profile in a sheet. Name, gender, branch and photo were set once — changing them
 * is a request the desk approves. Phone, date of birth, emergency contact and socials are theirs to edit any time.
 */
export function ProfileEditor({ profile, photo, branches, request }: { profile: Profile; photo: string | null; branches: Branch[]; request: ChangeRequest | null }) {
  const [open, setOpen] = useState(false);
  const waiting = request?.status === "pending";
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Edit profile"
        className="relative flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full border border-strong px-4 text-sm font-bold tracking-wider uppercase transition-colors hover:border-red hover:text-red">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
        Edit
        {waiting && <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full border-2 border-ink bg-red" title="Change pending" />}
      </button>
      {open && (
        <Sheet title="Your profile" open onClose={() => setOpen(false)}>
          <ProfileBody profile={profile} photo={photo} branches={branches} request={request} />
        </Sheet>
      )}
    </>
  );
}

function ProfileBody({ profile, photo, branches, request }: { profile: Profile; photo: string | null; branches: Branch[]; request: ChangeRequest | null }) {
  const [asking, setAsking] = useState(false);
  const [pending, start] = useTransition();
  const branchName = (id: string | null) => branches.find((b) => b.id === id)?.name ?? "—";
  const genderName = (g: string | null) => GENDERS.find(([k]) => k === g)?.[1] ?? "—";
  const open = request?.status === "pending" ? request : null;
  const recent = request && request.status !== "pending" && request.recent ? request : null;
  const asked = open ? [open.full_name && `name → ${open.full_name}`, open.gender && `gender → ${genderName(open.gender)}`, open.home_branch_id && `branch → ${branchName(open.home_branch_id)}`, open.photo_path && "new photo"].filter(Boolean).join(" · ") : "";

  return (
    <div className="flex flex-col gap-6">
        {/* set once — the desk changes these */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="Your photo" className="size-20 rounded-2xl border border-line object-cover" />
            ) : (
              <span className="stripes size-20 rounded-2xl" />
            )}
            <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div className="col-span-2"><dt className="label text-xs">Name</dt><dd className="truncate font-bold">{profile.full_name || "—"}</dd></div>
              <div><dt className="label text-xs">Gender</dt><dd className="font-bold">{genderName(profile.gender)}</dd></div>
              <div><dt className="label text-xs">Home branch</dt><dd className="font-bold">{branchName(profile.home_branch_id)}</dd></div>
            </dl>
          </div>

          {open ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-redline bg-redwash px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {open.photoUrl && <img src={open.photoUrl} alt="Requested photo" className="size-11 rounded-full border-2 border-red object-cover" />}
                <p className="min-w-0 text-sm"><b className="block text-chalk">Waiting for the desk</b><span className="text-ash">{asked}</span></p>
              </div>
              <button type="button" disabled={pending} onClick={() => start(async () => toastResult(await cancelRequest()))} className="cursor-pointer text-sm font-bold text-ash hover:text-red">Cancel</button>
            </div>
          ) : asking ? (
            <RequestForm profile={profile} branches={branches} onDone={() => setAsking(false)} />
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ash">
                {recent ? (recent.status === "approved" ? "Your last change was approved." : "Your last change request was declined — ask at the desk.") : "Need to fix your name, gender, branch or photo?"}
              </p>
              <button type="button" onClick={() => setAsking(true)} className="btn-ghost min-h-11">Request a change</button>
            </div>
          )}
        </section>

        {/* theirs to edit any time */}
        <ContactForm profile={profile} />
    </div>
  );
}

function RequestForm({ profile, branches, onDone }: { profile: Profile; branches: Branch[]; onDone: () => void }) {
  const [state, action, pending] = useActionState(async (prev: Result, form: FormData) => {
    const r = await requestChange(prev, form);
    if (r?.ok) onDone();
    return r;
  }, undefined);
  return (
    <form noValidate onSubmit={keepFields(action)} className="flex flex-col gap-4 rounded-xl border border-line p-4">
      <p className="text-sm text-ash">Change only what&apos;s wrong — the desk checks and approves it.</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name" name="full_name" defaultValue={profile.full_name} autoComplete="name" />
        <label className="flex flex-col gap-1.5">
          <span className="label">Gender</span>
          <select name="gender" defaultValue={profile.gender ?? ""} className="field">
            {GENDERS.map(([g, l]) => <option key={g} value={g}>{l}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="label">Home branch</span>
          <select name="home_branch_id" defaultValue={profile.home_branch_id ?? ""} className="field">
            {!profile.home_branch_id && <option value="">—</option>}
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
      </div>
      <PhotoCapture label="New photo (optional)" />
      <Field label="Note for the desk (optional)" name="note" maxLength={300} placeholder="e.g. spelling of my surname" />
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="btn-red min-h-12 max-sm:flex-1">{pending ? "Sending…" : "Send request"}</button>
        <button type="button" onClick={onDone} className="btn-ghost min-h-12 max-sm:flex-1">Cancel</button>
        <ResultToast state={state} />
      </div>
    </form>
  );
}

function ContactForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState(saveProfile, undefined);
  return (
    <form noValidate onSubmit={keepFields(action)} className="flex flex-col gap-4 border-t border-line pt-6">
      <p className="label">Contact &amp; socials · edit any time</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" defaultValue={profile.phone ?? ""} required />
        <Field label="Date of birth" name="date_of_birth" type="date" min="1900-01-01" max={new Date().toISOString().slice(0, 10)} defaultValue={profile.date_of_birth ?? ""} />
        <Field label="Emergency contact" name="emergency_contact" placeholder="Name & phone" maxLength={120} defaultValue={profile.emergency_contact ?? ""} />
        <Field label="Instagram / social link" name="instagram_url" type="url" placeholder="https://instagram.com/you" defaultValue={profile.instagram_url ?? ""} />
      </div>
      <div className="flex items-center gap-4">
        <button disabled={pending} className="btn-red min-h-12 max-sm:w-full">{pending ? "Saving…" : "Save"}</button>
        <ResultToast state={state} />
      </div>
    </form>
  );
}
