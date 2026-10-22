"use client";

import { startTransition, useEffect, useRef, useState } from "react";

// Toasts and confirm pop-ups for the whole site. <Feedback /> (root layout) renders them;
// any client component calls toast() / confirmDialog() / useResultToast().
type Tone = "ok" | "error";
type Toast = { id: number; text: string; tone: Tone; undo?: () => void };
type Ask = { title: string; body?: string; confirm?: string; danger?: boolean };

let push: ((text: string, tone: Tone, undo?: () => void) => void) | null = null;
let ask: ((a: Ask & { resolve: (ok: boolean) => void }) => void) | null = null;

export const toast = (text: string, tone: Tone = "ok", undo?: () => void) => push?.(text, tone, undo);

const UNDO_MS = 10_000;
/** For things that are hard to take back (cancel a plan, delete a member): `act` runs after 10 s, unless Undo on the
 *  toast is tapped first. Closing the tab in those 10 s means it never runs — the safe way round. */
export function withUndo(text: string, act: () => void) {
  const timer = setTimeout(act, UNDO_MS);
  toast(text, "ok", () => clearTimeout(timer));
}

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

/**
 * A form's result: success as a toast; an error stays on the page as a red box (its own full-width line, under the
 * button) and the view scrolls to it, so it can't be missed.
 */
export function ResultToast({ state }: { state: ActionResult }) {
  const box = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state?.error) box.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    else toastResult(state);
  }, [state]);
  if (!state?.error) return null;
  return (
    <p ref={box} role="alert" className="form-alert flex items-start gap-2 rounded-md border border-redline bg-redwash px-4 py-3 text-sm font-semibold text-chalk">
      <span aria-hidden="true" className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-red text-[11px] font-bold text-white">!</span>
      {state.error}
    </p>
  );
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
    push = (text, tone, undo) => {
      const id = ++n;
      setToasts((l) => [...l.filter((t) => t.text !== text).slice(-2), { id, text, tone, undo }]); // max 3, no repeats
      setTimeout(() => drop(id), undo ? UNDO_MS : tone === "error" || text.length > 60 ? 7000 : 4000); // errors and instructions stay longer
    };
    ask = setQ;
    const fixed = (e: Event) => {
      const el = e.target as HTMLInputElement;
      const box = el.closest?.("[data-error]");
      if (box && (!el.validity || el.validity.valid)) box.removeAttribute("data-error");
    };
    addEventListener("input", fixed, true);
    addEventListener("change", fixed, true);
    return () => {
      push = null;
      ask = null;
      removeEventListener("input", fixed, true);
      removeEventListener("change", fixed, true);
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
            {t.undo && (
              <button type="button" onClick={() => (t.undo!(), setToasts((l) => l.filter((x) => x.id !== t.id)), toast("Undone"))}
                className="-my-1 min-h-8 shrink-0 cursor-pointer rounded-full border border-red px-3 text-xs font-bold tracking-wider text-red uppercase hover:bg-red hover:text-white">
                Undo
              </button>
            )}
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
              {q.body && <p className="text-sm whitespace-pre-line text-ash">{q.body}</p>}
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

/**
 * Submit a form to a useActionState action without React's automatic reset. With <form action={…}> React clears every
 * field once the action finishes — so a server error left the member pop-up blank and staff re-typing everything.
 * Usage: <form noValidate onSubmit={keepFields(action)}>
 */
export const keepFields = (action: (data: FormData) => void) => (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  if (!checkFields(e.currentTarget)) return;
  const data = new FormData(e.currentTarget);
  startTransition(() => action(data));
};

/** The message under a field that isn't filled in right. */
function problem(el: HTMLInputElement) {
  const v = el.validity;
  if (v.valueMissing) return el.type === "file" ? "Add a photo" : el.type === "radio" ? "Pick one" : el.tagName === "SELECT" ? "Choose one" : "Fill this in";
  if (v.typeMismatch) return el.type === "email" ? "Enter a valid email" : el.type === "url" ? "Enter a full link, starting https://" : "Check this";
  if (v.tooShort) return `At least ${el.minLength} characters`;
  if (v.rangeUnderflow) return `${el.min} or more`;
  if (v.rangeOverflow) return `${el.max} or less`;
  if (v.badInput) return "Enter a number";
  return el.validationMessage || "Check this";
}

/**
 * Our own form validation, in place of the browser's bubbles (forms using it are noValidate): every field that isn't
 * right gets a red message under it (data-error on its label, fieldset or [data-field] box, drawn in CSS), and the
 * view scrolls to the first one. Each message clears as soon as that field is fixed (see Feedback). True when all good.
 */
export function checkFields(form: HTMLFormElement) {
  let first: { box: HTMLElement; el: HTMLInputElement } | null = null;
  for (const el of Array.from(form.elements) as HTMLInputElement[]) {
    if (!el.willValidate || el.validity.valid) continue;
    // a radio group reports once, on its fieldset — not on every option's label
    const box = (el.type === "radio" ? el.closest<HTMLElement>("fieldset, [data-field]") : null) ?? el.closest<HTMLElement>("[data-field], fieldset, label") ?? el;
    box.setAttribute("data-error", problem(el));
    first ??= { box, el };
  }
  if (first) {
    first.box.scrollIntoView({ behavior: "smooth", block: "center" });
    if (first.el.type !== "file" && first.el.type !== "hidden") first.el.focus({ preventScroll: true });
  }
  return !first;
}
