import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { listWarehouses, searchCities } from "./novaposhta.server";
import type { NpCity, NpPoint } from "./novaposhta-types";

/** Country-wide settlement search — the only step the customer has to type. */
export const npCitySearch = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ query: z.string().trim().max(80) }).parse(data),
  )
  .handler(async ({ data }): Promise<NpCity[]> => searchCities(data.query));

/** All delivery points of the chosen settlement, in one flat list. */
export const npCityWarehouses = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ settlementRef: z.string().trim().min(1).max(64) }).parse(data),
  )
  .handler(async ({ data }): Promise<NpPoint[]> => listWarehouses(data.settlementRef));
