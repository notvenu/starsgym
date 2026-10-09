"use client";

import { useState } from "react";

// Single-series charts in Arena Red on the dark surface. Text stays in text colours; only marks carry red.
// Every chart has a hover/focus tooltip and a table view, so no value is hover-only.

export type Point = { label: string; v: number };
type Format = "inr" | "count";

const fmt = (v: number, f: Format) =>
  f === "inr"
    ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0, notation: v >= 1e7 ? "compact" : "standard" }).format(v / 100)
    : new Intl.NumberFormat("en-IN").format(v);

/** Round up to a clean axis maximum: 1, 2, 2.5, 5 × 10ⁿ. */
function niceMax(max: number) {
  if (max <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(max));
  return ([1, 2, 2.5, 5, 10].find((m) => m * p >= max) ?? 10) * p;
}

function TableView({ rows, format, head }: { rows: Point[]; format: Format; head: [string, string] }) {
  return (
    <details className="mt-4 text-sm">
      <summary className="cursor-pointer text-ash hover:text-chalk">Show table</summary>
      <div className="mt-2 max-h-64 overflow-auto rounded border border-line">
        <table className="w-full text-left">
          <thead className="sticky top-0 bg-carbon text-xs tracking-wider text-ash uppercase"><tr><th className="px-3 py-2">{head[0]}</th><th className="px-3 py-2 text-right">{head[1]}</th></tr></thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => <tr key={r.label}><td className="px-3 py-1.5">{r.label}</td><td className="px-3 py-1.5 text-right tabular-nums">{fmt(r.v, format)}</td></tr>)}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** Vertical columns over time. */
export function ColumnChart({ data, format, unit }: { data: Point[]; format: Format; unit: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(...data.map((d) => d.v), 0));
  const every = Math.ceil(data.length / 6); // ~6 x-labels max, so they never collide
  const H = 220;

  return (
    <div>
      <div className="relative flex gap-3">
        {/* y axis */}
        <div className="flex w-14 shrink-0 flex-col justify-between text-right text-xs text-ash tabular-nums" style={{ height: H }}>
          {[max, max / 2, 0].map((t) => <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">{fmt(t, format)}</span>)}
        </div>
        <div className="relative min-w-0 flex-1" style={{ height: H }}>
          {[0, 50, 100].map((p) => <div key={p} className="absolute inset-x-0 border-t border-line" style={{ top: `${p}%` }} />)}
          <div className="absolute inset-0 flex items-end gap-[2px]" onPointerLeave={() => setHover(null)}>
            {data.map((d, i) => (
              <button
                key={d.label}
                type="button"
                onPointerEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={`${d.label}: ${fmt(d.v, format)} ${unit}`}
                className="group relative flex h-full flex-1 cursor-default items-end justify-center outline-none"
              >
                <span
                  className={`block w-full max-w-6 rounded-t-[4px] transition-colors ${hover === i ? "bg-[#ff4a50]" : "bg-red"} ${d.v ? "" : "opacity-0"}`}
                  style={{ height: `${(d.v / max) * 100}%`, minHeight: d.v ? 2 : 0 }}
                />
                {hover === i && (
                  <span className="pointer-events-none absolute bottom-full z-10 mb-2 flex flex-col items-center rounded-md border border-line bg-ink px-3 py-2 whitespace-nowrap shadow-xl">
                    <strong className="text-base text-chalk">{fmt(d.v, format)}</strong>
                    <span className="text-xs text-ash">{d.label}</span>
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-2 ml-17 flex gap-[2px] text-[11px] text-ash">
        {data.map((d, i) => (
          <span key={d.label} className="relative h-4 flex-1">
            {i % every === 0 && <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap">{d.label}</span>}
          </span>
        ))}
      </div>
      <TableView rows={data} format={format} head={["Period", unit]} />
    </div>
  );
}

/** Ranked horizontal bars with the value at the tip. */
export function BarList({ rows, format, unit, sub }: { rows: Point[]; format: Format; unit: string; sub?: Record<string, string> }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-ash">No data in this period.</p>;
  const max = Math.max(...rows.map((r) => r.v), 1);
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.label} className="flex flex-col gap-1" title={`${r.label}: ${fmt(r.v, format)} ${unit}`}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-body">{r.label}</span>
            <span className="shrink-0 font-bold tabular-nums">{fmt(r.v, format)}{sub?.[r.label] && <span className="ml-1.5 font-normal text-ash">{sub[r.label]}</span>}</span>
          </div>
          <div className="h-2 rounded-full bg-steel"><div className="h-full rounded-full bg-red" style={{ width: `${(r.v / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const STEPS = [0.12, 0.3, 0.5, 0.75, 1]; // sequential: one hue, light → full

/** Check-ins by weekday × hour. Darker red = busier. */
export function Heatmap({ cells }: { cells: { dow: number; h: number; v: number }[] }) {
  const [hover, setHover] = useState<string | null>(null);
  if (!cells.length) return <p className="py-6 text-center text-sm text-ash">No check-ins in this period.</p>;
  const hours = cells.map((c) => c.h);
  const from = Math.min(...hours), to = Math.max(...hours);
  const range = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const max = Math.max(...cells.map((c) => c.v));
  const at = (dow: number, h: number) => cells.find((c) => c.dow === dow && c.h === h)?.v ?? 0;
  const order = [1, 2, 3, 4, 5, 6, 0]; // Monday first
  const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-[2px] text-[11px]">
          <thead>
            <tr><th />{range.map((h) => <th key={h} className="w-6 font-normal text-ash">{h % 2 === 0 ? h : ""}</th>)}</tr>
          </thead>
          <tbody>
            {order.map((dow, row) => (
              <tr key={dow}>
                <th scope="row" className="pr-2 text-left font-normal text-ash">{DAYS[row]}</th>
                {range.map((h) => {
                  const v = at(dow, h);
                  const key = `${dow}-${h}`;
                  const step = v ? STEPS[Math.min(STEPS.length - 1, Math.floor((v / max) * STEPS.length))] : 0;
                  return (
                    <td key={h} className="relative p-0">
                      <button
                        type="button"
                        onPointerEnter={() => setHover(key)}
                        onPointerLeave={() => setHover(null)}
                        onFocus={() => setHover(key)}
                        onBlur={() => setHover(null)}
                        aria-label={`${DAYS[row]} ${hh(h)}: ${v} check-ins`}
                        className={`block size-6 cursor-default rounded-[4px] outline-none ${hover === key ? "ring-2 ring-chalk" : ""}`}
                        style={{ background: v ? `rgb(227 20 28 / ${step})` : "#1a1a1a" }}
                      />
                      {hover === key && (
                        <span className={`pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 rounded-md border border-line bg-ink px-3 py-2 text-center whitespace-nowrap shadow-xl ${row < 2 ? "top-full mt-2" : "bottom-full mb-2"}`}>
                          <strong className="block text-sm text-chalk">{v} check-ins</strong>
                          <span className="text-xs text-ash">{DAYS[row]} {hh(h)}</span>
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-ash">
        Quieter
        {STEPS.map((s) => <span key={s} className="size-3.5 rounded-[3px]" style={{ background: `rgb(227 20 28 / ${s})` }} />)}
        Busier
      </div>
    </div>
  );
}
