-- Staff accounts. Run after 0010.
-- Roles: member · staff (front desk at their home branch) · admin (owner: every branch, settings, staff management).
-- Additive: existing desk rules keep checking is_admin(), which now means "anyone at the desk"; the new restrictive
-- policies below then narrow staff to their branch and keep the owner's settings owner-only.

-- ───────── roles ─────────
do $$
declare c text;
begin
  for c in select conname from pg_constraint
            where conrelid = 'public.profiles'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table public.profiles drop constraint %I', c);
  end loop;
end $$;
alter table public.profiles add constraint profiles_role_check check (role in ('member', 'staff', 'admin'));

-- the front desk: staff or admin (every existing desk policy and function checks this)
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('staff', 'admin'))
$$;

-- the owner
create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin')
$$;

-- staff only (not the owner)
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'staff')
$$;

-- a staff member's branch (their home branch); null for everyone else
create or replace function public.staff_branch() returns uuid
language sql stable security definer set search_path = public as $$
  select home_branch_id from profiles where id = auth.uid() and role = 'staff'
$$;

grant execute on function public.is_owner(), public.is_staff(), public.staff_branch() to authenticated;

-- only the owner (or the service key, e.g. the Staff page's server action) changes anyone's role
create or replace function public.guard_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not is_owner() then
    raise exception 'Only the owner can change roles';
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role before update of role on public.profiles
  for each row execute function public.guard_role();

-- ───────── staff see and edit their branch only ─────────
-- Members with no home branch yet (new sign-ups) stay visible so the desk can take them on; the owner and
-- other staff without a branch don't.
drop policy if exists staff_branch_profiles_read on public.profiles;
create policy staff_branch_profiles_read on public.profiles as restrictive for select to authenticated
  using (not is_staff() or id = auth.uid() or (home_branch_id is null and role = 'member') or home_branch_id = staff_branch());
drop policy if exists staff_branch_profiles_write on public.profiles;
create policy staff_branch_profiles_write on public.profiles as restrictive for update to authenticated
  using (not is_staff() or id = auth.uid() or (home_branch_id is null and role = 'member') or home_branch_id = staff_branch())
  with check (not is_staff() or id = auth.uid() or home_branch_id = staff_branch());

drop policy if exists staff_branch_subs_read on public.subscriptions;
create policy staff_branch_subs_read on public.subscriptions as restrictive for select to authenticated
  using (not is_staff() or user_id = auth.uid() or branch_id = staff_branch());
drop policy if exists staff_branch_subs_write on public.subscriptions;
create policy staff_branch_subs_write on public.subscriptions as restrictive for update to authenticated
  using (not is_staff() or user_id = auth.uid() or branch_id = staff_branch());

drop policy if exists staff_branch_checkins_read on public.checkins;
create policy staff_branch_checkins_read on public.checkins as restrictive for select to authenticated
  using (not is_staff() or user_id = auth.uid() or branch_id = staff_branch());

-- ───────── the owner's settings ─────────
-- Reads stay as they are (prices, branches and site content are public); only writes are narrowed.
do $$
declare t text;
begin
  foreach t in array array['plans', 'offers', 'branches', 'branch_door_keys', 'holidays', 'site_items', 'site_settings'] loop
    execute format('drop policy if exists owner_only_insert on public.%I', t);
    execute format('drop policy if exists owner_only_update on public.%I', t);
    execute format('drop policy if exists owner_only_delete on public.%I', t);
    execute format('create policy owner_only_insert on public.%I as restrictive for insert to authenticated with check (not is_staff())', t);
    execute format('create policy owner_only_update on public.%I as restrictive for update to authenticated using (not is_staff())', t);
    execute format('create policy owner_only_delete on public.%I as restrictive for delete to authenticated using (not is_staff())', t);
  end loop;
end $$;
