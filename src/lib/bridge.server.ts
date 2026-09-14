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

/**
 * Read-only catalog access.
 *
 * The old shop is ocStore/OpenCart 3 with unprefixed tables and SEO keywords in
 * `seo_url` (columns query/keyword). Its `language_id` values are not 1/2, so
 * they are resolved from the `language` table by code. All reads go through the
 * bridge's SELECT-only `catalog.query` operation — nothing is ever written.
 */
async function catalogQuery<Row>(sql: string, args: Record<string, unknown> = {}): Promise<Row[]> {
  const rows = await bridgeCall<Row[]>("catalog.query", {
    sql: sql.replace(/\s+/g, " ").trim(),
    args,
  });
  return Array.isArray(rows) ? rows : [];
}

let languageIds: Promise<Record<string, number>> | null = null;

async function langId(lang: "ru" | "uk"): Promise<number> {
  if (!languageIds) {
    languageIds = catalogQuery<{ language_id: string; code: string }>(
      "SELECT language_id, code FROM language",
    )
      .then((rows) => {
        const out: Record<string, number> = {};
        for (const row of rows) {
          const code = String(row.code ?? "").toLowerCase();
          if (code.startsWith("ru") && out["ru"] === undefined) out["ru"] = Number(row.language_id);
          if ((code.startsWith("uk") || code.startsWith("ua")) && out["uk"] === undefined)
            out["uk"] = Number(row.language_id);
        }
        return out;
      })
      .catch((error: Error) => {
        languageIds = null;
        throw error;
      });
  }
  const map = await languageIds;
  return map[lang] ?? map["ru"] ?? 1;
}

/** query -> keyword, e.g. "category_id=20" -> "forms-stolbov". */
async function seoMap(kind: "category_id" | "product_id"): Promise<Map<string, string>> {
  const rows = await catalogQuery<{ query: string; keyword: string }>(
    "SELECT query, keyword FROM seo_url WHERE query LIKE :k ORDER BY seo_url_id",
    { k: `${kind}=%` },
  ).catch(() => []);
  const map = new Map<string, string>();
  for (const row of rows) if (!map.has(row.query)) map.set(row.query, row.keyword);
  return map;
}

const PRODUCT_COLUMNS = `
  p.product_id, p.model, p.sku, p.image, p.quantity, p.price, p.status,
  p.date_added, p.date_modified, p.sort_order,
  pd.name, pd.description, pd.meta_title, pd.meta_description,
  (SELECT MIN(ps.price) FROM product_special ps
    WHERE ps.product_id = p.product_id
      AND (ps.date_start = '0000-00-00' OR ps.date_start <= NOW())
      AND (ps.date_end = '0000-00-00' OR ps.date_end >= NOW())) AS special_price,
  (SELECT GROUP_CONCAT(pi.image ORDER BY pi.sort_order SEPARATOR '|')
     FROM product_image pi WHERE pi.product_id = p.product_id) AS gallery,
  (SELECT GROUP_CONCAT(p2c2.category_id) FROM product_to_category p2c2
    WHERE p2c2.product_id = p.product_id) AS category_ids
`;

async function withProductSlugs(rows: CatalogProductRow[]): Promise<CatalogProductRow[]> {
  const seo = await seoMap("product_id");
  return rows.map((row) => ({
    ...row,
    slug: seo.get(`product_id=${row.product_id}`) ?? null,
  }));
}

export const catalogBridge = {
  categories: async (lang: "ru" | "uk"): Promise<CatalogCategoryRow[]> => {
    const [langValue, seo] = await Promise.all([langId(lang), seoMap("category_id")]);
    const rows = await catalogQuery<CatalogCategoryRow>(
      `SELECT c.category_id, c.parent_id, c.image, c.sort_order, c.status,
              cd.name, cd.description, cd.meta_title, cd.meta_description,
              (SELECT COUNT(*) FROM product_to_category p2c
                 JOIN product pr ON pr.product_id = p2c.product_id AND pr.status = 1
                WHERE p2c.category_id = c.category_id) AS product_count
         FROM category c
         JOIN category_description cd
           ON cd.category_id = c.category_id AND cd.language_id = :lang
        ORDER BY c.sort_order, cd.name`,
      { lang: langValue },
    );
    return rows.map((row) => ({
      ...row,
      slug: seo.get(`category_id=${row.category_id}`) ?? null,
    }));
  },

  products: async (
    lang: "ru" | "uk",
    options: { categoryId?: number; limit?: number; offset?: number } = {},
  ): Promise<CatalogProductRow[]> => {
    const langValue = await langId(lang);
    const limit = Math.min(Math.max(options.limit ?? 500, 1), 1000);
    const offset = Math.max(options.offset ?? 0, 0);
    const args: Record<string, unknown> = { lang: langValue };
    let join = "";
    if (options.categoryId !== undefined) {
      join =
        "JOIN product_to_category p2c ON p2c.product_id = p.product_id AND p2c.category_id = :cat";
      args["cat"] = options.categoryId;
    }
    const rows = await catalogQuery<CatalogProductRow>(
      `SELECT ${PRODUCT_COLUMNS}
         FROM product p
         JOIN product_description pd
           ON pd.product_id = p.product_id AND pd.language_id = :lang
         ${join}
        WHERE p.status = 1
        ORDER BY p.sort_order, pd.name
        LIMIT ${limit} OFFSET ${offset}`,
      args,
    );
    return await withProductSlugs(rows);
  },

  product: async (
    lang: "ru" | "uk",
    key: { productId?: number; slug?: string },
  ): Promise<CatalogProductRow | null> => {
    const langValue = await langId(lang);
    let productId = key.productId ?? 0;
    if (!productId && key.slug) {
      const seo = await seoMap("product_id");
      for (const [query, keyword] of seo) {
        if (keyword === key.slug || keyword.replace(/\.(php|html?)$/, "") === key.slug) {
          productId = Number(query.slice("product_id=".length));
          break;
        }
      }
    }
    if (!productId) return null;

    const rows = await catalogQuery<CatalogProductRow>(
      `SELECT ${PRODUCT_COLUMNS}
         FROM product p
         JOIN product_description pd
           ON pd.product_id = p.product_id AND pd.language_id = :lang
        WHERE p.product_id = :id AND p.status = 1
        LIMIT 1`,
      { lang: langValue, id: productId },
    );
    const row = rows[0];
    if (!row) return null;

    const attributes = await catalogQuery<{ name: string; text: string }>(
      `SELECT ad.name, pa.text
         FROM product_attribute pa
         JOIN attribute_description ad
           ON ad.attribute_id = pa.attribute_id AND ad.language_id = :lang1
        WHERE pa.product_id = :id AND pa.language_id = :lang2`,
      { lang1: langValue, id: productId, lang2: langValue },
    ).catch(() => []);

    const [withSlug] = await withProductSlugs([row]);
    return { ...withSlug!, attributes };
  },

  search: async (lang: "ru" | "uk", q: string): Promise<CatalogProductRow[]> => {
    const langValue = await langId(lang);
    const needle = `%${q.trim()}%`;
    const rows = await catalogQuery<CatalogProductRow>(
      `SELECT ${PRODUCT_COLUMNS}
         FROM product p
         JOIN product_description pd
           ON pd.product_id = p.product_id AND pd.language_id = :lang
        WHERE p.status = 1
          AND (pd.name LIKE :q1 OR p.model LIKE :q2 OR p.sku LIKE :q3)
        ORDER BY pd.name
        LIMIT 120`,
      { lang: langValue, q1: needle, q2: needle, q3: needle },
    );
    return await withProductSlugs(rows);
  },

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
