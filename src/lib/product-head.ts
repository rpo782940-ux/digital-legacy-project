import { absUrl, type Lang } from "./site";

export type ProductHeadData = {
  name: string;
  description: string;
  image: string;
  price: number | null;
  inStock: boolean;
  brand: string | null;
} | null | undefined;

/** Shared head() builder for the RU and UK product routes. */
export function productHead(data: ProductHeadData, slug: string, lang: Lang) {
  const uk = lang === "uk";
  if (!data) {
    return {
      meta: [
        { title: uk ? "Товар недоступний | Техноформа" : "Товар недоступен | Техноформа" },
        { name: "robots", content: "noindex, follow" },
      ],
    };
  }

  const suffix = uk ? "купити форму | Техноформа" : "купить форму | Техноформа";
  const title = `${data.name} — ${suffix}`;
  const desc = (
    data.description?.trim() ||
    (uk
      ? `${data.name} — форма власного виробництва Техноформа для лиття бетонних виробів. Матеріали АБС, ПВХ та склопластик, доставка по Україні.`
      : `${data.name} — форма собственного производства Техноформа для литья бетонных изделий. Материалы АБС, ПВХ и стеклопластик, доставка по Украине.`)
  )
    .replace(/\s+/g, " ")
    .slice(0, 155);

  const ruPath = `/p/${slug}`;
  const ruUrl = absUrl(ruPath);
  const ukUrl = absUrl(`/uk${ruPath}`);
  const self = uk ? ukUrl : ruUrl;
  const image = data.image?.startsWith("http") ? data.image : absUrl(data.image || "/brand/logo.png");

  return {
    meta: [
      { title },
      { name: "description", content: desc },
      { property: "og:title", content: title },
      { property: "og:description", content: desc },
      { property: "og:type", content: "product" },
      { property: "og:url", content: self },
      { property: "og:image", content: image },
      { property: "og:locale", content: uk ? "uk_UA" : "ru_UA" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: image },
    ],
    links: [
      { rel: "canonical", href: self },
      { rel: "alternate", hrefLang: "ru-UA", href: ruUrl },
      { rel: "alternate", hrefLang: "uk-UA", href: ukUrl },
      { rel: "alternate", hrefLang: "x-default", href: ruUrl },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          name: data.name,
          description: desc,
          image,
          sku: slug,
          brand: { "@type": "Brand", name: data.brand || "Техноформа" },
          url: self,
          ...(data.price
            ? {
                offers: {
                  "@type": "Offer",
                  price: data.price,
                  priceCurrency: "UAH",
                  availability: data.inStock
                    ? "https://schema.org/InStock"
                    : "https://schema.org/PreOrder",
                  url: self,
                },
              }
            : {}),
        }),
      },
    ],
  };
}
