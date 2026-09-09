import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type OrderUpdate = Database["public"]["Tables"]["orders"]["Update"];

/**
 * Admin RPC surface. Every function re-checks the administrator role on the
 * server (`requireAdmin`) — hiding a button in the UI is never the boundary.
 * All writes go through the caller's RLS-scoped client, so the database
 * policies are a second, independent gate.
 */

/** Cheap probe used by the UI to decide whether to show the admin menu. */
export const amIAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { isAdminUser } = await import("./admin.server");
    return { admin: await isAdminUser(context) };
  });

/* ----------------------------- orders ----------------------------- */

export const adminListOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        q: z.string().trim().max(120).optional(),
        status: z.string().trim().max(30).optional(),
        limit: z.number().int().min(1).max(200).optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin(context);

    let query = context.supabase
      .from("orders")
      .select(
        "id, order_no, created_at, customer_name, phone, email, status, total, delivery, np_city, np_warehouse, np_warehouse_address, tracking_number, salesdrive_order_id, salesdrive_sync_status, comment",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);

    if (data.status) query = query.eq("status", data.status);
    if (data.q) {
      const q = data.q.replace(/[%,]/g, " ");
      query = query.or(
        `customer_name.ilike.%${q}%,phone.ilike.%${q}%,tracking_number.ilike.%${q}%`,
      );
    }

    const { data: orders, error } = await query;
    if (error) throw new Error(error.message);

    const ids = (orders ?? []).map((o) => o.id);
    const { data: items } = ids.length
      ? await context.supabase
          .from("order_items")
          .select("order_id, product_sku, product_name, variant_label, unit_price, quantity")
          .in("order_id", ids)
      : { data: [] as never[] };

    return (orders ?? []).map((o) => ({
      ...o,
      items: (items ?? []).filter((i) => i.order_id === o.id),
    }));
  });

export const adminUpdateOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.string().trim().max(30).optional(),
        tracking_number: z.string().trim().max(60).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin(context);
    const patch: OrderUpdate = {};
    if (data.status) patch.status = data.status;
    if (data.tracking_number !== undefined) patch.tracking_number = data.tracking_number;
    const { error } = await context.supabase.from("orders").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Re-reads live statuses from the CRM for the newest orders. */
export const adminRefreshOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { refreshAllOrderStatuses } = await import("./salesdrive.server");
    const updated = await refreshAllOrderStatuses(supabaseAdmin, 40);
    return { updated };
  });

/* ---------------------------- categories --------------------------- */

export const adminListCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin(context);
    const { data, error } = await context.supabase
      .from("categories")
      .select("id, slug, name_ru, name_uk, sort_order, is_active, image_path")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminSaveCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid().nullable().optional(),
        slug: z.string().trim().min(2).max(90),
        name_ru: z.string().trim().min(1).max(160),
        name_uk: z.string().trim().min(1).max(160),
        sort_order: z.number().int().min(0).max(9999),
        is_active: z.boolean(),
        image_path: z.string().trim().max(300).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin(context);
    const row = {
      slug: data.slug,
      name_ru: data.name_ru,
      name_uk: data.name_uk,
      sort_order: data.sort_order,
      is_active: data.is_active,
      image_path: data.image_path ?? null,
    };
    const res = data.id
      ? await context.supabase.from("categories").update(row).eq("id", data.id)
      : await context.supabase.from("categories").insert(row);
    if (res.error) throw new Error(res.error.message);
    return { ok: true as const };
  });

/* ----------------------------- products ---------------------------- */

export const adminListProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        q: z.string().trim().max(120).optional(),
        categoryId: z.string().uuid().nullable().optional(),
        page: z.number().int().min(0).max(500).optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin(context);

    const page = data.page ?? 0;
    const size = 40;
    let query = context.supabase
      .from("products")
      .select(
        "id, sku, external_id, slug, name_ru, name_uk, price, old_price, special_price, is_active, in_stock, image_path, category_id, sort_order",
        { count: "exact" },
      )
      .order("sort_order", { ascending: true })
      .range(page * size, page * size + size - 1);

    if (data.categoryId) query = query.eq("category_id", data.categoryId);
    if (data.q) {
      // Every word must match somewhere, so results are real hits, not guesses.
      for (const term of data.q.split(/\s+/).filter(Boolean).slice(0, 5)) {
        const p = `%${term.replace(/[%,()]/g, " ")}%`;
        query = query.or(
          `name_ru.ilike.${p},name_uk.ilike.${p},sku.ilike.${p},slug.ilike.${p},external_id.ilike.${p}`,
        );
      }
    }


    const { data: rows, error, count } = await query;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], count: count ?? 0, page, size };
  });

export const adminGetProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin(context);
    const { data: row, error } = await context.supabase
      .from("products")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

const productSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  category_id: z.string().uuid(),
  slug: z.string().trim().min(2).max(180),
  sku: z.string().trim().max(80).nullable(),
  name_ru: z.string().trim().min(1).max(240),
  name_uk: z.string().trim().min(1).max(240),
  description_ru: z.string().trim().max(20000).nullable(),
  description_uk: z.string().trim().max(20000).nullable(),
  price: z.number().nonnegative().max(10_000_000).nullable(),
  old_price: z.number().nonnegative().max(10_000_000).nullable(),
  special_price: z.number().nonnegative().max(10_000_000).nullable(),
  image_path: z.string().trim().max(400),
  gallery: z.array(z.string().trim().max(400)).max(30),
  specs_ru: z.array(z.string().trim().max(300)).max(60),
  specs_uk: z.array(z.string().trim().max(300)).max(60),
  is_active: z.boolean(),
  in_stock: z.boolean(),
  sort_order: z.number().int().min(0).max(99999),
  meta_title_ru: z.string().trim().max(300).nullable(),
  meta_title_uk: z.string().trim().max(300).nullable(),
  meta_desc_ru: z.string().trim().max(600).nullable(),
  meta_desc_uk: z.string().trim().max(600).nullable(),
});

export const adminSaveProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => productSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin(context);

    const { id, ...rest } = data;
    const row = { ...rest, gallery: rest.gallery as unknown as never };
    const res = id
      ? await context.supabase.from("products").update(row).eq("id", id).select("id").single()
      : await context.supabase.from("products").insert(row).select("id").single();
    if (res.error) throw new Error(res.error.message);
    return { ok: true as const, id: res.data.id };
  });

/* --------------------------- excel import -------------------------- */

const importSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).min(1).max(5000),
  apply: z.boolean(),
});

/**
 * Two-phase Excel import: `apply:false` returns the plan only, `apply:true`
 * performs it. Nothing is ever deleted and existing products are matched by
 * external_id / SKU / slug, so a repeated import updates instead of cloning.
 */
export const adminImportProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => importSchema.parse(data))
  .handler(async ({ data, context }) => {
    const {
      requireAdmin,
      normalizeRow,
      parseNumber,
      parseList,
      parseBool,
      slugify,
      normalizeImagePath,
    } = await import("./admin.server");
    await requireAdmin(context);

    const { data: cats } = await context.supabase
      .from("categories")
      .select("id, slug, name_ru, name_uk, external_id");
    const catBy = new Map<string, string>();
    for (const c of cats ?? []) {
      catBy.set(c.slug.toLowerCase(), c.id);
      catBy.set(c.name_ru.toLowerCase(), c.id);
      catBy.set(c.name_uk.toLowerCase(), c.id);
      catBy.set(c.id, c.id);
      if (c.external_id) catBy.set(String(c.external_id).toLowerCase(), c.id);
    }

    const { data: existing } = await context.supabase
      .from("products")
      .select("id, sku, external_id, slug")
      .limit(5000);
    const byExternal = new Map<string, string>();
    const bySku = new Map<string, string>();
    const bySlug = new Map<string, string>();
    for (const p of existing ?? []) {
      if (p.external_id) byExternal.set(String(p.external_id).toLowerCase(), p.id);
      if (p.sku) bySku.set(String(p.sku).toLowerCase(), p.id);
      bySlug.set(p.slug.toLowerCase(), p.id);
    }


    type PlanRow = {
      line: number;
      key: string;
      name: string;
      action: "create" | "update" | "skip" | "error";
      reason?: string;
    };
    const plan: PlanRow[] = [];
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    let withCategory = 0;
    let withoutCategory = 0;
    /** OpenCart category keys we could not map onto a site category. */
    const unmatched = new Map<string, number>();
    /** Site categories that received products, by category id. */
    const usedCategories = new Set<string>();

    for (let i = 0; i < data.rows.length; i++) {
      const raw = normalizeRow(data.rows[i] as Record<string, string>);
      const line = i + 2;
      const name = raw["name_ru"] ?? raw["name_uk"] ?? "";
      const key = raw["external_id"] ?? raw["sku"] ?? raw["seo_url"] ?? name;


      if (!name) {
        // A blank padding row from an OpenCart export is not an import error.
        const empty = Object.values(data.rows[i] as Record<string, unknown>).every(
          (v) => v === null || v === undefined || String(v).trim() === "",
        );
        if (empty) {
          skipped++;
          plan.push({ line, key, name, action: "skip", reason: "пустая строка" });
          continue;
        }
        errors++;
        plan.push({ line, key, name, action: "error", reason: "нет названия" });
        continue;
      }


      const matchId =
        (raw["external_id"] && byExternal.get(raw["external_id"].toLowerCase())) ||
        (raw["sku"] && bySku.get(raw["sku"].toLowerCase())) ||
        (raw["seo_url"] && bySlug.get(raw["seo_url"].toLowerCase())) ||
        null;

      let categoryId: string | null = null;
      const catKeys = (raw["category"] ?? "")
        .split(/[,;|]/)
        .map((p) => p.trim())
        .filter(Boolean);
      for (const part of catKeys) {
        const hit = catBy.get(part.toLowerCase());
        if (hit) {
          categoryId = hit;
          break;
        }
      }
      if (categoryId) {
        withCategory++;
        usedCategories.add(categoryId);
      } else {
        withoutCategory++;
        // Never invent a category from a raw OpenCart id — report it instead.
        for (const k of catKeys) unmatched.set(k, (unmatched.get(k) ?? 0) + 1);
      }

      if (!matchId && !categoryId) {
        skipped++;
        plan.push({ line, key, name, action: "skip", reason: "категория не найдена" });
        continue;
      }



      const patch: Record<string, unknown> = {};
      const put = (k: string, v: unknown) => {
        if (v !== null && v !== undefined) patch[k] = v;
      };
      put("name_ru", raw["name_ru"] ?? raw["name_uk"]);
      put("name_uk", raw["name_uk"] ?? raw["name_ru"]);
      put("description_ru", raw["description_ru"]);
      put("description_uk", raw["description_uk"]);
      put("sku", raw["sku"]);
      put("price", parseNumber(raw["price"]));
      put("old_price", parseNumber(raw["old_price"]));
      put("special_price", parseNumber(raw["special_price"]));
      put("manufacturer", raw["manufacturer"]);
      put("brand", raw["brand"]);
      const qty = parseNumber(raw["quantity"]);
      if (qty !== null) {
        patch["quantity"] = Math.max(0, Math.round(qty));
        patch["in_stock"] = qty > 0;
      }
      const img = normalizeImagePath(raw["image_path"]);
      if (img) patch["image_path"] = img;
      const gallery = parseList(raw["gallery"])
        .map((g) => normalizeImagePath(g))
        .filter((g): g is string => Boolean(g));
      if (gallery.length) patch["gallery"] = gallery;

      if (raw["specs_ru"]) patch["specs_ru"] = parseList(raw["specs_ru"]);
      if (raw["specs_uk"]) patch["specs_uk"] = parseList(raw["specs_uk"]);
      put("meta_title_ru", raw["meta_title_ru"]);
      put("meta_title_uk", raw["meta_title_uk"]);
      put("meta_desc_ru", raw["meta_desc_ru"]);
      put("meta_desc_uk", raw["meta_desc_uk"]);
      const active = parseBool(raw["is_active"]);
      if (active !== null) patch["is_active"] = active;
      if (categoryId) patch["category_id"] = categoryId;
      patch["synced_at"] = new Date().toISOString();

      if (matchId) {
        updated++;
        plan.push({ line, key, name, action: "update" });
        if (data.apply) {
          const { error } = await context.supabase
            .from("products")
            .update(patch as never)
            .eq("id", matchId);
          if (error) {
            updated--;
            errors++;
            plan[plan.length - 1] = { line, key, name, action: "error", reason: error.message };
          }
        }
      } else {
        const slug = (raw["seo_url"] ?? slugify(name)) || slugify(key || String(line));
        created++;
        plan.push({ line, key, name, action: "create" });
        if (data.apply) {
          const insert = {
            ...patch,
            slug: bySlug.has(slug.toLowerCase()) ? `${slug}_${line}` : slug,
            category_id: categoryId,
            external_id: raw["external_id"] ?? null,
            image_path: img ?? "",
            name_ru: patch["name_ru"] ?? name,
            name_uk: patch["name_uk"] ?? name,
          };

          const { error } = await context.supabase.from("products").insert(insert as never);
          if (error) {
            created--;
            errors++;
            plan[plan.length - 1] = { line, key, name, action: "error", reason: error.message };
          } else {
            bySlug.set(slug.toLowerCase(), "new");
          }
        }
      }
    }

    const catName = new Map((cats ?? []).map((c) => [c.id, c.name_ru] as const));

    return {
      applied: data.apply,
      toCreate: created,
      toUpdate: updated,
      skipped,
      errors,
      withCategory,
      withoutCategory,
      categories: [...usedCategories].map((id) => catName.get(id) ?? id),
      unmatchedCategories: [...unmatched].map(([key, count]) => ({ key, count })),
      rows: plan.slice(0, 300),
    };
  });

/* --------------------------- snapshots ----------------------------- */

const KEEP_SNAPSHOTS = 5;

/**
 * Full copy of the catalog taken right before a bulk change, so the admin can
 * roll products (and only products) back. Only the newest 5 are kept.
 */
export const adminCreateSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ source: z.string().trim().max(80).default("Импорт OpenCart"), note: z.string().trim().max(200).optional() })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin(context);

    const { data: rows, error } = await context.supabase.from("products").select("*").limit(20000);
    if (error) throw new Error(error.message);

    const { data: snap, error: insErr } = await context.supabase
      .from("product_snapshots")
      .insert({
        source: data.source,
        note: data.note ?? null,
        created_by: context.userId,
        products_count: rows?.length ?? 0,
        status: "pending",
        data: (rows ?? []) as never,
      })
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);

    const { data: all } = await context.supabase
      .from("product_snapshots")
      .select("id")
      .order("created_at", { ascending: false });
    const stale = (all ?? []).slice(KEEP_SNAPSHOTS).map((s) => s.id);
    if (stale.length) await context.supabase.from("product_snapshots").delete().in("id", stale);

    return { id: snap.id };
  });

/** Records the outcome of the change the snapshot was taken for. */
export const adminFinalizeSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        created: z.number().int().min(0),
        updated: z.number().int().min(0),
        cancel: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin(context);
    if (data.cancel || (data.created === 0 && data.updated === 0)) {
      await context.supabase.from("product_snapshots").delete().eq("id", data.id);
      return { ok: true as const, kept: false };
    }
    const { error } = await context.supabase
      .from("product_snapshots")
      .update({ status: "done", products_created: data.created, products_updated: data.updated })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const, kept: true };
  });

export const adminListSnapshots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin(context);
    const { data, error } = await context.supabase
      .from("product_snapshots")
      .select("id, source, note, status, products_count, products_created, products_updated, created_at")
      .order("created_at", { ascending: false })
      .limit(KEEP_SNAPSHOTS);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/**
 * Restores every product row from a snapshot. Products created after the
 * snapshot are removed; orders, users and CRM data are never touched.
 */
export const adminRollbackSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin(context);

    const { data: snap, error } = await context.supabase
      .from("product_snapshots")
      .select("id, data")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!snap) throw new Error("Снимок не найден");

    const rows = (snap.data as unknown as Record<string, unknown>[]) ?? [];
    if (!rows.length) throw new Error("Снимок пуст");

    const keep = new Set(rows.map((r) => String(r["id"])));
    let restored = 0;
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      const { error: upErr } = await context.supabase
        .from("products")
        .upsert(chunk as never, { onConflict: "id" });
      if (upErr) throw new Error(upErr.message);
      restored += chunk.length;
    }

    const { data: current } = await context.supabase.from("products").select("id").limit(20000);
    const extra = (current ?? []).map((p) => p.id).filter((id) => !keep.has(id));
    let removed = 0;
    for (let i = 0; i < extra.length; i += 200) {
      const chunk = extra.slice(i, i + 200);
      const { error: delErr } = await context.supabase.from("products").delete().in("id", chunk);
      if (delErr) throw new Error(delErr.message);
      removed += chunk.length;
    }

    return { restored, removed };
  });

