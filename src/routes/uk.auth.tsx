import { createFileRoute } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/site";
import { SiteLayout } from "@/components/SiteLayout";
import { AuthView } from "@/components/AuthView";

export const Route = createFileRoute("/uk/auth")({
  head: () => ({
    meta: [
      { title: "Вхід і реєстрація | Техноформа" },
      {
        name: "description",
        content:
          "Особистий кабінет Техноформа: вхід за номером телефону, реєстрація та відновлення пароля для відстеження замовлень форм.",
      },
      { property: "og:title", content: "Вхід і реєстрація | Техноформа" },
      {
        property: "og:description",
        content: "Увійдіть до особистого кабінету Техноформа, щоб бачити історію замовлень.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/uk/auth` },
      { name: "robots", content: "noindex, follow" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/uk/auth` }],
  }),
  component: () => (
    <SiteLayout lang="uk">
      <AuthView lang="uk" />
    </SiteLayout>
  ),
});
