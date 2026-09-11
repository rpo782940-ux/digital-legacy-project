/**
 * Signed HTTP client for the MySQL data bridge on the HostUkraine hosting.
 *
 * The edge runtime cannot open raw MySQL connections, so every database read or
 * write goes through bridge/api/index.php. The bridge keeps two strictly
 * separated connections:
 *
 *   - catalog (masteraf_new)      — SELECT only, never written to
 *   - shop    (masteraf_technoforma) — the new site's own users/orders/cart
 *
 * Credentials never reach the browser: this module is server-only and the
 * secret is read inside the request, not at module scope.
 */

type BridgeResponse<T> = { ok: true; data: T } | { ok: false; error: string };

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function bridgeCall<T>(op: string, params: Record<string, unknown> = {}): Promise<T> {
  const url = process.env["MYSQL_BRIDGE_URL"];
  const secret = process.env["MYSQL_BRIDGE_SECRET"];
  if (!url || !secret) throw new Error("bridge_not_configured");

  const body = JSON.stringify({ op, params });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = await hmacSha256Hex(secret, `${timestamp}.${body}`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-TF-Timestamp": timestamp,
      "X-TF-Signature": signature,
    },
    body,
  });

  const text = await response.text();
  let payload: BridgeResponse<T> | null = null;
  try {
    payload = JSON.parse(text) as BridgeResponse<T>;
  } catch {
    console.error(`[bridge] ${op}: non-JSON response (${response.status})`, text.slice(0, 300));
    throw new Error("bridge_bad_response");
  }
  if (!payload || payload.ok !== true) {
    const error = payload && "error" in payload ? payload.error : "unknown";
    console.error(`[bridge] ${op} failed: ${error}`);
    throw new Error(`bridge_${error}`);
  }
  return payload.data;
}

/** Read-only helpers for the old OpenCart catalog. */
export const catalogBridge = {
  categories: (lang: "ru" | "uk") => bridgeCall<CatalogCategoryRow[]>("catalog.categories", { lang }),
  products: (lang: "ru" | "uk", options: { categoryId?: number; limit?: number; offset?: number } = {}) =>
    bridgeCall<CatalogProductRow[]>("catalog.products", {
      lang,
      category_id: options.categoryId,
      limit: options.limit ?? 500,
      offset: options.offset ?? 0,
    }),
  product: (lang: "ru" | "uk", key: { productId?: number; slug?: string }) =>
    bridgeCall<CatalogProductRow | null>("catalog.product", {
      lang,
      product_id: key.productId,
      slug: key.slug,
    }),
  search: (lang: "ru" | "uk", q: string) => bridgeCall<CatalogProductRow[]>("catalog.search", { lang, q }),
  meta: () => bridgeCall<unknown>("catalog.meta"),
};

/** Read/write helpers for the new site's own database. */
export async function shopQuery<Row = Record<string, unknown>>(
  sql: string,
  args: Record<string, unknown> | unknown[] = [],
): Promise<{ rows: Row[]; affected: number; insert_id: string | null }> {
  return await bridgeCall("shop.query", { sql, args });
}

export async function shopTransaction(
  statements: Array<{ sql: string; args?: Record<string, unknown> | unknown[] }>,
): Promise<Array<{ rows: Record<string, unknown>[]; affected: number; insert_id: string | null }>> {
  return await bridgeCall("shop.transaction", { statements });
}

export type CatalogCategoryRow = {
  category_id: number | string;
  parent_id: number | string;
  image: string | null;
  sort_order: number | string;
  status: number | string;
  name: string;
  description: string | null;
  meta_title: string | null;
  meta_description: string | null;
  product_count: number | string;
  slug: string | null;
};

export type CatalogProductRow = {
  product_id: number | string;
  model: string | null;
  sku: string | null;
  image: string | null;
  quantity: number | string;
  price: string | number;
  status?: number | string;
  date_added?: string;
  date_modified?: string;
  sort_order?: number | string;
  name: string;
  description?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  special_price: string | number | null;
  gallery: string | null;
  category_ids: string | null;
  attributes?: Array<{ name: string; text: string }>;
  slug: string | null;
};

/** Absolute URL of a catalog image stored in the old shop. */
export function catalogImageUrl(path: string | null | undefined): string {
  if (!path) return "";
  const base = process.env["CATALOG_IMAGE_BASE_URL"] ?? "https://masteraform.com.ua/image/";
  const clean = String(path).replace(/^\/+/, "");
  return `${base.replace(/\/+$/, "")}/${clean}`;
}
