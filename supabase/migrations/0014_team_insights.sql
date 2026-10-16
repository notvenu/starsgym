-- Team (trainers + staff on one page) and branch-aware analytics. Run after 0013.

-- ───────── team ─────────
-- A trainer card can belong to a branch (null = both) and to a staff account (a trainer who also runs the desk).
alter table public.site_items add column if not exists branch_id uuid references public.branches on delete set null;
alter table public.site_items add column if not exists profile_id uuid references public.profiles on delete set null;
create unique index if not exists site_items_one_trainer_per_profile on public.site_items (profile_id) where kind = 'trainer';

-- ───────── analytics ─────────
-- One call per period: totals, daily series, peak hours, mix, branch comparison, who's training and who's gone quiet.
-- Gym days are Asia/Kolkata. p_branch null = every branch (the branch comparison always covers every branch).
-- security invoker: runs with the caller's row access, and only the owner opens the Analytics page.
create or replace function public.admin_insights(p_from date, p_to date, p_branch uuid default null)
returns json language sql stable security invoker set search_path = public as $$
with
sales as (
  select s.user_id, s.amount_paise, s.method, s.paid_at, (s.paid_at at time zone 'Asia/Kolkata')::date as day, p.track, p.duration_days
  from subscriptions s join plans p on p.id = s.plan_id
  where s.status = 'active' and s.paid_at is not null
    and (s.paid_at at time zone 'Asia/Kolkata')::date between p_from and p_to
    and (p_branch is null or s.branch_id = p_branch)
),
visits as (
  select c.user_id, c.day, c.created_at from checkins c
  where c.day between p_from and p_to and (p_branch is null or c.branch_id = p_branch)
),
active as (
  select distinct s.user_id from subscriptions s
  where s.status = 'active' and s.starts_on <= p_to and s.ends_on >= p_to and (p_branch is null or s.branch_id = p_branch)
),
first_paid as (
  select user_id, min(paid_at) as at from subscriptions where status = 'active' and paid_at is not null group by user_id
),
-- members whose plan ran out in the period (before today), and whether they've bought another since
ended as (
  select s.user_id, max(s.ends_on) as ends_on from subscriptions s
  where s.status = 'active' and s.ends_on >= p_from and s.ends_on < p_to and (p_branch is null or s.branch_id = p_branch)
  group by s.user_id
),
last_visit as (
  select user_id, max(day) as day from checkins where day <= p_to group by user_id
),
people as (
  select p.id, p.full_name, p.phone, p.gender,
    coalesce(extract(year from age(p_to, p.date_of_birth))::int, p.age) as years
  from profiles p join active a on a.user_id = p.id
)
select json_build_object(
  'revenue', coalesce((select sum(amount_paise) from sales), 0),
  'sales', (select count(*) from sales),
  'new_members', (select count(distinct s.user_id) from sales s join first_paid f on f.user_id = s.user_id and f.at = s.paid_at),
  'checkins', (select count(*) from visits),
  'visitors', (select count(distinct user_id) from visits),
  'active_members', (select count(*) from active),
  'ended', (select count(*) from ended),
  'renewed', (select count(*) from ended e where exists (
    select 1 from subscriptions s where s.user_id = e.user_id and s.status = 'active' and s.ends_on > e.ends_on)),
  'revenue_by_day', coalesce((select json_agg(json_build_object('day', day, 'v', v) order by day)
    from (select day, sum(amount_paise) as v from sales group by day) x), '[]'),
  'checkins_by_day', coalesce((select json_agg(json_build_object('day', day, 'v', v) order by day)
    from (select day, count(*) as v from visits group by day) x), '[]'),
  'heatmap', coalesce((select json_agg(json_build_object('dow', dow, 'h', h, 'v', v))
    from (select extract(dow from created_at at time zone 'Asia/Kolkata')::int as dow,
                 extract(hour from created_at at time zone 'Asia/Kolkata')::int as h, count(*) as v
          from visits group by 1, 2) x), '[]'),
  'by_plan', coalesce((select json_agg(json_build_object('track', track, 'days', duration_days, 'n', n, 'v', v) order by v desc)
    from (select track, duration_days, count(*) as n, sum(amount_paise) as v from sales group by 1, 2) x), '[]'),
  'by_method', coalesce((select json_agg(json_build_object('method', method, 'n', n, 'v', v) order by v desc)
    from (select method, count(*) as n, sum(amount_paise) as v from sales group by 1) x), '[]'),
  'by_branch', coalesce((select json_agg(json_build_object('name', b.name, 'revenue', coalesce(r.v, 0), 'checkins', coalesce(c.v, 0)) order by b.name)
    from branches b
    left join (select branch_id, sum(amount_paise) as v from subscriptions
               where status = 'active' and paid_at is not null
                 and (paid_at at time zone 'Asia/Kolkata')::date between p_from and p_to group by 1) r on r.branch_id = b.id
    left join (select branch_id, count(*) as v from checkins where day between p_from and p_to group by 1) c on c.branch_id = b.id
    where b.active), '[]'),
  'gender', coalesce((select json_agg(json_build_object('k', coalesce(gender, 'unknown'), 'n', n) order by n desc)
    from (select gender, count(*) as n from people group by 1) x), '[]'),
  'ages', coalesce((select json_agg(json_build_object('k', band, 'n', n) order by band)
    from (select case when years is null then '~ Not given' when years < 18 then 'Under 18' when years < 25 then '18–24'
                      when years < 35 then '25–34' when years < 45 then '35–44' else '45+' end as band, count(*) as n
          from people group by 1) x), '[]'),
  'quiet', coalesce((select json_agg(json_build_object('id', id, 'name', full_name, 'phone', phone, 'last', last) order by last nulls first)
    from (select p.id, p.full_name, p.phone, v.day as last from people p left join last_visit v on v.user_id = p.id
          where v.day is null or v.day < p_to - 9
          order by v.day nulls first limit 12) x), '[]')
)
$$;
grant execute on function public.admin_insights(date, date, uuid) to authenticated;
