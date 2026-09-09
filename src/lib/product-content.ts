import imageMap from "@/lib/image-map.json";
import type { Lang } from "@/lib/site";

const MAP = imageMap as Record<string, string>;

/**
 * Product photos are stored locally in their original resolution (WebP, up to
 * 1600 px). Remote source links are rewritten to the local copy.
 */
export function localImage(url: string): string {
  if (!url) return "";
  return MAP[url] ?? url;
}

export function localImages(urls: string[]): string[] {
  return urls.map(localImage).filter(Boolean);
}

/** Material inferred from the category and the product title. */
function material(category: string, name: string): "abs" | "frp" | "other" {
  const text = `${category} ${name}`.toLowerCase();
  if (text.includes("stekloplastic") || text.includes("stekloplastik") || /склоплас|стеклоплас/.test(text))
    return "frp";
  if (text.includes("abs") || /абс|пвх/.test(text)) return "abs";
  return "other";
}

type Copy = { ru: string; uk: string };

const USE: Record<string, Copy> = {
  forms_zaborov_iz_ABS: {
    ru: "секций бетонного еврозабора",
    uk: "секцій бетонного єврозабору",
  },
  forms_stekloplastic: {
    ru: "секций забора большого формата",
    uk: "секцій паркану великого формату",
  },
  forms_stolbov: { ru: "столбов для еврозабора", uk: "стовпів для єврозабору" },
  forms_stolbov_stekloplastik: {
    ru: "столбов для еврозабора",
    uk: "стовпів для єврозабору",
  },
  forms_nabornyh_stolbov: { ru: "наборных столбов", uk: "набірних стовпів" },
  forms_kryshek: { ru: "крышек, накладок и пазов", uk: "кришок, накладок і пазів" },
  forms_trotyar_plitka: {
    ru: "тротуарной плитки и брусчатки",
    uk: "тротуарної плитки та бруківки",
  },
  forms_fasadnoy_plitki: {
    ru: "фасадной и облицовочной плитки",
    uk: "фасадної та облицювальної плитки",
  },
  forms_3d_paneley: { ru: "декоративных 3D-панелей", uk: "декоративних 3D-панелей" },
  forms_pamyatnikov: { ru: "памятников из бетона", uk: "пам'ятників з бетону" },
  forms_nadgrobiy: { ru: "надгробий", uk: "надгробків" },
  forms_plit_pod_pamyatniki: {
    ru: "противоусадочных плит под памятники",
    uk: "протиусадкових плит під пам'ятники",
  },
  forms_ogradok_ABC: { ru: "ритуальных оградок", uk: "ритуальних огорож" },
  forms_decora: { ru: "декора и малой архитектуры", uk: "декору та малої архітектури" },
  forms_peril_i_balyasin: { ru: "перил и балясин", uk: "перил та балясин" },
  forms_stolov_i_skameek: {
    ru: "столов, скамеек и садовой мебели",
    uk: "столів, лавок та садових меблів",
  },
  forms_schelevogo_pola: { ru: "щелевого пола", uk: "щілинної підлоги" },
  vakuumnaya_formovka: { ru: "изделий вакуумной формовки", uk: "виробів вакуумного формування" },
  vibrostoly: { ru: "вибролитья", uk: "вібролиття" },
  dobavki_dlya_betona: { ru: "качественного бетона", uk: "якісного бетону" },
};

const MATERIAL_LINE: Record<"abs" | "frp" | "other", Copy> = {
  abs: {
    ru: "Матрица отлита из ударопрочного АБС/ПВХ-пластика: стенки держат геометрию, поверхность зеркальная, изделие выходит из формы без раковин и доработки.",
    uk: "Матриця відлита з ударостійкого АБС/ПВХ-пластику: стінки тримають геометрію, поверхня дзеркальна, виріб виходить із форми без раковин і доопрацювання.",
  },
  frp: {
    ru: "Форма выполнена из армированного стеклопластика — жёсткий каркас без деформаций даже при крупных габаритах и плотной вибрации.",
    uk: "Форма виконана з армованого склопластику — жорсткий каркас без деформацій навіть за великих габаритів і щільної вібрації.",
  },
  other: {
    ru: "Форма рассчитана на ежедневную работу с вибростолом и жёсткими бетонными смесями.",
    uk: "Форма розрахована на щоденну роботу з вібростолом і жорсткими бетонними сумішами.",
  },
};

const CLOSERS: Copy[] = [
  {
    ru: "Ресурс матрицы — сотни съёмов при аккуратной распалубке и смазке.",
    uk: "Ресурс матриці — сотні знімань за акуратної розпалубки та змащування.",
  },
  {
    ru: "Рабочая поверхность легко очищается, форма готова к следующей заливке за минуты.",
    uk: "Робоча поверхня легко очищується, форма готова до наступної заливки за хвилини.",
  },
  {
    ru: "Рисунок пропечатывается полностью — грани чёткие, углы без сколов.",
    uk: "Рисунок пропечатується повністю — грані чіткі, кути без сколів.",
  },
  {
    ru: "Подходит и для домашнего производства, и для серийного цеха.",
    uk: "Підходить і для домашнього виробництва, і для серійного цеху.",
  },
  {
    ru: "Отгрузка со склада в день заказа, доставка удобной вам службой.",
    uk: "Відвантаження зі складу в день замовлення, доставка зручною вам службою.",
  },
];

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Unique, in-house product copy generated from the product's own attributes.
 * Never reuses supplier texts and never mentions third-party shops.
 */
export function productDescription(
  p: { name: string; slug: string; category: string; specs: string[] },
  lang: Lang,
): string {
  const uk = lang === "uk";
  const use = USE[p.category] ?? { ru: "бетонных изделий", uk: "бетонних виробів" };
  const mat = MATERIAL_LINE[material(p.category, p.name)];
  const closer = CLOSERS[hash(p.slug || p.name) % CLOSERS.length]!;
  const size = p.specs.find((s) => /\d/.test(s));

  const opener = uk
    ? `«${p.name}» — форма для виготовлення ${use.uk} власними силами.`
    : `«${p.name}» — форма для изготовления ${use.ru} своими силами.`;

  const sizeLine = size
    ? uk
      ? ` Робочі параметри виробу: ${size}.`
      : ` Рабочие параметры изделия: ${size}.`
    : "";

  return `${opener}${sizeLine} ${uk ? mat.uk : mat.ru} ${uk ? closer.uk : closer.ru}`;
}

/** Descriptive ALT text for search engines and accessibility. */
export function productAlt(
  p: { name: string; category: string },
  lang: Lang,
): string {
  const use = USE[p.category] ?? { ru: "бетонных изделий", uk: "бетонних виробів" };
  return lang === "uk"
    ? `${p.name} — форма для виготовлення ${use.uk}`
    : `${p.name} — форма для изготовления ${use.ru}`;
}

/**
 * Removes any trace of third parties from catalog text: supplier/manufacturer
 * names, the old shop, production locations, cities, countries and links.
 * The shop must read as a fully independent catalogue with its own copy.
 */
const SCRUB: RegExp[] = [
  /masteraform[^\s,;.]*/gi,
  /мастера\s*форм\w*/gi,
  /майстра?\s*форм\w*/gi,
  /technoforma\.com\.ua/gi,
  /https?:\/\/\S+/gi,
  /\b[\w-]+\.(com|ua|net|org)(\.ua)?\b/gi,
  /(производител[ья]|виробник[аи]?|поставщик[аи]?|постачальник[аи]?)\s*[:—-]\s*[^\n,.;]+/gi,
  /(бренд|торговая марка|торгова марка)\s*[:—-]\s*[^\n,.;]+/gi,
  /\b(г\.|м\.|город|місто)\s?(Днепр\w*|Дніпр\w*|Киев\w*|Київ\w*|Харьков\w*|Харків\w*|Одесс\w*|Одес\w*|Львов\w*|Львів\w*)/gi,
  /\bДнепропетровск\w*|\bДніпропетровськ\w*|\bДнепр\b|\bДніпро\b/gi,
  /\b(Украина|Україна|Украине|Україні|Украины|України|Ukraine)\b/gi,
];

export function scrubText(text: string): string {
  let out = text ?? "";
  for (const re of SCRUB) out = out.replace(re, " ");
  return out
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/([,;:])\s*([,.;:])/g, "$1")
    .replace(/^[\s,;:.—-]+/g, "")
    .trim();
}
