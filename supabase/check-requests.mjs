// Checks 0015 (profile change requests) on top of 0011/0012 in an in-memory Postgres.
// Run: npm run check:requests
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";

const pg = new PGlite();
const q = async (sql, params) => (await pg.query(sql, params)).rows;
const as = async (uid) => {
  await pg.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false)`);
  if (uid) await pg.exec(`set role authenticated`);
};
const fails = (sql, params, re) => assert.rejects(pg.query(sql, params), (e) => re.test(e.message), `expected ${re}: ${sql}`);
const mig = (f) => readFileSync(new URL(`./migrations/${f}`, import.meta.url), "utf8");

// a minimal stand-in for the live schema (0001–0007 aren't in the repo), like check-staff.mjs
await pg.exec(`
  create role anon; create role authenticated;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create table branches (id uuid primary key, name text);
  create table profiles (id uuid primary key, full_name text, email text, gender text, phone text, home_branch_id uuid references branches,
    photo_path text, photo_changes int not null default 0, role text not null default 'member' check (role in ('member', 'admin')));
  create table subscriptions (id uuid primary key default gen_random_uuid(), user_id uuid, branch_id uuid, status text);
  create table checkins (id serial, user_id uuid, branch_id uuid);
  create table plans (id serial); create table offers (id serial); create table branch_door_keys (branch_id uuid);
  create table holidays (id serial); create table site_items (id serial); create table site_settings (id int);
  create function is_admin() returns boolean language sql stable security definer set search_path = public as
    $$ select exists (select 1 from profiles where id = auth.uid() and role = 'admin') $$;
  alter table profiles enable row level security;
  grant select, update on profiles to authenticated;
  create policy desk_all on profiles for all to authenticated using (is_admin()) with check (is_admin());
  create policy own_profile on profiles for all to authenticated using (id = auth.uid()) with check (id = auth.uid());
  grant usage on schema auth to authenticated;
`);
await pg.exec(mig("0011_staff_roles.sql"));
await pg.exec(mig("0012_staff_all_branches.sql"));
await pg.exec(mig("0015_profile_requests.sql"));

const [M, T] = ["00000000-0000-0000-0000-0000000000b1", "00000000-0000-0000-0000-0000000000b2"];
const OWNER = "00000000-0000-0000-0000-00000000000a", DESK_T = "00000000-0000-0000-0000-00000000000b";
const NEWBIE = "00000000-0000-0000-0000-0000000000c1", SETTLED = "00000000-0000-0000-0000-0000000000c2";
await q(`insert into branches values ($1, 'Mandadam'), ($2, 'Tadepalli')`, [M, T]);
await q(`insert into profiles (id, full_name, role, home_branch_id) values ($1, 'Owner', 'admin', null), ($2, 'Desk T', 'staff', $3)`, [OWNER, DESK_T, T]);
await q(`insert into profiles (id, full_name, gender, home_branch_id, photo_path) values
  ($1, 'New', null, null, null), ($2, 'Asha', 'female', $3, '${"00000000-0000-0000-0000-0000000000c2"}/a.jpg')`, [NEWBIE, SETTLED, M]);

// setting up: name, gender, branch and the first photo are theirs to set
await as(NEWBIE);
await q(`update profiles set full_name = 'Newbie Rao', gender = 'male', home_branch_id = $1 where id = $2`, [M, NEWBIE]);
await q(`select * from set_my_photo($1)`, [`${NEWBIE}/first.jpg`]);
await fails(`select * from set_my_photo($1)`, [`${NEWBIE}/second.jpg`], /request a change/); // one photo, then ask

// set up: those four are locked; contact details aren't
await as(SETTLED);
await fails(`update profiles set full_name = 'Someone Else' where id = $1`, [SETTLED], /Ask the desk/);
await fails(`update profiles set gender = 'male' where id = $1`, [SETTLED], /Ask the desk/);
await fails(`update profiles set home_branch_id = $1 where id = $2`, [T, SETTLED], /Ask the desk/);
await q(`update profiles set phone = '9000000000' where id = $1`, [SETTLED]);

// requests: written by the server; members read only their own, the desk reads what its branch can see
await as(null);
await q(`insert into profile_requests (user_id, full_name) values ($1, 'Asha K')`, [SETTLED]);
await fails(`insert into profile_requests (user_id, full_name) values ($1, 'Again')`, [SETTLED], /duplicate key|unique/); // one open at a time
await as(SETTLED);
assert.equal((await q(`select * from profile_requests`)).length, 1, "member sees their request");
await fails(`insert into profile_requests (user_id, full_name) values ($1, 'x')`, [SETTLED], /permission denied/);
assert.equal((await q(`update profile_requests set status = 'approved' returning id`)).length, 0, "members can't approve their own");
await as(DESK_T);
assert.equal((await q(`select * from profile_requests`)).length, 0, "Tadepalli desk doesn't see a Mandadam member's request");
await as(OWNER);
assert.equal((await q(`update profile_requests set status = 'approved', decided_by = $1, decided_at = now() returning id`, [OWNER])).length, 1, "the owner decides");
await q(`update profiles set full_name = 'Asha K' where id = $1`, [SETTLED]); // the desk applies it

await as(null);
console.log("✓ profile requests: setup is free, then name/gender/branch/photo go through the desk; contact details stay editable");
