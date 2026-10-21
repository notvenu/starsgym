"use client";

import { useState } from "react";

// One series over time, in the brand red on the dark card: a 2px line, a crosshair + tooltip on hover/touch, and a
// table view, so no value is hover-only. x is real time (gaps between entries show as gaps), y fits the data
// (body weight and 1RMs don't start at zero; the axis labels say where it starts).

type Pt = { day: string; v: number };
const shortDay = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const num = (v: number) => v.toLocaleString("en-IN", { maximumFractionDigits: 1 });

/** Axis bounds with a little room, on whole steps. */
function bounds(vs: number[]) {
  const lo = Math.min(...vs), hi = Math.max(...vs);
  const pad = Math.max((hi - lo) * 0.15, hi * 0.01, 0.5);
  const step = hi - lo + 2 * pad > 20 ? 5 : 1;
  return [Math.floor((lo - pad) / step) * step, Math.ceil((hi + pad) / step) * step];
}

export function TrendChart({ points, unit, label, height = 180 }: { points: Pt[]; unit: string; label: string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!points.length) return null;
  const [lo, hi] = bounds(points.map((p) => p.v));
  const t0 = Date.parse(points[0].day), t1 = Date.parse(points.at(-1)!.day);
  const x = (p: Pt) => (t1 === t0 ? 50 : ((Date.parse(p.day) - t0) / (t1 - t0)) * 100);
  const y = (p: Pt) => 100 - ((p.v - lo) / (hi - lo)) * 100;
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(p)},${y(p)}`).join(" ");
  const h = hover === null ? null : points[hover];
  const last = points.at(-1)!;

  // nearest point to the pointer, by x
  const pick = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const at = ((e.clientX - r.left) / r.width) * 100;
    setHover(points.reduce((best, p, i) => (Math.abs(x(p) - at) < Math.abs(x(points[best]) - at) ? i : best), 0));
  };

  return (
    <figure className="flex flex-col gap-2">
      <div className="flex gap-2">
        <div className="flex w-10 shrink-0 flex-col justify-between text-right text-xs text-ash tabular-nums" style={{ height }} aria-hidden="true">
          <span className="-translate-y-1/2">{num(hi)}</span>
          <span className="translate-y-1/2">{num(lo)}</span>
        </div>
        <div className="relative min-w-0 flex-1 touch-pan-y" style={{ height }} onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => setHover(null)}
          role="img" aria-label={`${label}: ${num(points[0].v)} ${unit} on ${shortDay(points[0].day)} to ${num(last.v)} ${unit} on ${shortDay(last.day)}`}>
          <div className="absolute inset-x-0 top-0 border-t border-line" />
          <div className="absolute inset-x-0 top-1/2 border-t border-line" />
          <div className="absolute inset-x-0 bottom-0 border-t border-strong" />
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden="true">
            <path d={path} fill="none" stroke="var(--color-red)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
          {/* the latest value, marked and labelled */}
          <span className="absolute size-2.5 -translate-1/2 rounded-full bg-red ring-2 ring-carbon" style={{ left: `${x(last)}%`, top: `${y(last)}%` }} />
          {h && (
            <>
              <div className="pointer-events-none absolute inset-y-0 border-l border-ash/50" style={{ left: `${x(h)}%` }} />
              <span className="pointer-events-none absolute size-3 -translate-1/2 rounded-full bg-red ring-2 ring-carbon" style={{ left: `${x(h)}%`, top: `${y(h)}%` }} />
              <div className={`pointer-events-none absolute top-1 z-10 rounded-md border border-line bg-ink px-2.5 py-1.5 text-xs whitespace-nowrap shadow-lg ${x(h) > 60 ? "-translate-x-full -ml-2" : "ml-2"}`} style={{ left: `${x(h)}%` }}>
                <span className="block text-ash">{shortDay(h.day)}</span>
                <span className="block font-bold text-chalk tabular-nums">{num(h.v)} {unit}</span>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="flex justify-between pl-12 text-xs text-ash" aria-hidden="true">
        <span>{shortDay(points[0].day)}</span>
        {points.length > 1 && <span>{shortDay(last.day)}</span>}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-ash hover:text-chalk">Show table</summary>
        <table className="mt-2 w-full text-left">
          <tbody className="divide-y divide-line">
            {[...points].reverse().map((p) => (
              <tr key={p.day}><td className="py-1.5 text-ash">{shortDay(p.day)}</td><td className="py-1.5 text-right tabular-nums">{num(p.v)} {unit}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
