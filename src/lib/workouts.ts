// Workout plans (one per member), logs and progression. Pure (no server or browser APIs), so the page, the actions and the check share it.

/** One exercise in a plan day. Progression: every `every` days since the plan started, add `addKg` and `addReps`. */
export type PlanExercise = { name: string; sets: number; reps: number; kg: number; addKg: number; addReps: number; every: number };
export type PlanDay = { name: string; exercises: PlanExercise[] };
export type Plan = { id?: string; name: string; days: PlanDay[]; started_on?: string };

export type LogSet = { kg: number; reps: number };
export type LogExercise = { name: string; sets: LogSet[] };
export type Log = { id?: string; day: string; title: string; exercises: LogExercise[]; note: string };

/** How often to step up. 0 = never. */
export const EVERY = [
  [0, "Never"],
  [3, "Every 3 days"],
  [7, "Every week"],
  [14, "Every 2 weeks"],
  [28, "Every 4 weeks"],
] as const;

/** Gym experience, asked when they sign up; it picks the split we suggest. */
export const LEVELS = [
  { key: "beginner", label: "Beginner", span: "New, or under 6 months" },
  { key: "novice", label: "Novice", span: "6 months – 1 year" },
  { key: "intermediate", label: "Intermediate", span: "1 – 2 years" },
  { key: "advanced", label: "Advanced", span: "2 – 4 years" },
  { key: "expert", label: "Expert", span: "4+ years" },
] as const;
export type Level = (typeof LEVELS)[number]["key"];
export const isLevel = (v: unknown): v is Level => LEVELS.some((l) => l.key === v);

/**
 * How each level trains. Fewer exercises, easier variants (machines), higher reps and weekly steps for newer lifters;
 * more exercises, harder variants, heavier compounds stepped up less often for experienced ones (they stall sooner).
 * `tier` picks the variant from each slot: 0 machines / basics, 1 free weights, 2 advanced.
 */
const RULES: Record<Level, { count: number; tier: number; mainSets: number; sets: number; mainReps: number; reps: number; every: number; accEvery: number }> = {
  beginner: { count: 4, tier: 0, mainSets: 3, sets: 2, mainReps: 10, reps: 12, every: 7, accEvery: 14 },
  novice: { count: 5, tier: 1, mainSets: 3, sets: 3, mainReps: 8, reps: 12, every: 7, accEvery: 14 },
  intermediate: { count: 6, tier: 1, mainSets: 4, sets: 3, mainReps: 6, reps: 10, every: 7, accEvery: 14 },
  advanced: { count: 7, tier: 2, mainSets: 4, sets: 3, mainReps: 5, reps: 10, every: 14, accEvery: 14 },
  expert: { count: 8, tier: 2, mainSets: 5, sets: 4, mainReps: 5, reps: 10, every: 14, accEvery: 28 },
};

/** Done for reps (or seconds), not weight. */
const BODYWEIGHT = /^(pull-up|chin-up|assisted pull-up|push-up|dips|chest dips|bench dips|hanging (leg|knee) raise|plank|side plank|dead bug|nordic curl|inverted row)/i;
const step = (name: string) =>
  /^(squat|front squat|hack squat|deadlift|romanian deadlift|sumo deadlift|rack pull|leg press|hip thrust)$/i.test(name) ? 5
  : /calf/i.test(name) ? 2.5
  : /dumbbell|lateral|curl|fly|raise|kickback|arnold|goblet|lunge|split squat|step-up/i.test(name) ? 1
  : 2.5;

/**
 * A split day: slots in priority order ("*" = main lift), each "tier 0|tier 1|tier 2" (one name = every tier).
 * A level takes its first `count` slots, so the first four matter most.
 */
type Blueprint = { key: string; name: string; days: { name: string; slots: string[] }[] };
const day = (name: string, ...slots: string[]) => ({ name, slots });

const PUSH = day("Push", "*Machine chest press|Bench press", "*Machine shoulder press|Overhead press", "Incline dumbbell press|Incline dumbbell press|Incline bench press", "Lateral raise|Lateral raise|Cable lateral raise",
  "Triceps pushdown|Rope pushdown", "Pec deck|Cable fly|Low-to-high cable fly", "Overhead dumbbell extension|Overhead cable extension|Skull crusher", "Push-up|Dips");
const PULL = day("Pull", "*Seated cable row|Barbell row|Deadlift", "*Lat pulldown|Lat pulldown|Pull-up", "Dumbbell row|Dumbbell row|Barbell row", "Face pull",
  "Dumbbell curl|Barbell curl", "Hammer curl", "Reverse pec deck|Rear delt fly|Reverse pec deck", "Straight-arm pulldown|Chest-supported row|Meadows row");
const LEGS = day("Legs", "*Leg press|Squat", "*Lying leg curl|Romanian deadlift", "Leg extension|Leg press|Hack squat", "Standing calf raise",
  "Seated leg curl|Lying leg curl", "Goblet squat|Walking lunge|Bulgarian split squat", "Plank (seconds)|Hanging knee raise|Hanging leg raise", "Hip abduction machine|Hip thrust");

export const SPLITS: Blueprint[] = [
  {
    key: "full",
    name: "Full Body",
    days: [
      day("Full body A", "*Goblet squat|Squat", "*Machine chest press|Bench press", "*Lat pulldown|Lat pulldown|Pull-up", "Seated dumbbell press|Overhead press",
        "Lying leg curl|Romanian deadlift", "Plank (seconds)|Plank (seconds)|Hanging leg raise", "Dumbbell curl|Barbell curl|EZ-bar curl", "Triceps pushdown|Rope pushdown|Skull crusher"),
      day("Full body B", "*Leg press|Deadlift", "*Dumbbell bench press|Incline bench press", "*Seated cable row|Barbell row|Pendlay row", "Machine shoulder press|Seated dumbbell press|Push press",
        "Leg extension|Bulgarian split squat", "Dead bug|Hanging knee raise|Ab wheel rollout", "Lateral raise|Lateral raise|Cable lateral raise", "Standing calf raise"),
    ],
  },
  {
    key: "upper-lower",
    name: "Upper / Lower",
    days: [
      day("Upper A", "*Machine chest press|Bench press", "*Seated cable row|Barbell row|Pendlay row", "*Machine shoulder press|Overhead press", "Lat pulldown|Lat pulldown|Pull-up",
        "Dumbbell fly|Cable fly", "Dumbbell curl|Barbell curl|EZ-bar curl", "Triceps pushdown|Rope pushdown|Close-grip bench press", "Lateral raise|Lateral raise|Cable lateral raise"),
      day("Lower A", "*Leg press|Squat", "*Lying leg curl|Romanian deadlift", "Leg extension|Leg press|Hack squat", "Standing calf raise",
        "Barbell glute bridge|Hip thrust", "Seated leg curl|Lying leg curl|Nordic curl", "Plank (seconds)|Hanging knee raise|Hanging leg raise", "Hip abduction machine|Walking lunge"),
      day("Upper B", "*Dumbbell bench press|Incline dumbbell press|Incline bench press", "*Lat pulldown|Chin-up|Pull-up", "*Seated dumbbell press|Seated dumbbell press|Push press", "Machine row|Dumbbell row|Meadows row",
        "Pec deck|Dips", "Face pull", "Hammer curl|Hammer curl|Incline dumbbell curl", "Overhead dumbbell extension|Overhead cable extension"),
      day("Lower B", "*Goblet squat|Deadlift", "*Leg press|Leg press|Front squat", "Seated leg curl", "Leg extension",
        "Reverse lunge|Bulgarian split squat", "Seated calf raise", "Dead bug|Cable crunch|Ab wheel rollout", "Hip abduction machine|Hip thrust"),
    ],
  },
  { key: "ppl", name: "Push / Pull / Legs", days: [PUSH, PULL, LEGS] },
  {
    key: "ppl6",
    name: "Push / Pull / Legs ×2",
    days: [1, 2].flatMap((n) => [PUSH, PULL, LEGS].map((d) => ({ ...d, name: `${d.name} ${n}` }))),
  },
  {
    key: "bro",
    name: "Bro Split",
    days: [
      day("Chest", "*Machine chest press|Bench press", "*Incline dumbbell press|Incline bench press", "Pec deck|Dumbbell fly|Cable fly", "Push-up|Chest dips",
        "Decline dumbbell press|Decline bench press", "Cable fly|Low-to-high cable fly", "Dumbbell pullover", "Smith machine bench press|Smith machine bench press|Weighted push-up"),
      day("Back", "*Lat pulldown|Deadlift", "*Seated cable row|Barbell row", "Machine row|Lat pulldown|Pull-up", "Back extension",
        "Dumbbell row|Dumbbell row|T-bar row", "Straight-arm pulldown|Straight-arm pulldown|Close-grip lat pulldown", "Face pull|Face pull|Meadows row", "Dumbbell shrug"),
      day("Shoulders", "*Machine shoulder press|Overhead press", "Lateral raise|Lateral raise|Cable lateral raise", "Reverse pec deck|Rear delt fly", "Front raise|Seated dumbbell press|Arnold press",
        "Dumbbell shrug|Face pull", "Machine lateral raise|Upright row", "Barbell shrug", "Landmine press"),
      day("Legs", "*Leg press|Squat", "*Lying leg curl|Romanian deadlift", "Leg extension|Leg press|Hack squat", "Standing calf raise",
        "Seated leg curl|Walking lunge|Bulgarian split squat", "Leg extension", "Seated leg curl|Seated leg curl|Nordic curl", "Seated calf raise"),
      day("Arms", "*Dumbbell curl|Barbell curl", "*Triceps pushdown|Close-grip bench press", "Hammer curl", "Overhead dumbbell extension|Skull crusher",
        "Preacher curl|Preacher curl|Incline dumbbell curl", "Rope pushdown|Rope pushdown|Overhead cable extension", "Cable curl|Concentration curl|Bayesian cable curl", "Bench dips|Dips"),
    ],
  },
];

/** What we suggest for each level; every split is still there to pick. */
export const RECOMMENDED: Record<Level, string> = { beginner: "full", novice: "upper-lower", intermediate: "ppl", advanced: "ppl6", expert: "bro" };

/** A split as this level does it: its exercises, variants, sets, reps and progression. */
export function buildSplit(key: string, level: Level): Plan {
  const split = SPLITS.find((s) => s.key === key) ?? SPLITS[0];
  const r = RULES[level];
  return {
    name: split.name,
    days: split.days.map((d) => ({
      name: d.name,
      exercises: d.slots.slice(0, r.count).map((slot): PlanExercise => {
        const main = slot.startsWith("*");
        const tiers = slot.replace("*", "").split("|");
        const name = tiers[Math.min(r.tier, tiers.length - 1)];
        const sets = main ? r.mainSets : r.sets;
        const every = main ? r.every : r.accEvery;
        if (BODYWEIGHT.test(name)) {
          const timed = name.includes("(seconds)");
          return { name, sets, reps: timed ? 30 : main ? r.mainReps : 8, kg: 0, addKg: 0, addReps: timed ? 5 : 1, every };
        }
        const reps = main ? r.mainReps : /calf|lateral|face pull|rear delt|reverse pec|shrug/i.test(name) ? 15 : r.reps;
        return { name, sets, reps, kg: 0, addKg: step(name), addReps: 0, every };
      }),
    })),
  };
}

const daysBetween = (from: string, to: string) => Math.floor((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 864e5);

/** Today's target for an exercise: the base plus one step for each full `every` days since the plan started. */
export function target(e: PlanExercise, startedOn: string, today: string): { kg: number; reps: number } {
  const steps = e.every > 0 ? Math.max(0, Math.floor(daysBetween(startedOn, today) / e.every)) : 0;
  return { kg: Math.round((e.kg + steps * e.addKg) * 100) / 100, reps: e.reps + steps * e.addReps };
}

/**
 * Today's target in their plan. Ready-made splits start without weights (0 kg): for those, the first time they log the
 * exercise on this plan sets the weight (their heaviest set), and progression counts from that day. `logs`: newest first.
 */
export function targetFor(e: PlanExercise, plan: Plan, logs: Log[], today: string) {
  const start = plan.started_on ?? today;
  if (e.kg > 0) return target(e, start, today);
  let first: { day: string; kg: number } | null = null;
  for (const l of logs) {
    const done = l.day >= start && l.title.startsWith(`${plan.name} · `) && l.exercises.find((x) => x.name === e.name);
    if (done) first = { day: l.day, kg: Math.max(...done.sets.map((s) => s.kg)) }; // keeps going: ends on the oldest
  }
  // no weight yet: nothing to step up from (0 + 2.5 kg a week would be nonsense); reps still progress
  return first ? target({ ...e, kg: first.kg }, first.day, today) : target({ ...e, addKg: 0 }, start, today);
}

/** A plan day as a fresh log, sets filled with today's targets. */
export const logFromDay = (plan: Plan, day: PlanDay, logs: Log[], today: string): Log => ({
  day: today,
  title: `${plan.name} · ${day.name}`,
  note: "",
  exercises: day.exercises.map((e) => {
    const t = targetFor(e, plan, logs, today);
    return { name: e.name, sets: Array.from({ length: e.sets }, () => ({ ...t })) };
  }),
});

// --- cleaning what comes from the browser (or a shared link) ---

const num = (v: unknown, max: number, min = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n * 100) / 100)) : min;
};
const text = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const list = <T>(v: unknown, max: number, each: (x: Record<string, unknown>) => T | null) =>
  (Array.isArray(v) ? v : []).slice(0, max).map((x) => (x && typeof x === "object" ? each(x as Record<string, unknown>) : null)).filter((x): x is T => x !== null);

export function cleanPlan(v: unknown): Plan | { error: string } {
  const p = (v ?? {}) as Record<string, unknown>;
  const name = text(p.name, 60);
  const days = list(p.days, 7, (d) => {
    const exercises = list(d.exercises, 20, (e) => {
      const n = text(e.name, 60);
      return n ? { name: n, sets: num(e.sets, 20, 1), reps: num(e.reps, 500, 1), kg: num(e.kg, 1000), addKg: num(e.addKg, 50), addReps: num(e.addReps, 50), every: num(e.every, 365) } : null;
    });
    return exercises.length ? { name: text(d.name, 40) || "Day", exercises } : null;
  });
  if (!name) return { error: "Give the plan a name." };
  if (!days.length) return { error: "Add at least one day with an exercise." };
  return { name, days };
}

export function cleanLog(v: unknown): Log | { error: string } {
  const l = (v ?? {}) as Record<string, unknown>;
  const day = text(l.day, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(day))) return { error: "Pick a date." };
  const exercises = list(l.exercises, 30, (e) => {
    const n = text(e.name, 60);
    const sets = list(e.sets, 30, (s) => ({ kg: num(s.kg, 1000), reps: num(s.reps, 500) })).filter((s) => s.reps > 0);
    return n && sets.length ? { name: n, sets } : null;
  });
  if (!exercises.length) return { error: "Log at least one set." };
  return { day, title: text(l.title, 80) || "Workout", note: text(l.note, 500), exercises };
}

// --- export and share ---

/** Share links carry the whole plan in the URL, so nothing needs to be public in the database. */
export const planLink = (origin: string, p: Plan) => `${origin}/dashboard/workouts?plan=${encodeURIComponent(JSON.stringify({ name: p.name, days: p.days }))}`;

const csvCell = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

/** One row per set: opens in Sheets or Excel. */
export function logsCsv(logs: Log[]) {
  const rows = [["date", "workout", "exercise", "set", "kg", "reps", "note"]];
  for (const l of logs) for (const e of l.exercises) e.sets.forEach((s, i) => rows.push([l.day, l.title, e.name, String(i + 1), String(s.kg), String(s.reps), i === 0 ? l.note : ""]));
  return rows.map((r) => r.map(csvCell).join(",")).join("\n");
}

/** Plain text for WhatsApp / notes. */
export const logText = (l: Log) =>
  [`${l.title} — ${l.day}`, ...l.exercises.map((e) => `• ${e.name}: ${e.sets.map((s) => (s.kg ? `${s.kg}kg×${s.reps}` : `${s.reps}`)).join(", ")}`), l.note].filter(Boolean).join("\n");

export const planText = (p: Plan) =>
  [p.name, ...p.days.flatMap((d) => [`\n${d.name}`, ...d.exercises.map((e) => `• ${e.name} ${e.sets}×${e.reps}${e.kg ? ` @ ${e.kg}kg` : ""}`)])].join("\n");

/** Total kg moved. */
export const volume = (l: Log) => l.exercises.reduce((t, e) => t + e.sets.reduce((s, x) => s + x.kg * x.reps, 0), 0);

/** The plan day after the one they last logged from this plan (logs newest first); the first day if none. */
export function nextDay(plan: Plan, logs: Log[]) {
  const last = logs.find((l) => l.title.startsWith(`${plan.name} · `));
  const i = last ? plan.days.findIndex((d) => last.title === `${plan.name} · ${d.name}`) : -1;
  return (i + 1) % plan.days.length;
}

/**
 * Which day is up. `next`: the one after their last workout on this plan. `today`: where the plan would be if they'd
 * trained every day since, one day per calendar day. They differ only after a missed day, and then we ask
 * (continue with the missed one, or jump to today's). `missed`: days between with no workout.
 */
export function schedule(plan: Plan, logs: Log[], today: string) {
  const next = nextDay(plan, logs);
  const last = logs.find((l) => l.title.startsWith(`${plan.name} · `));
  const missed = last ? Math.max(0, daysBetween(last.day, today) - 1) : 0;
  const now = (next + missed) % plan.days.length;
  return { next, today: now, missed, ask: missed > 0 && now !== next };
}

// --- strength insights ---

/** Estimated one-rep max (Epley). Only sets of 1–12 reps with weight: past that the estimate means little. */
export const e1rm = (kg: number, reps: number) => (kg > 0 && reps >= 1 && reps <= 12 ? Math.round((reps === 1 ? kg : kg * (1 + reps / 30)) * 10) / 10 : 0);

export type Lift = { name: string; sessions: number; points: { day: string; v: number }[]; best: { e1rm: number; kg: number; reps: number; day: string }; first: number };

/** Per exercise: best estimated 1RM each day it was done (oldest first), the all-time best set, how often it was done.
 *  Most-done first. Bodyweight-only exercises (no kg) are left out. `logs`: any order. */
export function lifts(logs: Log[]): Lift[] {
  const by = new Map<string, Map<string, { e1rm: number; kg: number; reps: number }>>();
  for (const l of logs)
    for (const e of l.exercises)
      for (const s of e.sets) {
        const v = e1rm(s.kg, s.reps);
        if (!v) continue;
        const days = by.get(e.name) ?? by.set(e.name, new Map()).get(e.name)!;
        if (v > (days.get(l.day)?.e1rm ?? 0)) days.set(l.day, { e1rm: v, kg: s.kg, reps: s.reps });
      }
  return [...by].map(([name, days]) => {
    const sorted = [...days].sort(([a], [b]) => a.localeCompare(b));
    const [bestDay, best] = sorted.reduce((m, d) => (d[1].e1rm > m[1].e1rm ? d : m));
    return { name, sessions: sorted.length, points: sorted.map(([day, x]) => ({ day, v: x.e1rm })), best: { ...best, day: bestDay }, first: sorted[0][1].e1rm };
  }).sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name));
}

/** kg lifted per week (Monday start), the last `weeks` weeks up to `today`, oldest first; empty weeks are 0. */
export function weeklyVolume(logs: Log[], today: string, weeks = 12) {
  const monday = (iso: string) => {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  };
  const end = monday(today);
  const starts = Array.from({ length: weeks }, (_, i) => new Date(Date.parse(`${end}T00:00:00Z`) - (weeks - 1 - i) * 7 * 864e5).toISOString().slice(0, 10));
  const sum = new Map(starts.map((w) => [w, 0]));
  for (const l of logs) {
    const w = monday(l.day);
    if (sum.has(w)) sum.set(w, sum.get(w)! + volume(l));
  }
  return starts.map((w) => ({ week: w, v: Math.round(sum.get(w)!) }));
}
