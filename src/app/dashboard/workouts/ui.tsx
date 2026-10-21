"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Sheet } from "@/components/sheet";
import { confirmDialog, toast, toastResult } from "@/components/feedback";
import { buildSplit, EVERY, LEVELS, logFromDay, logsCsv, logText, planLink, planText, RECOMMENDED, schedule, SPLITS, targetFor, volume, type Level, type Log, type Plan, type PlanDay, type PlanExercise } from "@/lib/workouts";
import { Check } from "@/components/client";
import { EXERCISES } from "@/lib/exercises";
import { deleteLog, deletePlan, saveLog, savePlan, type Result } from "./actions";

/** Native share sheet on phones; copies to the clipboard elsewhere. */
async function share(title: string, text: string, url?: string) {
  if (navigator.share) {
    try {
      return await navigator.share({ title, text, url });
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(url ? `${text}\n\n${url}` : text);
    toast("Copied — paste it anywhere");
  } catch {
    toast("Couldn't share", "error");
  }
}

function download(name: string, body: string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([body], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Edits a deep copy, so nested inputs can just mutate. */
function useDraft<T>(initial: T) {
  const [draft, setDraft] = useState(initial);
  return [draft, (fn: (d: T) => void) => setDraft((d) => { const c = structuredClone(d); fn(c); return c; })] as const;
}

const blankExercise = (name: string): PlanExercise => ({ name, sets: 3, reps: 10, kg: 0, addKg: 2.5, addReps: 0, every: 7 });
const kg = (n: number) => `${Math.round(n).toLocaleString("en-IN")} kg`;
const shortDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
const small = "field min-h-10 px-2.5 text-sm";
const HISTORY_PAGE = 5;

type Editing<T> = { value: T; id?: string } | null;

/** The /workouts page: today's workout, history, plan editing, switching splits, sharing and export.
 *  (Day to day, members log from the dashboard's check-in card: see TodayLog.) */
export function Workouts({ plan, level, logs, today, checkedIn, shared = null }: {
  plan: Plan | null; level: Level | null; logs: Log[]; today: string; checkedIn: boolean; shared?: Plan | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [busy, start] = useTransition();
  const [editing, setEditing] = useState<Editing<Plan>>(null);
  const [log, setLog] = useState<Editing<Log>>(null);
  const [choosing, setChoosing] = useState(false);
  const [shown, setShown] = useState(HISTORY_PAGE);
  const run = (fn: () => Promise<Result>, done: () => void) =>
    start(async () => {
      const r = await fn();
      toastResult(r);
      if (r?.ok) done();
    });
  const remove = async (what: string, fn: () => Promise<Result>, done: () => void) => {
    if (await confirmDialog({ title: `Delete ${what}?`, confirm: "Delete", danger: true })) run(fn, done);
  };
  const clearShared = () => shared && router.replace(pathname, { scroll: false });
  /** Picking a split saves it straight away; weights come from their first session. */
  const use = async (p: Plan) => {
    if (plan && !(await confirmDialog({ title: `Switch to ${p.name}?`, body: `It replaces ${plan.name}. Your workout history stays.`, confirm: "Switch" }))) return;
    run(() => savePlan(p), () => { setChoosing(false); clearShared(); });
  };

  const mine = LEVELS.find((l) => l.key === level) ?? LEVELS[0];
  const suggested = buildSplit(RECOMMENDED[mine.key], mine.key);
  const sched = plan ? schedule(plan, logs, today) : null;
  const day = plan?.days[sched!.next];
  const [asking, setAsking] = useState(false);
  const doneToday = logs.filter((l) => l.day === today);
  const past = logs.filter((l) => l.day !== today); // today's are on the card already
  const weekAgo = new Date(Date.parse(today) - 6 * 864e5).toISOString().slice(0, 10);
  const week = logs.filter((l) => l.day >= weekAgo).length;
  const startDay = (d: PlanDay) => plan && setLog({ value: logFromDay(plan, d, logs, today) });
  const begin = () => (sched?.ask ? setAsking(true) : day && startDay(day));
  const link = "min-h-10 cursor-pointer text-sm font-bold text-ash underline-offset-4 hover:text-chalk hover:underline";

  return (
    <section id="workouts" aria-label="Today's workout" className="card flex scroll-mt-20 flex-col gap-5 p-5 sm:p-6">
      {shared && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-red bg-redwash p-4">
          <p className="min-w-0 text-sm">
            <span className="block font-bold">{shared.name}</span>
            <span className="text-ash">Shared with you · {shared.days.map((d) => d.name).join(" · ")}</span>
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn-red min-h-10 px-4 text-xs" disabled={busy} onClick={() => use(shared)}>Use it</button>
            <button type="button" className="btn-ghost min-h-10 px-4 text-xs" onClick={clearShared}>Dismiss</button>
          </div>
        </div>
      )}

      {!plan || !day ? (
        // no split yet: one recommended for their level, one tap to start
        <>
          <div>
            <p className="label">Your training plan</p>
            <h2 className="font-display text-4xl leading-tight uppercase">{suggested.name}</h2>
            <p className="text-sm text-ash">Recommended for {mine.label.toLowerCase()}s · {suggested.days.map((d) => d.name).join(" · ")}</p>
          </div>
          <ul className="flex flex-col gap-1.5 text-sm text-body">
            {suggested.days[0].exercises.map((e) => <li key={e.name}>{e.name} <span className="text-ash">· {e.sets} × {e.reps}</span></li>)}
            <li className="text-ash">…and {suggested.days.length - 1} more workout{suggested.days.length > 2 ? "s" : ""}</li>
          </ul>
          <button type="button" className="btn-red min-h-12" disabled={busy} onClick={() => use(suggested)}>{busy ? "Saving…" : "Start this plan"}</button>
          <button type="button" className={`${link} self-start`} onClick={() => setChoosing(true)}>See other splits</button>
        </>
      ) : doneToday.length ? (
        // done for today
        <>
          <div>
            <p className="label">Today · {plan.name}</p>
            <h2 className="flex items-center gap-2 font-display text-4xl leading-tight uppercase"><Check /> Workout done</h2>
          </div>
          {doneToday.map((l) => (
            <button key={l.id} type="button" className="flex items-center justify-between gap-3 rounded-md border border-redline bg-redwash px-4 py-3 text-left hover:border-red" onClick={() => setLog({ value: l, id: l.id })}>
              <span className="min-w-0">
                <span className="block truncate font-bold">{l.title.replace(`${plan.name} · `, "")}</span>
                <span className="block text-sm text-ash">{summary(l)}</span>
              </span>
              <span className="shrink-0 text-sm font-bold text-red">View</span>
            </button>
          ))}
          <p className="text-sm text-ash">Next time: <b className="text-chalk">{day.name}</b></p>
        </>
      ) : (
        // today's workout: shown before check-in, loggable after
        <>
          <div>
            <p className="label">Today · {plan.name}</p>
            <h2 className="font-display text-4xl leading-tight uppercase">{day.name}</h2>
          </div>
          <ul className="divide-y divide-line text-sm">
            {day.exercises.map((e) => {
              const t = targetFor(e, plan, logs, today);
              return (
                <li key={e.name} className="flex justify-between gap-3 py-2">
                  <span className="min-w-0 truncate">{e.name}</span>
                  <span className="shrink-0 text-ash tabular-nums">{e.sets} × {t.reps}{t.kg ? ` · ${t.kg} kg` : ""}</span>
                </li>
              );
            })}
          </ul>
          {checkedIn ? (
            <button type="button" className="btn-red min-h-12" onClick={begin}>Log {day.name}</button>
          ) : (
            <p className="rounded-md border border-dashed border-strong px-4 py-3 text-center text-sm text-ash">Check in to log today&apos;s workout.</p>
          )}
        </>
      )}

      {past.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="label">History</p>
            <p className="text-sm text-ash">{week} this week</p>
          </div>
          <ul className="divide-y divide-line">
            {past.slice(0, shown).map((l) => (
              <li key={l.id}>
                <button type="button" className="flex w-full cursor-pointer items-center justify-between gap-3 py-2.5 text-left hover:text-red" onClick={() => setLog({ value: l, id: l.id })}>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{plan ? l.title.replace(`${plan.name} · `, "") : l.title}</span>
                    <span className="block text-xs text-ash">{summary(l)}</span>
                  </span>
                  <span className="shrink-0 text-xs text-ash">{shortDate(l.day)}</span>
                </button>
              </li>
            ))}
          </ul>
          {shown < past.length && <button type="button" className={`${link} self-start`} onClick={() => setShown(shown + 10)}>Show more</button>}
        </div>
      )}

      {(plan || logs.length > 0) && (
        <div className="flex flex-wrap gap-x-5 border-t border-line pt-3">
          {plan && <button type="button" className={link} onClick={() => setEditing({ value: plan, id: plan.id })}>Edit plan</button>}
          {plan && <button type="button" className={link} onClick={() => setChoosing(true)}>Change split</button>}
          {plan && <button type="button" className={link} onClick={() => share(plan.name, planText(plan), planLink(location.origin, plan))}>Share plan</button>}
          {checkedIn && <button type="button" className={link} onClick={() => setLog({ value: { day: today, title: "Workout", note: "", exercises: [] } })}>Log something else</button>}
          {logs.length > 0 && <button type="button" className={link} onClick={() => download(`workouts-${today}.csv`, logsCsv(logs), "text/csv")}>Export CSV</button>}
          {logs.length > 0 && <button type="button" className={link} onClick={() => download(`workouts-${today}.json`, JSON.stringify({ plan, logs }, null, 2), "application/json")}>Export JSON</button>}
        </div>
      )}

      {plan && sched && (
        <DayChoice open={asking} plan={plan} sched={sched} onClose={() => setAsking(false)} onPick={(i) => { setAsking(false); startDay(plan.days[i]); }} />
      )}
      <Sheet title="Pick a split" open={choosing} onClose={() => setChoosing(false)}>
        <SplitList level={mine.key} current={plan?.name ?? null} busy={busy} onPick={use} onCustom={() => { setChoosing(false); setEditing({ value: { name: "", days: [{ name: "Day 1", exercises: [] }] } }); }} />
      </Sheet>
      <Sheet title={editing?.id ? "Edit plan" : "Build your own"} open={!!editing} onClose={() => setEditing(null)}>
        {editing && (
          <PlanEditor key={editing.id ?? "new"} initial={editing.value} existing={!!editing.id} replaces={editing.id ? null : plan?.name ?? null} busy={busy}
            onSave={(p, restart) => run(() => savePlan(p, editing.id, restart), () => setEditing(null))}
            onDelete={() => remove(`"${editing.value.name}"`, () => deletePlan(editing.id!), () => setEditing(null))} />
        )}
      </Sheet>
      <Sheet title={log?.id ? "Workout" : "Log workout"} open={!!log} onClose={() => setLog(null)}>
        {log && (
          log.id ? (
            <LogEditor key={log.id} initial={log.value} today={today} busy={busy} existing
              onSave={(l) => run(() => saveLog(l, log.id), () => setLog(null))}
              onShare={(l) => share(l.title, logText(l))}
              onDelete={() => remove("this workout", () => deleteLog(log.id!), () => setLog(null))} />
          ) : (
            <GuidedLog key={log.value.title} initial={log.value} today={today} busy={busy} onSave={(l) => run(() => saveLog(l), () => setLog(null))} />
          )
        )}
      </Sheet>
    </section>
  );
}

/**
 * The dashboard's check-in card turns into this once they've checked in: today's plan day, ready to fill in and finish.
 * No plan yet: one tap starts the one recommended for their level.
 */
export function TodayLog({ plan, logs, today, level, onSkip }: { plan: Plan | null; logs: Log[]; today: string; level: Level | null; onSkip: () => void }) {
  const [busy, start] = useTransition();
  const sched = plan ? schedule(plan, logs, today) : null;
  const [picked, setPicked] = useState<number | null>(null); // after a missed day: the one they chose
  const save = (fn: () => Promise<Result>) => start(async () => toastResult(await fn()));
  const skip = <button type="button" className="min-h-10 cursor-pointer self-center text-sm font-bold text-ash hover:text-chalk" onClick={onSkip}>Not today</button>;

  if (!plan) {
    const mine = LEVELS.find((l) => l.key === level) ?? LEVELS[0];
    const suggested = buildSplit(RECOMMENDED[mine.key], mine.key);
    return (
      <div className="flex flex-col gap-4">
        <div>
          <p className="label">Log today&apos;s workout</p>
          <p className="text-xl font-bold">Start with {suggested.name}</p>
          <p className="text-sm text-ash">Recommended for {mine.label.toLowerCase()}s · {suggested.days.map((d) => d.name).join(" · ")}</p>
        </div>
        <button type="button" className="btn-red min-h-12" disabled={busy} onClick={() => save(() => savePlan(suggested))}>{busy ? "Saving…" : "Start this plan"}</button>
        <Link href="/dashboard/workouts" className="self-center text-sm font-bold text-ash hover:text-chalk">Other splits</Link>
        {skip}
      </div>
    );
  }
  const day = plan.days[picked ?? sched!.next];
  return (
    <div className="flex flex-col gap-4">
      <DayChoice open={sched!.ask && picked === null} plan={plan} sched={sched!} onClose={() => setPicked((p) => p ?? sched!.next)} onPick={setPicked} />
      <GuidedLog key={day.name} initial={logFromDay(plan, day, logs, today)} today={today} busy={busy} onSave={(l) => save(() => saveLog(l))} />
      {skip}
    </div>
  );
}

/** After a missed day: carry on with the workout they missed, or jump to the one the calendar says is today's. */
function DayChoice({ open, plan, sched, onPick, onClose }: { open: boolean; plan: Plan; sched: ReturnType<typeof schedule>; onPick: (i: number) => void; onClose: () => void }) {
  const option = (i: number, label: string, hint: string, main: boolean) => (
    <button type="button" onClick={() => onPick(i)} className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-md border px-4 py-4 text-left hover:border-red ${main ? "border-red bg-redwash" : "border-line bg-ink"}`}>
      <span>
        <span className="block font-label text-xs font-bold tracking-widest text-ash uppercase">{label}</span>
        <span className="block font-display text-3xl uppercase">{plan.days[i].name}</span>
        <span className="block text-sm text-ash">{hint}</span>
      </span>
      <span aria-hidden="true" className="text-red">→</span>
    </button>
  );
  return (
    <Sheet title={`Missed ${sched.missed === 1 ? "a day" : `${sched.missed} days`}`} open={open} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <p className="text-ash">Which workout today?</p>
        {option(sched.next, "Pick up where you left off", "The one you missed", true)}
        {option(sched.today, "Today's workout", "Stay on schedule, skip the missed one", false)}
      </div>
    </Sheet>
  );
}

type Progress = { log: Log; done: boolean[][]; i: number; j: number };
const STORE = "stargym-workout:"; // + date: an unfinished workout survives a reload (this phone only)
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Big − / + for the set in hand. */
function Stepper({ label, value, step, onChange }: { label: string; value: number; step: number; onChange: (n: number) => void }) {
  const btn = "flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-full border border-strong text-2xl leading-none hover:border-red active:bg-steel";
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="label">{label}</span>
      <div className="flex items-center gap-2">
        <button type="button" className={btn} aria-label={`Less ${label}`} onClick={() => onChange(Math.max(0, round2(value - step)))}>−</button>
        <input className="w-20 bg-transparent text-center font-display text-5xl tabular-nums outline-none focus:text-red" type="number" inputMode="decimal" min={0} step="any"
          aria-label={label} placeholder="0" value={value || ""} onChange={(e) => onChange(Number(e.target.value))} />
        <button type="button" className={btn} aria-label={`More ${label}`} onClick={() => onChange(round2(value + step))}>+</button>
      </div>
    </div>
  );
}

/**
 * Logging as you train: one exercise at a time, one set at a time. Each "Done" moves on to the next set, then the next
 * exercise; at the end, a summary and save. Only sets marked done are saved.
 */
function GuidedLog({ initial, today, busy, onSave }: { initial: Log; today: string; busy: boolean; onSave: (l: Log) => void }) {
  const fresh = (): Progress => ({ log: initial, done: initial.exercises.map((e) => e.sets.map(() => false)), i: 0, j: 0 });
  const [p, setP] = useState<Progress>(fresh);
  const [restored, setRestored] = useState(false);
  const [switching, setSwitching] = useState(false);
  const update = (fn: (c: Progress) => void) => setP((prev) => { const c = structuredClone(prev); fn(c); return c; });
  const key = STORE + today;

  // pick up an unfinished workout after a reload (read after mount, so server and browser render the same first)
  useEffect(() => {
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith(STORE) && k !== key) localStorage.removeItem(k); // older days
      const saved = JSON.parse(localStorage.getItem(key) ?? "null") as Progress | null;
      if (saved?.log?.title === initial.title) setP(saved); // eslint-disable-line react-hooks/set-state-in-effect -- restoring browser-only state
    } catch {}
    setRestored(true);
  }, [key, initial.title]);
  useEffect(() => {
    if (!restored) return;
    try {
      localStorage.setItem(key, JSON.stringify(p));
    } catch {}
  }, [p, key, restored]);

  const exs = p.log.exercises;
  const ex = exs[p.i];
  const set = ex?.sets[p.j];
  const total = p.done.flat().length;
  const doneCount = p.done.flat().filter(Boolean).length;
  const result = (): Log => ({ ...p.log, exercises: exs.map((e, i) => ({ name: e.name, sets: e.sets.filter((_, j) => p.done[i][j]) })).filter((e) => e.sets.length) });
  /** On to the first set not yet done, from exercise `from` on (after a switch, some may be half done); past the end = summary. */
  const goTo = (c: Progress, from: number) => {
    for (let k = from; k < c.done.length; k++) {
      const f = c.done[k].indexOf(false);
      if (f !== -1) return void ([c.i, c.j] = [k, f]);
    }
    [c.i, c.j] = [c.log.exercises.length, 0];
  };
  const advance = (c: Progress) => {
    const rest = c.done[c.i].indexOf(false, c.j + 1);
    if (rest !== -1) c.j = rest;
    else goTo(c, c.i + 1);
  };
  const doneSet = () => {
    update((c) => {
      c.done[c.i][c.j] = true;
      const sets = c.log.exercises[c.i].sets;
      for (let k = c.j + 1; k < sets.length; k++) if (!c.done[c.i][k]) sets[k] = { ...sets[c.j] }; // carry today's weight on
      advance(c);
    });
    navigator.vibrate?.(30);
  };
  const back = () => update((c) => {
    if (c.j > 0) c.j -= 1;
    else if (c.i > 0) [c.i, c.j] = [c.i - 1, c.log.exercises[c.i - 1].sets.length - 1];
    else return;
    c.done[c.i][c.j] = false;
  });
  const save = () => {
    onSave(result());
  };
  const add = (name: string) => update((c) => {
    c.log.exercises.push({ name, sets: [{ kg: 0, reps: 10 }] });
    c.done.push([false]);
    [c.i, c.j] = [c.log.exercises.length - 1, 0];
  });
  /** Do exercise k now (machine taken, or just a different order): it moves into the current slot, the rest shift down. */
  const switchTo = (k: number) => {
    update((c) => {
      const [e] = c.log.exercises.splice(k, 1);
      const [d] = c.done.splice(k, 1);
      const at = k < c.i ? c.i - 1 : c.i;
      c.log.exercises.splice(at, 0, e);
      c.done.splice(at, 0, d);
      c.i = at;
      c.j = Math.max(0, d.indexOf(false));
    });
    setSwitching(false);
  };
  const link = "min-h-10 cursor-pointer text-sm font-bold text-ash hover:text-chalk disabled:opacity-40";
  const planDay = p.log.title.includes(" · ") ? p.log.title.split(" · ").slice(1).join(" · ") : p.log.title;

  return (
    <div className="flex flex-col gap-5">
      {/* where they are */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-display text-2xl uppercase">{planDay}</p>
          <p className="text-sm text-ash tabular-nums">{doneCount}/{total} sets</p>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-strong">
          <div className="h-full bg-red transition-[width] duration-300" style={{ width: `${total ? (doneCount / total) * 100 : 0}%` }} />
        </div>
      </div>

      {ex && set ? (
        <>
          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="label">Exercise {p.i + 1} of {exs.length}</p>
              {exs.length > 1 && (
                <button type="button" aria-expanded={switching} className="min-h-9 cursor-pointer text-sm font-bold text-red hover:text-chalk" onClick={() => setSwitching(!switching)}>
                  {switching ? "Cancel" : "Switch ⇅"}
                </button>
              )}
            </div>
            <h3 className="font-display text-4xl leading-tight uppercase">{ex.name}</h3>
          </div>

          {switching && (
            // the exercises still to finish, in order; tap one to do it now
            <ul className="flex flex-col gap-1.5">
              {exs.map((e, k) => {
                const left = p.done[k].filter((d) => !d).length;
                return k !== p.i && left > 0 && (
                  <li key={k}>
                    <button type="button" className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-md border border-line bg-ink px-3 py-2.5 text-left text-sm hover:border-red" onClick={() => switchTo(k)}>
                      <span className="font-bold">{e.name}</span>
                      <span className="text-xs text-ash">{left < e.sets.length ? `${left} sets left` : `${e.sets.length} sets`} · do now →</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* sets so far */}
          <ol className="flex flex-col gap-1.5">
            {ex.sets.map((s, j) => (
              <li key={j} className={`flex items-center justify-between rounded-md px-3 py-2 text-sm tabular-nums ${j === p.j ? "border border-red bg-redwash font-bold" : "border border-line"}`}>
                <span className={p.done[p.i][j] || j === p.j ? "" : "text-faint"}>Set {j + 1}</span>
                <span className={p.done[p.i][j] ? "flex items-center gap-2" : "text-faint"}>
                  {s.kg ? `${s.kg} kg × ` : ""}{s.reps}{s.kg ? "" : " reps"}
                  {p.done[p.i][j] && <Check />}
                </span>
              </li>
            ))}
          </ol>

          {/* the set in hand */}
          <div className="flex flex-col gap-3">
            <Stepper label="Kg" value={set.kg} step={2.5} onChange={(n) => update((c) => void (c.log.exercises[c.i].sets[c.j].kg = n))} />
            <Stepper label="Reps" value={set.reps} step={1} onChange={(n) => update((c) => void (c.log.exercises[c.i].sets[c.j].reps = n))} />
          </div>
          <button type="button" className="btn-red min-h-14 text-base" disabled={!set.reps} onClick={doneSet}>Done · set {p.j + 1}</button>

          <div className="flex flex-wrap items-center justify-between gap-x-4">
            <button type="button" className={link} disabled={p.i === 0 && p.j === 0} onClick={back}>← Back</button>
            <button type="button" className={link} onClick={() => update((c) => { c.log.exercises[c.i].sets.push({ ...c.log.exercises[c.i].sets.at(-1)! }); c.done[c.i].push(false); })}>+ Set</button>
            <button type="button" className={link} onClick={() => update((c) => goTo(c, c.i + 1))}>
              {p.done[p.i].some(Boolean) ? "Next exercise →" : "Skip exercise →"}
            </button>
          </div>
          {exs[p.i + 1] && <p className="text-sm text-ash">Up next: <b className="text-chalk">{exs[p.i + 1].name}</b></p>}
          {doneCount > 0 && <button type="button" className={`${link} self-center`} disabled={busy} onClick={save}>Finish early &amp; save</button>}
        </>
      ) : (
        // past the last exercise: summary, extras, save
        <>
          <div>
            <p className="label">{doneCount ? "Workout complete" : "Nothing logged yet"}</p>
            <h3 className="font-display text-4xl leading-tight uppercase">{doneCount ? "Nice work" : "Add an exercise"}</h3>
          </div>
          {doneCount > 0 && (
            <ul className="divide-y divide-line border-y border-line text-sm">
              {result().exercises.map((e) => (
                <li key={e.name} className="flex justify-between gap-3 py-2">
                  <span className="min-w-0 truncate">{e.name}</span>
                  <span className="shrink-0 text-ash tabular-nums">{e.sets.map((x) => (x.kg ? `${x.kg}×${x.reps}` : x.reps)).join(", ")}</span>
                </li>
              ))}
            </ul>
          )}
          <ExercisePicker onPick={add} />
          {doneCount > 0 && (
            <>
              <textarea className="field py-2.5" rows={2} maxLength={500} placeholder="How did it go? (optional)" aria-label="Notes" value={p.log.note} onChange={(e) => update((c) => void (c.log.note = e.target.value))} />
              <button type="button" className="btn-red min-h-14 text-base" disabled={busy} onClick={save}>{busy ? "Saving…" : `Save workout · ${kg(volume(result()))}`}</button>
              <button type="button" className={`${link} self-center`} onClick={back}>← Back to last set</button>
            </>
          )}
        </>
      )}
    </div>
  );
}

const summary = (l: Log) => {
  const sets = l.exercises.reduce((s, e) => s + e.sets.length, 0);
  return `${l.exercises.length} exercise${l.exercises.length === 1 ? "" : "s"} · ${sets} set${sets === 1 ? "" : "s"}${volume(l) > 0 ? ` · ${kg(volume(l))}` : ""}`;
};

/** Every split, built for the level picked above it (theirs to start); that level's recommended one first. */
function SplitList({ level, current, busy, onPick, onCustom }: { level: Level; current: string | null; busy: boolean; onPick: (p: Plan) => void; onCustom: () => void }) {
  const [lvl, setLvl] = useState(level);
  const splits = [...SPLITS].sort((a, b) => Number(b.key === RECOMMENDED[lvl]) - Number(a.key === RECOMMENDED[lvl]));
  const row = "flex w-full cursor-pointer items-center justify-between gap-3 rounded-md border bg-ink px-4 py-3.5 text-left hover:border-red disabled:opacity-50";
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="label mb-2">Level</p>
        <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 [scrollbar-width:none]" role="group" aria-label="Level">
          {LEVELS.map((l) => (
            <button key={l.key} type="button" aria-pressed={lvl === l.key} onClick={() => setLvl(l.key)}
              className={`shrink-0 cursor-pointer rounded-full px-3.5 py-2 font-label text-xs font-bold tracking-wider uppercase ${lvl === l.key ? "bg-red text-white" : "bg-steel text-ash hover:text-chalk"}`}>
              {l.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-ash">{LEVELS.find((l) => l.key === lvl)!.span}{lvl === level && " · your level"}</p>
      </div>
      <ul className="flex flex-col gap-2">
        {splits.map((split) => {
          const s = buildSplit(split.key, lvl);
          const top = split.key === RECOMMENDED[lvl];
          return (
            <li key={split.key}>
              <button type="button" disabled={busy} onClick={() => onPick(s)} className={`${row} ${top ? "border-red" : "border-line"}`}>
                <span className="min-w-0">
                  {top && <span className="block font-label text-xs font-bold tracking-widest text-red uppercase">Recommended</span>}
                  <span className="block font-bold">{s.name}{s.name === current && <span className="font-normal text-ash"> · current</span>}</span>
                  <span className="block text-sm text-ash">{s.days.length} workouts · {s.days[0].exercises.length} exercises each</span>
                </span>
                <span aria-hidden="true" className="text-red">→</span>
              </button>
            </li>
          );
        })}
        <li>
          <button type="button" onClick={onCustom} className={`${row} border-dashed border-strong`}>
            <span>
              <span className="block font-bold">Build your own</span>
              <span className="block text-sm text-ash">Start empty, add from the exercise list</span>
            </span>
            <span aria-hidden="true" className="text-red">→</span>
          </button>
        </li>
      </ul>
    </div>
  );
}

/** "+ Add exercise", which opens a searchable list from the library by muscle; what they type can be added as-is. */
function ExercisePicker({ onPick }: { onPick: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<string | null>(null);
  if (!open) return <button type="button" className="min-h-11 w-full cursor-pointer rounded-md border border-dashed border-strong text-sm font-bold text-ash hover:border-red hover:text-chalk" onClick={() => setOpen(true)}>+ Add exercise</button>;
  const query = q.trim().toLowerCase();
  const found = Object.entries(EXERCISES).flatMap(([g, names]) => (group && g !== group ? [] : names.filter((n) => n.toLowerCase().includes(query)).map((n) => [g, n])));
  const pick = (name: string) => {
    onPick(name);
    setOpen(false);
    setQ("");
  };
  return (
    <div className="flex flex-col gap-2 rounded-md border border-strong bg-ink p-3">
      <div className="flex gap-2">
        <input className={small} type="search" autoFocus placeholder="Search exercises" aria-label="Search exercises" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" className="shrink-0 cursor-pointer px-2 text-sm text-ash hover:text-chalk" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none]">
        {[null, ...Object.keys(EXERCISES)].map((g) => (
          <button key={g ?? "all"} type="button" aria-pressed={group === g} onClick={() => setGroup(g)}
            className={`shrink-0 cursor-pointer rounded-full px-3 py-1.5 font-label text-xs font-bold tracking-wider uppercase ${group === g ? "bg-red text-white" : "bg-steel text-ash hover:text-chalk"}`}>
            {g ?? "All"}
          </button>
        ))}
      </div>
      <ul className="flex max-h-60 flex-col overflow-y-auto overscroll-contain">
        {q.trim() && !found.some(([, n]) => n.toLowerCase() === query) && (
          <li><button type="button" className="w-full cursor-pointer rounded px-2 py-2.5 text-left text-sm font-bold text-red hover:bg-steel" onClick={() => pick(q.trim())}>+ Add &quot;{q.trim()}&quot;</button></li>
        )}
        {found.map(([g, n]) => (
          <li key={g + n}>
            <button type="button" className="flex w-full cursor-pointer justify-between gap-2 rounded px-2 py-2.5 text-left text-sm hover:bg-steel" onClick={() => pick(n)}>
              {n}<span className="text-xs text-faint">{g}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Save, plus Share and Delete once it exists. */
function Footer({ busy, label, existing, onShare, onDelete }: { busy: boolean; label: string; existing: boolean; onShare?: () => void; onDelete: () => void }) {
  return (
    <div className="flex flex-col gap-2 pt-1">
      <button className="btn-red min-h-12" disabled={busy}>{busy ? "Saving…" : label}</button>
      {existing && (
        <div className={`grid gap-2 ${onShare ? "grid-cols-2" : ""}`}>
          {onShare && <button type="button" className="btn-ghost" onClick={onShare}>Share</button>}
          <button type="button" className="btn-ghost hover:text-red" disabled={busy} onClick={onDelete}>Delete</button>
        </div>
      )}
    </div>
  );
}

/** ↑ / ↓ for reordering. */
const MoveButton = ({ dir, label, disabled, onClick }: { dir: "up" | "down"; label: string; disabled: boolean; onClick: () => void }) => (
  <button type="button" aria-label={label} disabled={disabled} className="flex size-10 shrink-0 cursor-pointer items-center justify-center text-faint hover:text-chalk disabled:cursor-default disabled:opacity-30" onClick={onClick}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={dir === "up" ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} /></svg>
  </button>
);

const RemoveButton = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button type="button" aria-label={label} className="flex size-10 shrink-0 cursor-pointer items-center justify-center text-faint hover:text-red" onClick={onClick}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
  </button>
);

function PlanEditor({ initial, existing, replaces, busy, onSave, onDelete }: {
  initial: Plan; existing: boolean; replaces: string | null; busy: boolean; onSave: (p: Plan, restart: boolean) => void; onDelete: () => void;
}) {
  const [p, edit] = useDraft<Plan>({ name: initial.name, days: initial.days });
  const [restart, setRestart] = useState(false);
  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); onSave(p, restart); }}>
      <input className="field text-lg font-bold" required maxLength={60} placeholder="Split name" aria-label="Split name" value={p.name} onChange={(e) => edit((d) => void (d.name = e.target.value))} />
      {p.days.map((day, i) => (
        <section key={i} className="flex flex-col gap-3 rounded-md border border-line p-3">
          <div className="flex items-center gap-1">
            <input className="field min-h-10 border-transparent bg-transparent px-1 font-label font-bold tracking-wider uppercase focus:border-red" aria-label="Day name" maxLength={40} value={day.name} onChange={(e) => edit((d) => void (d.days[i].name = e.target.value))} />
            {p.days.length > 1 && <RemoveButton label={`Remove ${day.name}`} onClick={() => edit((d) => void d.days.splice(i, 1))} />}
          </div>
          {day.exercises.map((e, j) => {
            const set = (fn: (x: PlanExercise) => void) => edit((d) => fn(d.days[i].exercises[j]));
            const byReps = e.addReps > 0;
            const custom = !EVERY.some(([n]) => n === e.every);
            return (
              <div key={j} className="flex flex-col gap-2 rounded bg-ink p-3">
                <div className="flex items-center gap-1">
                  <p className="min-w-0 flex-1 truncate text-sm font-bold">{e.name}</p>
                  <MoveButton dir="up" label={`Move ${e.name} up`} disabled={j === 0} onClick={() => edit((d) => { const x = d.days[i].exercises; [x[j - 1], x[j]] = [x[j], x[j - 1]]; })} />
                  <MoveButton dir="down" label={`Move ${e.name} down`} disabled={j === day.exercises.length - 1} onClick={() => edit((d) => { const x = d.days[i].exercises; [x[j], x[j + 1]] = [x[j + 1], x[j]]; })} />
                  <RemoveButton label={`Remove ${e.name}`} onClick={() => edit((d) => void d.days[i].exercises.splice(j, 1))} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-ash">
                  <label className="flex flex-col gap-1">Sets<input className={small} type="number" inputMode="numeric" min={1} max={20} value={e.sets || ""} onChange={(v) => set((x) => void (x.sets = Number(v.target.value)))} /></label>
                  <label className="flex flex-col gap-1">Reps<input className={small} type="number" inputMode="numeric" min={1} max={500} value={e.reps || ""} onChange={(v) => set((x) => void (x.reps = Number(v.target.value)))} /></label>
                  <label className="flex flex-col gap-1">Kg<input className={small} type="number" inputMode="decimal" min={0} step="any" placeholder="First log" value={e.kg || ""} onChange={(v) => set((x) => void (x.kg = Number(v.target.value)))} /></label>
                </div>
                {/* progression: add [n] [kg|reps] [how often] */}
                <div className="grid grid-cols-[1fr_1fr_1.6fr] gap-2 text-xs text-ash">
                  <label className="flex flex-col gap-1">Increase
                    <input className={small} type="number" inputMode="decimal" min={0} step="any" placeholder="0" value={(byReps ? e.addReps : e.addKg) || ""}
                      onChange={(v) => set((x) => void (byReps ? (x.addReps = Number(v.target.value)) : (x.addKg = Number(v.target.value))))} />
                  </label>
                  <label className="flex flex-col gap-1">Of
                    <select className={small} value={byReps ? "reps" : "kg"}
                      onChange={(v) => set((x) => { const n = byReps ? x.addReps : x.addKg; [x.addKg, x.addReps] = v.target.value === "reps" ? [0, n || 1] : [n || 2.5, 0]; })}>
                      <option value="kg">kg</option>
                      <option value="reps">reps</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">How often
                    {custom ? (
                      <span className="flex items-center gap-1.5">
                        <input className={small} type="number" inputMode="numeric" min={1} max={365} aria-label="Every how many days" value={e.every} onChange={(v) => set((x) => void (x.every = Number(v.target.value)))} />
                        days
                      </span>
                    ) : (
                      <select className={small} value={e.every} onChange={(v) => set((x) => void (x.every = v.target.value === "custom" ? 5 : Number(v.target.value)))}>
                        {EVERY.map(([n, l]) => <option key={n} value={n}>{l}</option>)}
                        <option value="custom">Every … days</option>
                      </select>
                    )}
                  </label>
                </div>
              </div>
            );
          })}
          <ExercisePicker onPick={(name) => edit((d) => void d.days[i].exercises.push(blankExercise(name)))} />
        </section>
      ))}
      {p.days.length < 7 && <button type="button" className="btn-ghost self-start" onClick={() => edit((d) => void d.days.push({ name: `Day ${d.days.length + 1}`, exercises: [] }))}>+ Add day</button>}
      {existing && (
        <label className="flex items-center gap-2 text-sm text-ash">
          <input type="checkbox" className="size-4 accent-red" checked={restart} onChange={(e) => setRestart(e.target.checked)} /> Restart progression from today
        </label>
      )}
      {replaces && <p className="rounded-md border border-redline bg-redwash px-4 py-3 text-sm">This replaces your current split, <b>{replaces}</b>. Your workout history stays.</p>}
      <Footer busy={busy} label={replaces ? "Replace my split" : "Save split"} existing={existing} onDelete={onDelete} />
    </form>
  );
}

function LogEditor({ initial, today, busy, existing, onSave, onShare, onDelete }: {
  initial: Log; today: string; busy: boolean; existing: boolean; onSave: (l: Log) => void; onShare: (l: Log) => void; onDelete: () => void;
}) {
  const [l, edit] = useDraft<Log>(initial);
  // a plan day keeps its title (that's how the next day is worked out); new workouts are for today
  const planDay = initial.title.includes(" · ") ? initial.title.split(" · ").slice(1).join(" · ") : null;
  const sets = l.exercises.reduce((t, e) => t + e.sets.length, 0);
  const unit = "pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-faint";
  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); onSave(l); }}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0 flex-1">
          {planDay ? (
            <p className="font-display text-4xl leading-none uppercase">{planDay}</p>
          ) : (
            <input className="field font-bold" aria-label="Workout name" maxLength={80} value={l.title} onChange={(e) => edit((d) => void (d.title = e.target.value))} />
          )}
          <p className="mt-1 text-sm text-ash">{l.exercises.length} exercises · {sets} sets</p>
        </div>
        {existing && <input className="field w-auto" type="date" aria-label="Date" required max={today} value={l.day} onChange={(e) => edit((d) => void (d.day = e.target.value))} />}
      </div>
      <ol className="flex flex-col divide-y divide-line border-y border-line">
        {l.exercises.map((ex, i) => (
          <li key={i} className="flex flex-col gap-2 py-4">
            <p className="font-bold">{ex.name}</p>
            {ex.sets.map((s, j) => (
              <div key={j} className="grid grid-cols-[1.25rem_1fr_auto_1fr] items-center gap-2">
                <span className="text-sm text-faint tabular-nums">{j + 1}</span>
                <label className="relative">
                  <input className={`${small} pr-9`} type="number" inputMode="decimal" min={0} step="any" aria-label={`${ex.name} set ${j + 1} kg`} placeholder="0" value={s.kg || ""} onChange={(e) => edit((d) => void (d.exercises[i].sets[j].kg = Number(e.target.value)))} />
                  <span className={unit}>kg</span>
                </label>
                <span className="text-faint" aria-hidden="true">×</span>
                <label className="relative">
                  <input className={`${small} pr-11`} type="number" inputMode="numeric" min={0} aria-label={`${ex.name} set ${j + 1} reps`} placeholder="0" value={s.reps || ""} onChange={(e) => edit((d) => void (d.exercises[i].sets[j].reps = Number(e.target.value)))} />
                  <span className={unit}>reps</span>
                </label>
              </div>
            ))}
            <div className="flex gap-5 pl-7 text-sm font-bold">
              <button type="button" className="min-h-9 cursor-pointer text-red hover:text-chalk" onClick={() => edit((d) => void d.exercises[i].sets.push({ ...(d.exercises[i].sets.at(-1) ?? { kg: 0, reps: 10 }) }))}>+ Set</button>
              {/* removing the last set removes the exercise */}
              <button type="button" className="min-h-9 cursor-pointer text-ash hover:text-chalk" onClick={() => edit((d) => void (d.exercises[i].sets.length > 1 ? d.exercises[i].sets.pop() : d.exercises.splice(i, 1)))}>
                {ex.sets.length > 1 ? "− Set" : "Remove"}
              </button>
            </div>
          </li>
        ))}
      </ol>
      <ExercisePicker onPick={(name) => edit((d) => void d.exercises.push({ name, sets: [{ kg: 0, reps: 10 }] }))} />
      <textarea className="field py-2.5" rows={1} maxLength={500} placeholder="Notes (optional)" aria-label="Notes" value={l.note} onChange={(e) => edit((d) => void (d.note = e.target.value))} />
      <Footer busy={busy} label={existing ? "Save changes" : "Finish workout"} existing={existing} onShare={() => onShare(l)} onDelete={onDelete} />
    </form>
  );
}
