import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Manual sync trigger for staff (admin panel). */
export const triggerSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: staff } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (!staff) throw new Error("forbidden");

    const { runMasteraFormSync } = await import("@/lib/masteraform-sync.server");
    return await runMasteraFormSync("manual");
  });

/** Recent sync history for the admin panel. */
export const listSyncRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("sync_runs")
      .select(
        "id, trigger, status, categories_synced, products_created, products_updated, products_skipped, products_disabled, error, started_at, finished_at",
      )
      .order("started_at", { ascending: false })
      .limit(20);

    if (error) throw new Error(error.message);
    return data ?? [];
  });
