import { DAY_NAMES, prettyDay } from "@/lib/gym";

const SESSION: Record<string, string> = { morning: "Morning", evening: "Evening", ladies: "Ladies' hours" };

/** Streak + the last 30 days of visits as a calendar. Same view for the member (dashboard) and the desk (member page). */
export function Attendance({ days, visits, streak }: { days: string[]; visits: { day: string; session: string }[]; streak: number }) {
  const today = days.at(-1);
  const byDay = new Map<string, string[]>();
  visits.forEach((x) => byDay.set(x.day, [...(byDay.get(x.day) ?? []), x.session]));
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-3">
        <Big label="Streak" value={`${streak}d`} red={streak > 0} />
        <Big label="Visits · 30 days" value={visits.length} />
        <Big label="Days · 30 days" value={byDay.size} />
      </div>
      <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-10" role="list" aria-label="Visits by day">
        {days.map((d) => {
          const s = byDay.get(d) ?? [];
          return (
            <div key={d} role="listitem" title={`${prettyDay(d)}${s.length ? ` · ${s.map((x) => SESSION[x] ?? x).join(" + ")}` : " · no visit"}`}
              className={`flex aspect-square flex-col items-center justify-center rounded-md border text-[10px] font-bold ${s.length > 1 ? "border-red bg-red text-white" : s.length ? "border-red bg-redwash text-chalk" : "border-line text-faint"} ${d === today ? "ring-2 ring-chalk/60" : ""}`}>
              <span>{DAY_NAMES[new Date(`${d}T12:00:00`).getDay()][0]}</span>
              <span>{d.slice(8)}</span>
            </div>
          );
        })}
      </div>
      <p className="flex flex-wrap gap-4 text-xs text-ash">
        <span className="flex items-center gap-1.5"><i className="size-3 rounded border border-red bg-redwash" /> One visit</span>
        <span className="flex items-center gap-1.5"><i className="size-3 rounded bg-red" /> Morning + evening</span>
      </p>
    </div>
  );
}

function Big({ label, value, red }: { label: string; value: string | number; red?: boolean }) {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-panel px-3 py-3 sm:px-4">
      <p className={`font-display text-[clamp(28px,8vw,36px)] leading-none ${red ? "text-red" : ""}`}>{value}</p>
      <p className="label mt-1.5 text-[11px] sm:text-sm">{label}</p>
    </div>
  );
}
