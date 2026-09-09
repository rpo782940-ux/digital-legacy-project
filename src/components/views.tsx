import { Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, CreditCard, Factory, Layers, Truck } from "lucide-react";
import { ProductGrid } from "@/components/ProductGrid";
import { CategoryCatalog } from "@/components/CategoryCatalog";
import { highlightsQuery, navQuery } from "@/lib/catalog-queries";
import { t } from "@/lib/i18n";
import { categorySeo } from "@/lib/category-seo";
import {
  CATEGORIES,
  CONTACTS,
  categoryCover,
  telHref,
  PAGE_MAP,
  href,
  pageDesc,
  pageH1,
  pageNav,
  type CategorySummary,
  type Lang,
  type PageDef,
} from "@/lib/site";

function Breadcrumbs({ lang, current }: { lang: Lang; current: string }) {
  return (
    <nav aria-label="breadcrumb" className="mb-5 text-xs text-muted-foreground">
      <Link to={href("/", lang)} className="hover:text-foreground">
        {t("home", lang)}
      </Link>
      <span className="px-2">/</span>
      <span className="text-foreground">{current}</span>
    </nav>
  );
}

function PageHeader({ h1, sub }: { h1: string; sub?: string }) {
  return (
    <div className="border-b border-border bg-concrete">
      <div className="container-page py-10">
        <h1 className="max-w-4xl font-display text-2xl font-bold sm:text-3xl">{h1}</h1>
        {sub && <p className="mt-3 max-w-3xl text-sm text-concrete-foreground/75">{sub}</p>}
      </div>
    </div>
  );
}

/** Category cards backed by live counts / covers from the database. */
function useNavMap() {
  const { data } = useSuspenseQuery(navQuery);
  const map = new Map<string, CategorySummary>(data.categories.map((c) => [c.slug, c]));
  const visible = CATEGORIES.filter((c) => (map.get(c.slug)?.count ?? 0) > 0);
  return { map, visible, total: data.total };
}

function CategoryCard({
  page,
  info,
  lang,
  headingLevel = "h3",
}: {
  page: PageDef;
  info?: CategorySummary;
  lang: Lang;
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  const cover = categoryCover(page.slug, info?.cover ?? "/brand/logo.png");
  return (
    <Link
      to={href(`/${page.slug}.php`, lang)}
      className="group overflow-hidden rounded-xl border border-border bg-card shadow-plate transition-all duration-300 hover:-translate-y-1 hover:border-accent/50 hover:shadow-lift"
    >
      <div className="relative aspect-16/10 overflow-hidden bg-concrete">
        <img
          src={cover}
          alt={pageNav(page, lang)}
          loading="lazy"
          decoding="async"
          width={1024}
          height={640}
          className={`size-full transition-transform duration-500 group-hover:scale-[1.06] ${
            page.slug === "vakuumnaya_formovka" ? "object-contain p-1" : "object-cover"
          }`}
        />
      </div>
      <div className="flex items-center justify-between gap-3 p-4">
        <Heading className="font-display text-base font-semibold">{pageNav(page, lang)}</Heading>
        <span className="shrink-0 rounded-sm bg-muted px-2 py-1 text-xs text-muted-foreground">
          {info?.count ?? 0}
        </span>
      </div>
    </Link>
  );
}

export function HomeView({ lang }: { lang: Lang }) {
  const { map, visible, total } = useNavMap();
  const { data: highlights } = useSuspenseQuery(highlightsQuery(lang));

  const advantages = [
    { icon: Factory, t: "adv1t", d: "adv1d" },
    { icon: Layers, t: "adv2t", d: "adv2d" },
    { icon: CreditCard, t: "adv3t", d: "adv3d" },
    { icon: Truck, t: "adv4t", d: "adv4d" },
  ];

  return (
    <>
      <section className="relative overflow-hidden bg-steel text-steel-foreground">
        <div className="container-page grid items-center gap-10 py-16 md:grid-cols-2 md:py-24">
          <div>
            <span className="inline-block rounded-sm bg-accent px-2.5 py-1 text-xs font-bold tracking-wide text-accent-foreground uppercase">
              {total}+ {t("positions", lang)}
            </span>
            <h1 className="mt-5 font-display text-3xl font-bold sm:text-5xl">
              {t("heroTitle", lang)}
            </h1>
            <p className="mt-5 max-w-xl text-steel-foreground/75">{t("heroSub", lang)}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to={href("/products.php", lang)}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition-transform hover:-translate-y-0.5"
              >
                {t("heroCta", lang)} <ArrowRight className="size-4" />
              </Link>
              <a
                href={telHref(CONTACTS.phones[0])}
                className="inline-flex items-center gap-2 rounded-lg border border-steel-foreground/25 px-5 py-3 text-sm font-semibold hover:bg-steel-foreground/10"
              >
                {CONTACTS.phones[0]}
              </a>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {visible.slice(0, 4).map((c) => (
              <Link
                key={c.slug}
                to={href(`/${c.slug}.php`, lang)}
                className="group relative aspect-square overflow-hidden rounded-xl border border-steel-foreground/15 bg-steel-foreground/5"
              >
                <img
                  src={categoryCover(c.slug, map.get(c.slug)?.cover ?? "/brand/logo.png")}
                  alt={pageNav(c, lang)}
                  loading="lazy"
                  decoding="async"
                  width={1024}
                  height={640}
                  className={`size-full transition-transform duration-500 group-hover:scale-[1.06] ${
                    c.slug === "vakuumnaya_formovka" ? "object-contain p-1" : "object-cover"
                  }`}

                />
                <span className="absolute inset-x-0 bottom-0 bg-steel/85 px-3 py-2 text-xs font-semibold">
                  {pageNav(c, lang)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-card">
        <div className="container-page grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
          {advantages.map((a) => (
            <div key={a.t}>
              <a.icon className="size-7 text-accent" aria-hidden />
              <h3 className="mt-3 font-display text-base font-semibold">{t(a.t, lang)}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{t(a.d, lang)}</p>
            </div>
          ))}
        </div>
      </section>

      {highlights.fresh.length > 0 && (
        <section className="container-page py-14">
          <h2 className="font-display text-2xl font-bold">{t("newArrivals", lang)}</h2>
          <div className="mt-6">
            <ProductGrid products={highlights.fresh} lang={lang} />
          </div>
        </section>
      )}

      {highlights.specials.length > 0 && (
        <section className="border-y border-border bg-concrete">
          <div className="container-page py-14">
            <h2 className="font-display text-2xl font-bold">{t("specialOffers", lang)}</h2>
            <div className="mt-6">
              <ProductGrid products={highlights.specials} lang={lang} />
            </div>
          </div>
        </section>
      )}

      <section className="container-page py-14">
        <h2 className="font-display text-2xl font-bold">{t("categoriesTitle", lang)}</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((c) => (
            <CategoryCard key={c.slug} page={c} info={map.get(c.slug)} lang={lang} />
          ))}
        </div>
      </section>
    </>
  );
}

export function CatalogView({ lang }: { lang: Lang }) {
  const page = PAGE_MAP["products"];
  const { map, visible } = useNavMap();
  return (
    <>
      <PageHeader h1={pageH1(page, lang)} sub={pageDesc(page, lang)} />
      <div className="container-page py-10">
        <Breadcrumbs lang={lang} current={pageH1(page, lang)} />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((c) => (
            <CategoryCard
              key={c.slug}
              page={c}
              info={map.get(c.slug)}
              lang={lang}
              headingLevel="h2"
            />
          ))}
        </div>
      </div>
    </>
  );
}

export function CategoryView({ slug, lang }: { slug: string; lang: Lang }) {
  const page = PAGE_MAP[slug];
  const seo = categorySeo(slug, lang);
  return (
    <>
      <PageHeader h1={pageH1(page, lang)} sub={pageDesc(page, lang)} />
      <div className="container-page py-8">
        <Breadcrumbs lang={lang} current={pageNav(page, lang)} />
        <CategoryCatalog slug={slug} lang={lang} />
        {seo && (
          <section className="mt-12 rounded-xl border border-border bg-card p-6 shadow-plate sm:p-8">
            <h2 className="font-display text-xl font-bold">{seo.h2}</h2>
            <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
              {seo.paragraphs.map((text) => (
                <p key={text}>{text}</p>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}


export function DeliveryView({ lang }: { lang: Lang }) {
  const page = PAGE_MAP["oplata-dostavka"];
  const blocks =
    lang === "uk"
      ? [
          {
            h: "Оплата",
            items: [
              "Передоплата на рахунок ФОП, решта — при отриманні.",
              "Рахунок надсилаємо після підтвердження замовлення менеджером.",
              "Працюємо з ФОП і юридичними особами, надаємо документи.",
            ],
          },
          {
            h: "Доставка",
            items: [
              "Нова Пошта по всій Україні — відділення, поштомат або кур'єр на адресу.",
              "Перевізником замовника з нашого складу.",
              "Самовивіз зі складу, Пн–Пт 9:00–18:00.",
            ],
          },
        ]
      : [
          {
            h: "Оплата",
            items: [
              "Предоплата на счёт ФЛП, остальное — при получении.",
              "Счёт присылаем после подтверждения заказа менеджером.",
              "Работаем с ФЛП и юридическими лицами, предоставляем документы.",
            ],
          },
          {
            h: "Доставка",
            items: [
              "Новая Почта по всей Украине — отделение, почтомат или курьер на адрес.",
              "Перевозчиком заказчика с нашего склада.",
              "Самовывоз со склада, Пн–Пт 9:00–18:00.",
            ],
          },
        ];

  return (
    <>
      <PageHeader h1={pageH1(page, lang)} />
      <div className="container-page py-10">
        <Breadcrumbs lang={lang} current={pageH1(page, lang)} />
        <div className="grid gap-6 md:grid-cols-2">
          {blocks.map((b) => (
            <section key={b.h} className="rounded-xl border border-border bg-card p-6 shadow-plate">
              <h2 className="font-display text-lg font-semibold">{b.h}</h2>
              <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
                {b.items.map((i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                    {i}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}

export function TechnologyView({ lang }: { lang: Lang }) {
  const page = PAGE_MAP["tecnology"];
  const steps =
    lang === "uk"
      ? [
          ["Підготовка форми", "Форму очищають і обробляють розділювальним мастилом."],
          ["Заміс бетону", "Цемент М400–М500, промитий пісок, пластифікатор і пігмент."],
          ["Вібролиття", "Суміш заливають на вібростіл — виходить щільна поверхня без пор."],
          ["Витримка", "18–24 години у формі при +18…+25 °C."],
          ["Розпалубка", "Виріб виймають і залишають набирати міцність 7–28 діб."],
        ]
      : [
          ["Подготовка формы", "Форму очищают и обрабатывают разделительной смазкой."],
          ["Замес бетона", "Цемент М400–М500, промытый песок, пластификатор и пигмент."],
          ["Вибролитьё", "Смесь заливают на вибростол — плотная поверхность без пор."],
          ["Выдержка", "18–24 часа в форме при +18…+25 °C."],
          ["Распалубка", "Изделие вынимают и оставляют набирать прочность 7–28 суток."],
        ];

  return (
    <>
      <PageHeader h1={pageH1(page, lang)} sub={pageDesc(page, lang)} />
      <div className="container-page py-10">
        <Breadcrumbs lang={lang} current={pageH1(page, lang)} />
        <ol className="grid gap-4 md:grid-cols-2">
          {steps.map(([h, d], i) => (
            <li key={h} className="flex gap-4 rounded-xl border border-border bg-card p-5 shadow-plate">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-accent font-display text-base font-bold text-accent-foreground">
                {i + 1}
              </span>
              <div>
                <h2 className="font-display text-base font-semibold">{h}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}

export function ContactsView({ lang }: { lang: Lang }) {
  const page = PAGE_MAP["kontacts"];
  return (
    <>
      <PageHeader h1={pageH1(page, lang)} />
      <div className="container-page py-10">
        <Breadcrumbs lang={lang} current={pageH1(page, lang)} />
        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-xl border border-border bg-card p-6 shadow-plate">
            <h2 className="font-display text-lg font-semibold">{t("contacts", lang)}</h2>
            <ul className="mt-4 space-y-3 text-sm">
              {CONTACTS.phones.map((p) => (
                <li key={p}>
                  <a href={telHref(p)} className="font-medium hover:text-accent">
                    {p}
                  </a>
                </li>
              ))}
              <li>
                <a href={`mailto:${CONTACTS.email}`} className="hover:text-accent">
                  {CONTACTS.email}
                </a>
              </li>
              <li className="text-muted-foreground">
                {lang === "uk" ? CONTACTS.addressUk : CONTACTS.addressRu}
              </li>
              <li className="text-muted-foreground">
                {lang === "uk" ? CONTACTS.hoursUk : CONTACTS.hoursRu}
              </li>
            </ul>
          </section>
          <section className="rounded-xl border border-border bg-concrete p-6">
            <h2 className="font-display text-lg font-semibold">
              {lang === "uk" ? "Як замовити" : "Как заказать"}
            </h2>
            <p className="mt-3 text-sm text-concrete-foreground/80">
              {lang === "uk"
                ? "Додайте потрібні форми в кошик і оформіть замовлення — менеджер передзвонить для підтвердження. Або просто зателефонуйте нам."
                : "Добавьте нужные формы в корзину и оформите заказ — менеджер перезвонит для подтверждения. Или просто позвоните нам."}
            </p>
            <Link
              to={href("/products.php", lang)}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              {t("heroCta", lang)} <ArrowRight className="size-4" />
            </Link>
          </section>
        </div>
      </div>
    </>
  );
}
