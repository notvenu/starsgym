// Shared types and pure helpers (safe for client and server).

export const GYM_TZ = "Asia/Kolkata";

export type Branch = {
  id: string;
  name: string;
  address: string;
  maps_url: string | null;
  image_url: string | null;
  google_place_id: string | null;
  lat: number | null;
  lng: number | null;
  radius_m: number;
  require_location: boolean;
  morning_open: string; // "05:00:00"
  morning_close: string;
  evening_open: string | null;
  evening_close: string | null;
  closed_days: number[];
  ladies_morning_open: string | null; // women-only windows; women may also use general hours
  ladies_morning_close: string | null;
  ladies_evening_open: string | null;
  ladies_evening_close: string | null;
  grace_minutes: number; // check-in stays open this long after each closing time
  active: boolean;
};

export type Gender = "female" | "male" | "other";
export const GENDERS: [Gender, string][] = [["female", "Female"], ["male", "Male"], ["other", "Other"]];
export type Session = "morning" | "evening" | "ladies";

export type Track = "strength" | "strength_cardio" | "personal_training" | "trial" | "day_pass";

export type Plan = { id: string; track: Track; duration_days: number; price_paise: number; active: boolean };

export type Holiday = { id: string; day: string; branch_id: string | null; note: string };

export type Offer = {
  id: string;
  title: string;
  description: string;
  percent_off: number;
  tracks: Track[] | null;
  starts_on: string;
  ends_on: string;
  active: boolean;
};

/** Mirrors best_offer() in SQL — display only; the database prices the order. */
export function bestOffer(offers: Offer[], track: Track, today = gymDate()) {
  return offers
    .filter((o) => o.active && o.starts_on <= today && o.ends_on >= today && (!o.tracks || o.tracks.includes(track)))
    .sort((a, b) => b.percent_off - a.percent_off)[0];
}

export const discounted = (paise: number, offer?: Offer) =>
  offer ? Math.round((paise * (100 - offer.percent_off)) / 100) : paise;

export const TRACKS: Record<Track, string> = {
  strength: "Strength",
  strength_cardio: "Strength + Cardio",
  personal_training: "Personal Training",
  trial: "Trial Day",
  day_pass: "Day Pass",
};

export const DURATIONS = [
  { days: 30, label: "Monthly", per: "month" },
  { days: 90, label: "Quarterly", per: "3 months" },
  { days: 180, label: "Half-yearly", per: "6 months" },
  { days: 365, label: "Yearly", per: "year" },
] as const;

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function planName(p: Pick<Plan, "track" | "duration_days">) {
  const d = DURATIONS.find((x) => x.days === p.duration_days);
  return d ? `${TRACKS[p.track]} · ${d.label}` : TRACKS[p.track];
}

export const inr = (paise: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);

export const hhmm = (t: string) => t.slice(0, 5);

/** "2026-10-25" → "Sat, 25 Oct" */
export const prettyDay = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

/** Gym-local weekday (0 = Sun) and "HH:MM", regardless of the viewer's timezone. */
export function gymClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: GYM_TZ, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return { dow: DAY_NAMES.indexOf(get("weekday")), time: `${get("hour")}:${get("minute")}` };
}

/** Gym-local calendar date, "YYYY-MM-DD" (matches checkins.day). */
export const gymDate = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: GYM_TZ }).format(d);

/** The last n gym-local dates, oldest first; the last one is today. */
export const recentGymDates = (n: number, now = Date.now()) =>
  Array.from({ length: n }, (_, i) => gymDate(new Date(now - (n - 1 - i) * 864e5)));

type Hours = Pick<Branch, "id" | "morning_open" | "morning_close" | "evening_open" | "evening_close" | "closed_days"> &
  Partial<Pick<Branch, "ladies_morning_open" | "ladies_morning_close" | "ladies_evening_open" | "ladies_evening_close" | "grace_minutes">>;

/** Open sessions as ["HH:MM", "HH:MM"] pairs: morning, then evening if set. */
export const sessions = (b: Hours) =>
  [[b.morning_open, b.morning_close], ...(b.evening_open && b.evening_close ? [[b.evening_open, b.evening_close]] : [])].map(
    ([a, c]) => [hhmm(a), hhmm(c)] as const,
  );

export const hoursLabel = (b: Hours) => sessions(b).map(([a, c]) => `${a}–${c}`).join(" · ");

/** Women-only windows as ["HH:MM", "HH:MM"] pairs. */
export const ladiesSessions = (b: Hours) =>
  [[b.ladies_morning_open, b.ladies_morning_close], [b.ladies_evening_open, b.ladies_evening_close]]
    .filter((w): w is [string, string] => !!w[0] && !!w[1])
    .map(([a, c]) => [hhmm(a), hhmm(c)] as const);

export const ladiesLabel = (b: Hours) => ladiesSessions(b).map(([a, c]) => `${a}–${c}`).join(" · ");

const plusMinutes = (t: string, m: number) => {
  const total = (+t.slice(0, 2) * 60 + +t.slice(3, 5) + m) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

/** Mirrors in_window() in SQL: t in [a, c + grace], wrapping past midnight when needed. "HH:MM" strings. */
export function inWindow(t: string, a: string, c: string, grace = 0) {
  const end = plusMinutes(c, grace);
  return c < a || end < c ? t >= a || t <= end : t >= a && t <= end;
}

/** Mirrors branch_session_now() in SQL — display only; the database decides on check-in. */
export function sessionNow(b: Hours, female: boolean, now = new Date()): Session | "ladies_only" | null {
  const { time } = gymClock(now);
  const g = b.grace_minutes ?? 0;
  const ladies = ladiesSessions(b);
  if (ladies.some(([a, c]) => inWindow(time, a, c))) return female ? "ladies" : "ladies_only";
  const [morning, evening] = sessions(b);
  if (inWindow(time, ...morning, g)) return "morning";
  if (evening && inWindow(time, ...evening, g)) return "evening";
  if (female && ladies.some(([a, c]) => inWindow(time, a, c, g))) return "ladies";
  return null;
}

export const holidayFor = (holidays: Holiday[], branchId: string, day: string) =>
  holidays.find((h) => h.day === day && (!h.branch_id || h.branch_id === branchId));

/** Display-only. The database re-checks hours and holidays on every check-in. */
export function openState(b: Hours, holidays: Holiday[] = [], now = new Date()) {
  const { dow, time } = gymClock(now);
  const holiday = holidayFor(holidays, b.id, gymDate(now));
  if (holiday) return { open: false, label: `Closed today${holiday.note ? ` · ${holiday.note}` : ""}` };
  if (b.closed_days.includes(dow)) return { open: false, label: "Closed today" };
  const ladies = ladiesSessions(b).find(([a, c]) => inWindow(time, a, c));
  if (ladies) return { open: true, ladies: true, label: `ladies only till ${ladies[1]}` };
  const s = sessions(b);
  const current = s.find(([a, c]) => inWindow(time, a, c));
  if (current) return { open: true, label: `closes ${current[1]}` };
  const next = [...s, ...ladiesSessions(b)].filter(([a]) => time < a).sort(([a], [c]) => a.localeCompare(c))[0];
  return { open: false, label: next ? `opens ${next[0]}` : "closed for today" };
}

export type MemberDetails = { gender: Gender; phone: string; date_of_birth: string | null; emergency_contact: string | null };

/** Validates the member-details fields (sign-up, profile, desk entry). Gender decides ladies'-hours access. */
export function readMemberDetails(form: FormData): { error: string } | { details: MemberDetails } {
  const get = (k: string) => String(form.get(k) ?? "").trim();
  const gender = get("gender") as Gender;
  if (!GENDERS.some(([g]) => g === gender)) return { error: "Please choose a gender — it decides access to ladies' hours." };
  const phone = get("phone");
  if (phone.replace(/\D/g, "").length < 10) return { error: "Enter a 10-digit phone number." };
  const dob = get("date_of_birth");
  if (dob && (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || dob < "1900-01-01" || dob > gymDate())) return { error: "Check the date of birth." };
  const emergency = get("emergency_contact").slice(0, 120);
  return { details: { gender, phone, date_of_birth: dob || null, emergency_contact: emergency || null } };
}

/** UPI deep link; the QR at the desk encodes this. */
export function upiLink(amountPaise: number, ref: string) {
  const q = new URLSearchParams({
    pa: process.env.NEXT_PUBLIC_UPI_ID ?? "",
    pn: "Stars Gym",
    am: (amountPaise / 100).toFixed(2),
    cu: "INR",
    tn: `Stars Gym ${ref}`,
  });
  return `upi://pay?${q}`;
}

export const showcaseUrl = (path: string) =>
  path.startsWith("https://") ? path : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/showcase/${path}`;

export type ItemKind = "trainer" | "client" | "gallery" | "reel";

export type SiteItem = {
  id: string;
  kind: ItemKind;
  title: string;
  subtitle: string;
  body: string;
  image_path: string | null; // client stories: the "before" photo
  after_image_path: string | null;
  duration: string;
  trainer_id: string | null;
  url: string | null;
  sort: number;
  active: boolean;
};

export type Settings = {
  instagram_url: string | null;
  facebook_url: string | null;
  youtube_url: string | null;
  whatsapp: string | null;
  phone: string | null;
  email: string | null;
  branch_access?: "any" | "home"; // "home" = members check in only at their home branch
};

/** Item photos are either uploads in the "site" bucket or full URLs. */
export const itemImage = (path: string | null) =>
  !path ? null : path.startsWith("https://") ? path : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/site/${path}`;

/** instagram.com/reel/<code> (or /p/<code>) → its embeddable player URL. */
export function reelEmbed(url: string | null) {
  const m = url?.match(/instagram\.com\/(?:[\w.]+\/)?(reel|reels|p|tv)\/([\w-]+)/);
  return m ? `https://www.instagram.com/${m[1] === "reels" ? "reel" : m[1]}/${m[2]}/embed/` : null;
}

/** YouTube links → privacy-friendly embed; direct .mp4/.webm stays a <video> source. */
export function videoEmbed(url: string | null) {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return { type: "youtube" as const, src: `https://www.youtube-nocookie.com/embed/${yt[1]}` };
  if (/\.(mp4|webm)(\?|$)/i.test(url)) return { type: "file" as const, src: url };
  return null;
}

export const waLink = (digits: string, text = "Hi Stars Gym!") => `https://wa.me/${digits.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
