"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, Field, MemberDetailsFields, OpenStatus, WeekHolidays } from "@/components/client";
import type { Profile } from "@/lib/supabase";
import { ladiesLabel, weekHolidays, type Branch, type Holiday, type Session } from "@/lib/gym";
import { PhotoCapture } from "@/components/photo";
import { ScanButton } from "@/components/scanner";
import { ResultToast, toast } from "@/components/feedback";
import { changePhoto, checkIn, postShowcase, saveProfile } from "./actions";

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
    <form action={action} className="flex flex-col gap-3">
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

/** Members can replace their photo twice; after that the desk does it. */
export function PhotoForm({ url, changesLeft }: { url: string | null; changesLeft: number }) {
  const [state, action, pending] = useActionState(changePhoto, undefined);
  if (changesLeft <= 0)
    return (
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url && <img src={url} alt="Your photo" className="size-24 rounded-full border-2 border-strong object-cover" />}
        <p className="text-sm text-ash">You&apos;ve used both photo changes. Ask the desk if it needs updating.</p>
      </div>
    );
  return (
    <form action={action} className="flex flex-col gap-3">
      <PhotoCapture current={url} label={`Your photo · ${changesLeft} change${changesLeft === 1 ? "" : "s"} left`} />
      <div className="flex items-center gap-4">
        <button disabled={pending} className="btn-ghost">{pending ? "Saving…" : "Save new photo"}</button>
        <ResultToast state={state} />
      </div>
    </form>
  );
}

export function ProfileForm({ profile, branches }: { profile: Profile; branches: Branch[] }) {
  const [state, action, pending] = useActionState(saveProfile, undefined);
  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <Field label="Full name" name="full_name" defaultValue={profile.full_name} required />
      <MemberDetailsFields d={profile} />
      <Field label="Instagram / social link" name="instagram_url" type="url" placeholder="https://instagram.com/you" defaultValue={profile.instagram_url ?? ""} />
      <label className="flex flex-col gap-1.5">
        <span className="label">Home branch</span>
        <select name="home_branch_id" defaultValue={profile.home_branch_id ?? ""} className="field">
          <option value="">—</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </label>
      <div className="flex items-center gap-4 md:col-span-2">
        <button disabled={pending} className="btn-ghost">{pending ? "Saving…" : "Save profile"}</button>
        <ResultToast state={state} />
      </div>
    </form>
  );
}
