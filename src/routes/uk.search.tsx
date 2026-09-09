import { createFileRoute } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/site";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { SiteLayout } from "@/components/SiteLayout";
import { SearchView } from "@/components/SearchView";

const TITLE = "Пошук по каталогу форм | Техноформа";
const DESC =
  "Знайдіть форму для лиття бетону за назвою, артикулом або розміром: єврозабори, стовпи, пам'ятники, тротуарна та фасадна плитка, декор.";

export const Route = createFileRoute("/uk/search")({
  validateSearch: zodValidator(z.object({ q: fallback(z.string(), "").default("") })),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/uk/search` },
      { name: "robots", content: "noindex, follow" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/uk/search` }],
  }),
  component: () => {
    const { q } = Route.useSearch();
    return (
      <SiteLayout lang="uk">
        <SearchView lang="uk" initialQuery={q} />
      </SiteLayout>
    );
  },
});
