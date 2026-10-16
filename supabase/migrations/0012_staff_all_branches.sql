-- Staff who work at every branch (e.g. trainers covering both). Run after 0011.
-- They get the front desk everywhere but stay staff: settings, prices and roles are still the owner's.
alter table public.profiles add column if not exists all_branches boolean not null default false;

-- can the signed-in staff member work with this branch? (true for non-staff: their own rules apply)
create or replace function public.staff_sees(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from profiles where id = auth.uid() and role = 'staff')
      or exists (select 1 from profiles where id = auth.uid() and role = 'staff' and (all_branches or home_branch_id = b))
$$;
grant execute on function public.staff_sees(uuid) to authenticated;

drop policy if exists staff_branch_profiles_read on public.profiles;
create policy staff_branch_profiles_read on public.profiles as restrictive for select to authenticated
  using (not is_staff() or id = auth.uid() or (home_branch_id is null and role = 'member') or staff_sees(home_branch_id));
drop policy if exists staff_branch_profiles_write on public.profiles;
create policy staff_branch_profiles_write on public.profiles as restrictive for update to authenticated
  using (not is_staff() or id = auth.uid() or (home_branch_id is null and role = 'member') or staff_sees(home_branch_id))
  with check (not is_staff() or id = auth.uid() or staff_sees(home_branch_id));

drop policy if exists staff_branch_subs_read on public.subscriptions;
create policy staff_branch_subs_read on public.subscriptions as restrictive for select to authenticated
  using (not is_staff() or user_id = auth.uid() or staff_sees(branch_id));
drop policy if exists staff_branch_subs_write on public.subscriptions;
create policy staff_branch_subs_write on public.subscriptions as restrictive for update to authenticated
  using (not is_staff() or user_id = auth.uid() or staff_sees(branch_id));

drop policy if exists staff_branch_checkins_read on public.checkins;
create policy staff_branch_checkins_read on public.checkins as restrictive for select to authenticated
  using (not is_staff() or user_id = auth.uid() or staff_sees(branch_id));

-- only the owner (or the service key) moves staff between branches: the own-profile policy would otherwise let a
-- staff member flip all_branches or change their own home branch and see the other gym
create or replace function public.guard_staff_scope() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_owner() and (
    new.all_branches is distinct from old.all_branches
    or (old.role = 'staff' and new.home_branch_id is distinct from old.home_branch_id)
  ) then
    raise exception 'Only the owner can change staff branches';
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard_staff_scope on public.profiles;
create trigger profiles_guard_staff_scope before update of all_branches, home_branch_id on public.profiles
  for each row execute function public.guard_staff_scope();
