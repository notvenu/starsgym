-- Age for members without a date of birth (GymPro only kept age). Run after 0012.
-- The date of birth wins wherever both are set; this one doesn't tick over on birthdays.
alter table public.profiles add column if not exists age smallint check (age between 1 and 120);
-- profiles are updated column by column (see 0008): the desk and members may set it
grant update (age) on public.profiles to authenticated;
