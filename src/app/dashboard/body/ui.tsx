"use client";

import { useActionState, useState, useTransition } from "react";
import { confirmDialog, ResultToast, toastResult } from "@/components/feedback";
import { BODY_FIELDS, type BodyLog } from "@/lib/body";
import { deleteBody, saveBody } from "../workouts/actions";

const shortDay = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

/** One day's entry: weight up front, the other measurements one tap away. Picking a day that already has an entry
 *  fills it in, so saving updates it rather than blanking fields. */
export function BodyForm({ logs, today }: { logs: BodyLog[]; today: string }) {
  const [state, action, pending] = useActionState(saveBody, undefined);
  const [day, setDay] = useState(today);
  const existing = logs.find((l) => l.day === day);
  const last = logs[0];
  const [weight, ...rest] = BODY_FIELDS;
  const hint = (k: (typeof BODY_FIELDS)[number]["key"]) => (last?.[k] != null ? `Last: ${Number(last[k])}` : "");

  return (
    <form action={action} className="card flex flex-col gap-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="label">{existing ? "Update entry" : day === today ? "Today" : "New entry"}</p>
        <input className="field w-auto" type="date" name="day" aria-label="Date" required max={today} value={day} onChange={(e) => setDay(e.target.value)} />
      </div>
      {/* keyed by day: switching days swaps in that day's values */}
      <div key={day} className="flex flex-col gap-4">
        <label className="flex flex-col items-center gap-1 rounded-md border border-line bg-ink px-4 py-5">
          <span className="label">{weight.label}</span>
          <span className="flex items-baseline gap-2">
            <input className="w-32 bg-transparent text-right font-display text-6xl tabular-nums outline-none placeholder:text-faint focus:text-red" type="number" inputMode="decimal"
              step="0.1" min={weight.min} max={weight.max} name={weight.key} defaultValue={existing?.weight_kg ?? ""} placeholder={last?.weight_kg != null ? String(Number(last.weight_kg)) : "0.0"} />
            <span className="font-display text-2xl text-ash">kg</span>
          </span>
          {last?.weight_kg != null && <span className="text-xs text-ash">Last time {Number(last.weight_kg)} kg</span>}
        </label>
        <details className="group" open={rest.some((f) => existing?.[f.key] != null)}>
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-md border border-line px-4 font-bold hover:border-strong">
            More measurements
            <span className="text-sm font-normal text-ash group-open:hidden">{rest.length} more</span>
            <span aria-hidden="true" className="hidden text-ash group-open:inline">−</span>
          </summary>
          <div className="grid grid-cols-2 gap-3 pt-4 sm:grid-cols-3">
            {rest.map((f) => (
              <label key={f.key} className="flex flex-col gap-1.5">
                <span className="label text-xs">{f.label}</span>
                <span className="relative">
                  <input className="field pr-10 tabular-nums" type="number" inputMode="decimal" step="0.1" min={f.min} max={f.max} name={f.key}
                    defaultValue={existing?.[f.key] ?? ""} placeholder={hint(f.key)} />
                  <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-faint">{f.unit}</span>
                </span>
              </label>
            ))}
          </div>
        </details>
      </div>
      <ResultToast state={state} />
      <button className="btn-red min-h-12" disabled={pending}>{pending ? "Saving…" : existing ? "Update" : "Save"}</button>
    </form>
  );
}

export function BodyHistory({ logs }: { logs: BodyLog[] }) {
  const [busy, start] = useTransition();
  const remove = async (l: BodyLog) => {
    if (await confirmDialog({ title: `Delete ${shortDay(l.day)}?`, confirm: "Delete", danger: true })) start(async () => toastResult(await deleteBody(l.id!)));
  };
  return (
    <section className="flex flex-col gap-3">
      <p className="label">History · {logs.length}</p>
      <ul className="card max-h-96 divide-y divide-line overflow-y-auto">
        {logs.map((l) => (
          <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-bold">{shortDay(l.day)}</p>
              <p className="text-sm text-ash">
                {BODY_FIELDS.filter((f) => l[f.key] != null).map((f) => `${f.label} ${Number(l[f.key])}${f.unit === "%" ? "%" : ` ${f.unit}`}`).join(" · ")}
              </p>
            </div>
            <button type="button" className="min-h-10 shrink-0 cursor-pointer text-sm font-bold text-ash hover:text-red" disabled={busy} onClick={() => remove(l)}>Delete</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
