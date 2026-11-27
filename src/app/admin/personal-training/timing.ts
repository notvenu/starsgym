// Pure helpers shared by the page (server) and its client pop-up.
export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** Monday first, the way a gym week reads. */
export const WEEK = [1, 2, 3, 4, 5, 6, 0];

export type Details = { goal: string; days: number[]; time: string; minutes: number | null };
export const NO_DETAILS: Details = { goal: "", days: [], time: "", minutes: null };

/** "06:30" → "6:30 AM" */
export const clock = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

/** "Mon · Wed · Fri · 6:30 AM · 60 min", or "" when no timing is set. */
export const timingText = (d: Details) =>
  [WEEK.filter((n) => d.days.includes(n)).map((n) => DAY_NAMES[n]).join(" · "), d.time && clock(d.time), d.minutes && `${d.minutes} min`].filter(Boolean).join(" · ");
