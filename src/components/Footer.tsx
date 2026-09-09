import { Link } from "@tanstack/react-router";
import { Mail, MapPin, Phone } from "lucide-react";
import { t } from "@/lib/i18n";
import { CATEGORIES, CONTACTS, href, pageNav, telHref, type Lang } from "@/lib/site";

export function Footer({ lang }: { lang: Lang }) {
  return (
    <footer className="mt-20 bg-steel text-steel-foreground">
      <div className="hatched h-1.5 w-full" aria-hidden />
      <div className="container-page grid gap-10 py-14 md:grid-cols-4">
        <div>
          <span className="inline-flex rounded-xl bg-steel-foreground/95 px-3 py-2">
            <img src="/brand/logo.png" alt="TechnoForma" width={160} height={52} className="h-9 w-auto" />
          </span>
          <p className="mt-3 text-sm text-steel-foreground/70">
            {t("brandTagline", lang)}. АБС, ПВХ, {lang === "uk" ? "склопластик" : "стеклопластик"}.
          </p>
        </div>


        <div>
          <h3 className="text-sm font-semibold uppercase">{t("catalog", lang)}</h3>
          <ul className="mt-3 space-y-1.5 text-sm text-steel-foreground/70">
            {CATEGORIES.slice(0, 6).map((c) => (
              <li key={c.slug}>
                <Link to={href(`/${c.slug}.php`, lang)} className="hover:text-accent">
                  {pageNav(c, lang)}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase">&nbsp;</h3>
          <ul className="mt-3 space-y-1.5 text-sm text-steel-foreground/70">
            {CATEGORIES.slice(6).map((c) => (
              <li key={c.slug}>
                <Link to={href(`/${c.slug}.php`, lang)} className="hover:text-accent">
                  {pageNav(c, lang)}
                </Link>
              </li>
            ))}
            <li>
              <Link to={href("/oplata-dostavka.php", lang)} className="hover:text-accent">
                {t("payment", lang)}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase">{t("contacts", lang)}</h3>
          <ul className="mt-3 space-y-2 text-sm text-steel-foreground/70">
            {CONTACTS.phones.map((p) => (
              <li key={p} className="flex items-center gap-2">
                <Phone className="size-4 text-accent" aria-hidden />
                <a href={telHref(p)} className="font-semibold hover:text-accent">
                  {p}
                </a>
              </li>
            ))}
            <li className="flex items-center gap-2">
              <Mail className="size-4 text-accent" aria-hidden />
              <a href={`mailto:${CONTACTS.email}`} className="hover:text-accent">
                {CONTACTS.email}
              </a>
            </li>
            <li className="flex items-center gap-2">
              <MapPin className="size-4 text-accent" aria-hidden />
              {lang === "uk" ? CONTACTS.addressUk : CONTACTS.addressRu}
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-steel-foreground/10">
        <div className="container-page py-5 text-xs text-steel-foreground/50">
          © {new Date().getFullYear()} Техноформа. {lang === "uk" ? "Усі права захищені." : "Все права защищены."}
        </div>
      </div>
    </footer>
  );
}
