import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const langSchema = z.object({ lang: z.enum(["ru", "uk"]) });

/** Category cards with live product counts and covers. */
export const catalogNav = createServerFn({ method: "GET" }).handler(async () => {
  const { loadNav } = await import("@/lib/catalog.server");
  return await loadNav();
});

/** All products of a category (already ordered: new → sale → rest). */
export const catalogCategory = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    langSchema.extend({ slug: z.string().min(1).max(80) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { loadCategory } = await import("@/lib/catalog.server");
    return await loadCategory(data.slug, data.lang);
  });

/** New arrivals and specials for the home page. */
export const catalogHighlights = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => langSchema.parse(data))
  .handler(async ({ data }) => {
    const { loadHighlights } = await import("@/lib/catalog.server");
    return await loadHighlights(data.lang);
  });

/** Catalog search by name, article, description or SEO url. */
export const catalogSearch = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    langSchema.extend({ q: z.string().max(120) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { loadSearch } = await import("@/lib/catalog.server");
    return await loadSearch(data.q, data.lang);
  });

/** One product with its neighbours from the same category. */
export const catalogProduct = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    langSchema.extend({ slug: z.string().min(1).max(200) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { loadProduct } = await import("@/lib/catalog.server");
    return await loadProduct(data.slug, data.lang);
  });
