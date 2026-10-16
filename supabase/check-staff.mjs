// Checks 0011_staff_roles.sql in an in-memory Postgres: staff see and change only their branch, owner settings stay
// owner-only, only the owner changes roles. 0001–0007 aren't in the repo, so this stands up a minimal stand-in of the
// live schema (role check, old is_admin(), RLS on, broad desk policies like the originals) and applies 0011 on top.
// Run: node supabase/check-staff.mjs
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

await pg.exec(`
  create role anon; create role authenticated;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create table branches (id uuid primary key, name text);
  create table profiles (id uuid primary key, full_name text, email text, home_branch_id uuid references branches,
    role text not null default 'member' check (role in ('member', 'admin')));
  create table subscriptions (id uuid primary key default gen_random_uuid(), user_id uuid references profiles, branch_id uuid, status text);
  create table checkins (id serial, user_id uuid references profiles, branch_id uuid);
  create table plans (id serial primary key, price_paise int);
  create table offers (id serial); create table branch_door_keys (branch_id uuid); create table holidays (id serial);
  create table site_items (id serial); create table site_settings (id int);
  create function is_admin() returns boolean language sql stable security definer set search_path = public as
    $$ select exists (select 1 from profiles where id = auth.uid() and role = 'admin') $$;
  do $$ declare t text; begin
    foreach t in array array['branches','profiles','subscriptions','checkins','plans','offers','branch_door_keys','holidays','site_items','site_settings'] loop
      execute format('alter table %I enable row level security', t);
      execute format('grant select, insert, update, delete on %I to authenticated', t);
      execute format('create policy desk_all on %I for all to authenticated using (is_admin()) with check (is_admin())', t);
    end loop;
  end $$;
  create policy own_profile on profiles for all to authenticated using (id = auth.uid()) with check (id = auth.uid());
  create policy public_read on plans for select using (true);
  grant usage on schema auth to authenticated;
  grant usage on all sequences in schema public to authenticated;
`);
await pg.exec(readFileSync(new URL("./migrations/0011_staff_roles.sql", import.meta.url), "utf8"));

const [M, T] = ["00000000-0000-0000-0000-0000000000b1", "00000000-0000-0000-0000-0000000000b2"]; // Mandadam, Tadepalli
const OWNER = "00000000-0000-0000-0000-00000000000a", STAFF = "00000000-0000-0000-0000-00000000000b";
const MM = "00000000-0000-0000-0000-0000000000c1", TM = "00000000-0000-0000-0000-0000000000c2", NEW = "00000000-0000-0000-0000-0000000000c3";
await q(`insert into branches values ($1, 'Mandadam'), ($2, 'Tadepalli')`, [M, T]);
await q(`insert into profiles (id, full_name, home_branch_id, role) values
  ($1, 'Owner', null, 'admin'), ($2, 'Desk', $6, 'staff'), ($3, 'Mandadam member', $6, 'member'),
  ($4, 'Tadepalli member', $7, 'member'), ($5, 'New sign-up', null, 'member')`, [OWNER, STAFF, MM, TM, NEW, M, T]);
await q(`insert into subscriptions (user_id, branch_id, status) values ($1, $3, 'pending'), ($2, $4, 'pending')`, [MM, TM, M, T]);
await q(`insert into checkins (user_id, branch_id) values ($1, $3), ($2, $4)`, [MM, TM, M, T]);

// staff: their branch (plus unassigned sign-ups), nothing from the other branch
await as(STAFF);
const names = (await q(`select full_name from profiles order by full_name`)).map((r) => r.full_name);
assert.deepEqual(names, ["Desk", "Mandadam member", "New sign-up"], "staff see their branch + unassigned + themselves");
assert.equal((await q(`select * from subscriptions`)).length, 1, "staff see only their branch's plans");
assert.equal((await q(`select * from checkins`)).length, 1, "staff see only their branch's check-ins");
assert.equal((await q(`update profiles set full_name = 'x' where id = $1 returning id`, [TM])).length, 0, "staff can't edit the other branch");
assert.equal((await q(`update subscriptions set status = 'cancelled' where user_id = $1 returning id`, [TM])).length, 0, "nor its orders");
assert.equal((await q(`update profiles set full_name = 'Mandadam member' where id = $1 returning id`, [MM])).length, 1, "staff edit their branch");
await fails(`update profiles set home_branch_id = $1 where id = $2`, [T, MM], /row-level security/); // can't hand members to another branch
await as(null);
await q(`insert into plans (price_paise) values (149900)`);
await as(STAFF);
assert.equal((await q(`update plans set price_paise = 1 returning id`)).length, 0, "staff can't change prices");
assert.equal((await q(`select * from plans`)).length, 1, "…but still read them");
await fails(`insert into offers default values`, [], /row-level security/);
await fails(`update profiles set role = 'admin' where id = $1`, [STAFF], /Only the owner/);
await fails(`update profiles set role = 'staff' where id = $1`, [MM], /Only the owner/);

// a member can't promote themselves either
await as(MM);
await fails(`update profiles set role = 'admin' where id = $1`, [MM], /Only the owner/);

// the owner: everything, everywhere
await as(OWNER);
assert.equal((await q(`select * from profiles`)).length, 5, "owner sees every branch");
assert.equal((await q(`select * from subscriptions`)).length, 2);
await q(`insert into offers default values`);
await q(`update profiles set role = 'staff', home_branch_id = $1 where id = $2`, [T, TM]);
assert.equal((await q(`select role from profiles where id = $1`, [TM]))[0].role, "staff", "owner promotes");
await fails(`update profiles set role = 'boss' where id = $1`, [TM], /check/);


// 0012: staff covering both branches
await as(null);
await pg.exec(readFileSync(new URL("./migrations/0012_staff_all_branches.sql", import.meta.url), "utf8"));
await as(STAFF);
await fails(`update profiles set all_branches = true where id = $1`, [STAFF], /Only the owner/); // can't widen their own reach
await fails(`update profiles set home_branch_id = $1 where id = $2`, [T, STAFF], /Only the owner/); // nor hop branches
assert.equal((await q(`select * from subscriptions`)).length, 1, "single-branch staff still see one branch");
await as(OWNER);
await q(`update profiles set all_branches = true where id = $1`, [STAFF]);
await as(STAFF);
assert.equal((await q(`select * from subscriptions`)).length, 2, "both-branch staff see every branch's plans");
assert.equal((await q(`select * from checkins`)).length, 2, "…and check-ins");
assert.equal((await q(`select * from profiles where id = $1`, [TM])).length, 1, "…and members");
assert.equal((await q(`update plans set price_paise = 1 returning id`)).length, 0, "…but still can't change prices");
await fails(`update profiles set role = 'admin' where id = $1`, [STAFF], /Only the owner/);
await as(MM);
await q(`update profiles set home_branch_id = $1 where id = $2`, [T, MM]); // members still pick their own home branch

await as(null);
console.log("✓ staff roles: branch scoping, both-branch staff, owner-only settings and role changes all hold");
