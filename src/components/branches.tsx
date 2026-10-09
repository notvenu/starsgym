"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DAY_NAMES, gymClock, gymDate, holidayFor, hoursLabel, ladiesLabel, ladiesSessions, prettyDay, sessions, type Branch, type Holiday } from "@/lib/gym";

const mins = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const span = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60 ? `${m % 60}m` : ""}`.trim() : `${m}m`);
const DAY_START = 4 * 60; // timeline runs 04:00 → 24:00
const DAY_LEN = 20 * 60;

/** Live status in gym time: "closes in 2h 14m", "opens in 35m", "opens Mon 05:00". */
function status(b: Branch, holidays: Holiday[], now: Date) {
  const { dow, time } = gymClock(now);
  const today = gymDate(now);
  const t = mins(time);
  const s = sessions(b);
  const holiday = holidayFor(holidays, b.id, today);
  const closedToday = !!holiday || b.closed_days.includes(dow);
  if (!closedToday) {
    const ladies = ladiesSessions(b).find(([a, c]) => t >= mins(a) && t <= mins(c));
    if (ladies) return { open: true, text: `Ladies' hours · till ${ladies[1]}`, holiday };
    const cur = s.find(([a, c]) => t >= mins(a) && t <= mins(c));
    if (cur) return { open: true, text: `Open · closes in ${span(mins(cur[1]) - t)}`, holiday };
    const next = s.find(([a]) => t < mins(a));
    if (next) return { open: false, text: `Closed · opens in ${span(mins(next[0]) - t)}`, holiday };
  }
  for (let d = 1; d <= 7; d++) {
    const date = new Date(now.getTime() + d * 864e5);
    const { dow: nd } = gymClock(date);
    if (!b.closed_days.includes(nd) && !holidayFor(holidays, b.id, gymDate(date))) {
      return { open: false, text: `Closed · opens ${d === 1 ? "tomorrow" : DAY_NAMES[nd]} ${s[0][0]}`, holiday };
    }
  }
  return { open: false, text: "Closed", holiday };
}

/**
 * Branch picker: pick a branch to see its map, live open/closed countdown, today's sessions on a
 * 24-hour timeline with a "now" marker, and the week's hours.
 */
export function BranchExplorer({ branches, holidays }: { branches: Branch[]; holidays: Holiday[] }) {
  const [i, setI] = useState(0);
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  if (!branches.length) return null;

  const b = branches[Math.min(i, branches.length - 1)];
  const st = now ? status(b, holidays, now) : null;
  const clock = now ? gymClock(now) : null;
  const nowMin = clock ? mins(clock.time) : 0;
  const todayClosed = !!st?.holiday || (clock ? b.closed_days.includes(clock.dow) : false);
  const mapQuery = b.lat != null && b.lng != null ? `${b.lat},${b.lng}` : `${b.name}, ${b.address}`;
  const directions = b.maps_url ?? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapQuery)}`;
  const week = [1, 2, 3, 4, 5, 6, 0];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
      {/* branch list */}
      <div role="tablist" aria-label="Branches" className="flex flex-col gap-3">
        {branches.map((x, n) => {
          const active = x.id === b.id;
          const s = now ? status(x, holidays, now) : null;
          return (
            <button
              key={x.id}
              role="tab"
              aria-selected={active}
              aria-controls="branch-panel"
              onClick={() => setI(n)}
              className={`group relative flex cursor-pointer flex-col justify-end gap-3 overflow-hidden rounded-lg border p-6 text-left lg:flex-1 transition-[border-color,background-color] duration-300 ${active ? "border-red bg-redwash" : "border-line bg-carbon hover:border-strong"}`}
            >
              <span aria-hidden="true" className={`absolute -right-4 -bottom-8 font-display text-[140px] leading-none transition-colors ${active ? "text-red/15" : "text-white/[0.03]"}`}>0{n + 1}</span>
              <span className="relative flex items-center gap-2 font-label text-[13px] font-bold tracking-[0.16em] uppercase">
                <span className={`inline-block size-2 rounded-full ${s?.open ? "animate-pulse-red bg-red" : "bg-strong"}`} />
                <span className={s?.open ? "text-chalk" : "text-ash"}>{s?.text ?? " "}</span>
              </span>
              <span className="relative font-display text-[clamp(40px,5vw,64px)] leading-none uppercase">{x.name}</span>
              <span className="relative line-clamp-2 max-w-md text-[15px] text-ash">{x.address}</span>
            </button>
          );
        })}
      </div>

      {/* details */}
      <div id="branch-panel" role="tabpanel" key={b.id} className="flex animate-rise flex-col overflow-hidden rounded-lg border border-line bg-carbon [animation-duration:.6s]">
        <div className="relative h-64 sm:h-80">
          <iframe
            title={`Map of ${b.name}`}
            src={`https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=15&output=embed`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="map-dark size-full border-0"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-linear-to-t from-carbon to-transparent" />
        </div>

        <div className="flex flex-col gap-6 p-6">
          {/* today's timeline */}
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="label">Today{now ? ` · ${prettyDay(gymDate(now))}` : ""}</p>
              {st && <p className={`text-sm font-bold ${st.open ? "text-red" : "text-ash"}`}>{st.text}</p>}
            </div>
            <div className="relative h-11">
              <div className={`absolute inset-x-0 top-3 h-5 rounded-full ${todayClosed ? "stripes" : "bg-steel"}`} />
              {!todayClosed &&
                sessions(b).map(([a, c]) => (
                  <div
                    key={a}
                    className="absolute top-3 h-5 rounded-full bg-red/85"
                    style={{ left: `${((mins(a) - DAY_START) / DAY_LEN) * 100}%`, width: `${((mins(c) - mins(a)) / DAY_LEN) * 100}%` }}
                    title={`${a}–${c}`}
                  />
                ))}
              {!todayClosed &&
                ladiesSessions(b).map(([a, c]) => (
                  <div
                    key={`l${a}`}
                    className="absolute top-3 h-5 rounded-full border-2 border-red bg-[repeating-linear-gradient(135deg,var(--color-red)_0_3px,transparent_3px_7px)]"
                    style={{ left: `${((mins(a) - DAY_START) / DAY_LEN) * 100}%`, width: `${((mins(c) - mins(a)) / DAY_LEN) * 100}%` }}
                    title={`Ladies' hours ${a}–${c}`}
                  />
                ))}
              {now && nowMin >= DAY_START && (
                <div className="absolute top-0 bottom-0 flex flex-col items-center" style={{ left: `${((nowMin - DAY_START) / DAY_LEN) * 100}%` }}>
                  <span className="h-full w-0.5 -translate-x-1/2 rounded bg-chalk shadow-[0_0_10px_rgba(244,242,238,.8)]" />
                </div>
              )}
              {todayClosed && <p className="absolute inset-x-0 top-3 text-center font-label text-xs leading-5 font-bold tracking-[0.2em] text-chalk uppercase">{st?.holiday ? `Holiday${st.holiday.note ? ` · ${st.holiday.note}` : ""}` : "Weekly off"}</p>}
            </div>
            <div className="relative h-4 text-[11px] text-ash">
              {[6, 9, 12, 15, 18, 21].map((h) => (
                <span key={h} className="absolute -translate-x-1/2" style={{ left: `${((h * 60 - DAY_START) / DAY_LEN) * 100}%` }}>{String(h).padStart(2, "0")}:00</span>
              ))}
            </div>
          </div>

          {/* week */}
          <ul className="grid grid-cols-7 gap-1.5 text-center">
            {week.map((d) => {
              const off = b.closed_days.includes(d);
              const isToday = clock?.dow === d;
              return (
                <li key={d} className={`rounded-md border px-1 py-2 ${isToday ? "border-red bg-redwash" : "border-line"}`}>
                  <p className={`font-label text-xs font-bold tracking-[0.12em] uppercase ${isToday ? "text-red" : "text-ash"}`}>{DAY_NAMES[d]}</p>
                  <p className={`mt-1 text-[11px] leading-tight ${off ? "text-faint" : "text-body"}`}>{off ? "Off" : sessions(b).map(([a]) => a).join(" / ")}</p>
                </li>
              );
            })}
          </ul>
          <div className="-mt-3 flex flex-col gap-1 text-sm text-ash">
            <p><span className="mr-1.5 inline-block h-2.5 w-5 rounded-full bg-red/85 align-middle" />General: {hoursLabel(b)}</p>
            {ladiesLabel(b) && (
              <p><span className="mr-1.5 inline-block h-2.5 w-5 rounded-full border-2 border-red bg-[repeating-linear-gradient(135deg,var(--color-red)_0_3px,transparent_3px_7px)] align-middle" />Ladies&apos; hours: {ladiesLabel(b)} · women only</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <a href={directions} target="_blank" rel="noreferrer" className="btn-red">
              Get directions
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17L17 7M8 7h9v9" /></svg>
            </a>
            <Link href="/dashboard" className="btn-ghost">Check in here</Link>
            <Link href="/contact" className="btn-ghost">Contact</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
