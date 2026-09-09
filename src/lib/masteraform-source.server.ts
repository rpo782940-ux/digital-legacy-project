/**
 * Live MasteraForm catalog reader (server-only).
 *
 * MasteraForm (OpenCart) is the single source of truth. This module reads it
 * over public HTTP:
 *   - category tree      -> index.php?route=product/categories (main menu)
 *   - category listings  -> /<category>/?limit=100&page=N in RU and UA
 *                           (product membership, order, names, prices,
 *                            old/sale prices, stock, main photo)
 *   - product details    -> /main_google_feed.xml (description, gallery,
 *                            material, availability)
 *   - new arrivals       -> index.php?route=common/latest
 *   - specials           -> /specials/
 *
 * Nothing here reaches the browser: the sync worker writes the result into our
 * own database and the frontend only ever reads our database.
 */

export const MF_ORIGIN = "https://masteraform.com.ua";

export type SourceProduct = {
  id: string;
  path: string;
  categorySlug: string;
  position: number;
  nameRu: string;
  nameUk: string;
  descriptionRu: string;
  price: number | null;
  oldPrice: number | null;
  inStock: boolean;
  image: string | null;
  gallery: string[];
  material: string | null;
};

export type SourceCategory = {
  externalId: string;
  slug: string;
  sortOrder: number;
  nameRu: string;
  nameUk: string;
  titleRu: string;
  titleUk: string;
  descRu: string;
  descUk: string;
  h1Ru: string;
  h1Uk: string;
  image: string | null;
};

/** MasteraForm category path -> our slug. Legacy technoforma slugs are kept
 *  untouched so existing search-engine positions survive. */
export const CATEGORY_SLUGS: Record<string, string> = {
  formy_dlya_zaborov_iz_abs_i_pvh_plastika_ru: "forms_zaborov_iz_ABS",
  formy_dlya_zaborov_iz_stekloplastika_ru: "forms_stekloplastic",
  formy_stolbov_iz_abs_plastika_ru: "forms_stolbov",
  formy_stolbov_iz_stekloplastika_ru: "forms_stolbov_stekloplastik",
  formy_kryshek_dlya_stolbov_i_zaborov_ru: "forms_kryshek",
  formy_dlya_stel_ru: "forms_pamyatnikov",
  formy_dlya_nadgrobiya_ru: "forms_nadgrobiy",
  formy_plit_pod_pamyatnik_ru: "forms_plit_pod_pamyatniki",
  formy_dlya_ogradok_ru: "forms_ogradok_ABC",
  "formy-dlya-3d-panelej-iz-abs-plastika": "forms_3d_paneley",
  formy_dlya_fasadnoy_plitki_ru: "forms_fasadnoy_plitki",
  formy_trotuarnoy_plitki_ru: "forms_trotyar_plitka",
  formy_peril_i_balyasin_ru: "forms_peril_i_balyasin",
  formy_dlya_stolov_i_skameek_ru: "forms_stolov_i_skameek",
  formy_dekora_ru: "forms_decora",
  "forma-dlya-schelevogo-pola": "forms_schelevogo_pola",
  "dobavki-dlya-betona": "dobavki_dlya_betona",
  "vakuumnaya-formovka-plastika": "vakuumnaya_formovka",
  oborudovanie: "vibrostoly",
  formy_nabornyh_stolbov_ru: "forms_nabornyh_stolbov",
};

const UA_HEADER = "Mozilla/5.0 (compatible; TechnoformaSync/1.0)";

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { headers: { "User-Agent": UA_HEADER } });
  if (!response.ok) throw new Error(`mf_http_${response.status}: ${url}`);
  return await response.text();
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&laquo;|&raquo;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&mdash;|&ndash;/g, "-");
}

function stripTags(value: string): string {
  return decodeEntities(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function pathOf(url: string): string {
  return url
    .replace(/^https?:\/\/[^/]+/i, "")
    .split("?")[0]!
    .replace(/^\/(ua\/)?/, "")
    .replace(/\/$/, "");
}

function money(value: string | undefined | null): number | null {
  if (!value) return null;
  const num = Number.parseFloat(value.replace(/[^\d.,]/g, "").replace(",", "."));
  return Number.isFinite(num) && num > 0 ? num : null;
}

/** Original, untouched photo: `/image/cache/x/y-411x303.jpg` -> `/image/x/y.jpg`. */
export function originalImage(url: string | null | undefined): string | null {
  if (!url) return null;
  const [scheme, rest] = url.replace(/^http:/, "https:").split("://");
  if (!rest) return null;
  return `${scheme}://${rest
    .replace("/image/cache/", "/image/")
    .replace(/\/{2,}/g, "/")
    .replace(/-\d{2,4}x\d{2,4}(?=\.[a-z]{3,4}$)/i, "")}`;
}

// -------------------------------------------------------------- feed detail

type FeedEntry = {
  descriptionRu: string;
  gallery: string[];
  material: string | null;
  image: string | null;
  inStock: boolean;
  salePrice: number | null;
};

export async function loadFeed(): Promise<Map<string, FeedEntry>> {
  const xml = await fetchText(`${MF_ORIGIN}/main_google_feed.xml`);
  const map = new Map<string, FeedEntry>();

  for (const raw of xml.split("<entry").slice(1)) {
    const tag = (name: string): string | null => {
      const match = raw.match(new RegExp(`<g:${name}>([\\s\\S]*?)</g:${name}>`));
      return match ? decodeEntities(match[1]!.replace(/^<!\[CDATA\[|\]\]>$/g, "")).trim() : null;
    };

    const id = tag("id");
    if (!id) continue;

    map.set(id, {
      descriptionRu: stripTags(tag("description") ?? ""),
      gallery: [...raw.matchAll(/<g:additional_image_link>([\s\S]*?)<\/g:additional_image_link>/g)]
        .map((m) => originalImage(m[1]!.trim()))
        .filter((v): v is string => Boolean(v)),
      material: tag("material"),
      image: originalImage(tag("image_link")),
      inStock: (tag("availability") ?? "").toLowerCase() !== "out of stock",
      salePrice: money(tag("sale_price")),
    });
  }

  return map;
}

// ------------------------------------------------------------- html parsing

type Card = {
  id: string;
  path: string;
  name: string;
  image: string | null;
  price: number | null;
  oldPrice: number | null;
  inStock: boolean;
};

function parseCards(html: string): Card[] {
  const cards: Card[] = [];

  for (const block of html.split('class="product-layout').slice(1)) {
    const id = block.match(/cart\.add\('(\d+)'\)/)?.[1];
    const href = block.match(/<a href="(https?:\/\/masteraform\.com\.ua\/[^"]+)"/)?.[1];
    if (!id || !href) continue;

    const name =
      decodeEntities(block.match(/<img[^>]*\stitle="([^"]*)"/)?.[1] ?? "") ||
      stripTags(block.match(/<div class="caption[^"]*"[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/)?.[1] ?? "");

    const priceNew = money(block.match(/price-new[^>]*>([^<]*)</)?.[1]);
    const priceOld = money(block.match(/price-old[^>]*>([^<]*)</)?.[1]);
    const plain = money(block.match(/<p class="price">\s*([^<]*)</)?.[1]);

    cards.push({
      id,
      path: pathOf(href),
      name,
      image: originalImage(block.match(/<img[^>]*\ssrc="([^"]+)"/)?.[1]),
      price: priceNew ?? plain,
      oldPrice: priceOld,
      inStock: !/Нет в наличии|Немає в наявності/i.test(block),
    });
  }

  return cards;
}

function extractMeta(html: string) {
  const title = html.match(/<title>([\s\S]*?)<\/title>/i);
  const desc = html.match(/<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i);
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return {
    title: title ? stripTags(title[1]!) : "",
    desc: desc ? decodeEntities(desc[1]!).trim() : "",
    h1: h1 ? stripTags(h1[1]!) : "",
  };
}

async function loadListing(path: string, lang: "ru" | "ua") {
  const prefix = lang === "ua" ? `${MF_ORIGIN}/ua` : MF_ORIGIN;
  const cards: Card[] = [];
  let meta = { title: "", desc: "", h1: "" };

  for (let page = 1; page <= 8; page += 1) {
    const html = await fetchText(`${prefix}/${path}/?limit=100&page=${page}`);
    if (page === 1) meta = extractMeta(html);

    const found = parseCards(html).filter((c) => !cards.some((existing) => existing.id === c.id));
    if (!found.length) break;
    cards.push(...found);
    if (found.length < 100) break;
  }

  return { meta, cards };
}

async function loadIds(url: string): Promise<string[]> {
  try {
    return parseCards(await fetchText(url)).map((c) => c.id);
  } catch {
    return [];
  }
}

/** Top-level categories exactly as MasteraForm lists them in its main menu. */
export async function loadCategoryList(): Promise<{ path: string; nameRu: string }[]> {
  const html = await fetchText(`${MF_ORIGIN}/index.php?route=product/categories`);
  const seen = new Set<string>();
  const list: { path: string; nameRu: string }[] = [];

  for (const match of html.matchAll(
    /href="(https?:\/\/masteraform\.com\.ua\/[^"]*)"[^>]*>\s*([^<]{2,120}?)\s*<\/a>/g,
  )) {
    const path = pathOf(match[1]!);
    if (!CATEGORY_SLUGS[path] || seen.has(path)) continue;
    seen.add(path);
    list.push({ path, nameRu: decodeEntities(match[2]!).trim() });
  }

  return list;
}

export type SourceCatalog = {
  categories: SourceCategory[];
  products: SourceProduct[];
  newIds: string[];
  saleIds: string[];
};

export async function loadMasteraFormCatalog(): Promise<SourceCatalog> {
  const { toUkrainian } = await import("./mf-translate.server");

  const feed = await loadFeed();
  const menu = await loadCategoryList();

  const categories: SourceCategory[] = [];
  const products: SourceProduct[] = [];
  const claimed = new Map<string, string>();

  for (const [index, entry] of menu.entries()) {
    const slug = CATEGORY_SLUGS[entry.path]!;
    const ru = await loadListing(entry.path, "ru");
    const uk = await loadListing(entry.path, "ua");
    const ukNames = new Map(uk.cards.map((c) => [c.id, c.name]));

    categories.push({
      externalId: entry.path,
      slug,
      sortOrder: index,
      nameRu: entry.nameRu,
      nameUk: uk.meta.h1 || toUkrainian(entry.nameRu),
      titleRu: ru.meta.title || entry.nameRu,
      titleUk: uk.meta.title || toUkrainian(ru.meta.title || entry.nameRu),
      descRu: ru.meta.desc,
      descUk: uk.meta.desc || toUkrainian(ru.meta.desc),
      h1Ru: ru.meta.h1 || entry.nameRu,
      h1Uk: uk.meta.h1 || toUkrainian(ru.meta.h1 || entry.nameRu),
      image: ru.cards[0]?.image ?? null,
    });

    ru.cards.forEach((card, position) => {
      // A product listed in several categories belongs to the one its own
      // URL points at (MasteraForm keeps the canonical category in the path).
      const owner = card.path.split("/")[0];
      const canonical = owner === entry.path;
      const previous = claimed.get(card.id);
      if (previous && !canonical) return;
      if (previous && canonical) {
        const index = products.findIndex((p) => p.id === card.id);
        if (index >= 0) products.splice(index, 1);
      }
      claimed.set(card.id, entry.path);

      const detail = feed.get(card.id);
      const price = card.price;
      const oldPrice = card.oldPrice && price && card.oldPrice > price ? card.oldPrice : null;

      products.push({
        id: card.id,
        path: card.path,
        categorySlug: slug,
        position,
        nameRu: card.name,
        nameUk: ukNames.get(card.id) || toUkrainian(card.name),
        descriptionRu: detail?.descriptionRu ?? "",
        price,
        oldPrice: oldPrice ?? (detail?.salePrice && price && detail.salePrice < price ? price : null),
        inStock: card.inStock && (detail?.inStock ?? true),
        image: card.image ?? detail?.image ?? null,
        gallery: detail?.gallery ?? [],
        material: detail?.material ?? null,
      });
    });
  }

  const newIds = await loadIds(`${MF_ORIGIN}/index.php?route=common/latest`);
  const saleIds = await loadIds(`${MF_ORIGIN}/specials/?limit=100`);

  return { categories, products, newIds, saleIds };
}
