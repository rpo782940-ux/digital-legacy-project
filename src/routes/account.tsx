import { createFileRoute } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/site";
import { SiteLayout } from "@/components/SiteLayout";
import { AccountView } from "@/components/AccountView";

export const Route = createFileRoute("/account")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Мой кабинет | Техноформа" },
      {
        name: "description",
        content: "Профиль, контактные данные и история заказов форм Техноформа.",
      },
      { property: "og:title", content: "Мой кабинет | Техноформа" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/account` },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/account` }],
  }),
  component: () => (
    <SiteLayout lang="ru">
      <AccountView lang="ru" />
    </SiteLayout>
  ),
});
