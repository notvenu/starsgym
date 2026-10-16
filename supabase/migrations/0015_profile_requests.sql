-- Profile change requests. Run after 0014.
-- Members set their name, gender, home branch and photo once, while setting up. After that those four go through the
-- desk as a request (approve / reject); date of birth, phone, emergency contact and socials stay theirs to edit.

-- ───────── first photo only ─────────
-- (was: first photo plus two changes). A new photo after that is a request.
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
  if p.photo_path is not null then raise exception 'Your photo is set — request a change from your dashboard'; end if;
  update profiles set photo_path = p_path where id = uid;
  old_path := null;
  changes_left := 0;
  return next;
end $$;

-- ───────── name / gender / branch are locked once set up ─────────
-- "Set up" = they have a photo (the last onboarding step). The desk (and the owner) can still change anything.
create or replace function public.guard_member_identity() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() = new.id and not is_admin() and old.photo_path is not null and (
    new.full_name is distinct from old.full_name
    or new.gender is distinct from old.gender
    or (old.home_branch_id is not null and new.home_branch_id is distinct from old.home_branch_id)
  ) then
    raise exception 'Ask the desk to change your name, gender or branch — request it from your dashboard';
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard_member_identity on public.profiles;
create trigger profiles_guard_member_identity before update of full_name, gender, home_branch_id on public.profiles
  for each row execute function public.guard_member_identity();

-- ───────── the requests ─────────
create table if not exists public.profile_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  -- only the fields they want changed are set
  full_name text,
  gender text check (gender in ('female', 'male', 'other')),
  home_branch_id uuid references public.branches on delete set null,
  photo_path text, -- a new photo already uploaded to faces/<user>/…, applied on approval, deleted on rejection
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles on delete set null
);
-- one open request per member: a new one replaces it
create unique index if not exists profile_requests_one_open on public.profile_requests (user_id) where status = 'pending';

alter table public.profile_requests enable row level security;
-- members write through the server (service key, after checking who they are), so the photo path is always theirs
grant select on public.profile_requests to authenticated;
grant update (status, decided_at, decided_by) on public.profile_requests to authenticated;

drop policy if exists own_requests on public.profile_requests;
create policy own_requests on public.profile_requests for select to authenticated using (user_id = auth.uid());
drop policy if exists desk_reads_requests on public.profile_requests;
create policy desk_reads_requests on public.profile_requests for select to authenticated
  using (is_admin() and staff_sees((select p.home_branch_id from profiles p where p.id = user_id)));
drop policy if exists desk_decides_requests on public.profile_requests;
create policy desk_decides_requests on public.profile_requests for update to authenticated
  using (is_admin() and staff_sees((select p.home_branch_id from profiles p where p.id = user_id)))
  with check (is_admin() and staff_sees((select p.home_branch_id from profiles p where p.id = user_id)));
