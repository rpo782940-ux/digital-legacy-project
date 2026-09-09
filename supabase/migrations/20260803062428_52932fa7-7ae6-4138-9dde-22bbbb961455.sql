DROP INDEX IF EXISTS public.products_external_id_key;
DROP INDEX IF EXISTS public.categories_external_id_key;
CREATE UNIQUE INDEX products_external_id_key ON public.products (external_id);
CREATE UNIQUE INDEX categories_external_id_key ON public.categories (external_id);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_new boolean NOT NULL DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_special boolean NOT NULL DEFAULT false;