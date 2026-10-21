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
  upi_id?: string | null; // this branch's UPI ID for desk QR codes (0022); none = NEXT_PUBLIC_UPI_ID
};

/** The UPI ID payments for this branch go to: its own, or the gym-wide one. */
export const branchUpi = (b?: { upi_id?: string | null } | null) => b?.upi_id?.trim() || process.env.NEXT_PUBLIC_UPI_ID || "";
/** Who an order is paid to: a PT order's trainer when they've set a UPI ID, else the branch (then the gym-wide one). */
export const orderUpi = (b?: { upi_id?: string | null } | null, trainer?: { upi_id?: string | null } | null) => trainer?.upi_id?.trim() || branchUpi(b);
export const UPI_ID = /^[a-z0-9._-]{2,256}@[a-z][a-z0-9.-]{1,63}$/;

export type Spot = { lat: number; lng: number; accuracy: number };

/** Browser only: this phone's location for a check-in, or the message to show when it can't be had. */
export function locate(): Promise<Spot | { error: string }> {
  return new Promise((done) => {
    if (!navigator.geolocation) return done({ error: "Your browser can't share location." });
    navigator.geolocation.getCurrentPosition(
      (p) => done({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) => done({ error: e.code === e.PERMISSION_DENIED ? "Allow location access to check in — you need to be at the gym." : "Couldn't get your location — step near a window or turn on GPS, then try again." }),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  });
}

/** Server: a check-in needs to come from inside the branch's circle whenever the branch has coordinates. */
export function atBranch(b: Pick<Branch, "lat" | "lng" | "radius_m"> | null, spot?: Partial<Spot> | null): string | null {
  if (b?.lat == null || b.lng == null) return null;
  if (!Number.isFinite(spot?.lat) || !Number.isFinite(spot?.lng)) return "Allow location access to check in — you need to be at the gym.";
  const at = withinBranch(b, spot!.lat!, spot!.lng!, Number(spot!.accuracy) || 0);
  return at.ok ? null : `You seem to be ${at.dist} m away from the branch — check in when you're there.`;
}

/** Metres between two points (haversine). */
export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const rad = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

/**
 * Inside the branch's check-in circle? Phones indoors often report a fix tens of metres off (and say so in `accuracy`),
 * so the reported error counts in the member's favour — capped at the radius, so a city-wide guess never passes.
 */
export function withinBranch(b: Pick<Branch, "lat" | "lng" | "radius_m">, lat: number, lng: number, accuracy = 0) {
  if (b.lat == null || b.lng == null) return { ok: true, dist: 0 };
  const radius = b.radius_m || 150;
  const dist = distanceM(b.lat, b.lng, lat, lng);
  return { ok: dist <= radius + Math.min(Math.max(accuracy, 0), radius), dist: Math.round(dist) };
}

export type Gender = "female" | "male" | "other";
export const GENDERS: [Gender, string][] = [["female", "Female"], ["male", "Male"], ["other", "Other"]];
export type Session = "morning" | "evening" | "ladies";

export type Track = "strength" | "strength_cardio" | "couples" | "personal_training" | "trial" | "day_pass";

export type Plan = { id: string; track: Track; duration_days: number; price_paise: number; active: boolean };

export type Holiday = { id: string; day: string; branch_id: string | null; note: string };

export type Offer = {
  id: string;
  title: string;
  description: string;
  percent_off: number; // the biggest discount it gives (what "up to" shows)
  percent_by_days: Record<string, number> | null; // per plan length, e.g. {"30":10,"90":15,"180":20,"365":25}; null = percent_off on every plan (0019)
  tracks: Track[] | null;
  starts_on: string;
  ends_on: string;
  active: boolean;
};

/** Mirrors best_offer() in SQL — display only; the database prices the order. */
/** The % an offer takes off a plan `days` long (10% monthly, 25% yearly…); 0 if it doesn't cover that length.
 *  Without `days` it's the biggest it gives — for "up to 25% off". The database prices orders the same way (0019). */
export const offerPercent = (o: Offer, days?: number) =>
  o.percent_by_days && days !== undefined ? (o.percent_by_days[String(days)] ?? 0) : o.percent_off;

/** The best running offer for a track (and plan length, when given). */
export function bestOffer(offers: Offer[], track: Track, days?: number, today = gymDate()) {
  return offers
    .filter((o) => o.active && o.starts_on <= today && o.ends_on >= today && (!o.tracks || o.tracks.includes(track)) && offerPercent(o, days) > 0)
    .sort((a, b) => offerPercent(b, days) - offerPercent(a, days))[0];
}

export const discounted = (paise: number, offer?: Offer, days?: number) =>
  offer ? Math.round((paise * (100 - offerPercent(offer, days))) / 100) : paise;

/**
 * How much a longer plan saves against paying monthly for the same stretch (offers applied to both).
 * null for monthly plans, one-day passes, or when there's no saving.
 */
export function savings(plans: Plan[], offers: Offer[], plan: Plan) {
  const months = Math.round(plan.duration_days / 30); // 365 days → 12
  const monthly = plans.find((p) => p.track === plan.track && p.duration_days === 30 && p.active);
  if (months <= 1 || !monthly) return null;
  const offer = bestOffer(offers, plan.track, plan.duration_days);
  const price = discounted(plan.price_paise, offer, plan.duration_days);
  const payingMonthly = discounted(monthly.price_paise, bestOffer(offers, plan.track, 30), 30) * months;
  const save = payingMonthly - price;
  if (save <= 0) return null;
  return { perMonth: Math.round(price / months), payingMonthly, save, pct: Math.round((save / payingMonthly) * 100) };
}

/** Tracks that are memberships (and so carry the one-time admission fee on the first one). */
export const MEMBERSHIP: Track[] = ["strength", "strength_cardio", "couples", "personal_training"];

export const TRACKS: Record<Track, string> = {
  strength: "Strength",
  strength_cardio: "Strength + Cardio",
  couples: "Couples",
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

/** A trainer's own PT fee (set per month on the Team page) for a plan length: monthly × months, 365 days = 12. */
export const trainerFee = (monthlyPaise: number, days: number) => monthlyPaise * Math.max(1, Math.round(days / 30));

export const DAY_NAMES =["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function planName(p: Pick<Plan, "track" | "duration_days">) {
  const d = DURATIONS.find((x) => x.days === p.duration_days);
  return d ? `${TRACKS[p.track]} · ${d.label}` : TRACKS[p.track];
}

export const inr = (paise: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);

const METHOD: Record<string, string> = { razorpay: "Online", upi_qr: "UPI", cash: "Cash" };
/** How a plan was paid: "Cash", "UPI", or for a split desk payment "UPI ₹1,000 + Cash ₹350". */
export const payMethod = (p: { method: string; amount_paise: number; cash_paise?: number | null }) =>
  p.cash_paise ? `${METHOD[p.method] ?? p.method} ${inr(p.amount_paise - p.cash_paise)} + Cash ${inr(p.cash_paise)}` : (METHOD[p.method] ?? p.method);

export const hhmm = (t: string) => t.slice(0, 5);

/** What the customer saved on the plan itself: its list price minus what they were charged for it (admission is
 *  separate). Counts any discount — a running offer or a price negotiated at the desk. 0 when there was none. */
export const discountOf = (s: { list_price_paise: number | null; amount_paise: number; admission_paise?: number | null }) =>
  Math.max(0, (s.list_price_paise ?? 0) - (s.amount_paise - (s.admission_paise ?? 0)));

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

/** Gym-local date n days from now (negative = ago). */
export const gymDateIn = (days: number) => gymDate(new Date(Date.now() + days * 864e5));

/** The last n gym-local dates, oldest first; the last one is today. */
export const recentGymDates = (n: number, now = Date.now()) =>
  Array.from({ length: n }, (_, i) => gymDate(new Date(now - (n - 1 - i) * 864e5)));

/** Every date of a "YYYY-MM" month, oldest first, stopping at today. */
export const monthDates = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const today = gymDate();
  return Array.from({ length: last }, (_, i) => `${ym}-${String(i + 1).padStart(2, "0")}`).filter((d) => d <= today);
};

/** "YYYY-MM" n months after (negative = before) the given one. */
export const shiftMonth = (ym: string, n: number) => {
  const d = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};

type Hours = Pick<Branch, "id" | "morning_open" | "morning_close" | "evening_open" | "evening_close" | "closed_days"> &
  Partial<Pick<Branch, "ladies_morning_open" | "ladies_morning_close" | "ladies_evening_open" | "ladies_evening_close" | "grace_minutes">>;

/** Open sessions as ["HH:MM", "HH:MM"] pairs: morning, then evening if set. */
export const sessions = (b: Hours) =>
  [[b.morning_open, b.morning_close], ...(b.evening_open && b.evening_close ? [[b.evening_open, b.evening_close]] : [])].map(
    ([a, c]) => [hhmm(a), hhmm(c)] as const,
  );

export const hoursLabel = (b: Hours) => sessions(b).map(([a, c]) => `${a}–${c}`).join(" · ");

/**
 * The gym's hours across every branch, for the homepage: each session from its earliest opening to its latest closing
 * (morning, then evening), and the days at least one branch is open ("Mon–Sat", "Every day", "Closed Sun, Wed").
 */
export function gymHours(branches: Hours[]) {
  const span = (i: number) => {
    const s = branches.map((b) => sessions(b)[i]).filter((x) => !!x);
    return s.length ? `${s.map(([o]) => o).sort()[0]}–${s.map(([, c]) => c).sort().at(-1)}` : null;
  };
  const windows = [span(0), span(1)].filter((w): w is string => !!w);
  const closed = [0, 1, 2, 3, 4, 5, 6].filter((d) => branches.length > 0 && branches.every((b) => b.closed_days.includes(d)));
  const days = !closed.length ? "Every day" : closed.length === 1 && closed[0] === 0 ? "Mon–Sat" : `Closed ${closed.map((d) => DAY_NAMES[d]).join(", ")}`;
  return { windows, days };
}

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

/** Holidays for a branch from today through Sunday — the "this week" heads-up shown at check-in. */
export function weekHolidays(holidays: Holiday[], branchId: string, now = new Date()) {
  const today = gymDate(now);
  const sunday = gymDate(new Date(now.getTime() + ((7 - gymClock(now).dow) % 7) * 864e5));
  return holidays
    .filter((h) => h.day >= today && h.day <= sunday && (!h.branch_id || h.branch_id === branchId))
    .sort((a, b) => a.day.localeCompare(b.day));
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

/** Years old: from the date of birth, else the age on file (GymPro imports, desk entry). */
export const ageOf = (m: { date_of_birth: string | null; age: number | null }) =>
  m.date_of_birth ? Math.floor((Date.parse(gymDate()) - Date.parse(m.date_of_birth)) / (365.25 * 864e5)) : m.age;

export type MemberDetails = { gender: Gender; phone: string; date_of_birth: string | null; emergency_contact: string | null };

/** Phone, date of birth and emergency contact (desk entry and sign-up). */
export function readContactDetails(form: FormData): { error: string } | { details: Omit<MemberDetails, "gender"> } {
  const phone = String(form.get("phone") ?? "").trim();
  if (phone.replace(/\D/g, "").length < 10) return { error: "Enter a 10-digit phone number." };
  const rest = readPersonalDetails(form);
  return "error" in rest ? rest : { details: { phone, ...rest.details } };
}

/** Date of birth and emergency contact — what members edit themselves any time (phone and email go through the desk). */
export function readPersonalDetails(form: FormData): { error: string } | { details: Pick<MemberDetails, "date_of_birth" | "emergency_contact"> } {
  const get = (k: string) => String(form.get(k) ?? "").trim();
  const dob = get("date_of_birth");
  if (dob && (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || dob < "1900-01-01" || dob > gymDate())) return { error: "Check the date of birth." };
  const emergency = get("emergency_contact").slice(0, 120);
  return { details: { date_of_birth: dob || null, emergency_contact: emergency || null } };
}

/** Validates the member-details fields (sign-up, setup, desk entry). Gender decides ladies'-hours access. */
export function readMemberDetails(form: FormData): { error: string } | { details: MemberDetails } {
  const gender = String(form.get("gender") ?? "").trim() as Gender;
  if (!GENDERS.some(([g]) => g === gender)) return { error: "Please choose a gender — it decides access to ladies' hours." };
  const contact = readContactDetails(form);
  return "error" in contact ? contact : { details: { gender, ...contact.details } };
}

/** UPI deep link; the QR at the desk encodes this. */
export function upiLink(amountPaise: number, ref: string, upiId = process.env.NEXT_PUBLIC_UPI_ID ?? "") {
  const q = new URLSearchParams({
    pa: upiId,
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
  branch_id: string | null; // trainers: their branch, null = both (0014)
  profile_id: string | null; // trainers who also have desk access (0014)
  pt_fee_paise?: number | null; // trainers: their own PT fee per month, set by the owner; null = the standard PT price
  upi_id?: string | null; // trainers: PT orders they're picked for are paid here; null = the branch's UPI
  url: string | null;
  sort: number;
  active: boolean;
};

/** Where a trainer coaches, for their card — only worth saying when there's more than one branch. */
export const coachesAt = (branches: { id: string; name: string }[], id: string | null) =>
  branches.length > 1 ? branches.find((b) => b.id === id)?.name ?? "Both branches" : undefined;

/** A same-site path to go to after sign-in, or the fallback. Rejects "//x" and "/\x" (browsers read both as another site). */
export const safeNext = (v: unknown, fallback = "/dashboard") =>
  typeof v === "string" && /^\/(?![\\/])[^\s\\]*$/.test(v) ? v : fallback;

export type Settings = {
  instagram_url: string | null;
  facebook_url: string | null;
  youtube_url: string | null;
  whatsapp: string | null;
  phone: string | null;
  email: string | null;
  branch_access?: "any" | "home"; // "home" = members check in only at their home branch
  admission_fee_paise?: number; // one-time, added to a member's first membership
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

/** Rows → CSV text. Quotes every cell, and defuses cells Excel would run as a formula (=, +, -, @). */
export const toCsv = (rows: (string | number | null | undefined)[][]) =>
  rows.map((r) => r.map((v) => {
    const t = String(v ?? "");
    return `"${(/^[=+\-@\t\r]/.test(t) ? `'${t}` : t).replace(/"/g, '""')}"`;
  }).join(",")).join("\r\n");

/** Hidden sign-in email for phone-only accounts (members imported from GymPro had no email). Members never see it or
 *  type it: they sign in with their phone, and the server swaps in this address. ".invalid" can never receive mail. */
export const LOGIN_EMAIL_DOMAIN = "members.stars-gym.invalid";
export const loginEmail = (userId: string) => `${userId}@${LOGIN_EMAIL_DOMAIN}`;

/** A phone number's last 10 digits — how phone sign-in matches "+91 98765-43210" to "9876543210". */
export const phoneKey = (phone: string | null | undefined) => (phone ?? "").replace(/\D/g, "").slice(-10);

/**
 * The starting password the gym hands out: first 4 letters of the name + last 4 digits of the phone, lowercase, skipping
 * initials ("B. Bunny", 9392705139 → "bunn5139"; "Sk. Sami" → "sami"). Guessable by anyone who knows both, so members
 * are asked to change it. null when there aren't enough letters or digits for a 6+ character password.
 */
export function starterPassword(name: string | null | undefined, phone: string | null | undefined) {
  const letters = (s: string) => s.replace(/[^a-z]/gi, "").slice(0, 4).toLowerCase();
  // initials: 1–3 letters before a dot ("B.", "Sk.", "S.Jhansi"), or a lone letter ("Karthik B")
  const noInitials = letters((name ?? "").replace(/\b[a-z]{1,3}\./gi, " ").replace(/\b[a-z]\b/gi, " "));
  const word = noInitials.length >= 2 ? noInitials : letters(name ?? ""); // a name that's only initials keeps them
  const digits = (phone ?? "").replace(/\D/g, "");
  return word.length >= 2 && digits.length >= 10 ? word + digits.slice(-4) : null;
}

const words = (s: string | null | undefined) =>
  (s ?? "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/** Edit distance, giving up past `cap` (all we need is "one or two typos"). */
function typos(a: string, b: string, cap: number) {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (Math.min(...row) > cap) return cap + 1;
    prev = row;
  }
  return prev[b.length];
}

/**
 * Fuzzy people search: how well a query fits someone (lower = better), or null for no match. Every word of the query
 * must fit some word of their name or email: start of a word (0), inside one (1), a typo or two (2–3), or its letters in
 * order within one word (4) — so "rahul kmr", "rahl" and "kumar r" all find Rahul Kumar. 3+ digits match phone numbers.
 */
export function fuzzyScore(query: string, name: string | null, email?: string | null, phone?: string | null): number | null {
  const digits = query.replace(/\D/g, "");
  if (digits.length >= 3 && digits.length >= query.replace(/\s/g, "").length - 1) {
    return (phone ?? "").replace(/\D/g, "").includes(digits) ? 0 : null;
  }
  const hay = [...words(name), ...words(email?.split("@")[0]), ...(email ? [email.toLowerCase()] : [])];
  let total = 0;
  for (const t of words(query)) {
    let best = Infinity;
    for (const w of hay) {
      const cap = t.length >= 7 ? 2 : t.length >= 4 ? 1 : 0;
      const s = w.startsWith(t) ? 0
        : w.includes(t) ? 1
        : cap && typos(t, w.slice(0, t.length), cap) <= cap ? 2 // typo in what they've typed so far
        : cap && typos(t, w, cap) <= cap ? 3
        : t.length >= 3 && [...t].every(((i) => (c: string) => (i = w.indexOf(c, i) + 1) > 0)(0)) ? 4 // letters in order
        : Infinity;
      best = Math.min(best, s);
      if (best === 0) break;
    }
    if (best === Infinity) return null;
    total += best;
  }
  return total;
}

/** Plan lengths an offer can price separately: the membership lengths, plus one-day passes (trial / day pass). */
export const OFFER_LENGTHS: [number, string][] = [...DURATIONS.map((d) => [d.days, d.label] as [number, string]), [1, "Day pass / trial"]];

/** An offer's discount in words: "25% off", or per length "10% Monthly · 15% Quarterly · 25% Yearly". */
export function offerLabel(o: Offer) {
  if (!o.percent_by_days) return `${o.percent_off}% off`;
  return OFFER_LENGTHS.filter(([d]) => o.percent_by_days![String(d)]).map(([d, label]) => `${o.percent_by_days![String(d)]}% ${label}`).join(" · ");
}
