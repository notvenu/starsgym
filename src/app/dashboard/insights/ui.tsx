"use client";

import { useState } from "react";
import { TrendChart } from "../workouts/charts";

const num = (v: number) => v.toLocaleString("en-IN", { maximumFractionDigits: 1 });

/** Estimated 1RM over time for one lift at a time; their most-done lifts to pick from. */
export function LiftTrend({ lifts }: { lifts: { name: string; points: { day: string; v: number }[] }[] }) {
  const [name, setName] = useState(lifts[0].name);
  const lift = lifts.find((l) => l.name === name) ?? lifts[0];
  const change = lift.points.at(-1)!.v - lift.points[0].v;
  return (
    <div className="card flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="label">Estimated 1RM</p>
          <p className="font-display text-5xl leading-none tabular-nums">{num(lift.points.at(-1)!.v)} <span className="text-2xl text-ash">kg</span></p>
        </div>
        <select className="field w-auto max-w-full" aria-label="Exercise" value={lift.name} onChange={(e) => setName(e.target.value)}>
          {lifts.map((l) => <option key={l.name} value={l.name}>{l.name}</option>)}
        </select>
      </div>
      {lift.points.length > 1 ? (
        <>
          <p className="-mt-2 text-sm text-ash"><b className="text-chalk tabular-nums">{change >= 0 ? "+" : "−"}{num(Math.abs(change))} kg</b> over {lift.points.length} sessions</p>
          <TrendChart points={lift.points} unit="kg" label={`${lift.name} estimated 1RM`} />
        </>
      ) : (
        <p className="text-sm text-ash">One session so far — the trend shows after your next {lift.name.toLowerCase()}.</p>
      )}
    </div>
  );
}
