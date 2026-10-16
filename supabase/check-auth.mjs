// Starting passwords, phone matching, the shared rate limit and the locked-down door check-in (0017), in an in-memory
// Postgres with stand-ins for the parts of the live schema that aren't in the repo. Run: npm run check:auth
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { phoneKey, safeNext, starterPassword } from "../src/lib/gym.ts";

// ── starting password: first 4 letters of the name (no initials) + last 4 phone digits, lowercase
assert.equal(starterPassword("B. Bunny", "9392705139"), "bunn5139", "initials are skipped");
assert.equal(starterPassword("Sk. Sami", "+91 75699-00667"), "sami0667", "two-letter initials too, and phone formatting doesn't matter");
assert.equal(starterPassword("N. Mohith kumar", "7569166965"), "mohi6965");
assert.equal(starterPassword("S.Jhansi", "9397945807"), "jhan5807", "an initial without a space");
assert.equal(starterPassword("Karthik. B", "9346828998"), "kart8998", "a trailing initial; a full name with a stray dot stays");
assert.equal(starterPassword("Hari chandana", "9347779189"), "hari9189", "no initials, unchanged");
assert.equal(starterPassword("A. K.", "9347779189"), "ak9189", "a name that's only initials keeps them");
assert.equal(starterPassword("Uma", "9063255380"), "uma5380", "short names use what they have");
assert.equal(starterPassword("A", "9063255380"), null, "one letter is too short a password");
assert.equal(starterPassword("Ravi", "12345"), null, "no proper phone, no password");
assert.equal(starterPassword(null, null), null);
assert.equal(phoneKey("+91 98765-43210"), "9876543210");
assert.equal(phoneKey("09876543210"), "9876543210", "a leading 0 still matches");
assert.equal(safeNext("//evil.com"), "/dashboard", "sign-in never redirects off the site");

const pg = new PGlite();
const q = async (sql, params) => (await pg.query(sql, params)).rows;
const role = (r) => pg.exec(`select set_config('request.jwt.claim.role', '${r}', false), set_config('request.jwt.claim.sub', '', false)`);
await pg.exec(`
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
  create type plan_track as enum ('strength');
  create table branches (id uuid primary key default gen_random_uuid(), name text, active bool default true);
  create table branch_door_keys (branch_id uuid references branches, key uuid default gen_random_uuid());
  create table plans (id uuid primary key default gen_random_uuid(), track plan_track, duration_days int);
  create table profiles (id uuid primary key default gen_random_uuid(), full_name text, phone text, photo_path text);
  create table subscriptions (id uuid primary key default gen_random_uuid(), user_id uuid, plan_id uuid, status text, starts_on date, ends_on date);
  create table checkins (user_id uuid, branch_id uuid, day date default current_date, session text default 'morning', created_at timestamptz default now());
  create table enquiries (id serial, name text);
  grant insert on enquiries to anon, authenticated;
  create function gym_today() returns date language sql as $$ select current_date $$;
  create function _check_in(uid uuid, b uuid, lat float8, lng float8, door bool) returns int language sql as
    $$ insert into checkins (user_id, branch_id) values (uid, b); select 1 $$;
`);
await pg.exec(readFileSync(new URL("./migrations/0017_rate_limits_security.sql", import.meta.url), "utf8"));

// ── rate limit: max hits per window, per key, then a fresh window
const hit = async (key, max = 3) => (await q(`select rate_limit_hit($1, $2, 60) as ok`, [key, max]))[0].ok;
assert.deepEqual([await hit("a"), await hit("a"), await hit("a"), await hit("a")], [true, true, true, false], "4th hit in the window is refused");
assert.equal(await hit("b"), true, "keys are counted separately");
await q(`update rate_limits set window_start = now() - interval '2 minutes' where key = 'a'`);
assert.equal(await hit("a"), true, "the window resets");
const grants = await q(`select has_function_privilege('anon', 'rate_limit_hit(text,int,int)', 'execute') a, has_function_privilege('authenticated', 'rate_limit_hit(text,int,int)', 'execute') u`);
assert.deepEqual({ ...grants[0] }, { a: false, u: false }, "visitors can't call the rate limiter (or reset their own counts)");

// ── door check-in by phone: only the server may do it
await pg.exec(`
  insert into branches (name) values ('Main');
  insert into branch_door_keys (branch_id) select id from branches;
  insert into profiles (full_name, phone) values ('Asha Rao', '+91 98765 43210');
`);
const key = (await q(`select key from branch_door_keys`))[0].key;
const door = `select first_name from check_in_at_door($1, $2)`;
await role("anon");
await assert.rejects(pg.query(door, [key, "9876543210"]), /entrance page/, "the public key can't check people in by phone");
await role("authenticated");
await assert.rejects(pg.query(door, [key, "9876543210"]), /entrance page/, "a signed-in member can't check someone else in by phone");
await role("service_role");
assert.equal((await q(door, [key, "9876543210"]))[0].first_name, "Asha", "the site's server can");
const perms = await q(`select has_function_privilege('anon', 'check_in_at_door(uuid,text,text)', 'execute') door,
  has_table_privilege('anon', 'enquiries', 'insert') enq`);
assert.deepEqual({ ...perms[0] }, { door: false, enq: false }, "anon can't call door check-in or post enquiries directly");

console.log("auth checks passed");
