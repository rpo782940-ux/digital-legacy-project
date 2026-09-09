ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS seo_url text,
  ADD COLUMN IF NOT EXISTS meta_title_ru text,
  ADD COLUMN IF NOT EXISTS meta_title_uk text,
  ADD COLUMN IF NOT EXISTS meta_desc_ru text,
  ADD COLUMN IF NOT EXISTS meta_desc_uk text,
  ADD COLUMN IF NOT EXISTS h1_ru text,
  ADD COLUMN IF NOT EXISTS h1_uk text,
  ADD COLUMN IF NOT EXISTS description_ru text,
  ADD COLUMN IF NOT EXISTS description_uk text,
  ADD COLUMN IF NOT EXISTS synced_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS categories_external_id_key ON public.categories (external_id) WHERE external_id IS NOT NULL;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS seo_url text,
  ADD COLUMN IF NOT EXISTS meta_title_ru text,
  ADD COLUMN IF NOT EXISTS meta_title_uk text,
  ADD COLUMN IF NOT EXISTS meta_desc_ru text,
  ADD COLUMN IF NOT EXISTS meta_desc_uk text,
  ADD COLUMN IF NOT EXISTS h1_ru text,
  ADD COLUMN IF NOT EXISTS h1_uk text,
  ADD COLUMN IF NOT EXISTS description_ru text,
  ADD COLUMN IF NOT EXISTS description_uk text,
  ADD COLUMN IF NOT EXISTS gallery jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS manufacturer text,
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS old_price numeric,
  ADD COLUMN IF NOT EXISTS special_price numeric,
  ADD COLUMN IF NOT EXISTS source_hash text,
  ADD COLUMN IF NOT EXISTS synced_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS products_external_id_key ON public.products (external_id) WHERE external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger text NOT NULL DEFAULT 'cron',
  status text NOT NULL DEFAULT 'running',
  categories_synced integer NOT NULL DEFAULT 0,
  products_created integer NOT NULL DEFAULT 0,
  products_updated integer NOT NULL DEFAULT 0,
  products_skipped integer NOT NULL DEFAULT 0,
  products_disabled integer NOT NULL DEFAULT 0,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sync_runs TO authenticated;
GRANT ALL ON public.sync_runs TO service_role;

ALTER TABLE public.sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read sync runs" ON public.sync_runs
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP TRIGGER IF EXISTS set_sync_runs_updated_at ON public.sync_runs;
CREATE TRIGGER set_sync_runs_updated_at BEFORE UPDATE ON public.sync_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();