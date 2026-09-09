import { createFileRoute } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/site";
import { CartView } from "@/components/CartView";
import { SiteLayout } from "@/components/SiteLayout";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Корзина | Техноформа" },
      { name: "description", content: "Ваш заказ форм для бетонных изделий Техноформа." },
      { name: "robots", content: "noindex, follow" },
      { property: "og:title", content: "Корзина | Техноформа" },
      { property: "og:description", content: "Ваш заказ форм для бетонных изделий." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/cart` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/cart` }],
  }),
  component: () => (
    <SiteLayout lang="ru">
      <CartView lang="ru" />
    </SiteLayout>
  ),
});
