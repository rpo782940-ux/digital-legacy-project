import { notFound } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import {
  CatalogView,
  CategoryView,
  ContactsView,
  DeliveryView,
  TechnologyView,
} from "@/components/views";
import { SiteLayout } from "@/components/SiteLayout";
import { categoryQuery, navQuery } from "@/lib/catalog-queries";
import { absUrl, PAGE_MAP, pageDesc, pageTitle, type Lang } from "@/lib/site";

/** Prime the catalog cache before a page renders (SSR-friendly). */
export async function pageLoader(slug: string, lang: Lang, queryClient: QueryClient) {
  const page = PAGE_MAP[slug];
  if (!page) throw notFound();
  if (page.isCategory) {
    await Promise.all([
      queryClient.ensureQueryData(navQuery),
      queryClient.ensureQueryData(categoryQuery(slug, lang)),
    ]);
  } else if (slug === "products") {
    await queryClient.ensureQueryData(navQuery);
  }
  return null;
}

export function renderPage(slug: string, lang: Lang) {
  const page = PAGE_MAP[slug];
  if (!page) throw notFound();
  let body;
  if (slug === "products") body = <CatalogView lang={lang} />;
  else if (slug === "oplata-dostavka") body = <DeliveryView lang={lang} />;
  else if (slug === "tecnology") body = <TechnologyView lang={lang} />;
  else if (slug === "kontacts") body = <ContactsView lang={lang} />;
  else body = <CategoryView slug={slug} lang={lang} />;
  return <SiteLayout lang={lang}>{body}</SiteLayout>;
}

export function pageHead(slug: string, lang: Lang) {
  const page = PAGE_MAP[slug];
  if (!page) return { meta: [{ title: "404" }] };
  const title = pageTitle(page, lang);
  const desc = pageDesc(page, lang);
  const ruPath = `/${slug}.php`;
  const self = absUrl(lang === "uk" ? `/uk${ruPath}` : ruPath);
  const ruUrl = absUrl(ruPath);
  const ukUrl = absUrl(`/uk${ruPath}`);
  return {
    meta: [
      { title },
      { name: "description", content: desc },
      { property: "og:title", content: title },
      { property: "og:description", content: desc },
      { property: "og:type", content: "website" },
      { property: "og:url", content: self },
      { property: "og:locale", content: lang === "uk" ? "uk_UA" : "ru_UA" },
      { name: "twitter:card", content: "summary_large_image" },
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
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: lang === "uk" ? "Головна" : "Главная",
              item: absUrl(lang === "uk" ? "/uk/" : "/"),
            },
            { "@type": "ListItem", position: 2, name: title, item: self },
          ],
        }),
      },
    ],
  };
}

