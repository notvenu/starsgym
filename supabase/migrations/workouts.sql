-- Gym experience on profiles, each member's one workout split (with progression), and their workout logs. Each member sees and edits only their own rows.
-- Shared plans travel in the link itself, so nothing here is public.

alter table profiles add column if not exists experience text
  check (experience in ('beginner', 'novice', 'intermediate', 'advanced', 'expert')); -- asked at /welcome; picks the suggested split
grant update (experience) on profiles to authenticated;

create table if not exists workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null check (length(name) between 1 and 60),
  days jsonb not null check (jsonb_typeof(days) = 'array' and pg_column_size(days) < 64000),
  started_on date not null default (now() at time zone 'Asia/Kolkata')::date, -- progression counts from here
  created_at timestamptz not null default now()
);

create table if not exists workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  day date not null,
  title text not null check (length(title) between 1 and 80),
  exercises jsonb not null check (jsonb_typeof(exercises) = 'array' and pg_column_size(exercises) < 64000),
  note text not null default '' check (length(note) <= 500),
  created_at timestamptz not null default now()
);

create unique index if not exists workout_plans_one_per_user on workout_plans (user_id); -- one split each; a new one replaces it
create index if not exists workout_logs_user_day on workout_logs (user_id, day desc);

alter table workout_plans enable row level security;
alter table workout_logs enable row level security;

drop policy if exists "own plans" on workout_plans;
create policy "own plans" on workout_plans for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "own logs" on workout_logs;
create policy "own logs" on workout_logs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Body weight and measurements: one row per member per day (saving the same day again updates it).
create table if not exists body_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  day date not null,
  weight_kg numeric(5,2) check (weight_kg between 20 and 400),
  body_fat numeric(4,1) check (body_fat between 2 and 70),
  chest_cm numeric(5,1) check (chest_cm between 10 and 300),
  waist_cm numeric(5,1) check (waist_cm between 10 and 300),
  hips_cm numeric(5,1) check (hips_cm between 10 and 300),
  arm_cm numeric(5,1) check (arm_cm between 10 and 300),
  thigh_cm numeric(5,1) check (thigh_cm between 10 and 300),
  created_at timestamptz not null default now(),
  unique (user_id, day)
);
alter table body_logs enable row level security;
drop policy if exists "own body logs" on body_logs;
create policy "own body logs" on body_logs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Progress photos: private. Files sit in the private "progress" bucket, which only the server touches (service key) and
-- shows through short-lived signed links, like member faces. Rows: each member their own.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progress', 'progress', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create table if not exists progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  day date not null,
  path text not null,
  note text not null default '' check (length(note) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists progress_photos_user_day on progress_photos (user_id, day desc);
alter table progress_photos enable row level security;
drop policy if exists "own progress photos" on progress_photos;
create policy "own progress photos" on progress_photos for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
