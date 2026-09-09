import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Check, Minus, Plus, ShoppingCart } from "lucide-react";
import { ProductGrid } from "@/components/ProductGrid";
import { CatalogSidebar } from "@/components/CategoryCatalog";
import { useCart } from "@/lib/cart";
import { productQuery } from "@/lib/catalog-queries";
import { fmtPrice, t } from "@/lib/i18n";
import { PAGE_MAP, href, pageNav, type Lang } from "@/lib/site";

export function ProductPage({ slug, lang }: { slug: string; lang: Lang }) {
  const { data } = useSuspenseQuery(productQuery(slug, lang));
  const { add } = useCart();
  const [shot, setShot] = useState(0);
  const [vi, setVi] = useState(0);
  const [qty, setQty] = useState(1);
  const [done, setDone] = useState(false);

  if (!data) {
    return (
      <div className="container-page py-20 text-center text-muted-foreground">
        {t("productNotFound", lang)}
      </div>
    );
  }

  const { product, categorySlug, related } = data;
  const category = PAGE_MAP[categorySlug];
  const variant = product.variants[vi];
  const price = variant?.price ?? product.price;
  const shots = [product.image, ...product.gallery].filter(Boolean);
  const current = shots[Math.min(shot, shots.length - 1)] ?? product.image;

  const onAdd = () => {
    if (!price) return;
    for (let i = 0; i < qty; i++) {
      add({
        productId: product.id,
        sku: product.sku,
        name: product.name,
        image: product.image,
        variant: variant?.label ?? null,
        price,
      });
    }
    setDone(true);
    setTimeout(() => setDone(false), 1600);
  };

  return (
    <div className="container-page py-8">
      <nav aria-label="breadcrumb" className="mb-5 text-xs text-muted-foreground">
        <Link to={href("/", lang)} className="hover:text-foreground">
          {t("home", lang)}
        </Link>
        <span className="px-2">/</span>
        {category && (
          <>
            <Link to={href(`/${categorySlug}.php`, lang)} className="hover:text-foreground">
              {pageNav(category, lang)}
            </Link>
            <span className="px-2">/</span>
          </>
        )}
        <span className="text-foreground">{product.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="order-2 min-w-0 lg:order-1">
          <CatalogSidebar lang={lang} active={categorySlug} />
        </aside>

        <div className="order-1 min-w-0 lg:order-2">
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <div className="relative aspect-4/3 overflow-hidden rounded-xl border border-border bg-concrete">
                <div
                  aria-hidden
                  className="absolute inset-0 scale-125 bg-cover bg-center opacity-40 blur-2xl"
                  style={{ backgroundImage: `url("${current}")` }}
                />
                <img
                  src={current}
                  alt={product.alt || product.name}
                  className="relative size-full object-contain p-4"
                  decoding="async"
                />
              </div>
              {shots.length > 1 && (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {shots.map((s, i) => (
                    <button
                      key={s + i}
                      type="button"
                      onClick={() => setShot(i)}
                      aria-label={`${product.name} ${i + 1}`}
                      className={`size-16 shrink-0 overflow-hidden rounded-lg border bg-concrete ${
                        i === shot ? "border-accent" : "border-border"
                      }`}
                    >
                      <img
                        src={s}
                        alt=""
                        loading="lazy"
                        className="size-full object-contain p-1"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="min-w-0">
              <h1 className="font-display text-xl font-bold sm:text-2xl">{product.name}</h1>

              <p
                className={`mt-3 text-sm font-medium ${
                  product.inStock ? "text-accent" : "text-muted-foreground"
                }`}
              >
                {product.inStock ? t("inStockLabel", lang) : t("outOfStock", lang)}
              </p>

              {product.specs.length > 0 && (
                <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                  {product.specs.map((s) => (
                    <li key={s} className="flex gap-2">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                      {s}
                    </li>
                  ))}
                </ul>
              )}

              {product.variants.length > 1 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {product.variants.map((v, i) => (
                    <button
                      key={v.label + i}
                      type="button"
                      onClick={() => setVi(i)}
                      className={`min-h-10 rounded-lg border px-3 text-sm transition-colors ${
                        i === vi
                          ? "border-accent bg-accent font-semibold text-accent-foreground"
                          : "border-input hover:bg-muted"
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-6 rounded-xl border border-border bg-card p-4">
                {price ? (
                  <p className="font-display text-3xl font-bold">
                    {product.oldPrice && product.oldPrice > price && (
                      <span className="mr-2 text-lg font-medium text-muted-foreground line-through">
                        {fmtPrice(product.oldPrice, lang)}
                      </span>
                    )}
                    {fmtPrice(price, lang)}{" "}
                    <span className="text-base font-medium text-muted-foreground">
                      {t("uah", lang)}
                    </span>
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("onRequest", lang)}</p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <div className="flex items-center rounded-lg border border-input">
                    <button
                      type="button"
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                      aria-label="-"
                      className="flex size-11 items-center justify-center hover:bg-muted"
                    >
                      <Minus className="size-4" aria-hidden />
                    </button>
                    <span aria-label={t("quantity", lang)} className="w-10 text-center text-sm">
                      {qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQty((q) => Math.min(99, q + 1))}
                      aria-label="+"
                      className="flex size-11 items-center justify-center hover:bg-muted"
                    >
                      <Plus className="size-4" aria-hidden />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={onAdd}
                    disabled={!price}
                    className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {done ? <Check className="size-4" /> : <ShoppingCart className="size-4" />}
                    {done ? t("inCart", lang) : t("addToCart", lang)}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {product.description && (
            <section className="mt-10">
              <h2 className="font-display text-lg font-semibold">{t("descriptionTitle", lang)}</h2>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                {product.description}
              </p>
            </section>
          )}

          {related.length > 0 && (
            <section className="mt-12">
              <h2 className="font-display text-lg font-semibold">{t("relatedTitle", lang)}</h2>
              <div className="mt-5">
                <ProductGrid products={related.slice(0, 4)} lang={lang} />
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
