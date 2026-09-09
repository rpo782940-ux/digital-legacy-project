import { createFileRoute } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/site";
import { SiteLayout } from "@/components/SiteLayout";
import { AuthView } from "@/components/AuthView";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Вход и регистрация | Техноформа" },
      {
        name: "description",
        content:
          "Личный кабинет Техноформа: вход по номеру телефона, регистрация и восстановление пароля для отслеживания заказов на формы.",
      },
      { property: "og:title", content: "Вход и регистрация | Техноформа" },
      {
        property: "og:description",
        content: "Войдите в личный кабинет Техноформа, чтобы видеть историю заказов.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/auth` },
      { name: "robots", content: "noindex, follow" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/auth` }],
  }),
  component: () => (
    <SiteLayout lang="ru">
      <AuthView lang="ru" />
    </SiteLayout>
  ),
});
