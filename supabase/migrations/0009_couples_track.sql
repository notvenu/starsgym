-- Run this on its own, BEFORE 0010. Postgres can't use a new enum value in the same run that adds it.
alter type public.plan_track add value if not exists 'couples';
