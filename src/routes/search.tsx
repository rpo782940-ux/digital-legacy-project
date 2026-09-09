import { createFileRoute } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/site";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { SiteLayout } from "@/components/SiteLayout";
import { SearchView } from "@/components/SearchView";

const TITLE = "Поиск по каталогу форм | Техноформа";
const DESC =
  "Найдите форму для литья бетона по названию, артикулу или размеру: еврозаборы, столбы, памятники, тротуарная и фасадная плитка, декор.";

export const Route = createFileRoute("/search")({
  validateSearch: zodValidator(z.object({ q: fallback(z.string(), "").default("") })),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/search` },
      { name: "robots", content: "noindex, follow" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/search` }],
  }),
  component: () => {
    const { q } = Route.useSearch();
    return (
      <SiteLayout lang="ru">
        <SearchView lang="ru" initialQuery={q} />
      </SiteLayout>
    );
  },
});
