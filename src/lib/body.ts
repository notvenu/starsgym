// Body weight and measurements. Pure, shared by the page, the action, insights and the check.

export const BODY_FIELDS = [
  { key: "weight_kg", label: "Weight", unit: "kg", min: 20, max: 400 },
  { key: "body_fat", label: "Body fat", unit: "%", min: 2, max: 70 },
  { key: "chest_cm", label: "Chest", unit: "cm", min: 10, max: 300 },
  { key: "waist_cm", label: "Waist", unit: "cm", min: 10, max: 300 },
  { key: "hips_cm", label: "Hips", unit: "cm", min: 10, max: 300 },
  { key: "arm_cm", label: "Arm", unit: "cm", min: 10, max: 300 },
  { key: "thigh_cm", label: "Thigh", unit: "cm", min: 10, max: 300 },
] as const;
export type BodyKey = (typeof BODY_FIELDS)[number]["key"];
export type BodyLog = { id?: string; day: string } & { [K in BodyKey]: number | null };

/** From the form: a date, and at least one number, each inside its field's range (the database checks the same). */
export function cleanBody(get: (k: string) => unknown, today: string): Omit<BodyLog, "id"> | { error: string } {
  const day = String(get("day") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(day))) return { error: "Pick a date." };
  if (day > today) return { error: "That date hasn't happened yet." };
  const row = { day } as Omit<BodyLog, "id">;
  for (const f of BODY_FIELDS) {
    const raw = String(get(f.key) ?? "").trim();
    if (!raw) {
      row[f.key] = null;
      continue;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < f.min || n > f.max) return { error: `${f.label} should be between ${f.min} and ${f.max} ${f.unit}.` };
    row[f.key] = Math.round(n * 10) / 10;
  }
  if (BODY_FIELDS.every((f) => row[f.key] === null)) return { error: "Enter at least one measurement." };
  return row;
}

/** One field over time, oldest first, days without it left out. `logs`: any order. */
export const bodySeries = (logs: BodyLog[], key: BodyKey) =>
  logs.filter((l) => l[key] != null).sort((a, b) => a.day.localeCompare(b.day)).map((l) => ({ day: l.day, v: Number(l[key]) }));
