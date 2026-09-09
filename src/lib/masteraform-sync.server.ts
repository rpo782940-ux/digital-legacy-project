/**
 * MasteraForm -> new site catalog synchronisation worker.
 *
 * Server-only. Reads the live MasteraForm shop (see masteraform-source.server)
 * and writes everything into our own database:
 *   categories, products, descriptions, SEO (title / description / H1 / URL),
 *   main photo, gallery, stock, prices, sale prices and specials.
 *
 * Ordering follows the shop logic requested for the new site:
 *   new arrivals -> specials -> everything else.
 *
 * The frontend never contacts MasteraForm; it only reads our database.
 */

export type SyncTrigger = "cron" | "manual";

export type SyncResult = {
  runId: string | null;
  categories: number;
  created: number;
  updated: number;
  skipped: number;
  disabled: number;
  durationMs: number;
};

const NEW_BASE = 0;
const SALE_BASE = 10_000;
const REST_BASE = 100_000;

async function hash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function specsFrom(description: string, material: string | null): string[] {
  const specs: string[] = [];
  if (material) specs.push(material);

  const size = description.match(/(\d{2,4}\s*[хx×]\s*\d{2,4}(\s*[хx×]\s*\d{1,4})?)\s*мм/i);
  if (size) specs.push(`${size[1]!.replace(/\s+/g, "")} мм`);

  const output = description.match(/(\d+[\s-]*\d*)\s*шт\.?\s*за\s*смену/i);
  if (output) specs.push(`${output[1]!.trim()} шт/смена`);

  const resource = description.match(/Ресурс формы\s*([\d\s-]+)\s*шт/i);
  if (resource) specs.push(`ресурс ${resource[1]!.trim()} шт`);

  return specs.slice(0, 4);
}

import { scrubText } from "@/lib/product-content";

export async function runMasteraFormSync(trigger: SyncTrigger): Promise<SyncResult> {
  const startedAt = Date.now();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { loadMasteraFormCatalog } = await import("@/lib/masteraform-source.server");
  const { toUkrainian } = await import("@/lib/mf-translate.server");

  const { data: run } = await supabaseAdmin
    .from("sync_runs")
    .insert({ trigger, status: "running" })
    .select("id")
    .single();

  const runId = run?.id ?? null;
  const result: SyncResult = {
    runId,
    categories: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    disabled: 0,
    durationMs: 0,
  };

  try {
    const source = await loadMasteraFormCatalog();
    const now = new Date().toISOString();

    // ---------------------------------------------------------- categories
    const categoryIdBySlug = new Map<string, string>();

    for (const category of source.categories) {
      const { data: saved, error } = await supabaseAdmin
        .from("categories")
        .upsert(
          {
            external_id: category.externalId,
            slug: category.slug,
            seo_url: category.externalId,
            name_ru: category.nameRu,
            name_uk: category.nameUk,
            meta_title_ru: category.titleRu,
            meta_title_uk: category.titleUk,
            meta_desc_ru: category.descRu,
            meta_desc_uk: category.descUk,
            h1_ru: category.h1Ru,
            h1_uk: category.h1Uk,
            sort_order: category.sortOrder,
            is_active: true,
            synced_at: now,
          },
          { onConflict: "external_id" },
        )
        .select("id")
        .single();

      if (error) throw new Error(`category_${category.externalId}: ${error.message}`);
      if (saved) categoryIdBySlug.set(category.slug, saved.id);
      result.categories += 1;
    }

    // ------------------------------------------------------------ products
    const newRank = new Map(source.newIds.map((id, index) => [id, index]));
    const saleRank = new Map(source.saleIds.map((id, index) => [id, index]));

    const { data: existingRows } = await supabaseAdmin
      .from("products")
      .select("id, external_id, source_hash")
      .not("external_id", "is", null);

    const existing = new Map((existingRows ?? []).map((row) => [row.external_id as string, row]));
    const seen = new Set<string>();

    for (const product of source.products) {
      seen.add(product.id);

      const categoryId = categoryIdBySlug.get(product.categorySlug);
      if (!categoryId) {
        result.skipped += 1;
        continue;
      }

      const isNew = newRank.has(product.id);
      const isSale = product.oldPrice !== null || saleRank.has(product.id);
      const sortOrder = isNew
        ? NEW_BASE + newRank.get(product.id)!
        : isSale
          ? SALE_BASE + (saleRank.get(product.id) ?? 500)
          : REST_BASE + product.position;

      const specsRu = specsFrom(product.descriptionRu, product.material);
      const nameUk = product.nameUk;


      const payload = {
        external_id: product.id,
        category_id: categoryId,
        slug: `${product.path.split("/").pop() ?? "product"}--${product.id}`,
        seo_url: product.path,
        name_ru: product.nameRu,
        name_uk: nameUk,
        alt_ru: product.nameRu,
        alt_uk: nameUk,
        description_ru: scrubText(product.descriptionRu),
        description_uk: scrubText(toUkrainian(product.descriptionRu)),
        meta_title_ru: product.nameRu,
        meta_title_uk: nameUk,
        meta_desc_ru: scrubText(product.descriptionRu).slice(0, 300),
        meta_desc_uk: scrubText(toUkrainian(product.descriptionRu)).slice(0, 300),
        h1_ru: product.nameRu,
        h1_uk: nameUk,
        // original, full-resolution photo — never a resized cache copy
        image_path: product.image ?? "",
        gallery: product.gallery,
        specs_ru: specsRu.map(scrubText).filter(Boolean),
        specs_uk: specsRu.map((s) => scrubText(toUkrainian(s))).filter(Boolean),
        variants_ru: [],
        variants_uk: [],
        // No supplier/manufacturer data is ever stored or shown.
        brand: null,
        manufacturer: null,
        quantity: product.inStock ? 10 : 0,
        in_stock: product.inStock,
        price: product.price,
        old_price: product.oldPrice,
        special_price: product.oldPrice ? product.price : null,

        sort_order: sortOrder,
        is_new: isNew,
        is_special: isSale,
        is_active: true,
        synced_at: now,
      };

      const sourceHash = await hash(JSON.stringify({ ...payload, synced_at: null }));
      const current = existing.get(product.id);

      if (current?.source_hash === sourceHash) {
        result.skipped += 1;
        continue;
      }

      const { error } = await supabaseAdmin
        .from("products")
        .upsert({ ...payload, source_hash: sourceHash }, { onConflict: "external_id" });

      if (error) throw new Error(`product_${product.id}: ${error.message}`);

      if (current) result.updated += 1;
      else result.created += 1;
    }

    // -------------------------------------------- products removed upstream
    const stale = [...existing.keys()].filter((id) => !seen.has(id));
    if (stale.length) {
      const { error } = await supabaseAdmin
        .from("products")
        .update({ is_active: false, in_stock: false, synced_at: now })
        .in("external_id", stale);

      if (error) throw new Error(`disable_stale: ${error.message}`);
      result.disabled = stale.length;
    }

    result.durationMs = Date.now() - startedAt;

    if (runId) {
      await supabaseAdmin
        .from("sync_runs")
        .update({
          status: "success",
          categories_synced: result.categories,
          products_created: result.created,
          products_updated: result.updated,
          products_skipped: result.skipped,
          products_disabled: result.disabled,
          finished_at: new Date().toISOString(),
        })
        .eq("id", runId);
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("masteraform sync failed:", message);

    if (runId) {
      await supabaseAdmin
        .from("sync_runs")
        .update({ status: "failed", error: message, finished_at: new Date().toISOString() })
        .eq("id", runId);
    }

    throw error;
  }
}
