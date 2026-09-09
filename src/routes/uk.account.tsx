import { createFileRoute } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/site";
import { SiteLayout } from "@/components/SiteLayout";
import { AccountView } from "@/components/AccountView";

export const Route = createFileRoute("/uk/account")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Мій кабінет | Техноформа" },
      {
        name: "description",
        content: "Профіль, контактні дані та історія замовлень форм Техноформа.",
      },
      { property: "og:title", content: "Мій кабінет | Техноформа" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/uk/account` },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/uk/account` }],
  }),
  component: () => (
    <SiteLayout lang="uk">
      <AccountView lang="uk" />
    </SiteLayout>
  ),
});
