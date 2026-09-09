import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { ProductGrid } from "@/components/ProductGrid";
import { searchQuery } from "@/lib/catalog-queries";
import { t } from "@/lib/i18n";
import type { Lang } from "@/lib/site";

/** Catalog search across product names, articles, sizes and descriptions. */
export function SearchView({ lang, initialQuery }: { lang: Lang; initialQuery: string }) {
  const [value, setValue] = useState(initialQuery);
  const [q, setQ] = useState(initialQuery);

  useEffect(() => {
    const id = setTimeout(() => setQ(value.trim()), 250);
    return () => clearTimeout(id);
  }, [value]);

  const { data, isFetching } = useQuery({ ...searchQuery(q, lang), enabled: q.length >= 2 });

  return (
    <div className="container-page py-10">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">{t("searchTitle", lang)}</h1>

      <div className="mt-6 flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-ring/25">
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("searchPlaceholder", lang)}
          className="w-full bg-transparent text-sm outline-none"
          maxLength={120}
        />
      </div>

      {q.length < 2 ? (
        <p className="mt-6 text-sm text-muted-foreground">{t("searchHint", lang)}</p>
      ) : (
        <>
          <p className="mt-6 text-sm text-muted-foreground">
            {isFetching ? "…" : `${t("found", lang)}: ${data?.length ?? 0}`}
          </p>
          <div className="mt-6">
            {data && data.length > 0 ? (
              <ProductGrid products={data} lang={lang} />
            ) : (
              !isFetching && (
                <p className="text-sm text-muted-foreground">{t("nothingFound", lang)}</p>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}
