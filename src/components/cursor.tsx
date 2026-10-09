"use client";

import { useEffect, useRef } from "react";

const INTERACTIVE = "a, button, [role=tab], summary, label, select, [data-cursor]";
const TEXT = "input, textarea, [contenteditable=true]";

/**
 * Circle cursor: a dot pinned to the pointer and a ring that glides after it.
 * The ring grows over anything clickable and squeezes on press; text fields keep the native caret.
 * Mouse/trackpad only, and off when the visitor prefers reduced motion.
 */
export function Cursor() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!matchMedia("(pointer: fine)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const d = dot.current!, r = ring.current!;
    const root = document.documentElement;
    root.classList.add("has-cursor");

    let mx = 0, my = 0, rx = 0, ry = 0, raf = 0, shown = false;
    let state = "";
    const setState = (next: string) => {
      if (next !== state) r.dataset.state = d.dataset.state = state = next;
    };

    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      mx = e.clientX;
      my = e.clientY;
      if (!shown) {
        shown = true;
        rx = mx;
        ry = my;
        root.classList.add("cursor-shown");
      }
      const t = e.target as Element;
      if (!(r.dataset.down === "1")) setState(t.closest?.(TEXT) ? "text" : t.closest?.(INTERACTIVE) ? "hover" : "");
    };
    const down = () => (r.dataset.down = "1");
    const up = () => (r.dataset.down = "");
    const out = (e: MouseEvent) => {
      if (!e.relatedTarget) {
        shown = false;
        root.classList.remove("cursor-shown"); // left the window or entered an iframe (e.g. the map)
      }
    };
    const tick = () => {
      rx += (mx - rx) * 0.16;
      ry += (my - ry) * 0.16;
      d.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
      r.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      raf = requestAnimationFrame(tick);
    };

    addEventListener("pointermove", move, { passive: true });
    addEventListener("pointerdown", down);
    addEventListener("pointerup", up);
    document.addEventListener("mouseout", out);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("pointermove", move);
      removeEventListener("pointerdown", down);
      removeEventListener("pointerup", up);
      document.removeEventListener("mouseout", out);
      root.classList.remove("has-cursor", "cursor-shown");
    };
  }, []);

  return (
    <>
      <div ref={ring} aria-hidden="true" className="cursor-ring" />
      <div ref={dot} aria-hidden="true" className="cursor-dot" />
    </>
  );
}
