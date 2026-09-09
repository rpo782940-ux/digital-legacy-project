import { createFileRoute } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/site";
import { SiteLayout } from "@/components/SiteLayout";
import { AdminPanel } from "@/components/admin/AdminPanel";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Админ-панель | Техноформа" },
      {
        name: "description",
        content: "Управление заказами, товарами и категориями магазина Техноформа.",
      },
      { property: "og:title", content: "Админ-панель | Техноформа" },
      { property: "og:description", content: "Внутренняя панель управления магазином Техноформа." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/admin` },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/admin` }],
  }),
  component: () => (
    <SiteLayout lang="ru">
      <AdminPanel />
    </SiteLayout>
  ),
});
