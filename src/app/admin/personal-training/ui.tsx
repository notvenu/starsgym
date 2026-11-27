"use client";

import { useActionState, useState, useTransition } from "react";
import { Field } from "@/components/client";
import { confirmDialog, ResultToast, safely, toastResult, keepFields } from "@/components/feedback";
import { prettyDay } from "@/lib/gym";
import { Sheet } from "../ui";
import { addPtEntry, deletePtEntry, savePtDetails, type Result } from "./actions";
import { DAY_NAMES, WEEK, type Details } from "./timing";

export type Entry = { id: string; kind: "note" | "session"; day: string; body: string; author: string; canDelete: boolean };

/** A form that clears itself after it saves: the pop-up stays open for the next note. */
function EntryForm({ subId, kind, today }: { subId: string; kind: "note" | "session"; today: string }) {
  const [round, setRound] = useState(0); // a new key = a blank form
  const [state, action, saving] = useActionState(async (prev: Result, form: FormData) => {
    const res = await safely(() => addPtEntry(prev, form));
    if (res?.ok) {
      toastResult(res);
      setRound((n) => n + 1);
      return undefined;
    }
    return res;
  }, undefined);
  const session = kind === "session";
  return (
    <form key={round} noValidate onSubmit={keepFields(action)} className="flex flex-col gap-3">
      <input type="hidden" name="sub_id" value={subId} />
      <input type="hidden" name="kind" value={kind} />
      {session && <Field label="Day" name="day" type="date" defaultValue={today} max={today} required />}
      <label className="flex flex-col gap-1.5">
        <span className="label">{session ? "How it went (optional)" : "Note"}</span>
        <textarea name="body" rows={session ? 2 : 3} maxLength={1000} required={!session} placeholder={session ? "Lifts, weights, how they felt…" : "Injuries, preferences, what to work on next…"} className="field py-3" />
      </label>
      <ResultToast state={state} />
      <button disabled={saving} className="btn-red min-h-11 self-start">{saving ? "Saving…" : session ? "Log session" : "Add note"}</button>
    </form>
  );
}

/** Training days, time, length and goal. */
function ScheduleForm({ subId, details }: { subId: string; details: Details }) {
  const [state, action, saving] = useActionState(async (prev: Result, form: FormData) => {
    const res = await safely(() => savePtDetails(prev, form));
    if (res?.ok) {
      toastResult(res);
      return undefined;
    }
    return res;
  }, undefined);
  return (
    <form key={JSON.stringify(details)} noValidate onSubmit={keepFields(action)} className="flex flex-col gap-4">
      <input type="hidden" name="sub_id" value={subId} />
      <fieldset className="flex flex-col gap-2">
        <legend className="label mb-1.5">Training days</legend>
        <div className="flex flex-wrap gap-1.5">
          {WEEK.map((n) => (
            <label key={n} className="cursor-pointer">
              <input type="checkbox" name="days" value={n} defaultChecked={details.days.includes(n)} className="peer sr-only" />
              <span className="flex min-h-11 min-w-12 items-center justify-center rounded-full border border-line px-3 text-sm font-semibold text-ash transition-colors peer-checked:border-red peer-checked:bg-redwash peer-checked:text-chalk peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-red">{DAY_NAMES[n]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Time" name="start_time" type="time" defaultValue={details.time} />
        <Field label="Session length (minutes)" name="minutes" type="number" inputMode="numeric" min="10" max="240" step="5" defaultValue={details.minutes ?? ""} placeholder="60" />
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="label">Goal</span>
        <input name="goal" maxLength={300} defaultValue={details.goal} placeholder="Lose 8 kg · first pull-up · rehab a shoulder" className="field" />
      </label>
      <ResultToast state={state} />
      <button disabled={saving} className="btn-red min-h-11 self-start">{saving ? "Saving…" : "Save schedule"}</button>
    </form>
  );
}

/** One tap on a client's row: a session held today, no form. Details (another day, how it went) are in Manage. */
export function QuickSession({ subId, name, loggedToday }: { subId: string; name: string; loggedToday: boolean }) {
  const [pending, start] = useTransition();
  if (loggedToday) return <span className="flex min-h-10 items-center gap-1.5 px-2 text-sm font-semibold text-ash"><span aria-hidden="true" className="text-redtext">✓</span> Done today</span>;
  return (
    <button type="button" disabled={pending} className="btn-red min-h-10 px-4 text-sm"
      onClick={() => start(async () => {
        const form = new FormData();
        form.set("sub_id", subId);
        form.set("kind", "session");
        const res = await safely(() => addPtEntry(undefined, form));
        toastResult(res?.ok ? { ok: `Session logged for ${name}` } : res);
      })}>
      {pending ? "Saving…" : "+ Session"}
    </button>
  );
}

const H = "font-label text-sm font-bold tracking-[0.15em] uppercase";

/** The "Manage" button on a client row, and its pop-up: schedule and goal, log a session, add a note, and the history. */
export function ClientSheet({ subId, name, plan, details, entries, today }: { subId: string; name: string; plan: string; details: Details; entries: Entry[]; today: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const sessions = entries.filter((e) => e.kind === "session").length;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost min-h-10 px-4 text-sm">Manage</button>
      <Sheet title={name} open={open} onClose={() => setOpen(false)}>
        {open && (
          <div className="flex flex-col gap-7">
            <p className="-mt-1 text-sm text-ash">{plan} · {sessions} session{sessions === 1 ? "" : "s"} logged</p>

            <section className="flex flex-col gap-3">
              <h3 className={H}>Log a session</h3>
              <EntryForm subId={subId} kind="session" today={today} />
            </section>

            <section className="flex flex-col gap-3 border-t border-line pt-6">
              <h3 className={H}>Schedule and goal</h3>
              <ScheduleForm subId={subId} details={details} />
            </section>

            <section className="flex flex-col gap-3 border-t border-line pt-6">
              <h3 className={H}>Add a note</h3>
              <EntryForm subId={subId} kind="note" today={today} />
            </section>

            <section className="flex flex-col gap-3 border-t border-line pt-6">
              <h3 className={H}>History</h3>
              {entries.length ? (
                <ul className="flex flex-col gap-3">
                  {entries.map((e) => (
                    <li key={e.id} className="flex items-start gap-3 rounded-lg border border-line p-3">
                      <span className={`mt-0.5 shrink-0 rounded px-1.5 text-[11px] font-bold tracking-wider uppercase ${e.kind === "session" ? "bg-red text-white" : "bg-steel text-chalk"}`}>{e.kind === "session" ? "Session" : "Note"}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{prettyDay(e.day)}<span className="font-normal text-ash"> · {e.author}</span></span>
                        {e.body && <span className="mt-1 block text-sm break-words whitespace-pre-wrap text-body">{e.body}</span>}
                      </span>
                      {e.canDelete && (
                        <button type="button" disabled={pending} aria-label={`Delete this ${e.kind}`} className="min-h-10 cursor-pointer px-2 text-sm font-semibold text-ash hover:text-redtext"
                          onClick={async () => (await confirmDialog({ title: `Delete this ${e.kind}?`, confirm: "Delete", danger: true })) && start(async () => toastResult(await safely(() => deletePtEntry(e.id))))}>
                          Delete
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ash">Nothing yet. Log a session after each class and note anything worth remembering.</p>
              )}
            </section>
          </div>
        )}
      </Sheet>
    </>
  );
}
