const REP = "2.4s";
/* one rep: set up at the floor (0–22%), brace, pull (to 48%), lock out and squeeze (to 64%), lower (to 86%), reset */
const KT = "0;0.22;0.48;0.64;0.86;1";
const EASE = "0.45 0 0.3 1;0.45 0 0.3 1;0.45 0 0.3 1;0.45 0 0.3 1;0.45 0 0.3 1";
/*
 * The pump builds over a set of SET reps instead of resetting each rep: every lockout pumps the muscles a bit bigger and
 * they stay a little fuller between reps (0 → 40%, then 25 → 60%, 45 → 80%, 60 → 100%), then deflate while the last rep
 * comes down and the set starts again. Same rep phases as the lift, so it always peaks right at lockout.
 */
const SET = 4;
const REST = [0, 0.25, 0.45, 0.6, 0]; // fullness between reps (the last is the reset)
const PEAK = [0.4, 0.6, 0.8, 1];
const PHASES = [0, 0.22, 0.48, 0.64, 0.86];
const SET_KT = [...Array.from({ length: SET }, (_, k) => PHASES.map((t) => (k + t) / SET)).flat(), 1].map((t) => +t.toFixed(4)).join(";");
const SET_EASE = Array.from({ length: SET * PHASES.length }, () => "0.45 0 0.3 1").join(";");
/** Fullness (0–1) at each key time of the set: rest, brace, pull up to the peak, hold, lower to the next rest. */
const FULLNESS = [...Array.from({ length: SET }, (_, k) => [REST[k], REST[k], PEAK[k], PEAK[k], (PEAK[k] + REST[k + 1]) / 2]).flat(), REST[SET]];
/** A value growing with the pump: `at(f)` turns fullness into the attribute's value. */
function Grow({ on, attr, at }: { on: boolean; attr: string; at: (f: number) => string | number }) {
  return on ? <animate attributeName={attr} values={FULLNESS.map(at).join(";")} keyTimes={SET_KT} calcMode="spline" keySplines={SET_EASE} dur={`${2.4 * SET}s`} repeatCount="indefinite" /> : null;
}
const lerp = (a: number, b: number) => (f: number) => +(a + (b - a) * f).toFixed(2);
/** The traps: a hump over the shoulders that rises as they pump. */
const traps = (f: number) => {
  const w = 86 - 3 * f, h = 54 - 12 * f;
  return `M${w} ${60 + f} Q100 ${h} ${200 - w} ${60 + f} Q100 ${57 - f} ${w} ${60 + f} Z`;
};

/** SMIL animation on one attribute, on the shared rep timeline (only when the loader moves). */
function Anim({ on, attr, values }: { on: boolean; attr: string; values: string }) {
  return on ? <animate attributeName={attr} values={values} keyTimes={KT} calcMode="spline" keySplines={EASE} dur={REP} repeatCount="indefinite" /> : null;
}

/** The lifter, front on. `moving` false = a still frame at lockout (reduced motion). */
function Lifter({ moving }: { moving: boolean }) {
  const skin = "#f4f2ee";
  // the upper body (head, shoulders, arms, the bar in his hands) drops 26 for the floor pull; the legs bend under it
  const drop = "0 26;0 24;0 0;0 0;0 26;0 26";
  const legs = (side: 1 | -1) => {
    const hx = 100 + side * 9; // hip
    const ax = 100 + side * 13; // ankle, planted
    const top = `M${hx} 98 L${hx + side * 1} 124 L${ax} 150`;
    const bottom = `M${hx} 124 L${hx + side * 17} 133 L${ax} 150`;
    return { d: moving ? bottom : top, values: [bottom, bottom, top, top, bottom, bottom].join(";") };
  };
  const L = legs(-1), R = legs(1);
  return (
    <svg viewBox="0 0 200 160" className="w-60 overflow-visible" aria-hidden="true">
      <rect x="10" y="150" width="180" height="4" rx="2" fill="#2a2a2a" />
      <ellipse cx="100" cy="151" rx="70" ry="3" fill="rgb(227 20 28 / 0.3)" />
      {/* legs: shorts + thighs/shins bend as he drops */}
      {[L, R].map((leg, i) => (
        <path key={i} d={leg.d} fill="none" stroke={skin} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round">
          <Anim on={moving} attr="d" values={leg.values} />
        </path>
      ))}
      <g transform={moving ? "translate(0 26)" : undefined}>
        {moving && <animateTransform attributeName="transform" type="translate" values={drop} keyTimes={KT} calcMode="spline" keySplines={EASE} dur={REP} repeatCount="indefinite" />}
        {/* shorts */}
        <path d="M88 92 h24 v10 h-24 z" fill="#e3141c" />
        {/* torso, traps that bulge on the squeeze */}
        <path d="M86 60 Q100 54 114 60 L111 94 H89 Z" fill={skin} />
        <path d={traps(moving ? 0 : 1)} fill={skin}>
          <Grow on={moving} attr="d" at={traps} />
        </path>
        {/* head + red headband */}
        <circle cx="100" cy="45" r="9" fill={skin} />
        <rect x="90.5" y="40" width="19" height="4" rx="2" fill="#e3141c" />
        {/* sweat at lockout */}
        {moving && (
          <circle cx="110" cy="44" r="1.6" fill="#7cc4ff">
            <animate attributeName="opacity" values="0;0;0;1;0;0" keyTimes={KT} dur={REP} repeatCount="indefinite" />
            <animate attributeName="cy" values="44;44;44;46;52;52" keyTimes={KT} dur={REP} repeatCount="indefinite" />
          </circle>
        )}
        {/* arms hang straight to the bar; delts and arms get bigger with every rep of the set */}
        {[-1, 1].map((side) => (
          <g key={side}>
            <circle cx={100 + side * 15} cy="62" r={moving ? 6.5 : 10} fill={skin}>
              <Grow on={moving} attr="r" at={lerp(6.5, 10.5)} />
            </circle>
            <line x1={100 + side * 16} y1="64" x2={100 + side * 17} y2="102" stroke={skin} strokeLinecap="round" strokeWidth={moving ? 7 : 12}>
              <Grow on={moving} attr="stroke-width" at={lerp(7, 12.5)} />
            </line>
            <ellipse cx={100 + side * 16.5} cy="78" rx={moving ? 4 : 8} ry="8" fill={skin}>
              <Grow on={moving} attr="rx" at={lerp(4, 8.5)} />
              <Grow on={moving} attr="ry" at={lerp(8, 10)} />
            </ellipse>
            {/* pump lines: faint on the first rep, blazing by the last */}
            {moving && (
              <g stroke="#e3141c" strokeWidth="1.6" strokeLinecap="round" opacity="0">
                <Grow on attr="opacity" at={(f) => +Math.max(0, (f - 0.3) / 0.7).toFixed(2)} />
                <line x1={100 + side * 27} y1="70" x2={100 + side * 32} y2="67" />
                <line x1={100 + side * 28} y1="78" x2={100 + side * 34} y2="78" />
                <line x1={100 + side * 27} y1="86" x2={100 + side * 32} y2="89" />
              </g>
            )}
          </g>
        ))}
        {/* the bar: sleeve to sleeve, knurled grip, big red plates and collars on both ends */}
        <rect x="18" y="100" width="164" height="4" rx="2" fill="#cfcfcf" />
        <rect x="82" y="100" width="36" height="4" fill="url(#lf-knurl)" />
        <defs>
          <pattern id="lf-knurl" width="3" height="4" patternUnits="userSpaceOnUse"><rect width="1.2" height="4" fill="#8a8a8a" /></pattern>
        </defs>
        {[-1, 1].map((side) => (
          <g key={side}>
            <rect x={side < 0 ? 26 : 162} y="80" width="12" height="44" rx="3" fill="#e3141c" />
            <rect x={side < 0 ? 39 : 156} y="87" width="5" height="30" rx="2" fill="#1f1f1f" stroke="#3a3a3a" />
            <rect x={side < 0 ? 45 : 152} y="97" width="3" height="10" rx="1" fill="#bdbdbd" />
          </g>
        ))}
        {/* hands on the bar */}
        <circle cx="83" cy="102" r="4" fill={skin} />
        <circle cx="117" cy="102" r="4" fill={skin} />
      </g>
    </svg>
  );
}

/**
 * Full-page loading screen: a lifter, front on, pulls deadlift reps — bar and plates up from the floor to lockout —
 * and the pump builds rep by rep: arms, delts and traps a little bigger at every lockout, full by the fourth rep, then
 * the set starts again. Gym lines rotate underneath. A still, fully pumped lockout with reduced motion.
 */
export function GymLoader({ compact = false }: { compact?: boolean }) {
  return (
    <div role="status" aria-label="Loading" className={`loader-fade flex flex-col items-center justify-center gap-5 ${compact ? "min-h-[50dvh]" : "min-h-dvh"}`}>
      <span className="motion-reduce:hidden"><Lifter moving /></span>
      <span className="hidden motion-reduce:block"><Lifter moving={false} /></span>
      <p className="h-6 overflow-hidden font-label text-sm font-bold tracking-[0.24em] text-ash uppercase">
        <span className="loader-quips flex flex-col items-center">
          {["Setting up", "Chalking up", "Brace", "Pull", "Feel the pump", "Setting up"].map((q, i) => (
            <span key={i} className="flex h-6 items-center">{q}…</span>
          ))}
        </span>
      </p>
    </div>
  );
}

/** Placeholder blocks for data that's on its way, inside an already-drawn page (the admin shell). */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-steel/70 ${className}`} />;
}

/** A desk page while its data loads: title, a row of stat tiles, then a list panel. */
export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="loader-fade flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-11 w-36" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-3 rounded-lg border border-line bg-carbon p-5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-24" />
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-line bg-carbon">
        <div className="border-b border-line p-5"><Skeleton className="h-5 w-40" /></div>
        <ul className="divide-y divide-line">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <li key={i} className="flex items-center gap-4 px-5 py-4">
              <Skeleton className="size-12 shrink-0 rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-3 w-3/5" />
              </div>
              <Skeleton className="h-7 w-20 rounded-full max-sm:hidden" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
