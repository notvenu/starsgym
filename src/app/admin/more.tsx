"use client";

import { Children, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Infinite scroll without going back to the server: the page renders the whole list once, this shows 10 rows and
 * 10 more each time the end scrolls into view. (Re-rendering the page per 10 rows re-ran every query each time.)
 */
export function Reveal({ children, step = 10 }: { children: ReactNode; step?: number }) {
  const rows = Children.toArray(children);
  const [n, setN] = useState(step);
  const end = useRef<HTMLLIElement>(null);
  useEffect(() => {
    const el = end.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setN((x) => x + step), { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect(); // a fresh observer after each reveal: still in view = the next 10 load straight away
  }, [n, step, rows.length]);
  return (
    <ul className="divide-y divide-line">
      {rows.slice(0, n)}
      {n < rows.length && <li ref={end} className="px-5 py-3 text-center text-sm text-ash">Loading more · {rows.length - n} left</li>}
    </ul>
  );
}
