// Runs the migration in an in-memory Postgres (PGlite) with stubbed Supabase auth/storage,
// then exercises the money and streak rules. Run: npm run check:db
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { inWindow } from "../src/lib/gym.ts"; // the browser-side mirror must agree with SQL

const pg = new PGlite();
const q = async (sql, params) => (await pg.query(sql, params)).rows;
const one = async (sql, params) => (await q(sql, params))[0];
const as = (uid, role = "authenticated") =>
  pg.exec(`select set_config('request.jwt.claim.sub', '${uid ?? ""}', false), set_config('request.jwt.claim.role', '${role}', false)`);
const fails = async (sql, params, pattern) => {
  await assert.rejects(pg.query(sql, params), (e) => pattern.test(e.message), `expected ${pattern}`);
};

// minimal stand-ins for what Supabase provides
await pg.exec(`
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public bool, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
  create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name, '/') $$;
`);
for (const f of ["0001_init.sql", "0002_shifts_holidays_offers_passes.sql", "0003_site_content.sql", "0004_client_transformations.sql", "0005_admin_analytics.sql", "0006_door_checkin.sql", "0007_ladies_hours_sessions.sql"]) {
  await pg.exec(readFileSync(new URL(`./migrations/${f}`, import.meta.url), "utf8"));
}

const U1 = "00000000-0000-0000-0000-000000000001";
const ADMIN = "00000000-0000-0000-0000-0000000000ad";
await q(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'a@x.com', '{"full_name":"Asha"}'), ($2, 'admin@x.com', '{}')`, [U1, ADMIN]);
await q(`update profiles set role = 'admin' where id = $1`, [ADMIN]);
assert.equal((await one(`select full_name, email from profiles where id = $1`, [U1])).full_name, "Asha", "signup trigger creates profile");
await q(`insert into auth.users (id, raw_user_meta_data) values (gen_random_uuid(), '{"full_name":"Meena","gender":"female","date_of_birth":"1995-04-02","emergency_contact":"Ravi 9000000001"}')`);
assert.deepEqual({ ...(await one(`select gender, date_of_birth::text dob, emergency_contact ec from profiles where full_name = 'Meena'`)) }, { gender: "female", dob: "1995-04-02", ec: "Ravi 9000000001" }, "sign-up details land on the profile");
await q(`insert into auth.users (id, raw_user_meta_data) values (gen_random_uuid(), '{"full_name":"Bad","gender":"robot","date_of_birth":"soon"}')`);
assert.deepEqual({ ...(await one(`select gender, date_of_birth from profiles where full_name = 'Bad'`)) }, { gender: null, date_of_birth: null }, "junk sign-up details are dropped, not fatal");
assert.equal((await one(`select count(*)::int n from plans`)).n, 14, "seeded 12 memberships + trial + day pass");

// ── streak: closed days are skipped, an open missed day breaks it, today not yet checked in keeps it alive
const [b1, b2] = (await q(`select id from branches order by name`)).map((r) => r.id);
const dow = (await one(`select extract(dow from gym_today() - 2)::int d`)).d;
await q(`update branches set closed_days = array[$1::int]`, [dow]); // both branches closed on today-2
await q(`insert into checkins (user_id, branch_id, day) values ($1, $2, gym_today() - 1), ($1, $2, gym_today() - 3), ($1, $2, gym_today() - 5)`, [U1, b1]);
assert.equal((await one(`select current_streak($1) s`, [U1])).s, 2, "yesterday + closed day skipped + today-3, stops at missed today-4");
await q(`update branches set closed_days = '{}' where id = $1`, [b2]); // now one branch is open on that weekday
assert.equal((await one(`select current_streak($1) s`, [U1])).s, 1, "day counts as open if any branch is open");
await q(`insert into holidays (day, note) values (gym_today() - 2, 'Festival')`);
assert.equal((await one(`select current_streak($1) s`, [U1])).s, 2, "a gym-wide holiday never breaks a streak");
await q(`delete from holidays`);

// ── purchase: price comes from the plan, members can't activate their own orders
await q(`update plans set price_paise = 150000 where track = 'strength' and duration_days = 30`);
const monthly = (await one(`select id from plans where track = 'strength' and duration_days = 30`)).id;

// ── offers: best running offer for the plan's track applies; others don't
await q(`insert into offers (title, percent_off, tracks, starts_on, ends_on) values
  ('Cardio only', 50, '{strength_cardio}', gym_today(), gym_today() + 5),
  ('Expired', 60, null, gym_today() - 9, gym_today() - 1)`);
await q(`insert into offers (title, percent_off, tracks, ends_on) values ('Diwali', 20, '{strength,personal_training}', gym_today() + 5), ('Small', 10, null, gym_today() + 5)`);
await as(U1);
const offered = await one(`select * from create_pending_subscription($1, $2, 'cash')`, [monthly, b1]);
assert.equal(offered.list_price_paise, 150000);
assert.equal(offered.amount_paise, 120000, "20% Diwali beats 10%, cardio-only and expired offers ignored");
await q(`delete from subscriptions where id = $1`, [offered.id]);
await q(`delete from offers`);

const sub1 = await one(`select * from create_pending_subscription($1, $2, 'upi_qr')`, [monthly, b1]);
assert.equal(sub1.amount_paise, 150000);
assert.equal(sub1.status, "pending");
await fails(`select activate_subscription($1)`, [sub1.id], /Not allowed/);
await fails(`select check_in($1)`, [b1], /No active plan/);

// ── admin marks paid; activating twice is a no-op
await as(ADMIN);
const act = await one(`select * from activate_subscription($1)`, [sub1.id]);
assert.equal(act.status, "active");
assert.equal((await one(`select (ends_on - starts_on) d, starts_on = gym_today() t from subscriptions where id = $1`, [sub1.id])).d, 29);
await q(`select activate_subscription($1)`, [sub1.id]);

// ── early renewal (server, verified Razorpay payment) starts the day after the current plan ends
await as(U1);
const sub2 = await one(`select * from create_pending_subscription($1, $2, 'razorpay')`, [monthly, b1]);
await as(null, "service_role");
await q(`select activate_subscription($1, 'pay_123')`, [sub2.id]);
const renewal = await one(`select s2.starts_on = s1.ends_on + 1 ok from subscriptions s1, subscriptions s2 where s1.id = $1 and s2.id = $2`, [sub1.id, sub2.id]);
assert.ok(renewal.ok, "renewal queued after current plan");

// ── check-in: hours, location radius, once per day
// split shift: a morning window that's already over, an evening window covering now
await q(`update branches set morning_open = '00:00', morning_close = '00:00:01', evening_open = null, evening_close = null, closed_days = '{}', lat = 12.9716, lng = 77.5946, radius_m = 150 where id = $1`, [b1]);
await as(U1);
await fails(`select check_in($1, 12.9717, 77.5947)`, [b1], /only open during gym hours/);
await as(null, "service_role");
await q(`update branches set evening_open = '00:00:02', evening_close = '23:59:59' where id = $1`, [b1]);
await q(`update branches set closed_days = '{0,1,2,3,4,5,6}' where id = $1`, [b2]);
await as(U1);
await fails(`select check_in($1)`, [b2], /only open during gym hours/);
await fails(`select check_in($1, 13.0, 77.6)`, [b1], /m away/);
assert.equal((await one(`select check_in($1, 12.9717, 77.5947) s`, [b1])).s, 2, "today + yesterday");
assert.equal((await one(`select check_in($1, 12.9717, 77.5947) s`, [b1])).s, 2, "second check-in same day is ignored");
await q(`update branches set require_location = true where id = $1`, [b1]);
await fails(`select check_in($1)`, [b1], /needs your location/);

// ── entrance QR: the door key replaces the location check; phone or bill REF works without signing in
await as(null, "service_role");
const door = (await one(`select key from branch_door_keys where branch_id = $1`, [b1])).key;
await q(`update profiles set phone = '+91 98765-43210' where id = $1`, [U1]);
await as(null, "anon");
// (PGlite runs as superuser, so check the guards in the catalog rather than by querying as anon)
assert.equal((await one(`select relrowsecurity r from pg_class where relname = 'branch_door_keys'`)).r, true, "door keys behind RLS");
assert.deepEqual((await q(`select policyname from pg_policies where tablename = 'branch_door_keys'`)).map((r) => r.policyname), ["door keys admin"], "only admins read door keys");
assert.equal((await one(`select has_function_privilege('anon', 'public._check_in(uuid,uuid,float8,float8,boolean)', 'execute') x`)).x, false, "internal check-in not callable from the API");
assert.equal((await one(`select has_function_privilege('authenticated', 'public._check_in(uuid,uuid,float8,float8,boolean)', 'execute') x`)).x, false);
await fails(`select * from check_in_at_door(gen_random_uuid(), '9876543210')`, [], /no longer valid/);
await fails(`select * from check_in_at_door($1)`, [door], /Sign in, or enter/);
await fails(`select * from check_in_at_door($1, '12345')`, [door], /10-digit/);
await fails(`select * from check_in_at_door($1, '9000000000')`, [door], /No member with that phone/);
const byPhone = await one(`select * from check_in_at_door($1, '09876543210')`, [door]);
assert.deepEqual(byPhone, { first_name: "Asha", branch: byPhone.branch, streak: 2, already: true }, "phone match ignores formatting; location not needed");
await fails(`select * from check_in_at_door($1, null, 'ZZZZ')`, [door], /8-character REF/);
assert.equal((await one(`select * from check_in_at_door($1, null, $2)`, [door, "ref " + sub1.id.slice(0, 8).toLowerCase()])).first_name, "Asha", "bill REF works");
await as(U1);
assert.equal((await one(`select * from check_in_at_door($1)`, [door])).streak, 2, "signed-in member checks in with one tap");
await as(null, "service_role");
await q(`insert into branches (name) values ('Branch 3')`);
assert.equal((await one(`select count(*)::int n from branch_door_keys k join branches b on b.id = k.branch_id where b.name = 'Branch 3'`)).n, 1, "new branches get a door key");
await q(`delete from branches where name = 'Branch 3'`);
await as(U1);
// ── window maths, including windows that cross midnight
const WINDOWS = [
  ["21:00", "16:30", "22:00", 20, true], ["22:15", "16:30", "22:00", 20, true], ["22:25", "16:30", "22:00", 20, false],
  ["23:50", "22:00", "01:00", 0, true], ["00:30", "22:00", "01:00", 0, true], ["12:00", "22:00", "01:00", 0, false],
  ["00:10", "18:00", "23:55", 20, true], ["06:00", "18:00", "23:55", 20, false], ["10:00", null, null, 20, false],
];
for (const [t, open, close, grace, want] of WINDOWS) {
  assert.equal((await one(`select in_window($1::time, $2::time, $3::time, $4) w`, [t, open, close, grace])).w, want, `${t} in ${open}–${close} +${grace}`);
  if (open) assert.equal(inWindow(t, open, close, grace), want, `TS mirror: ${t} in ${open}–${close} +${grace}`);
}

// ── grace period after closing, ladies' hours, and morning + evening visits on the same day
// windows are set relative to the real clock (and may cross midnight — that's handled)
const at = [b1, 12.9717, 77.5947];
await as(null, "service_role");
await q(`update branches set evening_open = null, evening_close = null, morning_open = (gym_now() - interval '2 hours')::time, morning_close = (gym_now() - interval '10 minutes')::time, grace_minutes = 5 where id = $1`, [b1]);
await as(U1);
await fails(`select check_in($1, $2, $3)`, at, /only open during gym hours/); // closed 10 min ago, 5 min grace
await as(null, "service_role");
await q(`update branches set grace_minutes = 20 where id = $1`, [b1]);
await as(U1);
assert.equal((await one(`select check_in($1, $2, $3) s`, at)).s, 2, "inside the 20-minute grace period");
const sessionsToday = async () => (await q(`select session from checkins where user_id = $1 and day = gym_today() order by session`, [U1])).map((r) => r.session);
assert.deepEqual(await sessionsToday(), ["evening", "morning"], "morning and evening visits on one day are both recorded");
assert.equal((await one(`select current_streak($1) s`, [U1])).s, 2, "two visits in a day still count as one streak day");
await as(null, "service_role");
await q(`update branches set ladies_morning_open = (gym_now() - interval '5 minutes')::time, ladies_morning_close = (gym_now() + interval '30 minutes')::time where id = $1`, [b1]);
await as(U1);
await fails(`select check_in($1, $2, $3)`, at, /ladies' hours/); // no gender on file → treated as not female
await as(null, "service_role");
await q(`update profiles set gender = 'male' where id = $1`, [U1]);
await as(U1);
await fails(`select check_in($1, $2, $3)`, at, /ladies' hours — general hours today/);
await as(null, "service_role");
await q(`update profiles set gender = 'female' where id = $1`, [U1]);
await as(null, "anon");
assert.equal((await one(`select * from check_in_at_door($1, '9876543210')`, [door])).already, false, "door check-in in ladies' hours is a new session");
assert.equal((await one(`select * from check_in_at_door($1, '9876543210')`, [door])).already, true, "same session twice → already");
assert.deepEqual(await sessionsToday(), ["evening", "ladies", "morning"]);
await as(null, "service_role");
await q(`update branches set ladies_morning_open = null, ladies_morning_close = null where id = $1`, [b1]);
await as(U1);

await q(`insert into holidays (day, branch_id, note) values (gym_today(), $1, 'Maintenance')`, [b1]);
await fails(`select check_in($1, 12.9717, 77.5947)`, [b1], /closed today for a holiday/);

// ── staff scan: the pass token resolves to first name + validity
await as(null, "anon");
const pass = await one(`select v.* from subscriptions s, verify_pass(s.pass_token) v where s.id = $1`, [sub1.id]);
assert.equal(pass.first_name, "Asha");
assert.equal(pass.valid_today, true);
assert.equal(pass.checked_in_today, true);
assert.equal((await q(`select * from verify_pass(gen_random_uuid())`)).length, 0, "unknown token → nothing");
await as(U1);

// ── trial only once
const trial = (await one(`select id from plans where track = 'trial'`)).id;
const t1 = await one(`select * from create_pending_subscription($1, $2, 'cash')`, [trial, b1]);
await as(ADMIN);
await q(`select activate_subscription($1)`, [t1.id]);
await as(U1);
await fails(`select create_pending_subscription($1, $2, 'cash')`, [trial, b1], /Trial day already used/);

// ── members can't buy for someone else
await fails(`select create_pending_subscription($1, $2, 'cash', $3)`, [monthly, b1, ADMIN], /Not allowed/);

// ── showcase feed: latest post per member within 7 days, with streak
await q(`insert into showcase_posts (user_id, image_path, created_at) values ($1, 'old.jpg', now() - interval '8 days'), ($1, 'a.jpg', now() - interval '1 day'), ($1, 'b.jpg', now())`, [U1]);
const feed = await q(`select image_path, streak from showcase_feed`);
assert.deepEqual(feed, [{ image_path: "b.jpg", streak: 2 }]);

// ── site content: one settings row, enquiry limits enforced by the table
assert.equal((await one(`select count(*)::int n from site_settings`)).n, 1);
await fails(`insert into site_settings (id) values (2)`, [], /site_settings_id_check|duplicate|violates/);
await fails(`insert into enquiries (name, phone) values ('A', '1')`, [], /enquiries_phone_check/);
await q(`insert into site_items (kind, title, url) values ('reel', 'Deadlift PR', 'https://www.instagram.com/reel/abc/')`);
await fails(`insert into site_items (kind, url) values ('reel', 'http://insecure.example')`, [], /site_items_url_check/);

const coach = await one(`insert into site_items (kind, title) values ('trainer', 'Ravi') returning id`);
await q(`insert into site_items (kind, title, duration, trainer_id, image_path, after_image_path) values ('client', 'Asha', '16 weeks', $1, 'b.jpg', 'a.jpg')`, [coach.id]);
await q(`delete from site_items where id = $1`, [coach.id]);
assert.equal((await one(`select trainer_id from site_items where title = 'Asha'`)).trainer_id, null, "deleting a coach keeps the story");

// ── analytics: members are refused; admins get totals that match the rows
await as(U1);
await fails(`select admin_analytics(gym_today() - 30, gym_today())`, [], /Not allowed/);
await as(ADMIN);
const stats = (await one(`select admin_analytics(gym_today() - 30, gym_today()) a`)).a;
const paidRows = await one(`select count(*)::int n, coalesce(sum(amount_paise), 0)::int v from subscriptions where status = 'active' and paid_at is not null`);
assert.equal(stats.sales, paidRows.n);
assert.equal(stats.revenue, paidRows.v);
assert.equal(stats.revenue_by_day.reduce((t, r) => t + r.v, 0), paidRows.v, "daily revenue adds up");
assert.equal(stats.checkins_by_day.reduce((t, r) => t + r.v, 0), stats.checkins, "daily check-ins add up");
assert.equal(stats.heatmap.reduce((t, r) => t + r.v, 0), stats.checkins, "heatmap adds up");
assert.ok(stats.active_members >= 1);

console.log("✓ database rules hold");
