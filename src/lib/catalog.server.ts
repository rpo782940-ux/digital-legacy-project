/**
 * Server-only catalog reads.
 * The database (filled by the MasteraForm sync worker) is the single source of
 * truth — no static JSON catalog exists anymore.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { CategorySummary, Lang, Product, Variant } from "@/lib/site";
import {
  localImage,
  localImages,
  productAlt,
  productDescription,
  scrubText,
} from "@/lib/product-content";


const PRODUCT_COLUMNS =
  "external_id, sku, slug, name_ru, name_uk, alt_ru, alt_uk, image_path, gallery, specs_ru, specs_uk, variants_ru, variants_uk, description_ru, description_uk, price, old_price, in_stock, is_new, is_special, brand, sort_order, category_id";

export function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const url = process.env["SUPABASE_URL"]!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

type Row = Record<string, unknown>;

/** Categories retired from the site but still present in the source data. */
const HIDDEN_CATEGORIES = new Set(["forms_schelevogo_pola"]);

const strList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

const variantList = (value: unknown): Variant[] =>
  Array.isArray(value)
    ? (value as Variant[]).filter((v) => v && typeof v.label === "string")
    : [];

const num = (value: unknown): number | null =>
  value === null || value === undefined ? null : Number(value);

export function toProduct(row: Row, lang: Lang, categorySlug: string): Product {
  const uk = lang === "uk";
  const name = scrubText(String((uk ? row["name_uk"] : row["name_ru"]) ?? ""));
  const slug = String(row["slug"] ?? "");
  // Defensive: never render supplier/location traces coming from raw data.
  const specs = strList(uk ? row["specs_uk"] : row["specs_ru"]).map(scrubText).filter(Boolean);
  const base = { name, slug, category: categorySlug, specs };
  return {
    id: String(row["external_id"] ?? row["slug"]),
    sku: row["sku"] ? String(row["sku"]) : null,
    slug,
    name,
    alt: productAlt(base, lang),
    image: localImage(String(row["image_path"] ?? "")),
    gallery: localImages(strList(row["gallery"])),
    specs,
    description: productDescription(base, lang),
    variants: variantList(uk ? row["variants_uk"] : row["variants_ru"]),
    price: num(row["price"]),
    oldPrice: num(row["old_price"]),
    inStock: row["in_stock"] !== false,
    isNew: row["is_new"] === true,
    isSpecial: row["is_special"] === true,
    brand: null,
    category: categorySlug,
  };
}


async function categoryMap() {
  const supabase = publicClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, slug")
    .eq("is_active", true);
  if (error) throw new Error(error.message);

  const byId = new Map<string, string>();
  const bySlug = new Map<string, string>();
  for (const c of data ?? []) {
    if (HIDDEN_CATEGORIES.has(c.slug)) continue;
    byId.set(c.id, c.slug);
    bySlug.set(c.slug, c.id);
  }
  return { byId, bySlug };
}

/** Category cards: product counts and a cover image per category. */
export async function loadNav(): Promise<{ categories: CategorySummary[]; total: number }> {
  const supabase = publicClient();
  const { byId } = await categoryMap();

  const { data, error } = await supabase
    .from("products")
    .select("category_id, image_path, name_ru, name_uk, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(2000);
  if (error) throw new Error(error.message);

  const counts = new Map<string, number>();
  const covers = new Map<string, string>();
  for (const row of data ?? []) {
    const slug = byId.get(row.category_id);
    if (!slug) continue;
    counts.set(slug, (counts.get(slug) ?? 0) + 1);
    if (!covers.has(slug) && row.image_path) covers.set(slug, localImage(row.image_path));
  }

  const categories: CategorySummary[] = [...byId.values()].map((slug) => ({
    slug,
    name: slug,
    count: counts.get(slug) ?? 0,
    cover: covers.get(slug) ?? "/brand/logo.png",
  }));

  return { categories, total: data?.length ?? 0 };
}

/** All active products of one category, already sorted new → sale → rest. */
export async function loadCategory(slug: string, lang: Lang): Promise<Product[]> {
  const supabase = publicClient();
  const { bySlug } = await categoryMap();
  const id = bySlug.get(slug);
  if (!id) return [];

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("category_id", id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(1000);
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => toProduct(row as Row, lang, slug));
}

/** Home-page blocks: newest arrivals and current specials. */
export async function loadHighlights(
  lang: Lang,
): Promise<{ fresh: Product[]; specials: Product[] }> {
  const supabase = publicClient();
  const { byId } = await categoryMap();

  const pick = async (column: "is_new" | "is_special") => {
    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_COLUMNS)
      .eq("is_active", true)
      .eq(column, true)
      .order("sort_order", { ascending: true })
      .limit(8);
    if (error) throw new Error(error.message);
    return (data ?? [])
      .filter((row) => byId.has((row as Row)["category_id"] as string))
      .map((row) => toProduct(row as Row, lang, byId.get((row as Row)["category_id"] as string)!));
  };

  const [fresh, specials] = await Promise.all([pick("is_new"), pick("is_special")]);
  return { fresh, specials };
}

/** Real catalog search: every typed word must match a name, article or slug. */
export async function loadSearch(query: string, lang: Lang): Promise<Product[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const supabase = publicClient();
  const { byId } = await categoryMap();
  const terms = q
    .replace(/[%,()]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .slice(0, 5);
  if (!terms.length) return [];

  let request = supabase.from("products").select(PRODUCT_COLUMNS).eq("is_active", true);
  for (const term of terms) {
    const pattern = `%${term}%`;
    request = request.or(
      [
        `name_ru.ilike.${pattern}`,
        `name_uk.ilike.${pattern}`,
        `sku.ilike.${pattern}`,
        `slug.ilike.${pattern}`,
        `seo_url.ilike.${pattern}`,
        `external_id.ilike.${pattern}`,
      ].join(","),
    );
  }

  const { data, error } = await request.order("sort_order", { ascending: true }).limit(120);
  if (error) throw new Error(error.message);

  const needle = q.toLowerCase();
  // Exact article matches and name hits rank above incidental matches.
  const score = (row: Row) => {
    const sku = String(row["sku"] ?? "").toLowerCase();
    const name = `${row["name_ru"] ?? ""} ${row["name_uk"] ?? ""}`.toLowerCase();
    if (sku && sku === needle) return 0;
    if (sku.includes(needle)) return 1;
    if (name.startsWith(needle)) return 2;
    if (name.includes(needle)) return 3;
    return 4;
  };

  return (data ?? [])
    .filter((row) => byId.has((row as Row)["category_id"] as string))
    .sort((a, b) => score(a as Row) - score(b as Row))
    .map((row) => toProduct(row as Row, lang, byId.get((row as Row)["category_id"] as string)!));
}


/** Single product page: the item itself plus siblings from the same category. */
export async function loadProduct(
  slug: string,
  lang: Lang,
): Promise<{ product: Product; categorySlug: string; related: Product[] } | null> {
  const supabase = publicClient();
  const { byId } = await categoryMap();

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("slug", slug)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as Row;
  const categoryId = String(row["category_id"] ?? "");
  const categorySlug = byId.get(categoryId) ?? "";
  const product = toProduct(row, lang, categorySlug);

  const { data: siblings } = await supabase
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("category_id", categoryId)
    .eq("is_active", true)
    .neq("slug", slug)
    .order("sort_order", { ascending: true })
    .limit(8);

  const related = (siblings ?? []).map((r) => toProduct(r as Row, lang, categorySlug));
  return { product, categorySlug, related };
}

/** Slugs of every active product — used to build the sitemap. */
export async function loadProductSlugs(): Promise<string[]> {
  const supabase = publicClient();
  const { data, error } = await supabase
    .from("products")
    .select("slug, updated_at")
    .eq("is_active", true)
    .order("slug", { ascending: true })
    .limit(5000);
  if (error) return [];
  return (data ?? [])
    .map((row) => String((row as Row)["slug"] ?? ""))
    .filter((slug) => slug.length > 0);
}
