ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS nickname text,
  ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles ALTER COLUMN phone DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_key ON public.profiles (lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_nickname_key ON public.profiles (lower(nickname)) WHERE nickname IS NOT NULL;

ALTER TABLE public.phone_verifications
  ADD COLUMN IF NOT EXISTS email text;

ALTER TABLE public.phone_verifications ALTER COLUMN phone DROP NOT NULL;