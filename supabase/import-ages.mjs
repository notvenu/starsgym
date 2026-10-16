// Backfills profiles.age (0013) from a GymPro Excel export, matching members by phone.
//   1. Save the sheet's Phone and Age columns as CSV with a "phone,age" header.
//   2. Dry run: node --env-file=.env.local supabase/import-ages.mjs <ages.csv>
//   3. Write:   node --env-file=.env.local supabase/import-ages.mjs <ages.csv> --go
// Only fills members who have no age yet, so ages typed at the desk are never overwritten.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const GO = process.argv.includes("--go");
const ages = new Map(
  readFileSync(process.argv[2], "utf8").split(/\r?\n/).slice(1)
    .map((l) => l.split(","))
    .map(([phone, age]) => [String(phone).replace(/\D/g, "").slice(-10), Math.round(Number(age))])
    .filter(([phone, age]) => phone.length === 10 && age >= 1 && age <= 120),
);
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const { data, error } = await db.from("profiles").select("id,phone,age").not("phone", "is", null).limit(10000);
if (error) throw new Error(/age/.test(error.message) ? "Run supabase/migrations/0013_member_age.sql first." : error.message);

const todo = data.filter((p) => p.age == null && ages.has(p.phone.replace(/\D/g, "").slice(-10)));
const found = new Set(data.map((p) => p.phone.replace(/\D/g, "").slice(-10)));
console.log(`${ages.size} ages in the sheet · ${todo.length} members to fill · ${[...ages.keys()].filter((p) => !found.has(p)).length} phones not found`);
if (!GO) {
  console.log("Dry run. Add --go to write.");
  process.exit(0);
}
let n = 0;
for (const p of todo) {
  const { error } = await db.from("profiles").update({ age: ages.get(p.phone.replace(/\D/g, "").slice(-10)) }).eq("id", p.id);
  if (error) console.log(`  ✗ ${p.phone}: ${error.message}`);
  else n++;
}
console.log(`✓ set the age of ${n} members`);
