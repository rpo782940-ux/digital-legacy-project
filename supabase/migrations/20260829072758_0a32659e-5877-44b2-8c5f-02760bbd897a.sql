-- Admin rights are bound to one phone number, granted by the database itself.
CREATE OR REPLACE FUNCTION public.sync_admin_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.phone = '+380663020657' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_admin_role ON public.profiles;
CREATE TRIGGER profiles_admin_role
AFTER INSERT OR UPDATE OF phone ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_admin_role();

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM public.profiles WHERE phone = '+380663020657'
ON CONFLICT (user_id, role) DO NOTHING;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT SELECT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT SELECT, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.products TO service_role;
GRANT ALL ON public.categories TO service_role;