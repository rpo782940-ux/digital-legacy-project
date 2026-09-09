CREATE TABLE public.product_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'import',
  note text,
  created_by uuid REFERENCES auth.users(id),
  products_count integer NOT NULL DEFAULT 0,
  products_created integer NOT NULL DEFAULT 0,
  products_updated integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  data jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_snapshots TO authenticated;
GRANT ALL ON public.product_snapshots TO service_role;

ALTER TABLE public.product_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read snapshots" ON public.product_snapshots
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff create snapshots" ON public.product_snapshots
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update snapshots" ON public.product_snapshots
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff delete snapshots" ON public.product_snapshots
  FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));

CREATE TRIGGER product_snapshots_updated_at BEFORE UPDATE ON public.product_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX product_snapshots_created_at_idx ON public.product_snapshots (created_at DESC);