"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check } from "@/components/client";
import { doorCheckIn, type DoorResult } from "./actions";

type By = "phone" | "ref";

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
      if (!r.error) navigator.vibrate?.(60);
    });

  if (res && !res.error) {
    return (
      <div className="flex w-full max-w-sm animate-rise flex-col items-center gap-4 text-center">
        <div className="flex size-32 items-center justify-center rounded-full bg-red">
          <Check className="size-16 text-white" />
        </div>
        <p className="font-display text-5xl leading-none uppercase">{res.already ? "Already in" : "You're in"}{res.name ? `, ${res.name}` : ""}</p>
        <p className="text-lg text-body">
          {res.already ? "You've already checked in today." : `Checked in at ${res.branch}.`} Streak: <b className="text-chalk">{res.streak} day{res.streak === 1 ? "" : "s"}</b>
        </p>
        {member && <Link href="/dashboard" className="btn-ghost">Dashboard</Link>}
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-5">
      {!asGuest ? (
        <>
          <button onClick={() => go("me")} disabled={pending} className="btn-red min-h-16 font-display text-2xl font-normal tracking-wider">
            {pending ? "Checking in…" : `Check in as ${member!.split(" ")[0]}`}
          </button>
          <button onClick={() => setAsGuest(true)} className="cursor-pointer text-sm text-ash underline-offset-4 hover:text-chalk hover:underline">
            Checking in someone else? Use phone or bill number
          </button>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            go(by);
          }}
          className="flex flex-col gap-4"
        >
          <div role="tablist" aria-label="Check in with" className="grid grid-cols-2 gap-1 rounded-md border border-line bg-panel p-1">
            {(["phone", "ref"] as const).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={by === t}
                onClick={() => { setBy(t); setValue(""); setRes(undefined); }}
                className={`min-h-11 cursor-pointer rounded font-label text-sm font-bold uppercase tracking-[0.14em] ${by === t ? "bg-red text-white" : "text-ash hover:text-chalk"}`}>
                {t === "phone" ? "Phone number" : "Bill number"}
              </button>
            ))}
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="label">{by === "phone" ? "Phone on your membership" : "REF on your pass or receipt"}</span>
            {by === "phone" ? (
              <input key="phone" className="field text-xl tracking-wider" type="tel" inputMode="numeric" autoComplete="tel" placeholder="98765 43210"
                required value={value} onChange={(e) => setValue(e.target.value)} />
            ) : (
              <input key="ref" className="field text-xl tracking-[0.2em] uppercase" autoCapitalize="characters" autoComplete="off" placeholder="1A2B3C4D" maxLength={12}
                required value={value} onChange={(e) => setValue(e.target.value)} />
            )}
          </label>
          <button disabled={pending} className="btn-red min-h-16 font-display text-2xl font-normal tracking-wider">{pending ? "Checking in…" : "Check in"}</button>
          {!member && (
            <p className="text-center text-sm text-ash">
              Have an account? <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-bold text-red hover:text-chalk">Sign in</Link> to check in with one tap.
            </p>
          )}
        </form>
      )}
      {res?.error && <p role="alert" className="text-center text-red">{res.error}</p>}
    </div>
  );
}
