/**
 * SalesDriveService — live CRM integration (server only).
 *
 * Creating an order uses the verified form handler endpoint
 * `POST {SALESDRIVE_API_URL}/handler/` with the API key in the `form` field.
 * The REST endpoint `/api/order/add/` is NOT used: it answers 403 (CSRF).
 *
 * Reading orders uses `GET {SALESDRIVE_API_URL}/api/order/list/` with the
 * `Form-Api-Key` header, filtered by `filter[id][]` or `filter[externalId]`.
 *
 * Idempotency: every order carries `externalId = tf-<order_no>`. The handler
 * itself does NOT deduplicate, so before sending we (1) skip orders that
 * already store a `salesdrive_order_id` and (2) look the externalId up in the
 * CRM and adopt an existing order instead of creating a second one. That makes
 * a retry safe at any point.
 */

import { statusFromSalesDrive } from "./order-status";

export type SalesDriveItem = {
  sku: string | null;
  name: string;
  variant: string | null;
  price: number;
  qty: number;
};

export type SalesDriveOrder = {
  orderNo: number;
  userId: string | null;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string | null;
  comment: string | null;
  total: number;
  delivery?: "novaposhta" | "pickup" | "carrier" | string | null;
  city: string | null;
  warehouse: string | null;
  warehouseAddress: string | null;
  /** Extra Nova Poshta directory data, when the picker provided it. */
  cityFullName?: string | null;
  areaName?: string | null;
  regionName?: string | null;
  cityRef?: string | null;
  warehouseRef?: string | null;
  items: SalesDriveItem[];
};

const DELIVERY_LABEL: Record<string, string> = {
  novaposhta: "Нова Пошта, відділення",
  pickup: "Самовивіз",
  carrier: "Перевізник",
};

/** Human-readable delivery block duplicated into the CRM comment. */
export function describeDelivery(order: SalesDriveOrder): string {
  const method = DELIVERY_LABEL[order.delivery ?? "novaposhta"] ?? String(order.delivery ?? "");
  const lines = [`Доставка: ${method}`];
  if (order.city) lines.push(`Місто: ${order.city}`);
  if (order.warehouse) lines.push(`Відділення: ${order.warehouse}`);
  if (order.warehouseAddress) lines.push(`Адреса: ${order.warehouseAddress}`);
  return lines.join("\n");
}

export type SalesDriveResult =
  | { sent: true; orderId: number; adopted: boolean }
  | { sent: false; reason: string };


/** Known SalesDrive dictionary ids — do not invent new ones. */
const SHIPPING = { novaposhta: "id_9", pickup: "id_10", carrier: "id_9" } as const;
const PAYMENT_COD = "id_13";

export function externalIdFor(orderNo: number): string {
  return `tf-${orderNo}`;
}

function config() {
  const url = (process.env["SALESDRIVE_API_URL"] ?? "").replace(/\/+$/, "");
  const key = process.env["SALESDRIVE_API_KEY"] ?? "";
  return { url, key, enabled: Boolean(url && key) };
}

export type SalesDriveRemoteOrder = {
  id: number;
  statusId: number | null;
  status: string | null;
  externalId: string | null;
  trackingNumber: string | null;
};

function readRemote(row: Record<string, unknown>): SalesDriveRemoteOrder {
  const statusId = row["statusId"] == null ? null : Number(row["statusId"]);
  const delivery = row["ord_delivery_data"];
  let tracking: string | null = null;
  if (Array.isArray(delivery) && delivery.length) {
    const first = delivery[0] as Record<string, unknown> | undefined;
    const raw = first?.["trackingNumber"];
    tracking = typeof raw === "string" && raw.trim() ? raw.trim() : null;
  }
  return {
    id: Number(row["id"]),
    statusId,
    status: statusFromSalesDrive(statusId),
    externalId: row["externalId"] ? String(row["externalId"]) : null,
    trackingNumber: tracking,
  };
}

async function list(params: Record<string, string>): Promise<SalesDriveRemoteOrder[]> {
  const { url, key, enabled } = config();
  if (!enabled) return [];
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${url}/api/order/list/?${qs}`, {
    headers: { "Form-Api-Key": key, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`salesdrive_list_${res.status}`);
  const json = (await res.json()) as { data?: Record<string, unknown>[] };
  return (json.data ?? []).map(readRemote);
}

export const SalesDriveService = {
  isEnabled(): boolean {
    return config().enabled;
  },

  /** Reads one CRM order by its SalesDrive id. */
  async getOrder(id: number): Promise<SalesDriveRemoteOrder | null> {
    const rows = await list({ "filter[id][]": String(id) });
    return rows.find((r) => r.id === id) ?? null;
  },

  /** Finds a CRM order previously created for this site order. */
  async findByExternalId(externalId: string): Promise<SalesDriveRemoteOrder | null> {
    const rows = await list({ "filter[externalId]": externalId });
    const exact = rows.filter((r) => r.externalId === externalId);
    if (!exact.length) return null;
    // Oldest wins so retries always converge on the same CRM order.
    return exact.reduce((a, b) => (a.id <= b.id ? a : b));
  },

  async sendOrder(order: SalesDriveOrder): Promise<SalesDriveResult> {
    const { url, key, enabled } = config();
    if (!enabled) return { sent: false, reason: "disabled" };

    const externalId = externalIdFor(order.orderNo);

    // Idempotency guard: never create a second CRM order for the same site order.
    try {
      const existing = await SalesDriveService.findByExternalId(externalId);
      if (existing) return { sent: true, orderId: existing.id, adopted: true };
    } catch (e) {
      console.error("[SalesDrive] externalId lookup failed", e);
    }

    const shipping =
      SHIPPING[(order.delivery ?? "novaposhta") as keyof typeof SHIPPING] ?? SHIPPING.novaposhta;

    const deliveryText = describeDelivery(order);

    // The manager must always see where to ship, even if a CRM field mapping
    // changes: the delivery block is duplicated into the order comment.
    const commentParts = [
      order.comment,
      deliveryText,
      ...order.items.filter((i) => i.variant).map((i) => `${i.name}: ${i.variant}`),
    ].filter(Boolean);

    const payload: Record<string, unknown> = {
      form: key,
      getResultData: 1,
      externalId,
      fName: order.firstName || "Клиент",
      lName: order.lastName || "",
      phone: order.phone,
      comment: commentParts.join("\n"),
      shipping_method: shipping,
      payment_method: PAYMENT_COD,
      products: order.items.map((i) => ({
        id: i.sku ?? i.name,
        amount: i.qty,
        costPerItem: i.price,
        discount: 0,
      })),
    };
    if (order.email) payload["email"] = order.email;

    if (order.delivery === "novaposhta") {
      // "Відділення №5: вул. Героїв, 1" — the exact string NP/SalesDrive expects.
      const warehouseLine = [order.warehouse, order.warehouseAddress]
        .filter(Boolean)
        .join(": ");
      const full = [order.city, warehouseLine].filter(Boolean).join(", ");
      payload["adresDostavki"] = full;
      payload["shipping_address"] = full;
      payload["ord_delivery_data"] = [
        {
          provider: "novaposhta",
          type: order.warehouse?.toLowerCase().includes("поштомат")
            ? "WarehousePostomat"
            : "WarehouseWarehouse",
          cityName: order.city ?? "",
          cityFullName: order.cityFullName ?? order.city ?? "",
          ...(order.areaName ? { areaName: order.areaName } : {}),
          ...(order.regionName ? { regionName: order.regionName } : {}),
          address: warehouseLine || (order.warehouse ?? ""),
          ...(order.warehouseRef ? { recipientWarehouse: order.warehouseRef } : {}),
          ...(order.cityRef ? { recipientCityRef: order.cityRef } : {}),
          payForDelivery: "1",
          backDelivery: "0",
        },
      ];
    } else {
      const full = deliveryText.replace(/^Доставка:\s*/, "");
      payload["adresDostavki"] = full;
      payload["shipping_address"] = full;
    }


    const res = await fetch(`${url}/handler/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    if (!res.ok) {
      console.error("[SalesDrive] handler HTTP", res.status, text.slice(0, 300));
      return { sent: false, reason: `http_${res.status}` };
    }

    let parsed: { success?: boolean; data?: { orderId?: number }; message?: string } = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      return { sent: false, reason: "bad_response" };
    }
    const orderId = parsed.data?.orderId;
    if (!parsed.success || !orderId) {
      return { sent: false, reason: parsed.message ? String(parsed.message).slice(0, 200) : "rejected" };
    }
    return { sent: true, orderId, adopted: false };
  },
};

type AdminClient = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

/**
 * Pushes one site order into the CRM and records the outcome.
 * Safe to call repeatedly: an already-synced order is left untouched.
 */
export async function syncOrderToSalesDrive(
  admin: AdminClient,
  orderId: string,
): Promise<{ ok: boolean; salesDriveId?: number; reason?: string }> {
  const { data: order } = await admin
    .from("orders")
    .select(
      "id, order_no, customer_name, phone, email, comment, total, delivery, city, np_city, np_warehouse, np_warehouse_address, np_warehouse_data, user_id, salesdrive_order_id",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return { ok: false, reason: "order_missing" };
  if (order.salesdrive_order_id) {
    return { ok: true, salesDriveId: Number(order.salesdrive_order_id) };
  }

  const { data: items } = await admin
    .from("order_items")
    .select("product_sku, product_name, variant_label, unit_price, quantity")
    .eq("order_id", orderId);

  const [firstName, ...rest] = (order.customer_name ?? "").trim().split(/\s+/);

  // The picker stores the raw Nova Poshta point, which carries the refs the CRM
  // needs to resolve the exact branch.
  const point = (order.np_warehouse_data ?? null) as Record<string, unknown> | null;
  const npStr = (k: string) => {
    const v = point?.[k];
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };

  try {
    const result = await SalesDriveService.sendOrder({
      orderNo: Number(order.order_no),
      userId: order.user_id ?? null,
      firstName: firstName ?? "",
      lastName: rest.join(" "),
      phone: order.phone ?? "",
      email: order.email ?? null,
      comment: order.comment ?? null,
      total: Number(order.total ?? 0),
      delivery: order.delivery ?? "novaposhta",
      city: order.np_city ?? order.city ?? null,
      warehouse: order.np_warehouse ?? null,
      warehouseAddress: order.np_warehouse_address ?? npStr("description"),
      cityFullName: order.np_city ?? null,
      warehouseRef: npStr("ref"),
      cityRef: npStr("cityRef"),

      items: (items ?? []).map((i) => ({
        sku: i.product_sku ?? null,
        name: i.product_name,
        variant: i.variant_label ?? null,
        price: Number(i.unit_price),
        qty: i.quantity,
      })),
    });

    if (!result.sent) {
      await admin
        .from("orders")
        .update({
          salesdrive_sync_status: result.reason === "disabled" ? "disabled" : "error",
          salesdrive_sync_error: result.reason,
        })
        .eq("id", orderId);
      return { ok: false, reason: result.reason };
    }

    let statusId: number | null = null;
    try {
      statusId = (await SalesDriveService.getOrder(result.orderId))?.statusId ?? null;
    } catch {
      /* status is refreshed by the webhook anyway */
    }

    await admin
      .from("orders")
      .update({
        salesdrive_order_id: result.orderId,
        salesdrive_status_id: statusId,
        salesdrive_sync_status: "synced",
        salesdrive_sync_error: null,
        salesdrive_synced_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    return { ok: true, salesDriveId: result.orderId };
  } catch (e) {
    const reason = e instanceof Error ? e.message.slice(0, 200) : "unknown";
    console.error("[SalesDrive] sync failed", reason);
    await admin
      .from("orders")
      .update({ salesdrive_sync_status: "error", salesdrive_sync_error: reason })
      .eq("id", orderId);
    return { ok: false, reason };
  }
}

/**
 * Pull-based status refresh (belt and braces next to the webhook).
 *
 * The CRM stays the source of truth: only the SalesDrive id is taken from our
 * database, everything else is re-read from the API, so nothing a client sends
 * can influence the stored status.
 */
export async function refreshOrderStatuses(
  admin: AdminClient,
  userId: string,
  limit = 10,
): Promise<number> {
  if (!SalesDriveService.isEnabled()) return 0;

  const { data: rows } = await admin
    .from("orders")
    .select("id, salesdrive_order_id, status, tracking_number")
    .eq("user_id", userId)
    .not("salesdrive_order_id", "is", null)
    .not("status", "in", "(done,cancelled,returned,deleted)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!rows?.length) return 0;


  let updated = 0;
  for (const row of rows) {
    try {
      const remote = await SalesDriveService.getOrder(Number(row.salesdrive_order_id));
      if (!remote) continue;
      const patch: {
        salesdrive_status_id: number | null;
        salesdrive_synced_at: string;
        status?: string;
        tracking_number?: string;
      } = {
        salesdrive_status_id: remote.statusId,
        salesdrive_synced_at: new Date().toISOString(),
      };
      if (remote.status && remote.status !== row.status) patch.status = remote.status;
      if (remote.trackingNumber && remote.trackingNumber !== row.tracking_number)
        patch.tracking_number = remote.trackingNumber;
      if (Object.keys(patch).length <= 2) continue;
      await admin.from("orders").update(patch).eq("id", row.id);
      updated++;
    } catch (e) {
      console.error("[SalesDrive] status refresh failed", e);
    }
  }
  return updated;
}

/**
 * Admin-side status refresh: same pull logic as `refreshOrderStatuses`, but
 * across all users' newest open orders instead of a single account.
 */
export async function refreshAllOrderStatuses(
  admin: AdminClient,
  limit = 40,
): Promise<number> {
  if (!SalesDriveService.isEnabled()) return 0;

  const { data: rows } = await admin
    .from("orders")
    .select("id, salesdrive_order_id, status, tracking_number")
    .not("salesdrive_order_id", "is", null)
    .not("status", "in", "(done,cancelled,returned,deleted)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!rows?.length) return 0;

  let updated = 0;
  for (const row of rows) {
    try {
      const remote = await SalesDriveService.getOrder(Number(row.salesdrive_order_id));
      if (!remote) continue;
      const patch: {
        salesdrive_status_id: number | null;
        salesdrive_synced_at: string;
        status?: string;
        tracking_number?: string;
      } = {
        salesdrive_status_id: remote.statusId,
        salesdrive_synced_at: new Date().toISOString(),
      };
      if (remote.status && remote.status !== row.status) patch.status = remote.status;
      if (remote.trackingNumber && remote.trackingNumber !== row.tracking_number)
        patch.tracking_number = remote.trackingNumber;
      if (Object.keys(patch).length <= 2) continue;
      await admin.from("orders").update(patch).eq("id", row.id);
      updated++;
    } catch (e) {
      console.error("[SalesDrive] admin status refresh failed", e);
    }
  }
  return updated;
}
