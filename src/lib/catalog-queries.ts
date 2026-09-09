import { queryOptions } from "@tanstack/react-query";
import {
  catalogCategory,
  catalogHighlights,
  catalogNav,
  catalogProduct,
  catalogSearch,
} from "@/lib/catalog.functions";
import type { Lang } from "@/lib/site";

export const navQuery = queryOptions({
  queryKey: ["catalog", "nav"],
  queryFn: () => catalogNav(),
  staleTime: 5 * 60_000,
});

export const categoryQuery = (slug: string, lang: Lang) =>
  queryOptions({
    queryKey: ["catalog", "category", slug, lang],
    queryFn: () => catalogCategory({ data: { slug, lang } }),
    staleTime: 5 * 60_000,
  });

export const highlightsQuery = (lang: Lang) =>
  queryOptions({
    queryKey: ["catalog", "highlights", lang],
    queryFn: () => catalogHighlights({ data: { lang } }),
    staleTime: 5 * 60_000,
  });

export const searchQuery = (q: string, lang: Lang) =>
  queryOptions({
    queryKey: ["catalog", "search", q, lang],
    queryFn: () => catalogSearch({ data: { q, lang } }),
    staleTime: 60_000,
  });

export const productQuery = (slug: string, lang: Lang) =>
  queryOptions({
    queryKey: ["catalog", "product", slug, lang],
    queryFn: () => catalogProduct({ data: { slug, lang } }),
    staleTime: 5 * 60_000,
  });
