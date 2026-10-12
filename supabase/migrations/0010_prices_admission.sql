-- Prices from the gym's price board, the Couples plan, and the one-time admission fee. Run after 0009.

-- ───────── Couples plans ─────────
insert into public.plans (track, duration_days, price_paise, active)
select 'couples', d, 0, true from unnest(array[30, 90, 180, 365]) d
where not exists (select 1 from public.plans p where p.track = 'couples' and p.duration_days = d);

-- ───────── prices (₹ × 100) ─────────
update public.plans p set price_paise = v.paise, active = true
from (values
  ('strength', 30, 149900), ('strength', 90, 399900), ('strength', 180, 699900), ('strength', 365, 1299900),
  ('strength_cardio', 30, 199900), ('strength_cardio', 90, 549900), ('strength_cardio', 180, 999900), ('strength_cardio', 365, 1799900),
  ('couples', 30, 349900), ('couples', 90, 999900), ('couples', 180, 1749900), ('couples', 365, 2999900),
  ('personal_training', 30, 499900), ('personal_training', 90, 1299900), ('personal_training', 180, 2399900), ('personal_training', 365, 4199900)
) as v(track, days, paise)
where p.track = v.track::public.plan_track and p.duration_days = v.days;

-- ───────── admission fee ─────────
-- Charged once, on a member's first membership (not trial or day pass). Editable in admin → Pricing.
alter table public.site_settings add column if not exists admission_fee_paise int not null default 19900 check (admission_fee_paise >= 0);
alter table public.subscriptions add column if not exists admission_paise int not null default 0;

-- Adds the fee to the order as it's created, so every path that sells a plan (online, desk) charges it the same way.
create or replace function public.add_admission_fee() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  fee int := coalesce((select admission_fee_paise from site_settings where id = 1), 0);
  t plan_track := (select track from plans where id = new.plan_id);
begin
  if fee > 0 and t in ('strength', 'strength_cardio', 'personal_training', 'couples')
     and not exists (
       select 1 from subscriptions s join plans p on p.id = s.plan_id
       where s.user_id = new.user_id and s.status = 'active'
         and p.track in ('strength', 'strength_cardio', 'personal_training', 'couples')
     ) then
    new.admission_paise := fee;
    new.amount_paise := new.amount_paise + fee;
  end if;
  return new;
end $$;

drop trigger if exists subscriptions_admission_fee on public.subscriptions;
create trigger subscriptions_admission_fee before insert on public.subscriptions
  for each row when (new.status = 'pending') execute function public.add_admission_fee();
