import Link from "next/link";
import type { ReactNode } from "react";

// Shared pieces for the member tabs, so every tab has the same frame: a heading with a one-line purpose, cards, and
// empty states that say what the tab is for and what to do first.

/** Tab heading: title, a short purpose line, optional actions on the right. */
export function PageHead({ title, sub, children }: { title: string; sub: ReactNode; children?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-[clamp(40px,5vw,64px)] leading-none uppercase">{title}</h1>
        <p className="mt-2 text-ash">{sub}</p>
      </div>
      {children}
    </header>
  );
}

/** A number with a label and an optional line under it. `muted`: no value yet. */
export function Stat({ label, value, unit, sub, muted }: { label: string; value: string; unit?: string; sub?: ReactNode; muted?: boolean }) {
  return (
    <div className="card flex min-w-0 flex-col gap-1 p-4">
      <p className="label truncate text-xs">{label}</p>
      <p className={`font-display text-3xl leading-none tabular-nums ${muted ? "text-faint" : ""}`}>
        {value}{unit && <span className="ml-1 text-lg text-ash">{unit}</span>}
      </p>
      {sub && <p className="truncate text-xs text-ash">{sub}</p>}
    </div>
  );
}

export const ICONS = {
  scale: "M4 20h16M6 20l2-12h8l2 12M12 8V4M9 13a3 3 0 0 1 6 0",
  camera: "M4 7h3l2-3h6l2 3h3v13H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  dumbbell: "M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12",
  check: "M5 12l5 5L20 7",
};

export function Icon({ d, size = 22 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/** First-run card: what this is for, a few tips, the one thing to do. */
export function Empty({ icon, title, body, tips, action }: { icon: string; title: string; body: ReactNode; tips?: string[]; action?: ReactNode }) {
  return (
    <div className="card flex flex-col gap-4 p-6">
      <span className="flex size-12 items-center justify-center rounded-full border border-redline bg-redwash text-red"><Icon d={icon} /></span>
      <div>
        <p className="text-xl font-bold">{title}</p>
        <p className="mt-1 text-ash">{body}</p>
      </div>
      {tips && (
        <ul className="flex flex-col gap-2 text-sm text-body">
          {tips.map((t) => (
            <li key={t} className="flex gap-2.5"><span className="mt-0.5 text-red"><Icon d={ICONS.check} size={16} /></span>{t}</li>
          ))}
        </ul>
      )}
      {action}
    </div>
  );
}

/** "Go do X" card linking to another tab. */
export function Jump({ href, icon, title, sub }: { href: string; icon: string; title: string; sub: string }) {
  return (
    <Link href={href} className="card flex items-center gap-4 p-4 transition-colors hover:border-red">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-steel text-chalk"><Icon d={icon} size={20} /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold">{title}</span>
        <span className="block truncate text-sm text-ash">{sub}</span>
      </span>
      <span aria-hidden="true" className="text-red">→</span>
    </Link>
  );
}
