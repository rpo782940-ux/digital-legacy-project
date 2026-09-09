DROP INDEX IF EXISTS public.profiles_nickname_key;
DROP INDEX IF EXISTS public.profiles_nickname_lower_idx;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS salesdrive_order_id bigint,
  ADD COLUMN IF NOT EXISTS salesdrive_status_id integer,
  ADD COLUMN IF NOT EXISTS salesdrive_sync_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS salesdrive_sync_error text,
  ADD COLUMN IF NOT EXISTS salesdrive_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS tracking_number text,
  ADD COLUMN IF NOT EXISTS discount numeric NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS orders_salesdrive_order_id_idx
  ON public.orders (salesdrive_order_id) WHERE salesdrive_order_id IS NOT NULL;