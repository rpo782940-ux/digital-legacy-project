import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/SiteLayout";
import { HomeView } from "@/components/views";
import { highlightsQuery, navQuery } from "@/lib/catalog-queries";
import { SITE_URL } from "@/lib/site";

const TITLE = "Техноформа — форми для бетонних виробів";
const DESC =
  "Technoforma виготовляє для Вас форми для надгробків будь-якої складності. АБС та ПВХ форми для виготовлення надгробків з бетону. У нас: ціни від виробника, широкий асортимент та вигідні пропозиції.";

export const Route = createFileRoute("/uk/")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(navQuery),
      context.queryClient.ensureQueryData(highlightsQuery("uk")),
    ]);
    return null;
  },
  errorComponent: ({ error }) => (
    <div role="alert" className="container-page py-20 text-center">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="container-page py-20 text-center">404</div>,
  head: () => ({

    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/uk/` },
      { property: "og:locale", content: "uk_UA" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "canonical", href: `${SITE_URL}/uk/` },
      { rel: "alternate", hrefLang: "ru-UA", href: `${SITE_URL}/` },
      { rel: "alternate", hrefLang: "uk-UA", href: `${SITE_URL}/uk/` },
      { rel: "alternate", hrefLang: "x-default", href: `${SITE_URL}/` },
    ],
  }),
  component: () => (
    <SiteLayout lang="uk">
      <HomeView lang="uk" />
    </SiteLayout>
  ),
});
