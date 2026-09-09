-- unique identity constraints (case-insensitive) for e-mail and nickname
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_lower_idx ON public.profiles (lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_nickname_lower_idx ON public.profiles (lower(nickname)) WHERE nickname IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_uniq_idx ON public.profiles (phone) WHERE phone IS NOT NULL;

-- purge unconfirmed test accounts (no admin/manager role attached)
DELETE FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role IN ('admin','manager'));