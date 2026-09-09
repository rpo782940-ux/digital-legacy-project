import { createFileRoute } from "@tanstack/react-router";

/**
 * SalesDrive status webhook.
 *
 * URL: {site}/api/public/salesdrive/webhook?secret=<SALESDRIVE_WEBHOOK_SECRET>
 * (the secret may also be sent as the `X-Webhook-Secret` header).
 *
 * The payload is only used to learn WHICH order changed. The status and the
 * tracking number are then re-read from the SalesDrive API server side, so a
 * forged request can never push a fake status into the site.
 */

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Accepts JSON, form-encoded and `data[id]` style bodies. */
async function readOrderId(request: Request): Promise<number | null> {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("data[id]") ?? url.searchParams.get("id");
  if (fromQuery && /^\d+$/.test(fromQuery)) return Number(fromQuery);

  const raw = await request.text();
  if (!raw) return null;

  try {
    const json = JSON.parse(raw) as Record<string, unknown>;
    const data = (json["data"] ?? json) as Record<string, unknown>;
    const id = data["id"] ?? json["id"] ?? json["orderId"];
    if (id != null && /^\d+$/.test(String(id))) return Number(id);
  } catch {
    const params = new URLSearchParams(raw);
    const id = params.get("data[id]") ?? params.get("id") ?? params.get("orderId");
    if (id && /^\d+$/.test(id)) return Number(id);
  }
  return null;
}

export const Route = createFileRoute("/api/public/salesdrive/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["SALESDRIVE_WEBHOOK_SECRET"] ?? "";
        if (!secret) return new Response("not configured", { status: 503 });

        const url = new URL(request.url);
        const provided =
          request.headers.get("x-webhook-secret") ?? url.searchParams.get("secret") ?? "";
        if (!timingSafeEqual(provided, secret)) {
          return new Response("invalid secret", { status: 401 });
        }

        const salesDriveId = await readOrderId(request);
        if (!salesDriveId) return new Response("missing order id", { status: 400 });

        const { SalesDriveService } = await import("@/lib/salesdrive.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let remote = null;
        try {
          remote = await SalesDriveService.getOrder(salesDriveId);
        } catch (e) {
          console.error("[SalesDrive webhook] fetch failed", e);
          return new Response("crm unavailable", { status: 502 });
        }
        if (!remote) return new Response("order not found in crm", { status: 404 });

        const patch = {
          salesdrive_status_id: remote.statusId,
          salesdrive_sync_status: "synced",
          salesdrive_synced_at: new Date().toISOString(),
          ...(remote.status ? { status: remote.status } : {}),
          ...(remote.trackingNumber ? { tracking_number: remote.trackingNumber } : {}),
        };

        // Match by CRM id first, then by the externalId we issued (tf-<order_no>).
        const orderNo = remote.externalId?.startsWith("tf-")
          ? Number(remote.externalId.slice(3))
          : null;

        const { data: updated } = await supabaseAdmin
          .from("orders")
          .update(patch)
          .eq("salesdrive_order_id", salesDriveId)
          .select("id");

        if ((!updated || updated.length === 0) && orderNo && Number.isFinite(orderNo)) {
          await supabaseAdmin
            .from("orders")
            .update({ ...patch, salesdrive_order_id: salesDriveId })
            .eq("order_no", orderNo);
        }

        return Response.json({ ok: true, status: remote.status, id: salesDriveId });
      },
    },
  },
});
