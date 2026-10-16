-- Rate limits shared by every server instance, and the door check-in locked to the server. Run after 0016.
-- Only the server (service key) touches this: RLS on with no policies, and the function isn't granted to visitors.
create table if not exists public.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  hits int not null default 1
);
alter table public.rate_limits enable row level security;

-- Counts one hit on p_key; true while the key is within p_max hits per p_window_seconds.
create or replace function public.rate_limit_hit(p_key text, p_max int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  n int;
  fresh timestamptz := now() - make_interval(secs => p_window_seconds);
begin
  insert into rate_limits as r (key) values (p_key)
  on conflict (key) do update set
    hits = case when r.window_start < fresh then 1 else r.hits + 1 end,
    window_start = case when r.window_start < fresh then now() else r.window_start end
  returning hits into n;
  -- ponytail: tidy as we go instead of a cron job; fine at gym traffic
  if random() < 0.01 then delete from rate_limits where window_start < now() - interval '1 day'; end if;
  return n <= p_max;
end $$;
revoke all on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;

-- ───────── door check-in ─────────
-- Checking in by phone or bill number was callable straight from the browser with the public key, so anyone holding
-- the (printed) entrance code could look up which phone numbers are members — name, plan, expiry — and check them in.
-- Now those two paths only run through the site's server (service key, rate-limited); "me" still uses the session.
create or replace function public.check_in_at_door(p_key uuid, p_phone text default null, p_ref text default null)
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
  if (p_phone is not null or p_ref is not null) and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Check in from the entrance page';
  end if;

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
revoke execute on function public.check_in_at_door(uuid, text, text) from public, anon;
grant execute on function public.check_in_at_door(uuid, text, text) to authenticated, service_role;

-- ───────── enquiries ─────────
-- The contact form inserted with the public key, so bots could skip the site's rate limit and post straight to the
-- table. The server writes enquiries now; visitors can't.
revoke insert on public.enquiries from anon, authenticated;
