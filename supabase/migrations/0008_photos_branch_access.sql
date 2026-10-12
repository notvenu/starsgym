-- Member photos (shown to staff when a pass is scanned) and the branch-access rule for check-ins.
-- Run after 0001–0007.

-- ───────── member photos ─────────
-- Private bucket: photos are personal data. The app reads and writes it server-side with the service key
-- and only ever hands out short-lived signed URLs, so no storage policies are needed.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('faces', 'faces', false, 2097152, '{image/jpeg,image/png,image/webp}')
on conflict (id) do nothing;

alter table public.profiles
  add column photo_path text,
  -- times the member replaced their own photo; the first photo is free, then two changes
  add column photo_changes int not null default 0;
-- photo_path / photo_changes are deliberately NOT granted for update: members go through set_my_photo()

-- A member sets their own photo. Returns the replaced path (to delete) and changes left.
create or replace function public.set_my_photo(p_path text)
returns table (old_path text, changes_left int)
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  p profiles;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if p_path is null or p_path not like uid::text || '/%' then raise exception 'Invalid photo'; end if;
  select * into p from profiles where id = uid for update;
  if p.photo_path is not null and p.photo_changes >= 2 then
    raise exception 'You''ve used both photo changes — ask the desk to update it';
  end if;
  update profiles
     set photo_path = p_path,
         photo_changes = photo_changes + case when p.photo_path is null then 0 else 1 end
   where id = uid
  returning p.photo_path, 2 - photo_changes into old_path, changes_left;
  return next;
end $$;
grant execute on function public.set_my_photo(text) to authenticated;

-- Staff set or replace any member's photo (at the desk). Doesn't use up the member's changes.
create or replace function public.admin_set_photo(p_user uuid, p_path text) returns text
language plpgsql security definer set search_path = public as $$
declare old text;
begin
  if not is_admin() then raise exception 'Staff only'; end if;
  if p_path is null or p_path not like p_user::text || '/%' then raise exception 'Invalid photo'; end if;
  select photo_path into old from profiles where id = p_user for update;
  if not found then raise exception 'Member not found'; end if;
  update profiles set photo_path = p_path where id = p_user;
  return old;
end $$;
grant execute on function public.admin_set_photo(uuid, text) to authenticated;

-- the staff scan page shows the member's photo
drop function if exists public.verify_pass(uuid);
create function public.verify_pass(p_token uuid)
returns table (first_name text, track public.plan_track, duration_days int, starts_on date, ends_on date, status text,
               valid_today boolean, checked_in_today boolean, photo_path text, home_branch text)
language sql stable security definer set search_path = public as $$
  select split_part(pr.full_name, ' ', 1), p.track, p.duration_days, s.starts_on, s.ends_on, s.status,
         s.status = 'active' and gym_today() between s.starts_on and s.ends_on,
         exists (select 1 from checkins c where c.user_id = s.user_id and c.day = gym_today()),
         pr.photo_path,
         (select b.name from branches b where b.id = pr.home_branch_id)
  from subscriptions s join plans p on p.id = s.plan_id join profiles pr on pr.id = s.user_id
  where s.pass_token = p_token
$$;
grant execute on function public.verify_pass(uuid) to anon, authenticated;

-- ───────── branch access ─────────
-- 'any'  = members can check in at every branch
-- 'home' = only at their home branch (set at sign-up / by the desk; their first check-in sets it if blank)
alter table public.site_settings add column branch_access text not null default 'any' check (branch_access in ('any', 'home'));

create or replace function public.branch_access() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select branch_access from site_settings where id = 1), 'any')
$$;

-- in home-branch mode, members can't move themselves to another branch — the desk does that
create or replace function public.guard_home_branch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.home_branch_id is distinct from old.home_branch_id and old.home_branch_id is not null
     and branch_access() = 'home' and not is_admin() and auth.uid() is not null then
    raise exception 'Your membership is tied to your home branch — ask the desk to move it';
  end if;
  return new;
end $$;
create trigger profiles_guard_home_branch before update of home_branch_id on public.profiles
  for each row execute function public.guard_home_branch();

-- same rules as 0007, plus the branch-access check
create or replace function public._check_in(uid uuid, p_branch uuid, p_lat double precision, p_lng double precision, p_at_door boolean)
returns int
language plpgsql security definer set search_path = public as $$
declare
  b branches;
  dist double precision;
  female boolean;
  home uuid;
  sess text;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if not has_active_subscription(uid) then raise exception 'No active plan — buy one to check in'; end if;

  select * into b from branches where id = p_branch and active;
  if not found then raise exception 'Branch not found'; end if;

  select gender = 'female', home_branch_id into female, home from profiles where id = uid;
  if branch_access() = 'home' then
    if home is null then
      update profiles set home_branch_id = b.id where id = uid; -- first check-in picks the home branch
    elsif home <> b.id then
      raise exception '%', format('Your membership is for the %s branch — check in there, or ask the desk',
        (select name from branches where id = home));
    end if;
  end if;

  if exists (select 1 from holidays h where h.day = gym_today() and (h.branch_id is null or h.branch_id = b.id)) then
    raise exception 'The gym is closed today for a holiday — your streak is safe';
  end if;

  sess := branch_session_now(b, coalesce(female, false));
  if sess = 'ladies_only' then
    raise exception '%', format('These are ladies'' hours — general hours today: %s–%s%s',
      to_char(b.morning_open, 'HH24:MI'), to_char(b.morning_close, 'HH24:MI'),
      case when b.evening_open is null then '' else format(' and %s–%s', to_char(b.evening_open, 'HH24:MI'), to_char(b.evening_close, 'HH24:MI')) end);
  elsif sess is null then
    raise exception '%', format('Check-in is only open during gym hours: %s–%s%s',
      to_char(b.morning_open, 'HH24:MI'), to_char(b.morning_close, 'HH24:MI'),
      case when b.evening_open is null then '' else format(' and %s–%s', to_char(b.evening_open, 'HH24:MI'), to_char(b.evening_close, 'HH24:MI')) end);
  end if;

  if not p_at_door then
    if b.lat is not null and b.lng is not null and p_lat is not null and p_lng is not null then
      dist := 2 * 6371000 * asin(sqrt(
        power(sin(radians(p_lat - b.lat) / 2), 2) +
        cos(radians(b.lat)) * cos(radians(p_lat)) * power(sin(radians(p_lng - b.lng) / 2), 2)));
      if dist > b.radius_m then raise exception 'You seem to be % m away from the branch', round(dist); end if;
    elsif b.require_location then
      raise exception 'This branch needs your location to check in';
    end if;
  end if;

  insert into checkins (user_id, branch_id, session) values (uid, b.id, sess) on conflict (user_id, day, session) do nothing;
  return current_streak(uid);
end $$;
revoke execute on function public._check_in(uuid, uuid, double precision, double precision, boolean) from public, anon, authenticated;

-- Entrance check-in now returns the full picture for the success screen, including the member's photo
-- (staff at the door match the face to the person, whichever way they checked in).
drop function if exists public.check_in_at_door(uuid, text, text);
create function public.check_in_at_door(p_key uuid, p_phone text default null, p_ref text default null)
returns table (first_name text, branch text, streak int, already boolean, session text, sessions_today text[],
               month_visits int, track public.plan_track, duration_days int, ends_on date, photo_path text)
language plpgsql security definer set search_path = public as $$
declare
  bid uuid;
  uid uuid;
  digits text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);
  ref text := upper(regexp_replace(coalesce(p_ref, ''), '^\s*(REF)?\s*|\s+$', '', 'gi'));
  n int;
  before int;
begin
  select k.branch_id into bid from branch_door_keys k join branches b on b.id = k.branch_id where k.key = p_key and b.active;
  if bid is null then raise exception 'This check-in code is no longer valid — ask the desk'; end if;

  if p_phone is not null then
    if length(digits) <> 10 then raise exception 'Enter your 10-digit phone number'; end if;
    select count(*), min(id::text)::uuid into n, uid from profiles where right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10) = digits;
    if n = 0 then raise exception 'No member with that phone number — try your bill number, or ask the desk'; end if;
    if n > 1 then raise exception 'More than one member has that number — use your bill number instead'; end if;
  elsif p_ref is not null then
    if ref !~ '^[0-9A-F]{8}$' then raise exception 'Bill number is the 8-character REF on your pass or receipt'; end if;
    select s.user_id into uid from subscriptions s where upper(left(s.id::text, 8)) = ref and s.status = 'active'
      order by s.ends_on desc limit 1;
    if uid is null then raise exception 'No active plan with that bill number — ask the desk'; end if;
  else
    uid := auth.uid();
    if uid is null then raise exception 'Sign in, or enter your phone or bill number'; end if;
  end if;

  select count(*) into before from checkins c where c.user_id = uid and c.day = gym_today();
  streak := _check_in(uid, bid, null, null, true);
  already := before = (select count(*) from checkins c where c.user_id = uid and c.day = gym_today());

  select c.session into session from checkins c where c.user_id = uid and c.day = gym_today() order by c.created_at desc limit 1;
  select array_agg(c.session order by c.created_at) into sessions_today from checkins c where c.user_id = uid and c.day = gym_today();
  select count(*) into month_visits from checkins c where c.user_id = uid and c.day >= date_trunc('month', gym_today())::date;
  select p.track, p.duration_days, s.ends_on into track, duration_days, ends_on
    from subscriptions s join plans p on p.id = s.plan_id
   where s.user_id = uid and s.status = 'active' and gym_today() between s.starts_on and s.ends_on
   order by s.ends_on desc limit 1;
  select split_part(pr.full_name, ' ', 1), pr.photo_path into first_name, photo_path
    from profiles pr where pr.id = uid;
  select b.name into branch from branches b where b.id = bid;
  return next;
end $$;
grant execute on function public.check_in_at_door(uuid, text, text) to anon, authenticated;

-- the entrance page now shows the branch's live hours, so it needs the branch id (was: its name)
drop function if exists public.door_branch(uuid);
create function public.door_branch(p_key uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select b.id from branch_door_keys k join branches b on b.id = k.branch_id where k.key = p_key and b.active
$$;
grant execute on function public.door_branch(uuid) to anon, authenticated;
