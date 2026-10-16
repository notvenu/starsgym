"use client";

import { useEffect, useRef, useState } from "react";

// Toasts and confirm pop-ups for the whole site. <Feedback /> (root layout) renders them;
// any client component calls toast() / confirmDialog() / useResultToast().
type Tone = "ok" | "error";
type Toast = { id: number; text: string; tone: Tone };
type Ask = { title: string; body?: string; confirm?: string; danger?: boolean };

let push: ((text: string, tone: Tone) => void) | null = null;
let ask: ((a: Ask & { resolve: (ok: boolean) => void }) => void) | null = null;

export const toast = (text: string, tone: Tone = "ok") => push?.(text, tone);

/** Resolves true when they confirm; false on cancel, Escape or tapping outside. */
export const confirmDialog = (a: Ask) =>
  new Promise<boolean>((resolve) => (ask ? ask({ ...a, resolve }) : resolve(window.confirm(a.title))));

type ActionResult = { ok?: unknown; error?: string; message?: string } | null | undefined;

/** Toasts a server action's result: { error } red, { ok: "…" } / { message } green. */
export function toastResult(r: ActionResult) {
  if (r?.error) toast(r.error, "error");
  else if (typeof r?.ok === "string") toast(r.ok);
  else if (r?.message) toast(r.message);
}

/** Toasts each new result from useActionState. */
export function useResultToast(state: ActionResult) {
  useEffect(() => toastResult(state), [state]);
}

/** Drop-in for an inline result message: renders nothing, toasts instead. */
export function ResultToast({ state }: { state: ActionResult }) {
  useResultToast(state);
  return null;
}

/** Toasts once when it mounts — for server-rendered moments like "pass issued". */
export function ToastOnMount({ text }: { text: string }) {
  const shown = useRef(false);
  useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    toast(text);
  }, [text]);
  return null;
}

export function Feedback() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [q, setQ] = useState<(Ask & { resolve: (ok: boolean) => void }) | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let n = 0;
    const drop = (id: number) => setToasts((l) => l.filter((t) => t.id !== id));
    push = (text, tone) => {
      const id = ++n;
      setToasts((l) => [...l.filter((t) => t.text !== text).slice(-2), { id, text, tone }]); // max 3, no repeats
      setTimeout(() => drop(id), tone === "error" || text.length > 60 ? 7000 : 4000); // errors and instructions stay longer
    };
    ask = setQ;
    return () => {
      push = null;
      ask = null;
    };
  }, []);

  useEffect(() => {
    if (q && !dialog.current?.open) dialog.current?.showModal();
  }, [q]);

  const answer = (ok: boolean) => {
    q?.resolve(ok);
    setQ(null);
    dialog.current?.close();
  };

  return (
    <>
      <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[100] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end">
        {toasts.map((t) => (
          <div key={t.id} role={t.tone === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex w-full max-w-sm animate-rise items-start gap-3 rounded-lg border bg-carbon py-3 pr-2 pl-4 text-sm text-chalk shadow-2xl shadow-black/50 ${t.tone === "error" ? "border-red" : "border-line"}`}>
            <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-white ${t.tone === "error" ? "bg-red" : "bg-[#1f9d55]"}`} aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                {t.tone === "error" ? <path d="M12 7v6m0 4h.01" /> : <path d="m5 12 5 5 9-10" />}
              </svg>
            </span>
            <p className="min-w-0 flex-1 py-px font-semibold">{t.text}</p>
            <button type="button" onClick={() => setToasts((l) => l.filter((x) => x.id !== t.id))} aria-label="Dismiss"
              className="-my-1 flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-ash hover:text-chalk">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
        ))}
      </div>

      <dialog ref={dialog} aria-label={q?.title} onClose={() => q && answer(false)}
        onClick={(e) => e.target === e.currentTarget && answer(false)}
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-line bg-carbon p-0 text-chalk backdrop:bg-black/75 backdrop:backdrop-blur-sm">
        {q && (
          <div className="flex flex-col gap-5 p-6">
            <div className="flex flex-col gap-2">
              <h2 className="font-display text-2xl uppercase">{q.title}</h2>
              {q.body && <p className="text-sm text-ash">{q.body}</p>}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => answer(false)} className="btn-ghost min-h-11 px-5 text-sm">Cancel</button>
              <button type="button" autoFocus onClick={() => answer(true)} className={`${q.danger ? "btn-red" : "btn-ghost"} min-h-11 px-5 text-sm`}>{q.confirm ?? "OK"}</button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
