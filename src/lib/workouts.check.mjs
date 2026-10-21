// npm run check:workouts — progression, cleaning and CSV.
import assert from "node:assert/strict";
import { buildSplit, e1rm, lifts, weeklyVolume, schedule, targetFor, cleanLog, cleanPlan, LEVELS, logFromDay, logsCsv, nextDay, RECOMMENDED, SPLITS, target } from "./workouts.ts";
import { EXERCISES } from "./exercises.ts";
import { bodySeries, cleanBody } from "./body.ts";

const e = { name: "Squat", sets: 3, reps: 5, kg: 60, addKg: 2.5, addReps: 0, every: 7 };
assert.deepEqual(target(e, "2026-01-01", "2026-01-01"), { kg: 60, reps: 5 });
assert.deepEqual(target(e, "2026-01-01", "2026-01-07"), { kg: 60, reps: 5 }); // day 6: not a full week yet
assert.deepEqual(target(e, "2026-01-01", "2026-01-08"), { kg: 62.5, reps: 5 });
assert.deepEqual(target(e, "2026-01-01", "2026-01-29"), { kg: 70, reps: 5 });
assert.deepEqual(target({ ...e, addKg: 0, addReps: 1, every: 3 }, "2026-01-01", "2026-01-10"), { kg: 60, reps: 8 });
assert.deepEqual(target({ ...e, every: 0 }, "2026-01-01", "2027-01-01"), { kg: 60, reps: 5 }); // never
assert.deepEqual(target(e, "2026-02-01", "2026-01-01"), { kg: 60, reps: 5 }); // clock before start
assert.deepEqual(target({ ...e, addKg: 0.1 }, "2026-01-01", "2026-01-22"), { kg: 60.3, reps: 5 }); // no float noise

// every split at every level: survives cleaning, only library exercises, no repeats in a day, more work as the level goes up
const library = new Set(Object.values(EXERCISES).flat());
for (const split of SPLITS) {
  let prev = 0;
  for (const { key } of LEVELS) {
    const s = buildSplit(split.key, key);
    assert.deepEqual(cleanPlan(s), s, `${split.key}/${key}`);
    for (const d of s.days) {
      for (const e of d.exercises) assert.ok(library.has(e.name), `${split.key}/${key}: ${e.name} is not in the library`);
      assert.equal(new Set(d.exercises.map((e) => e.name)).size, d.exercises.length, `${split.key}/${key}/${d.name} repeats an exercise`);
    }
    const sets = s.days[0].exercises.reduce((t, e) => t + e.sets, 0);
    assert.ok(sets > prev, `${split.key}/${key}: not more work than the level below`);
    prev = sets;
  }
}
for (const { key } of LEVELS) assert.ok(SPLITS.some((s) => s.key === RECOMMENDED[key]), key);
const beg = buildSplit("ppl", "beginner").days[0].exercises, pro = buildSplit("ppl", "expert").days[0].exercises;
assert.equal(beg[0].name, "Machine chest press"); // easier variant
assert.equal(pro[0].name, "Bench press");
assert.ok(beg.length === 4 && pro.length === 8);
assert.deepEqual(buildSplit("full", "intermediate").days[0].exercises.find((e) => e.name.startsWith("Plank")), { name: "Plank (seconds)", sets: 3, reps: 30, kg: 0, addKg: 0, addReps: 5, every: 14 }); // timed: +5 s

const ppl = buildSplit("ppl", "intermediate");
const log = logFromDay({ ...ppl, started_on: "2026-01-01" }, ppl.days[0], [], "2026-01-15");

// no weight in the plan: the first logged session sets it, progression counts from that day
const plan = { name: "PPL", started_on: "2026-01-01", days: [{ name: "Push", exercises: [{ name: "Bench press", sets: 3, reps: 5, kg: 0, addKg: 2.5, addReps: 0, every: 7 }] }] };
const bench = plan.days[0].exercises[0];
const session = (day, kg) => ({ day, title: "PPL · Push", note: "", exercises: [{ name: "Bench press", sets: [{ kg, reps: 5 }, { kg: kg - 10, reps: 5 }] }] });
assert.deepEqual(targetFor(bench, plan, [], "2026-01-10"), { kg: 0, reps: 5 }); // never logged: they fill it in
assert.deepEqual(targetFor(bench, plan, [session("2026-01-03", 60)], "2026-01-09"), { kg: 60, reps: 5 }); // heaviest set, 6 days on
assert.deepEqual(targetFor(bench, plan, [session("2026-01-10", 70), session("2026-01-03", 60)], "2026-01-17"), { kg: 65, reps: 5 }); // anchored on the first
assert.deepEqual(targetFor(bench, plan, [{ ...session("2026-01-03", 60), title: "Workout" }], "2026-01-17"), { kg: 0, reps: 5 }); // other workouts don't count
assert.deepEqual(targetFor({ ...bench, kg: 50 }, plan, [session("2026-01-03", 60)], "2026-01-08"), { kg: 52.5, reps: 5 }); // a weight they set wins
assert.equal(log.exercises[0].sets.length, 4);

assert.deepEqual(cleanPlan({ name: "", days: [] }), { error: "Give the plan a name." });
assert.deepEqual(cleanPlan({ name: "X", days: [{ name: "A", exercises: [{ name: "  " }] }] }), { error: "Add at least one day with an exercise." });
const p = cleanPlan({ name: "X", days: [{ name: "A", exercises: [{ name: "Curl", sets: 99, reps: -3, kg: "abc", every: 7 }] }] });
assert.ok(!("error" in p) && p.days[0].exercises[0].sets === 20 && p.days[0].exercises[0].reps === 1 && p.days[0].exercises[0].kg === 0);

assert.deepEqual(cleanLog({ day: "nope", exercises: [] }), { error: "Pick a date." });
assert.deepEqual(cleanLog({ day: "2026-01-01", exercises: [{ name: "Curl", sets: [{ kg: 10, reps: 0 }] }] }), { error: "Log at least one set." });

assert.equal(
  logsCsv([{ day: "2026-01-01", title: "Push, heavy", note: 'felt "good"', exercises: [{ name: "Bench", sets: [{ kg: 60, reps: 5 }, { kg: 60, reps: 4 }] }] }]),
  'date,workout,exercise,set,kg,reps,note\n2026-01-01,"Push, heavy",Bench,1,60,5,"felt ""good"""\n2026-01-01,"Push, heavy",Bench,2,60,4,',
);
const done = (day) => ({ day: "2026-01-01", title: `${ppl.name} · ${day}`, note: "", exercises: [] });
assert.equal(nextDay(ppl, []), 0);
assert.equal(nextDay(ppl, [done("Push")]), 1);
assert.equal(nextDay(ppl, [done("Legs"), done("Pull")]), 0); // wraps; newest first
assert.equal(nextDay(ppl, [{ ...done("Push"), title: "Workout" }]), 0);

// missed days: ask whether to continue with the missed one or jump to today's
const at = (day, d) => ({ day: `2026-01-${day}`, title: `${ppl.name} · ${d}`, note: "", exercises: [] });
assert.deepEqual(schedule(ppl, [], "2026-01-10"), { next: 0, today: 0, missed: 0, ask: false }); // first ever
assert.deepEqual(schedule(ppl, [at("09", "Push")], "2026-01-10"), { next: 1, today: 1, missed: 0, ask: false }); // trained yesterday
assert.deepEqual(schedule(ppl, [at("08", "Push")], "2026-01-10"), { next: 1, today: 2, missed: 1, ask: true }); // missed one: Pull or Legs?
assert.deepEqual(schedule(ppl, [at("07", "Push")], "2026-01-10"), { next: 1, today: 0, missed: 2, ask: true }); // wraps round
assert.deepEqual(schedule(ppl, [at("06", "Push")], "2026-01-10"), { next: 1, today: 1, missed: 3, ask: false }); // a full cycle: same day

// strength
assert.equal(e1rm(100, 1), 100);
assert.equal(e1rm(100, 5), 116.7);
assert.equal(e1rm(100, 15), 0); // too many reps to estimate
assert.equal(e1rm(0, 10), 0); // bodyweight
const w = (day, sets) => ({ day, title: "W", note: "", exercises: [{ name: "Bench press", sets }, { name: "Pull-up", sets: [{ kg: 0, reps: 8 }] }] });
const ls = lifts([w("2026-01-08", [{ kg: 60, reps: 5 }, { kg: 65, reps: 3 }]), w("2026-01-01", [{ kg: 55, reps: 5 }])]);
assert.equal(ls.length, 1); // pull-ups have no weight
assert.deepEqual(ls[0].points, [{ day: "2026-01-01", v: 64.2 }, { day: "2026-01-08", v: 71.5 }]);
assert.deepEqual(ls[0].best, { e1rm: 71.5, kg: 65, reps: 3, day: "2026-01-08" });
assert.equal(ls[0].first, 64.2);
const vol = weeklyVolume([w("2026-01-14", [{ kg: 50, reps: 10 }]), w("2026-01-12", [{ kg: 10, reps: 10 }]), w("2025-01-01", [{ kg: 99, reps: 1 }])], "2026-01-15", 3);
assert.deepEqual(vol, [{ week: "2025-12-29", v: 0 }, { week: "2026-01-05", v: 0 }, { week: "2026-01-12", v: 600 }]); // Wed 14th + Mon 12th; last year ignored

// body
const form = (o) => (k) => o[k];
assert.deepEqual(cleanBody(form({ day: "2026-01-02", weight_kg: "72.35", waist_cm: "" }), "2026-01-10"),
  { day: "2026-01-02", weight_kg: 72.4, body_fat: null, chest_cm: null, waist_cm: null, hips_cm: null, arm_cm: null, thigh_cm: null });
assert.deepEqual(cleanBody(form({ day: "2026-01-02" }), "2026-01-10"), { error: "Enter at least one measurement." });
assert.deepEqual(cleanBody(form({ day: "2026-01-02", weight_kg: "5" }), "2026-01-10"), { error: "Weight should be between 20 and 400 kg." });
assert.deepEqual(cleanBody(form({ day: "2026-02-02", weight_kg: "70" }), "2026-01-10"), { error: "That date hasn't happened yet." });
assert.deepEqual(bodySeries([{ day: "2026-01-05", weight_kg: 71 }, { day: "2026-01-01", weight_kg: 72 }, { day: "2026-01-03", weight_kg: null }], "weight_kg"), [{ day: "2026-01-01", v: 72 }, { day: "2026-01-05", v: 71 }]);

console.log("workouts ok");
