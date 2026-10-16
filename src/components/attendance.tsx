import { prettyDay } from "@/lib/gym";
import { Flame } from "@/components/site";

const SESSION: Record<string, string> = { morning: "Morning", evening: "Evening", ladies: "Ladies' hours" };
const FAV: Record<string, string> = { morning: "Mostly mornings", evening: "Mostly evenings", ladies: "Ladies' hours regular" };
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

const dow = (iso: string) => (new Date(`${iso}T12:00:00`).getDay() + 6) % 7; // Monday = 0

/**
 * The last 30 days as a training log: streak up top, then real weeks (Mon–Sun) where back-to-back training days join
 * into a red chain. One visit = soft red, morning + evening = full red. Same view for the member and the desk.
 */
export function Attendance({ days, visits, streak }: { days: string[]; visits: { day: string; session: string }[]; streak: number }) {
  const today = days.at(-1);
  const byDay = new Map<string, string[]>();
  visits.forEach((x) => byDay.set(x.day, [...(byDay.get(x.day) ?? []), x.session]));
  const counts = visits.reduce<Record<string, number>>((c, v) => ((c[v.session] = (c[v.session] ?? 0) + 1), c), {});
  const fav = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  // pad to Monday so the columns are real weekdays
  const cells: (string | null)[] = [...Array(dow(days[0])).fill(null), ...days];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className={`flex size-14 items-center justify-center rounded-2xl ${streak > 0 ? "bg-red text-white shadow-[0_8px_30px_rgb(227_20_28/0.35)]" : "bg-steel text-ash"}`}>
            <Flame size={28} />
          </span>
          <div>
            <p className="font-display text-5xl leading-none tabular-nums">{streak}</p>
            <p className="label mt-1">Day streak</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip value={visits.length} label="visits" />
          <Chip value={byDay.size} label={`of ${days.length} days`} />
          {fav && <Chip label={FAV[fav] ?? fav} />}
        </div>
      </div>

      <div>
        <div className="mb-2 grid grid-cols-7 gap-2 text-center font-label text-xs font-bold tracking-[0.18em] text-faint">
          {WEEKDAYS.map((d, i) => <span key={i}>{d}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-2" role="list" aria-label="Visits in the last 30 days">
          {cells.map((d, i) => {
            if (!d) return <span key={`pad${i}`} aria-hidden="true" />;
            const s = byDay.get(d) ?? [];
            const prev = i > 0 ? cells[i - 1] : null;
            const chained = s.length > 0 && !!prev && (byDay.get(prev)?.length ?? 0) > 0 && dow(d) !== 0; // joins the day before, same week
            const isToday = d === today;
            const first = d.endsWith("-01") || i === dow(days[0]);
            return (
              <div key={d} role="listitem" title={`${prettyDay(d)}${s.length ? ` · ${s.map((x) => SESSION[x] ?? x).join(" + ")}` : " · rest day"}`}
                className="log-cell relative aspect-square" style={{ animationDelay: `${Math.min(i, 34) * 14}ms` }}>
                {chained && <span aria-hidden="true" className="absolute top-1/2 right-full h-2 w-2 -translate-y-1/2 bg-red/70" />}
                <div className={`flex size-full flex-col items-center justify-center rounded-xl text-sm font-bold transition-transform hover:scale-105 ${
                  s.length > 1 ? "bg-red text-white shadow-[0_0_18px_rgb(227_20_28/0.45)]"
                  : s.length ? "bg-red/45 text-white"
                  : "bg-steel/60 text-faint"
                } ${isToday ? (s.length ? "ring-2 ring-chalk ring-offset-2 ring-offset-carbon" : "border-2 border-dashed border-red text-chalk") : ""}`}>
                  {first && <span className="font-label text-[9px] leading-none tracking-wider uppercase opacity-80">{new Date(`${d}T12:00:00`).toLocaleDateString("en-IN", { month: "short" })}</span>}
                  <span className="tabular-nums">{Number(d.slice(8))}</span>
                  {s.length > 1 && <span aria-hidden="true" className="mt-0.5 flex gap-0.5"><i className="size-1 rounded-full bg-white" /><i className="size-1 rounded-full bg-white" /></span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ash">
        <span className="flex items-center gap-1.5"><i className="size-3.5 rounded bg-steel/60" /> Rest</span>
        <span className="flex items-center gap-1.5"><i className="size-3.5 rounded bg-red/45" /> Trained</span>
        <span className="flex items-center gap-1.5"><i className="size-3.5 rounded bg-red" /> Morning + evening</span>
        <span className="flex items-center gap-1.5"><i className="h-1.5 w-4 rounded bg-red/70" /> Streak chain</span>
      </p>
    </div>
  );
}

function Chip({ value, label }: { value?: number; label: string }) {
  return (
    <span className="flex items-baseline gap-1.5 rounded-full border border-line bg-panel px-3.5 py-1.5 text-sm">
      {value !== undefined && <b className="font-display text-lg leading-none tabular-nums">{value}</b>}
      <span className="text-ash">{label}</span>
    </span>
  );
}
