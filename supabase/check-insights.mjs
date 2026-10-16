// Checks admin_insights() from 0014 in an in-memory Postgres with a tiny two-branch gym.
// Run: node supabase/check-insights.mjs
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";

const pg = new PGlite();
const q = async (sql, params) => (await pg.query(sql, params)).rows;

await pg.exec(`
  create role authenticated;
  create table branches (id uuid primary key, name text, active boolean default true);
  create table profiles (id uuid primary key, full_name text, phone text, gender text, date_of_birth date, age smallint);
  create table plans (id serial primary key, track text, duration_days int);
  create table subscriptions (id serial, user_id uuid, plan_id int, branch_id uuid, status text, method text,
    amount_paise int, paid_at timestamptz, starts_on date, ends_on date);
  create table checkins (id serial, user_id uuid, branch_id uuid, day date, created_at timestamptz);
  create table site_items (id uuid primary key default gen_random_uuid(), kind text);
`);
await pg.exec(readFileSync(new URL("./migrations/0014_team_insights.sql", import.meta.url), "utf8"));

const [M, T] = ["00000000-0000-0000-0000-0000000000b1", "00000000-0000-0000-0000-0000000000b2"];
const [A, B, C, D] = ["a", "b", "c", "d"].map((x) => `00000000-0000-0000-0000-0000000000${x}${x}`);
await q(`insert into branches values ($1, 'Mandadam'), ($2, 'Tadepalli')`, [M, T]);
await q(`insert into plans (track, duration_days) values ('strength', 30), ('strength_cardio', 90)`);
await q(`insert into profiles values
  ($1, 'Asha', '9000000001', 'female', '2000-01-01', null),  -- 26, from date of birth
  ($2, 'Bala', '9000000002', 'male', null, 31),               -- age on file
  ($3, 'Chitra', '9000000003', 'female', null, null),         -- expired, renewed
  ($4, 'Dev', '9000000004', 'male', null, 40)                 -- expired, gone`, [A, B, C, D]);
// period: 2026-10-01 → 2026-10-15
await q(`insert into subscriptions (user_id, plan_id, branch_id, status, method, amount_paise, paid_at, starts_on, ends_on) values
  ($1, 1, $5, 'active', 'cash',    149900, '2026-10-02 10:00+05:30', '2026-10-02', '2026-10-31'),  -- Asha: first plan → new member
  ($2, 2, $6, 'active', 'upi_qr',  399900, '2026-10-05 19:00+05:30', '2026-10-05', '2027-01-02'),  -- Bala at Tadepalli
  ($2, 1, $6, 'active', 'cash',    149900, '2026-08-01 10:00+05:30', '2026-08-01', '2026-08-30'),  -- Bala's old plan → not new
  ($3, 1, $5, 'active', 'cash',    149900, '2026-09-05 10:00+05:30', '2026-09-05', '2026-10-04'),  -- Chitra ended in period…
  ($3, 1, $5, 'active', 'upi_qr',  149900, '2026-10-05 09:00+05:30', '2026-10-05', '2026-11-03'),  -- …and renewed
  ($4, 1, $5, 'active', 'cash',    149900, '2026-09-08 10:00+05:30', '2026-09-08', '2026-10-07'),  -- Dev ended, didn't renew
  ($1, 1, $5, 'pending', 'upi_qr', 149900, null, null, null)                                        -- unpaid: ignored`, [A, B, C, D, M, T]);
await q(`insert into checkins (user_id, branch_id, day, created_at) values
  ($1, $4, '2026-10-03', '2026-10-03 06:15+05:30'), ($1, $4, '2026-10-04', '2026-10-04 06:40+05:30'),
  ($2, $5, '2026-10-14', '2026-10-14 18:05+05:30'),
  ($3, $4, '2026-09-20', '2026-09-20 07:00+05:30')`, [A, B, C, M, T]);

const run = async (branch = null) => (await q(`select admin_insights('2026-10-01', '2026-10-15', $1) as j`, [branch]))[0].j;

const all = await run();
assert.equal(all.revenue, 149900 + 399900 + 149900, "revenue: paid plans in the period only");
assert.equal(all.sales, 3);
assert.equal(all.new_members, 1, "only Asha's first-ever plan is new");
assert.equal(all.checkins, 3);
assert.equal(all.visitors, 2);
assert.equal(all.active_members, 3, "Asha, Bala, Chitra hold a plan on the last day");
assert.equal(all.ended, 2, "Chitra and Dev ran out in the period");
assert.equal(all.renewed, 1, "Chitra renewed");
assert.deepEqual(all.heatmap.find((c) => c.h === 6 && c.dow === 6), { dow: 6, h: 6, v: 1 }, "Sat 06:00 in gym time");
assert.deepEqual(all.ages.map((a) => a.k).sort(), ["25–34", "~ Not given"], "Asha 26 + Bala 31 → 25–34, Chitra unknown");
assert.equal(all.ages.find((a) => a.k === "25–34").n, 2);
assert.deepEqual(all.quiet.map((p) => p.name), ["Chitra", "Asha"], "no visit in 10 days: never-seen first, Bala (seen yesterday) isn't");
assert.deepEqual(all.by_branch.map((b) => [b.name, b.revenue, b.checkins]), [["Mandadam", 299800, 2], ["Tadepalli", 399900, 1]]);

const tad = await run(T);
assert.equal(tad.revenue, 399900, "branch filter narrows sales");
assert.equal(tad.checkins, 1);
assert.equal(tad.active_members, 1);
assert.equal(tad.by_branch.length, 2, "comparison still covers every branch");

console.log("✓ admin_insights: totals, new vs returning, renewals, gym-time heatmap, ages, gone-quiet and branch filter hold");
