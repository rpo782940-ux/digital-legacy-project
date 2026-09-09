import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { PAGES, SITE_URL as BASE_URL } from "@/lib/site";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { loadProductSlugs } = await import("@/lib/catalog.server");
        let productPaths: string[] = [];
        try {
          const slugs = await loadProductSlugs();
          productPaths = slugs.flatMap((slug) => [`/p/${slug}`, `/uk/p/${slug}`]);
        } catch {
          /* catalogue unavailable — still emit the static map */
        }

        const paths = [
          "/",
          "/uk/",
          ...PAGES.flatMap((p) => [`/${p.slug}.php`, `/uk/${p.slug}.php`]),
          ...productPaths,
        ];

        const priority = (path: string) => {
          if (path === "/" || path === "/uk/") return "1.0";
          if (path.includes("/p/")) return "0.6";
          return "0.8";
        };

        const urls = paths.map((path) => {
          const ru = path.startsWith("/uk") ? path.replace(/^\/uk/, "") || "/" : path;
          const uk = path.startsWith("/uk") ? path : `/uk${path === "/" ? "/" : path}`;
          return [
            "  <url>",
            `    <loc>${BASE_URL}${path}</loc>`,
            `    <xhtml:link rel="alternate" hreflang="ru-UA" href="${BASE_URL}${ru}"/>`,
            `    <xhtml:link rel="alternate" hreflang="uk-UA" href="${BASE_URL}${uk}"/>`,
            `    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}${ru}"/>`,
            `    <changefreq>${path.includes("/p/") ? "monthly" : "weekly"}</changefreq>`,
            `    <priority>${priority(path)}</priority>`,
            "  </url>",
          ].join("\n");
        });

        const xml = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
          ...urls,
          "</urlset>",
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
