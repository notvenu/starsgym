"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check } from "@/components/client";
import { prettyDay, type Session } from "@/lib/gym";
import { doorCheckIn, type DoorResult } from "./actions";

type By = "phone" | "ref";
const SESSION: Record<Session, string> = { morning: "Morning", evening: "Evening", ladies: "Ladies' hours" };

export function DoorCheckIn({ doorKey, member, next }: { doorKey: string; member: string | null; next: string }) {
  const [asGuest, setAsGuest] = useState(!member); // signed-in members can still switch to phone / bill
  const [by, setBy] = useState<By>("phone");
  const [value, setValue] = useState("");
  const [res, setRes] = useState<DoorResult>();
  const [pending, start] = useTransition();

  const go = (how: "me" | By) =>
    start(async () => {
      const r = await doorCheckIn(doorKey, how, value);
      setRes(r);
      if (!r.error) navigator.vibrate?.(r.already ? 30 : [60, 40, 60]);
    });

  if (res && !res.error) return <Welcome r={res} signedIn={!!member && !asGuest} onAgain={() => { setRes(undefined); setValue(""); }} />;

  return (
    <div className="w-full max-w-md animate-rise rounded-2xl border border-chalk/10 bg-carbon/80 p-6 shadow-[0_30px_80px_rgba(0,0,0,.5)] backdrop-blur-md [animation-delay:120ms] sm:p-8">
      {!asGuest ? (
        <div className="flex flex-col gap-4">
          <p className="text-center text-ash">Signed in as <b className="text-chalk">{member}</b></p>
          <button onClick={() => go("me")} disabled={pending} className="btn-red min-h-18 animate-pulse-red font-display text-3xl font-normal tracking-wider">
            {pending ? "Checking in…" : "Check in"}
          </button>
          <button onClick={() => setAsGuest(true)} className="cursor-pointer text-sm text-ash underline-offset-4 hover:text-chalk hover:underline">
            Checking in someone else? Use phone or bill number
          </button>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); go(by); }} className="flex flex-col gap-5">
          <div role="tablist" aria-label="Check in with" className="grid grid-cols-2 gap-1 rounded-full border border-line bg-panel p-1">
            {(["phone", "ref"] as const).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={by === t}
                onClick={() => { setBy(t); setValue(""); setRes(undefined); }}
                className={`min-h-11 cursor-pointer rounded-full font-label text-sm font-bold uppercase tracking-[0.14em] transition-colors ${by === t ? "bg-red text-white" : "text-ash hover:text-chalk"}`}>
                {t === "phone" ? "Phone" : "Bill number"}
              </button>
            ))}
          </div>
          <label className="flex flex-col gap-2">
            <span className="label">{by === "phone" ? "Phone number on your membership" : "REF on your pass or receipt"}</span>
            {by === "phone" ? (
              <input key="phone" className="field min-h-16 text-center text-2xl tracking-[0.12em]" type="tel" inputMode="numeric" autoComplete="tel" placeholder="98765 43210"
                required value={value} onChange={(e) => setValue(e.target.value)} />
            ) : (
              <input key="ref" className="field min-h-16 text-center text-2xl tracking-[0.3em] uppercase" autoCapitalize="characters" autoComplete="off" placeholder="1A2B3C4D" maxLength={12}
                required value={value} onChange={(e) => setValue(e.target.value)} />
            )}
          </label>
          <button disabled={pending} className="btn-red min-h-16 font-display text-2xl font-normal tracking-wider">{pending ? "Checking in…" : "Check in"}</button>
          {member ? (
            <button type="button" onClick={() => setAsGuest(false)} className="cursor-pointer text-sm text-ash hover:text-chalk">← Back to my check-in</button>
          ) : (
            <p className="text-center text-sm text-ash">
              Have an account? <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-bold text-red hover:text-chalk">Sign in</Link> to check in with one tap.
            </p>
          )}
        </form>
      )}
      {res?.error && <p role="alert" className="mt-4 rounded-md border border-red/40 bg-redwash px-4 py-3 text-center text-sm text-chalk">{res.error}</p>}
    </div>
  );
}

/** The after-check-in screen: who, which session, streak, this month, plan validity. */
function Welcome({ r, signedIn, onAgain }: { r: DoorResult; signedIn: boolean; onAgain: () => void }) {
  const time = r.at ? new Date(r.at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "";
  const daysLeft = r.endsOn ? Math.round((Date.parse(r.endsOn) - Date.parse(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }))) / 864e5) + 1 : null;
  return (
    <div className="flex w-full max-w-md animate-rise flex-col items-center gap-6 text-center">
      <div className="relative">
        {r.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.photo} alt="" className="size-36 rounded-full border-[5px] border-red object-cover shadow-[0_0_60px_rgba(227,20,28,.45)]" />
        ) : (
          <div className="flex size-36 items-center justify-center rounded-full bg-red shadow-[0_0_60px_rgba(227,20,28,.45)]">
            <Check className="size-16 text-white" />
          </div>
        )}
        {r.photo && (
          <span className="absolute -right-1 -bottom-1 flex size-12 items-center justify-center rounded-full border-4 border-ink bg-red">
            <Check className="size-6 text-white" />
          </span>
        )}
      </div>

      <div>
        <p className="font-label text-sm font-bold tracking-[0.24em] text-red uppercase">
          {r.already ? `Already in · ${r.session ? SESSION[r.session] : "today"}` : `${r.session ? SESSION[r.session] : "Checked in"} · ${time}`}
        </p>
        <h2 className="mt-1 font-display text-[clamp(48px,13vw,76px)] leading-[0.9] uppercase">
          {r.already ? "See you inside" : "Welcome"}{r.name ? <>, <span className="text-red">{r.name}</span></> : null}
        </h2>
        <p className="mt-2 text-ash">{r.branch}</p>
      </div>

      <dl className="grid w-full grid-cols-2 gap-3 text-left">
        <Stat label="Streak" value={<span className="flex items-center gap-2"><Flame size={22} /> {r.streak} day{r.streak === 1 ? "" : "s"}</span>} />
        <Stat label="This month" value={`${r.monthVisits ?? 0} visit${r.monthVisits === 1 ? "" : "s"}`} />
        <Stat
          wide
          label="Today"
          value={
            <span className="flex flex-wrap gap-2">
              {(r.sessionsToday ?? []).map((s) => (
                <span key={s} className="inline-flex items-center gap-1 rounded-full border border-redline bg-redwash px-3 py-1 font-label text-sm tracking-wider uppercase">
                  <Check className="size-4 text-red" /> {SESSION[s]}
                </span>
              ))}
            </span>
          }
        />
        {r.plan && <Stat wide label="Plan" value={r.plan} />}
        {r.endsOn && (
          <Stat wide label="Valid till" value={<>{prettyDay(r.endsOn)}{daysLeft !== null && <span className={`ml-2 text-sm ${daysLeft <= 5 ? "text-red" : "text-ash"}`}>· {daysLeft} day{daysLeft === 1 ? "" : "s"} left</span>}</>} />
        )}
      </dl>
      {daysLeft !== null && daysLeft <= 5 && <p className="text-sm text-red">Your plan ends soon — renew at the desk or online.</p>}

      <div className="flex w-full flex-col gap-2 sm:flex-row">
        {signedIn ? (
          <Link href="/dashboard" className="btn-red flex-1">My dashboard</Link>
        ) : (
          <button onClick={onAgain} className="btn-ghost flex-1">Check in someone else</button>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, wide }: { label: string; value: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`rounded-xl border border-chalk/10 bg-carbon/80 px-4 py-3 backdrop-blur ${wide ? "col-span-2" : ""}`}>
      <dt className="font-label text-xs font-bold tracking-[0.18em] text-ash uppercase">{label}</dt>
      <dd className="mt-1 text-xl font-bold">{value}</dd>
    </div>
  );
}

function Flame({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-red">
      <path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 1.5-5 3-6 .3 2 1.3 3.2 3 3.5C12 8 11 5 12 2z" />
    </svg>
  );
}
