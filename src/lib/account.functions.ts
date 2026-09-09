import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkPassword } from "./phone";

/** Profile + order history for the signed-in customer (RLS scoped). */
export const getMyAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Statuses are pulled from the CRM before reading, so the customer sees the
    // current state even when a webhook delivery was missed.
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { refreshOrderStatuses } = await import("./salesdrive.server");
      await refreshOrderStatuses(supabaseAdmin, userId);
    } catch (e) {
      console.error("[SalesDrive] account refresh failed", e);
    }


    const { data: profile } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, phone, phone_verified, email")
      .eq("id", userId)
      .maybeSingle();

    const { data: orders } = await supabase
      .from("orders")
      .select(
        "id, order_no, status, total, discount, created_at, np_city, np_warehouse, np_warehouse_address, delivery, comment, tracking_number, salesdrive_order_id",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    const ids = (orders ?? []).map((o) => o.id);
    const { data: items } = ids.length
      ? await supabase
          .from("order_items")
          .select("order_id, product_sku, product_name, variant_label, unit_price, quantity")
          .in("order_id", ids)
      : { data: [] as never[] };

    return {
      profile: profile ?? null,
      orders: (orders ?? []).map((o) => ({
        ...o,
        items: (items ?? []).filter((i) => i.order_id === o.id),
      })),
    };
  });

const profileSchema = z.object({
  firstName: z.string().trim().min(2).max(60),
  lastName: z.string().trim().min(2).max(60),
});

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => profileSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ first_name: data.firstName, last_name: data.lastName })
      .eq("id", context.userId);
    if (error) return { ok: false as const, error: "failed" };
    return { ok: true as const };
  });

const passwordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: z
    .string()
    .min(8)
    .max(72)
    .refine((v) => checkPassword(v).ok, { message: "weak_password" }),
});

/** Password change: the current password is re-verified server side first. */
export const changeMyPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => passwordSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createClient } = await import("@supabase/supabase-js");

    const email = context.claims?.email as string | undefined;
    if (!email) return { ok: false as const, error: "failed" };

    const check = createClient(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_PUBLISHABLE_KEY"]!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { error: signInError } = await check.auth.signInWithPassword({
      email,
      password: data.currentPassword,
    });
    if (signInError) return { ok: false as const, error: "wrong_password" };

    const { error } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      password: data.newPassword,
    });
    if (error) return { ok: false as const, error: "failed" };
    return { ok: true as const };
  });
