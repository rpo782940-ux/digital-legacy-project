import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Expand, Plus } from "lucide-react";
import { Lightbox } from "@/components/Lightbox";
import { useCart } from "@/lib/cart";
import { fmtPrice, t } from "@/lib/i18n";
import { href, type Lang, type Product } from "@/lib/site";

export type ProductView = "grid" | "list";

function ProductCard({
  product,
  lang,
  view,
  onOpen,
}: {
  product: Product;
  lang: Lang;
  view: ProductView;
  onOpen: () => void;
}) {
  const { add } = useCart();
  const [vi, setVi] = useState(0);
  const [done, setDone] = useState(false);
  const variant = product.variants[vi];
  const price = variant?.price ?? product.price;
  const list = view === "list";

  const onAdd = () => {
    if (!price) return;
    add({
      productId: product.id,
      sku: product.sku,
      name: product.name,
      image: product.image,
      variant: variant?.label ?? null,
      price,
    });
    setDone(true);
    setTimeout(() => setDone(false), 1400);
  };

  const to = product.slug ? href(`/p/${product.slug}`, lang) : null;

  return (
    <article
      className={`group flex overflow-hidden rounded-xl border border-border bg-card shadow-plate transition-all duration-300 hover:border-accent/50 hover:shadow-lift ${
        list ? "flex-col sm:flex-row" : "flex-col hover:-translate-y-1"
      }`}
    >
      <div
        className={`relative overflow-hidden bg-concrete ${
          list ? "aspect-video w-full shrink-0 sm:aspect-4/3 sm:w-56" : "aspect-video"
        }`}
      >
        <div
          aria-hidden
          className="absolute inset-0 scale-125 bg-cover bg-center opacity-45 blur-2xl"
          style={{ backgroundImage: `url("${product.image}")` }}
        />
        <img
          src={product.image}
          alt={product.alt || product.name}
          loading="lazy"
          decoding="async"
          width={480}
          height={360}
          className="relative size-full object-contain p-3 drop-shadow-[0_6px_18px_rgba(0,0,0,0.25)] transition-transform duration-500 group-hover:scale-[1.06]"
        />
        <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
          {product.isNew && (
            <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold text-accent-foreground uppercase">
              {t("badgeNew", lang)}
            </span>
          )}
          {product.isSpecial && (
            <span className="rounded-full bg-destructive px-2.5 py-1 text-[11px] font-bold text-destructive-foreground uppercase">
              {t("badgeSale", lang)}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onOpen}
          aria-label={t("zoom", lang)}
          className="absolute right-2.5 bottom-2.5 flex min-h-9 items-center gap-1.5 rounded-full bg-steel/85 px-3 py-1.5 text-[11px] font-semibold text-steel-foreground backdrop-blur-sm transition-colors hover:bg-steel"
        >
          <Expand className="size-3.5" aria-hidden />
          {t("zoom", lang)}
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-display text-base leading-snug font-semibold">
          {to ? (
            <Link to={to} className="transition-colors hover:text-accent">
              {product.name}
            </Link>
          ) : (
            product.name
          )}
        </h3>

        {product.specs.length > 0 && (
          <p className="text-xs text-muted-foreground">{product.specs.join(" · ")}</p>
        )}

        {list && product.description && (
          <p className="line-clamp-3 text-sm text-muted-foreground">{product.description}</p>
        )}

        <p
          className={`text-xs font-medium ${product.inStock ? "text-accent" : "text-muted-foreground"}`}
        >
          {product.inStock ? t("inStockLabel", lang) : t("outOfStock", lang)}
        </p>

        {product.variants.length > 1 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {product.variants.map((v, i) => (
              <button
                key={v.label + i}
                onClick={() => setVi(i)}
                className={`min-h-9 rounded-full border px-3 py-1 text-[11px] transition-colors ${
                  i === vi
                    ? "border-accent bg-accent font-semibold text-accent-foreground"
                    : "border-border text-muted-foreground hover:border-accent/60"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}

        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-3">
          <div>
            {price ? (
              <>
                {product.oldPrice && product.oldPrice > price && (
                  <span className="mr-2 text-sm text-muted-foreground line-through">
                    {fmtPrice(product.oldPrice, lang)}
                  </span>
                )}
                <span className="font-display text-xl font-bold">
                  {fmtPrice(price, lang)}{" "}
                  <span className="text-sm font-medium text-muted-foreground">
                    {t("uah", lang)}
                  </span>
                </span>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">{t("onRequest", lang)}</span>
            )}
          </div>
          <button
            onClick={onAdd}
            disabled={!price}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {done ? <Check className="size-4" /> : <Plus className="size-4" />}
            {done ? t("inCart", lang) : t("addToCart", lang)}
          </button>
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({
  products,
  lang,
  view = "grid",
}: {
  products: Product[];
  lang: Lang;
  view?: ProductView;
}) {
  const { add } = useCart();
  const [open, setOpen] = useState<number | null>(null);

  if (products.length === 0)
    return <p className="py-10 text-muted-foreground">{t("nothingFound", lang)}</p>;

  return (
    <>
      <div
        className={
          view === "list"
            ? "flex flex-col gap-4"
            : "grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4"
        }
      >
        {products.map((p, i) => (
          <ProductCard
            key={p.id}
            product={p}
            lang={lang}
            view={view}
            onOpen={() => setOpen(i)}
          />
        ))}
      </div>
      {open !== null && (
        <Lightbox
          products={products}
          index={open}
          lang={lang}
          onClose={() => setOpen(null)}
          onIndex={setOpen}
          onAdd={(p) => {
            const price = p.variants[0]?.price ?? p.price;
            if (!price) return;
            add({
              productId: p.id,
              sku: p.sku,
              name: p.name,
              image: p.image,
              variant: p.variants[0]?.label ?? null,
              price,
            });
          }}
        />
      )}
    </>
  );
}
