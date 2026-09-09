/**
 * Server-only admin helpers.
 *
 * Administrator rights are NEVER taken from the client: the check runs against
 * the `user_roles` table through the security-definer `has_role` function with
 * the caller's own (RLS-scoped) Supabase client.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type AdminContext = {
  supabase: SupabaseClient<Database>;
  userId: string;
};

/** Throws when the signed-in user is not an administrator. */
export async function requireAdmin(context: AdminContext): Promise<void> {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || data !== true) throw new Error("forbidden");
}

export async function isAdminUser(context: AdminContext): Promise<boolean> {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  return data === true;
}

/* ------------------------------------------------------------------ */
/* Excel import                                                        */
/* ------------------------------------------------------------------ */

export type ImportRow = Record<string, string | number | boolean | null>;

export type ImportPlanRow = {
  line: number;
  key: string;
  name: string;
  action: "create" | "update" | "skip" | "error";
  reason?: string;
};

export type ImportPlan = {
  toCreate: number;
  toUpdate: number;
  skipped: number;
  errors: number;
  rows: ImportPlanRow[];
};

const ALIASES: Record<string, string[]> = {
  external_id: ["external_id", "product_id", "id", "код", "ид"],
  sku: ["sku", "артикул", "article", "model", "модель"],
  name_ru: ["name_ru", "name(ru-ru)", "название", "название ru", "name", "наименование"],
  name_uk: ["name_uk", "name(uk-ua)", "название ua", "назва", "name_ua"],
  description_ru: ["description_ru", "description(ru-ru)", "описание", "описание ru"],
  description_uk: ["description_uk", "description(uk-ua)", "опис", "описание ua", "description_ua"],
  price: ["price", "цена", "ціна"],
  old_price: ["old_price", "старая цена", "стара ціна"],
  special_price: ["special_price", "акция", "акционная цена", "акційна ціна"],
  quantity: ["quantity", "количество", "кількість", "qty", "остаток"],
  category: ["category", "main_category", "categories", "категория", "категорія", "category_slug"],
  image_path: ["image_path", "image_name", "image", "изображение", "фото", "main_image"],
  gallery: ["gallery", "images", "additional_images", "галерея", "доп изображения"],
  specs_ru: ["specs_ru", "характеристики", "характеристики ru"],
  specs_uk: ["specs_uk", "характеристики ua", "характеристики uk"],
  meta_title_ru: ["meta_title_ru", "meta_title(ru-ru)", "seo title", "meta title"],
  meta_title_uk: ["meta_title_uk", "meta_title(uk-ua)", "seo title ua"],
  meta_desc_ru: ["meta_desc_ru", "meta_description(ru-ru)", "seo description", "meta description"],
  meta_desc_uk: ["meta_desc_uk", "meta_description(uk-ua)", "seo description ua"],
  seo_url: ["seo_url", "keyword(ru-ru)", "slug", "url", "ссылка"],
  manufacturer: ["manufacturer", "производитель", "виробник"],
  brand: ["brand", "бренд"],
  sort_order: ["sort_order", "порядок", "сортировка"],
  is_active: ["is_active", "status", "активен", "активність", "статус"],
};

/** OpenCart exports store relative image paths; the shop serves them from /image/. */
export function normalizeImagePath(v: string | undefined): string | null {
  const s = (v ?? "").trim();
  if (!s || s.toLowerCase() === "none") return null;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://masteraform.com.ua/image/${s.replace(/^\/+/, "")}`;
}


const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Maps arbitrary spreadsheet headers onto our product columns. */
export function normalizeRow(raw: ImportRow): Record<string, string> {
  const lookup = new Map<string, string>();
  for (const [k, v] of Object.entries(raw)) {
    if (v === null || v === undefined) continue;
    lookup.set(norm(k), String(v).trim());
  }
  const out: Record<string, string> = {};
  for (const [field, names] of Object.entries(ALIASES)) {
    for (const n of names) {
      const v = lookup.get(n);
      if (v) {
        out[field] = v;
        break;
      }
    }
  }
  return out;
}

export const parseNumber = (v: string | undefined): number | null => {
  if (!v) return null;
  const n = Number(v.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export const parseList = (v: string | undefined): string[] =>
  v
    ? v
        .split(/[\n;|]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

export const parseBool = (v: string | undefined): boolean | null => {
  if (v === undefined) return null;
  const s = v.toLowerCase();
  if (["1", "true", "да", "так", "yes", "enabled", "активен"].includes(s)) return true;
  if (["0", "false", "нет", "ні", "no", "disabled"].includes(s)) return false;
  return null;
};

export function slugify(input: string): string {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", ґ: "g", д: "d", е: "e", є: "ie", ж: "zh",
    з: "z", и: "i", і: "i", ї: "i", й: "y", к: "k", л: "l", м: "m", н: "n",
    о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts",
    ч: "ch", ш: "sh", щ: "shch", ь: "", ю: "iu", я: "ia", ы: "y", э: "e", ъ: "",
  };
  return input
    .toLowerCase()
    .split("")
    .map((c) => map[c] ?? c)
    .join("")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 90);
}
