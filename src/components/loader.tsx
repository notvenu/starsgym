/** Full-height loading screen: plates slide onto a barbell, then it presses, while gym lines rotate underneath. */
export function GymLoader({ compact = false }: { compact?: boolean }) {
  return (
    <div role="status" aria-label="Loading" className={`loader-fade flex flex-col items-center justify-center gap-6 ${compact ? "min-h-[50dvh]" : "min-h-dvh"}`}>
      <svg viewBox="0 0 180 90" className="w-48 overflow-visible" aria-hidden="true">
        <ellipse className="loader-shadow" cx="90" cy="84" rx="58" ry="3.5" fill="rgb(227 20 28 / 0.35)" />
        <g className="loader-press">
          <rect x="8" y="41" width="164" height="5" rx="2.5" fill="#d4d4d4" />
          {/* knurling */}
          <rect x="62" y="41" width="56" height="5" fill="url(#knurl)" />
          <defs>
            <pattern id="knurl" width="3" height="5" patternUnits="userSpaceOnUse"><rect width="1.2" height="5" fill="#9a9a9a" /></pattern>
          </defs>
          {/* left plates, then right: big red, small black */}
          <g className="loader-plate-l">
            <rect x="26" y="14" width="12" height="60" rx="2.5" fill="#e3141c" />
            <rect x="40" y="24" width="8" height="40" rx="2" fill="#1f1f1f" stroke="#3a3a3a" />
            <rect x="50" y="37" width="5" height="13" rx="1" fill="#bdbdbd" />
          </g>
          <g className="loader-plate-r">
            <rect x="142" y="14" width="12" height="60" rx="2.5" fill="#e3141c" />
            <rect x="132" y="24" width="8" height="40" rx="2" fill="#1f1f1f" stroke="#3a3a3a" />
            <rect x="125" y="37" width="5" height="13" rx="1" fill="#bdbdbd" />
          </g>
        </g>
      </svg>
      <p className="h-6 overflow-hidden font-label text-sm font-bold tracking-[0.24em] text-ash uppercase">
        <span className="loader-quips flex flex-col items-center">
          {["Loading the plates", "Chalking up", "Tightening the collars", "One more rep", "Spotting you", "Loading the plates"].map((q, i) => (
            <span key={i} className="flex h-6 items-center">{q}…</span>
          ))}
        </span>
      </p>
    </div>
  );
}
