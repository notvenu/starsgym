"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

// A target is a CSS selector (first visible match wins; comma-separate a desktop and a phone version) or { panel }:
// the card whose heading (or small label) contains that text, or any of several texts. No target, or one that isn't on
// the page (a section that only shows when it has something in it, or a menu that's hidden on a phone): the step
// shows as a centred card instead.
export type Target = string | { panel: string | string[] };
export type Step = { target?: Target; title: string; body: string };

type Box = { top: number; left: number; width: number; height: number };
const visible = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
};

/** The element a step points at, or null (nothing to point at: the step shows as a centred card). */
function find(t?: Target): HTMLElement | null {
  if (!t) return null;
  if (typeof t === "string") return [...document.querySelectorAll<HTMLElement>(t)].find(visible) ?? null;
  const want = [t.panel].flat().map((p) => p.toLowerCase());
  return [...document.querySelectorAll<HTMLElement>("main section, main .card")].find((s) => {
    const head = s.querySelector("h2, h3, .label")?.textContent?.toLowerCase();
    return visible(s) && !!head && want.some((w) => head.includes(w));
  }) ?? null;
}

// which demos this account has seen, in this browser (kept per account, so a new person on a shared desk computer still gets the tour)
const storeKey = (scope: string, uid: string) => `stargym-demo:${scope}:${uid}`;
const readSeen = (scope: string, uid: string): string[] => {
  try {
    return JSON.parse(localStorage.getItem(storeKey(scope, uid)) ?? "[]");
  } catch {
    return [];
  }
};

export type Demo = { key: string; steps: Step[] };

/**
 * Guided demos (the admin panel and the member dashboard each give it their own steps). A new account gets the welcome
 * tour once; the Demo button (every page, any account) shows that page's demo, or the welcome on a page without one.
 * A red dot marks pages whose demo hasn't been seen yet.
 */
export function DemoTour({ userId, scope, welcome, pageFor, buttonClass = "" }: {
  userId: string; scope: string; welcome: Step[]; pageFor: (path: string) => Demo; buttonClass?: string;
}) {
  const path = usePathname();
  const [run, setRun] = useState<Demo | null>(null);
  const [i, setI] = useState(0);
  const [seen, setSeen] = useState<string[] | null>(null); // null until read from this browser (no dot on the server render)
  const [box, setBox] = useState<Box | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const step = run?.steps[i];

  const start = useCallback((r: Demo) => {
    document.querySelectorAll("dialog[open]").forEach((d) => (d as HTMLDialogElement).close()); // a pop-up or the phone menu would sit above the tour
    setSeen((prev) => {
      const all = [...new Set([...(prev ?? readSeen(scope, userId)), r.key])];
      localStorage.setItem(storeKey(scope, userId), JSON.stringify(all)); // marked when it starts: leaving halfway doesn't bring it back
      return all;
    });
    setI(0);
    setRun(r);
  }, [scope, userId]);

  const stop = useCallback(() => setRun(null), []);

  // a new account: the welcome tour, once, shortly after the page has drawn
  useEffect(() => {
    const done = readSeen(scope, userId);
    setSeen(done);
    if (done.includes("welcome")) return;
    // not on top of the first-sign-in password pop-up: wait until it's been dealt with (or put off with "Later")
    const t = setInterval(() => {
      if (document.querySelector("dialog[open]")) return;
      clearInterval(t);
      start({ key: "welcome", steps: welcome });
    }, 800);
    return () => clearInterval(t);
  }, [scope, userId, start, welcome]);

  useEffect(() => stop(), [path, stop]); // going to another page ends the demo

  // point at this step's element: scroll it into view, then follow it as the page moves
  useEffect(() => {
    if (!step) return;
    const measure = () => {
      const el = find(step.target);
      if (!el) return setBox(null);
      const r = el.getBoundingClientRect();
      setBox({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    const el = find(step.target);
    if (el) {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // a tall card: its top just under the page header; anything else: centred
      window.scrollBy({ top: r.height > vh * 0.6 ? r.top - 90 : r.top + r.height / 2 - vh / 2, behavior: "auto" });
    }
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [step]);

  // the card sits under the highlighted element, above it when there's no room, or centred when nothing is highlighted
  useLayoutEffect(() => {
    if (!step) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(360, vw - 24);
    const h = card.current?.offsetHeight ?? 200;
    if (!box) return setPos({ top: Math.max(12, (vh - h) / 2), left: (vw - w) / 2 });
    const gap = 14;
    const below = box.top + box.height + gap;
    const top = below + h <= vh - 12 ? below : box.top - gap - h >= 12 ? box.top - gap - h : vh - h - 12;
    setPos({ top, left: Math.min(Math.max(box.left, 12), vw - w - 12) });
  }, [box, step]);

  useEffect(() => {
    if (!run) return;
    next.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") stop();
      else if (e.key === "ArrowRight") setI((n) => Math.min(n + 1, run.steps.length - 1));
      else if (e.key === "ArrowLeft") setI((n) => Math.max(n - 1, 0));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [run, i, stop]);

  const page = pageFor(path);
  const last = !!run && i === run.steps.length - 1;
  const w = typeof window === "undefined" ? 360 : Math.min(360, window.innerWidth - 24);

  return (
    <>
      {!run && (
        <button type="button" data-demo-button onClick={() => start(page)} aria-label="Show the demo for this page"
          className={`fixed right-4 bottom-20 z-40 flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line bg-panel/95 px-4 text-sm font-bold text-chalk shadow-lg backdrop-blur hover:border-red lg:right-6 lg:bottom-6 ${buttonClass}`}>
          <span aria-hidden="true" className="flex size-5 items-center justify-center rounded-full bg-red text-xs text-white">?</span>
          Demo
          {seen && !seen.includes(page.key) && <span aria-hidden="true" className="absolute -top-1 -right-1 size-3 rounded-full bg-red ring-2 ring-panel" />}
        </button>
      )}

      {run && step && (
        <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Page demo">
          {/* the dimmed page, with a window cut out over the highlighted element */}
          {box ? (
            <div aria-hidden="true" className="pointer-events-none absolute rounded-xl border-2 border-red shadow-[0_0_0_100vmax_rgba(0,0,0,0.72)] motion-safe:transition-all motion-safe:duration-200"
              style={{ top: box.top - 6, left: box.left - 6, width: box.width + 12, height: box.height + 12 }} />
          ) : (
            <div aria-hidden="true" className="absolute inset-0 bg-black/72" />
          )}

          <div ref={card} aria-live="polite" className="absolute rounded-xl border border-line bg-panel p-5 text-chalk shadow-2xl"
            style={{ width: w, top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? "visible" : "hidden" }}>
            <p className="font-label text-xs font-bold tracking-[0.2em] text-redtext uppercase">Step {i + 1} of {run.steps.length}</p>
            <h2 className="mt-1 font-display text-2xl leading-tight uppercase">{step.title}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-body">{step.body}</p>
            <div className="mt-5 flex items-center gap-2">
              <button type="button" onClick={stop} className="min-h-11 cursor-pointer px-2 text-sm font-semibold text-ash hover:text-chalk">{last ? "Close" : "Skip"}</button>
              <span className="flex-1" />
              {i > 0 && <button type="button" onClick={() => setI(i - 1)} className="btn-ghost min-h-11 px-4">Back</button>}
              <button ref={next} type="button" onClick={() => (last ? stop() : setI(i + 1))} className="btn-red min-h-11 px-5">{last ? "Done" : "Next"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
