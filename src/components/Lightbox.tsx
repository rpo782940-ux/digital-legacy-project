import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { fmtPrice, t } from "@/lib/i18n";
import type { Lang, Product } from "@/lib/site";

/**
 * Full product card in an overlay: gallery, characteristics, description,
 * availability, prices and related items from the same list.
 */
export function Lightbox({
  products,
  index,
  lang,
  onClose,
  onIndex,
  onAdd,
}: {
  products: Product[];
  index: number;
  lang: Lang;
  onClose: () => void;
  onIndex: (i: number) => void;
  onAdd: (p: Product) => void;
}) {
  const product = products[index];
  const [shot, setShot] = useState(0);

  const step = useCallback(
    (d: number) => onIndex((index + d + products.length) % products.length),
    [index, products.length, onIndex],
  );

  useEffect(() => setShot(0), [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, step]);

  if (!product) return null;

  const price = product.variants[0]?.price ?? product.price;
  const shots = [product.image, ...product.gallery].filter(Boolean);
  const current = shots[Math.min(shot, shots.length - 1)] ?? product.image;
  const related = products.filter((p) => p.id !== product.id).slice(0, 4);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={product.name}
      className="fixed inset-0 z-100 flex items-start justify-center overflow-y-auto bg-steel/95 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        aria-label="close"
        className="fixed top-4 right-4 z-10 rounded-full border border-steel-foreground/20 bg-steel-foreground/10 p-2.5 text-steel-foreground transition-colors hover:bg-steel-foreground/20"
      >
        <X className="size-5" />
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          step(-1);
        }}
        aria-label="prev"
        className="fixed top-1/2 left-3 z-10 rounded-full border border-steel-foreground/20 bg-steel-foreground/10 p-3 text-steel-foreground transition-colors hover:bg-steel-foreground/20 sm:left-6"
      >
        <ChevronLeft className="size-6" />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          step(1);
        }}
        aria-label="next"
        className="fixed top-1/2 right-3 z-10 rounded-full border border-steel-foreground/20 bg-steel-foreground/10 p-3 text-steel-foreground transition-colors hover:bg-steel-foreground/20 sm:right-6"
      >
        <ChevronRight className="size-6" />
      </button>

      <div
        className="my-6 w-full max-w-5xl overflow-hidden rounded-2xl bg-card shadow-lift"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grid gap-0 md:grid-cols-2">
          <div className="bg-concrete p-4 sm:p-6">
            {/* Small source photos are scaled up to fill the viewer instead of
                sitting tiny in the middle of the frame. */}
            <img
              src={current}
              alt={product.alt || product.name}
              className="mx-auto h-[52vh] w-full object-contain sm:h-[58vh]"
            />
            {shots.length > 1 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {shots.map((src, i) => (
                  <button
                    key={src + i}
                    onClick={() => setShot(i)}
                    className={`size-16 overflow-hidden rounded-md border bg-card p-1 ${
                      i === shot ? "border-accent" : "border-border"
                    }`}
                  >
                    <img src={src} alt="" loading="lazy" className="size-full object-contain" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4 p-5 sm:p-6">
            <div className="flex flex-wrap gap-1.5">
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

            <h2 className="font-display text-xl font-bold">{product.name}</h2>

            <p className={`text-sm font-medium ${product.inStock ? "text-accent" : "text-muted-foreground"}`}>
              {product.inStock ? t("inStockLabel", lang) : t("outOfStock", lang)}
            </p>

            {product.specs.length > 0 && (
              <div>
                <h3 className="font-display text-sm font-semibold">{t("characteristics", lang)}</h3>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {product.specs.map((s) => (
                    <li key={s} className="flex gap-2">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {product.brand && (
              <p className="text-sm text-muted-foreground">
                {t("manufacturer", lang)}: <span className="text-foreground">{product.brand}</span>
              </p>
            )}

            {product.description && (
              <div>
                <h3 className="font-display text-sm font-semibold">{t("descriptionTitle", lang)}</h3>
                <p className="mt-2 max-h-40 overflow-y-auto text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                  {product.description}
                </p>
              </div>
            )}

            <div className="mt-auto flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
              <div>
                {price ? (
                  <>
                    {product.oldPrice && product.oldPrice > price && (
                      <span className="mr-2 text-sm text-muted-foreground line-through">
                        {fmtPrice(product.oldPrice, lang)}
                      </span>
                    )}
                    <span className="font-display text-2xl font-bold">
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
                onClick={() => onAdd(product)}
                disabled={!price}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="size-4" />
                {t("addToCart", lang)}
              </button>
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <div className="border-t border-border p-5 sm:p-6">
            <h3 className="font-display text-sm font-semibold">{t("relatedTitle", lang)}</h3>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {related.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onIndex(products.indexOf(p))}
                  className="overflow-hidden rounded-lg border border-border bg-card text-left transition-colors hover:border-accent/60"
                >
                  <div className="aspect-video bg-concrete p-2">
                    <img
                      src={p.image}
                      alt={p.alt || p.name}
                      loading="lazy"
                      className="size-full object-contain"
                    />
                  </div>
                  <p className="line-clamp-2 p-2 text-xs">{p.name}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
