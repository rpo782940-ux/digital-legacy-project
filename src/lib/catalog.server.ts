/**
 * Server-only catalog reads.
 *
 * The single source of truth is the old OpenCart database (masteraf_new),
 * reached through the signed PHP bridge on the HostUkraine hosting. Nothing is
 * written there — the bridge rejects every non-SELECT statement.
 *
 *   catalog.server.ts -> bridge.server.ts -> /bridge/api/index.php -> MySQL
 */
import {
  catalogBridge,
  catalogImageUrl,
  type CatalogCategoryRow,
  type CatalogProductRow,
} from "@/lib/bridge.server";
import { CATEGORIES, type CategorySummary, type Lang, type Product } from "@/lib/site";
import { productAlt, productDescription, scrubText } from "@/lib/product-content";

/** Categories retired from the site but still present in the source data. */
const HIDDEN_CATEGORIES = new Set(["forms_schelevogo_pola"]);

const PAGE_SIZE = 1000;
const TTL_MS = 5 * 60_000;

/** Site category slugs, keyed by a loose comparable form of the slug/name. */
const SITE_SLUGS = new Map<string, string>();
for (const c of CATEGORIES) SITE_SLUGS.set(normalize(c.slug), c.slug);

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/\.(php|html?)$/, "")
    .replace(/[^a-z0-9а-яіїєґ]+/gi, "");
}

// ------------------------------------------------------------------ live cache

type Snapshot = {
  products: Product[];
  bySlug: Map<string, Product>;
  byCategory: Map<string, Product[]>;
  categories: CategorySummary[];
  loadedAt: number;
};

const cache = new Map<Lang, Snapshot>();
const inflight = new Map<Lang, Promise<Snapshot>>();

function html(value: unknown): string {
  return scrubText(
    String(value ?? "")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

const num = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/** OpenCart SEO keyword, or a stable id-based slug when the shop has none. */
function productSlug(row: CatalogProductRow): string {
  const seo = String(row.slug ?? "").replace(/\.(php|html?)$/, "");
  return seo || `p${row.product_id}`;
}

export function toProduct(row: CatalogProductRow, lang: Lang, categorySlug: string): Product {
  const name = scrubText(String(row.name ?? ""));
  const slug = productSlug(row);
  const specs = (row.attributes ?? [])
    .map((a) => `${scrubText(String(a.name ?? ""))}: ${scrubText(String(a.text ?? ""))}`)
    .map((s) => s.replace(/^:\s*/, "").trim())
    .filter(Boolean);
  const base = { name, slug, category: categorySlug, specs };

  const listPrice = num(row.price);
  const special = num(row.special_price);
  const gallery = String(row.gallery ?? "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(catalogImageUrl);
  const description = html(row.description) || productDescription(base, lang);
  const added = row.date_added ? Date.parse(String(row.date_added).replace(" ", "T")) : NaN;

  return {
    id: String(row.product_id),
    sku: row.model ? String(row.model) : row.sku ? String(row.sku) : null,
    slug,
    name,
    alt: productAlt(base, lang),
    image: catalogImageUrl(row.image),
    gallery,
    specs,
    description,
    variants: [],
    price: special ?? listPrice,
    oldPrice: special ? listPrice : null,
    inStock: (num(row.quantity) ?? 0) > 0,
    isNew: Number.isFinite(added) ? Date.now() - added < 90 * 86_400_000 : false,
    isSpecial: special !== null,
    brand: null,
    category: categorySlug,
  };
}

/** category_id -> site category slug, built from the shop's own SEO keywords. */
function categoryIndex(rows: CatalogCategoryRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    if (String(row.status) === "0") continue;
    const candidates = [row.slug ?? "", row.meta_title ?? "", row.name ?? ""];
    for (const candidate of candidates) {
      const slug = SITE_SLUGS.get(normalize(String(candidate)));
      if (slug && !HIDDEN_CATEGORIES.has(slug)) {
        map.set(String(row.category_id), slug);
        break;
      }
    }
  }
  return map;
}

async function fetchAllProducts(lang: Lang): Promise<CatalogProductRow[]> {
  const all: CatalogProductRow[] = [];
  for (let offset = 0; offset < 20_000; offset += PAGE_SIZE) {
    const page = await catalogBridge.products(lang, { limit: PAGE_SIZE, offset });
    if (!Array.isArray(page) || page.length === 0) break;
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return all;
}

async function snapshot(lang: Lang): Promise<Snapshot> {
  const cached = cache.get(lang);
  if (cached && Date.now() - cached.loadedAt < TTL_MS) return cached;
  const running = inflight.get(lang);
  if (running) return await running;

  const task = (async (): Promise<Snapshot> => {
    const [categoryRows, productRows] = await Promise.all([
      catalogBridge.categories(lang),
      fetchAllProducts(lang),
    ]);
    const index = categoryIndex(categoryRows ?? []);

    const products: Product[] = [];
    const bySlug = new Map<string, Product>();
    const byCategory = new Map<string, Product[]>();

    for (const row of productRows) {
      const ids = String(row.category_ids ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const slugs = [...new Set(ids.map((id) => index.get(id)).filter((s): s is string => !!s))];
      const product = toProduct(row, lang, slugs[0] ?? "");
      products.push(product);
      bySlug.set(product.slug, product);
      for (const slug of slugs) {
        const list = byCategory.get(slug) ?? [];
        list.push(slugs[0] === slug ? product : { ...product, category: slug });
        byCategory.set(slug, list);
      }
    }

    const counts = new Map<string, number>();
    const covers = new Map<string, string>();
    for (const [slug, list] of byCategory) {
      counts.set(slug, list.length);
      const withImage = list.find((p) => p.image);
      if (withImage) covers.set(slug, withImage.image);
    }

    const categories: CategorySummary[] = CATEGORIES.filter(
      (c) => !HIDDEN_CATEGORIES.has(c.slug),
    ).map((c) => ({
      slug: c.slug,
      name: c.slug,
      count: counts.get(c.slug) ?? 0,
      cover: covers.get(c.slug) ?? "/brand/logo.png",
    }));

    const fresh: Snapshot = { products, bySlug, byCategory, categories, loadedAt: Date.now() };
    cache.set(lang, fresh);
    return fresh;
  })();

  inflight.set(lang, task);
  try {
    return await task;
  } finally {
    inflight.delete(lang);
  }
}

// ----------------------------------------------------------------- public API

/**
 * The bridge is the only data source; when the hosting side is misconfigured
 * the pages must still render (empty, never with invented products).
 */
const EMPTY: Snapshot = {
  products: [],
  bySlug: new Map(),
  byCategory: new Map(),
  categories: CATEGORIES.filter((c) => !HIDDEN_CATEGORIES.has(c.slug)).map((c) => ({
    slug: c.slug,
    name: c.slug,
    count: 0,
    cover: "/brand/logo.png",
  })),
  loadedAt: 0,
};

async function safeSnapshot(lang: Lang): Promise<Snapshot> {
  try {
    return await snapshot(lang);
  } catch (error) {
    console.error("[catalog] bridge unavailable:", (error as Error).message);
    return EMPTY;
  }
}

/** Category cards: product counts and a cover image per category. */
export async function loadNav(): Promise<{ categories: CategorySummary[]; total: number }> {
  const data = await safeSnapshot("ru");
  return { categories: data.categories, total: data.products.length };
}

/** All active products of one category, specials and new arrivals first. */
export async function loadCategory(slug: string, lang: Lang): Promise<Product[]> {
  if (HIDDEN_CATEGORIES.has(slug)) return [];
  const data = await safeSnapshot(lang);
  return data.byCategory.get(slug) ?? [];
}

/** Home-page blocks: newest arrivals and current specials. */
export async function loadHighlights(
  lang: Lang,
): Promise<{ fresh: Product[]; specials: Product[] }> {
  const data = await safeSnapshot(lang);
  const visible = data.products.filter((p) => p.category);
  return {
    fresh: visible.filter((p) => p.isNew).slice(0, 8),
    specials: visible.filter((p) => p.isSpecial).slice(0, 8),
  };
}

/** Catalog search over the real OpenCart data (name, model, article). */
export async function loadSearch(query: string, lang: Lang): Promise<Product[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const rows = await catalogBridge.search(lang, q).catch((error: Error) => {
    console.error("[catalog] search failed:", error.message);
    return [] as Awaited<ReturnType<typeof catalogBridge.search>>;
  });
  const data = await safeSnapshot(lang);
  const needle = q.toLowerCase();

  return (rows ?? [])
    .map((row) => data.bySlug.get(productSlug(row)) ?? toProduct(row, lang, ""))
    .sort((a, b) => score(a, needle) - score(b, needle));
}

function score(p: Product, needle: string): number {
  const sku = (p.sku ?? "").toLowerCase();
  const name = p.name.toLowerCase();
  if (sku && sku === needle) return 0;
  if (sku.includes(needle)) return 1;
  if (name.startsWith(needle)) return 2;
  if (name.includes(needle)) return 3;
  return 4;
}

/** Single product page: the item itself plus siblings from the same category. */
export async function loadProduct(
  slug: string,
  lang: Lang,
): Promise<{ product: Product; categorySlug: string; related: Product[] } | null> {
  const data = await safeSnapshot(lang);
  const known = data.bySlug.get(slug);

  // Full record (attributes, gallery, description) comes from the bridge.
  const idMatch = /^p(\d+)$/.exec(slug);
  const row = await catalogBridge.product(lang, {
    productId: known ? Number(known.id) : idMatch ? Number(idMatch[1]) : undefined,
    slug: known || idMatch ? undefined : slug,
  });
  if (!row && !known) return null;

  const categorySlug = known?.category ?? "";
  const product = row ? toProduct(row, lang, categorySlug) : known!;
  const related = (data.byCategory.get(categorySlug) ?? [])
    .filter((p) => p.slug !== product.slug)
    .slice(0, 8);

  return { product, categorySlug, related };
}

/** Slugs of every active product — used to build the sitemap. */
export async function loadProductSlugs(): Promise<string[]> {
  try {
    const data = await safeSnapshot("ru");
    return data.products.map((p) => p.slug).sort();
  } catch {
    return [];
  }
}
