import { createFileRoute } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/site";
import { CartView } from "@/components/CartView";
import { SiteLayout } from "@/components/SiteLayout";

export const Route = createFileRoute("/uk/cart")({
  head: () => ({
    meta: [
      { title: "Кошик | Техноформа" },
      { name: "description", content: "Ваше замовлення форм для бетонних виробів Техноформа." },
      { name: "robots", content: "noindex, follow" },
      { property: "og:title", content: "Кошик | Техноформа" },
      { property: "og:description", content: "Ваше замовлення форм для бетонних виробів." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/uk/cart` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/uk/cart` }],
  }),
  component: () => (
    <SiteLayout lang="uk">
      <CartView lang="uk" />
    </SiteLayout>
  ),
});
