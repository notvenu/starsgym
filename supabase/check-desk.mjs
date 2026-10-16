// Split payments, the CSV export and migration 0016 — on minimal stand-in tables, since 0001–0007 aren't in the repo.
// Run: npm run check:desk
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { payMethod, toCsv } from "../src/lib/gym.ts";

assert.equal(toCsv([["a", 'say "hi"', null], [1, "=HYPERLINK(x)", "+91 98"]]), `"a","say ""hi""",""\r\n"1","'=HYPERLINK(x)","'+91 98"`, "CSV quotes cells and defuses formulas");
assert.equal(payMethod({ method: "cash", amount_paise: 100000 }), "Cash");
assert.equal(payMethod({ method: "upi_qr", amount_paise: 135000, cash_paise: 35000 }).replace(/\s/g, " "), "UPI ₹1,000 + Cash ₹350");

const pg = new PGlite();
await pg.exec(`
  create role authenticated;
  create table branches (id uuid primary key default gen_random_uuid(), name text, active bool default true);
  create table plans (id uuid primary key default gen_random_uuid(), track text, duration_days int);
  create table profiles (id uuid primary key default gen_random_uuid(), full_name text, phone text, gender text, date_of_birth date, age int);
  create table site_items (id uuid primary key default gen_random_uuid(), kind text);
  create table checkins (user_id uuid, branch_id uuid, day date, created_at timestamptz default now());
  create table subscriptions (id uuid primary key default gen_random_uuid(), user_id uuid, plan_id uuid references plans, branch_id uuid,
    status text, method text, amount_paise int, paid_at timestamptz, starts_on date, ends_on date);
`);
await pg.exec(readFileSync(new URL("./migrations/0016_split_pay_pt_trainer.sql", import.meta.url), "utf8"));
await pg.exec(`
  insert into plans (track, duration_days) values ('strength', 30);
  insert into subscriptions (plan_id, status, method, amount_paise, cash_paise, paid_at, starts_on, ends_on)
  select id, 'active', m, a, c, '2026-10-10 10:00+05:30', '2026-10-10', '2026-11-09' from plans,
    (values ('upi_qr', 135000, 35000), ('cash', 150000, null::int), ('upi_qr', 200000, null::int)) v(m, a, c);
`);
const { by_method, revenue } = (await pg.query(`select admin_insights('2026-10-01', '2026-10-31') as r`)).rows[0].r;
assert.equal(revenue, 485000, "revenue counts each sale once");
assert.deepEqual(Object.fromEntries(by_method.map((x) => [x.method, x.v])), { cash: 185000, upi_qr: 300000 }, "split sale's cash goes under cash");
await assert.rejects(pg.query(`update subscriptions set cash_paise = amount_paise + 1 where method = 'cash'`), /check/, "cash part can't exceed the total");
console.log("desk checks passed");
