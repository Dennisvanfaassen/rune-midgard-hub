-- Run in Lovable Cloud SQL Editor. Only month and day are stored, never birth year.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birthday_month smallint;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birthday_day smallint;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profile_birthday_month_day_valid;
ALTER TABLE public.profiles ADD CONSTRAINT profile_birthday_month_day_valid CHECK (
 (birthday_month IS NULL AND birthday_day IS NULL) OR
 (birthday_month BETWEEN 1 AND 12 AND birthday_day BETWEEN 1 AND
 CASE birthday_month WHEN 2 THEN 29 WHEN 4 THEN 30 WHEN 6 THEN 30 WHEN 9 THEN 30 WHEN 11 THEN 30 ELSE 31 END)
);
