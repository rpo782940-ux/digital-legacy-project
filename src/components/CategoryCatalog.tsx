import { useMemo } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, LayoutGrid, List } from "lucide-react";
import { ProductGrid, type ProductView } from "@/components/ProductGrid";
import { categoryQuery, navQuery } from "@/lib/catalog-queries";
import { t } from "@/lib/i18n";
import {
  CATEGORIES,
  href,
  pageNav,
  type CategorySummary,
  type Lang,
  type Product,
} from "@/lib/site";

export type CatalogSearch = {
  sort: string;
  limit: number;
  page: number;
  view: string;
  stock: string;
};

const SORTS = [
  ["default", "sortDefault"],
  ["name-asc", "sortNameAsc"],
  ["name-desc", "sortNameDesc"],
  ["price-asc", "sortPriceAsc"],
  ["price-desc", "sortPriceDesc"],
] as const;

const LIMITS = [24, 48, 72, 96];

function sortProducts(list: Product[], sort: string): Product[] {
  const price = (p: Product) => p.variants[0]?.price ?? p.price ?? Number.POSITIVE_INFINITY;
  const copy = [...list];
  switch (sort) {
    case "name-asc":
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    case "name-desc":
      return copy.sort((a, b) => b.name.localeCompare(a.name));
    case "price-asc":
      return copy.sort((a, b) => price(a) - price(b));
    case "price-desc":
      return copy.sort((a, b) => price(b) - price(a));
    default:
      return copy;
  }
}

/** Left column: full category list with live counts, like the reference catalog. */
export function CatalogSidebar({ lang, active }: { lang: Lang; active?: string }) {
  const { data } = useSuspenseQuery(navQuery);
  const map = new Map<string, CategorySummary>(data.categories.map((c) => [c.slug, c]));
  const visible = CATEGORIES.filter((c) => (map.get(c.slug)?.count ?? 0) > 0);

  return (
    <nav aria-label={t("categoriesMenu", lang)} className="lg:sticky lg:top-24">
      <p className="mb-3 font-display text-sm font-bold tracking-wide uppercase">
        {t("categoriesMenu", lang)}
      </p>
      <ul className="max-h-[60vh] overflow-y-auto overscroll-contain rounded-xl border border-border bg-card lg:max-h-[calc(100vh-9rem)]">
        {visible.map((c) => {
          const on = c.slug === active;
          return (
            <li key={c.slug} className="border-b border-border last:border-0">
              <Link
                to={href(`/${c.slug}.php`, lang)}
                className={`flex min-h-11 items-center justify-between gap-2 px-3.5 py-2.5 text-sm transition-colors ${
                  on ? "bg-muted font-semibold text-accent" : "hover:bg-muted"
                }`}
              >
                <span className="min-w-0 flex-1">{pageNav(c, lang)}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {map.get(c.slug)?.count ?? 0}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Catalog body of a category page: sorting, page size, grid/list switch and
 * pagination — all mirrored in the URL so results are shareable.
 */
export function CategoryCatalog({ slug, lang }: { slug: string; lang: Lang }) {
  const { data: all } = useSuspenseQuery(categoryQuery(slug, lang));
  const search = useSearch({ strict: false }) as Partial<CatalogSearch>;
  const navigate = useNavigate();

  const sort = typeof search.sort === "string" ? search.sort : "default";
  const view: ProductView = search.view === "list" ? "list" : "grid";
  const stock = search.stock === "in" ? "in" : "all";
  const limit = LIMITS.includes(Number(search.limit)) ? Number(search.limit) : 24;

  const filtered = useMemo(
    () => (stock === "in" ? all.filter((p) => p.inStock) : all),
    [all, stock],
  );
  const sorted = useMemo(() => sortProducts(filtered, sort), [filtered, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / limit));
  const page = Math.min(Math.max(1, Number(search.page) || 1), pages);
  const start = (page - 1) * limit;
  const items = sorted.slice(start, start + limit);

  const update = (patch: Partial<CatalogSearch>) =>
    navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => ({ ...prev, page: 1, ...patch }),
      resetScroll: false,
    });

  const control =
    "min-h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-ring/25";

  return (
    <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="min-w-0">
        <CatalogSidebar lang={lang} active={slug} />
      </aside>

      <div className="min-w-0">
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
          <label className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <span className="hidden sm:inline">{t("sortLabel", lang)}</span>
            <select
              value={sort}
              onChange={(e) => update({ sort: e.target.value })}
              className={control}
              aria-label={t("sortLabel", lang)}
            >
              {SORTS.map(([value, key]) => (
                <option key={value} value={value}>
                  {t(key, lang)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="hidden sm:inline">{t("showLabel", lang)}</span>
            <select
              value={limit}
              onChange={(e) => update({ limit: Number(e.target.value) })}
              className={control}
              aria-label={t("showLabel", lang)}
            >
              {LIMITS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => update({ stock: stock === "in" ? "all" : "in" })}
            aria-pressed={stock === "in"}
            className={`min-h-10 rounded-lg border px-3 text-xs font-medium transition-colors ${
              stock === "in"
                ? "border-accent bg-accent text-accent-foreground"
                : "border-input hover:bg-muted"
            }`}
          >
            {t("onlyInStock", lang)}
          </button>

          <div className="ml-auto flex items-center gap-1">
            {(
              [
                ["grid", LayoutGrid, "viewGrid"],
                ["list", List, "viewList"],
              ] as const
            ).map(([value, Icon, key]) => (
              <button
                key={value}
                type="button"
                onClick={() => update({ view: value, page })}
                aria-label={t(key, lang)}
                aria-pressed={view === value}
                className={`flex size-10 items-center justify-center rounded-lg border transition-colors ${
                  view === value
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-input hover:bg-muted"
                }`}
              >
                <Icon className="size-4" aria-hidden />
              </button>
            ))}
          </div>
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          {t("showing", lang)} {sorted.length === 0 ? 0 : start + 1}–{start + items.length}{" "}
          {t("ofTotal", lang)} {sorted.length} {t("positions", lang)}
        </p>

        <ProductGrid products={items} lang={lang} view={view} />

        {pages > 1 && (
          <nav
            aria-label="pagination"
            className="mt-8 flex flex-wrap items-center justify-center gap-1.5"
          >
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => update({ page: page - 1 })}
              className="flex min-h-10 items-center gap-1 rounded-lg border border-input px-3 text-sm disabled:opacity-40"
            >
              <ChevronLeft className="size-4" aria-hidden /> {t("prevPage", lang)}
            </button>
            {Array.from({ length: pages }, (_, i) => i + 1)
              .filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 1)
              .map((n, i, arr) => (
                <span key={n} className="flex items-center gap-1.5">
                  {i > 0 && arr[i - 1] !== n - 1 && (
                    <span className="px-1 text-muted-foreground">…</span>
                  )}
                  <button
                    type="button"
                    onClick={() => update({ page: n })}
                    aria-current={n === page ? "page" : undefined}
                    className={`min-h-10 min-w-10 rounded-lg border px-3 text-sm font-medium ${
                      n === page
                        ? "border-accent bg-accent text-accent-foreground"
                        : "border-input hover:bg-muted"
                    }`}
                  >
                    {n}
                  </button>
                </span>
              ))}
            <button
              type="button"
              disabled={page >= pages}
              onClick={() => update({ page: page + 1 })}
              className="flex min-h-10 items-center gap-1 rounded-lg border border-input px-3 text-sm disabled:opacity-40"
            >
              {t("nextPage", lang)} <ChevronRight className="size-4" aria-hidden />
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}
