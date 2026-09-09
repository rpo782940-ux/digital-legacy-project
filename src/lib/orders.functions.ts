import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const itemSchema = z.object({
  sku: z.string().trim().max(80).nullable().optional(),
  name: z.string().trim().min(1).max(200),
  variant: z.string().trim().max(120).nullable(),
  price: z.number().nonnegative().max(1_000_000),
  qty: z.number().int().min(1).max(999),
});

const orderSchema = z.object({
  email: z.string().trim().max(160).optional().nullable(),
  city: z.string().trim().max(200).optional().nullable(),
  delivery: z.enum(["novaposhta", "pickup", "carrier"]),
  comment: z.string().trim().max(1000).optional().nullable(),
  lang: z.enum(["ru", "uk"]),
  np: z
    .object({
      city: z.string().trim().max(200),
      warehouse: z.string().trim().max(200),
      warehouseAddress: z.string().trim().max(300),
      data: z.unknown().nullable(),
    })
    .nullable()
    .optional(),
  items: z.array(itemSchema).min(1).max(100),
});

/** Checkout is available to signed-in customers only; identity comes from the profile. */
export const placeOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => orderSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { syncOrderToSalesDrive } = await import("./salesdrive.server");

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("first_name, last_name, phone")
      .eq("id", context.userId)
      .maybeSingle();

    if (!profile) throw new Error("profile_missing");

    const total = data.items.reduce((n, i) => n + i.price * i.qty, 0);
    const np = data.delivery === "novaposhta" ? (data.np ?? null) : null;

    // Double-submit guard: an identical order created moments ago is reused
    // instead of being duplicated (double click, page refresh, retry).
    const since = new Date(Date.now() - 3 * 60_000).toISOString();
    const { data: recent } = await supabaseAdmin
      .from("orders")
      .select("id, order_no")
      .eq("user_id", context.userId)
      .eq("total", total)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recent) {
      try {
        await syncOrderToSalesDrive(supabaseAdmin, recent.id);
      } catch (e) {
        console.error("[SalesDrive] resync failed", e);
      }
      return { ok: true as const, orderNo: recent.order_no };
    }

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: context.userId,
        customer_name: `${profile.first_name} ${profile.last_name}`.trim(),
        phone: profile.phone ?? "",
        email: data.email || null,
        city: np?.city || data.city || null,
        delivery: data.delivery,
        comment: data.comment || null,
        total,
        lang: data.lang,
        status: "new",
        np_city: np?.city || null,
        np_warehouse: np?.warehouse || null,
        np_warehouse_address: np?.warehouseAddress || null,
        np_warehouse_data: (np?.data ?? null) as never,
      })
      .select("id, order_no")
      .single();

    if (error || !order) throw new Error("order_failed");

    const { error: itemsError } = await supabaseAdmin.from("order_items").insert(
      data.items.map((i) => ({
        order_id: order.id,
        product_sku: i.sku ?? null,
        product_name: i.name,
        variant_label: i.variant,
        unit_price: i.price,
        quantity: i.qty,
      })),
    );

    if (itemsError) throw new Error("order_items_failed");

    // CRM push is idempotent (externalId) and never breaks checkout.
    try {
      await syncOrderToSalesDrive(supabaseAdmin, order.id);
    } catch (e) {
      console.error("[SalesDrive] send failed", e);
    }

    return { ok: true as const, orderNo: order.order_no };
  });
