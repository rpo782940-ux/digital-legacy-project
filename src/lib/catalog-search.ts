import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";

/** Catalog listing state kept in the URL: sorting, page size, view, paging. */
export const catalogSearchSchema = zodValidator(
  z.object({
    sort: fallback(z.string(), "default").default("default"),
    limit: fallback(z.number(), 24).default(24),
    page: fallback(z.number(), 1).default(1),
    view: fallback(z.string(), "grid").default("grid"),
    stock: fallback(z.string(), "all").default("all"),
  }),
);
