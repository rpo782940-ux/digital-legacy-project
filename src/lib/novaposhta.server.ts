import type { NpCity, NpPoint, NpPointKind } from "./novaposhta-types";

/**
 * Official Nova Poshta API v2.0 (address directories), server side only.
 *
 * The public address directories work without a counterparty key, so the
 * picker keeps working even when NOVAPOSHTA_API_KEY is absent or expired.
 */
const ENDPOINT = "https://api.novaposhta.ua/v2.0/json/";

type NpItem = Record<string, unknown>;

type NpResponse = {
  success: boolean;
  data?: NpItem[];
  errors?: string[];
  info?: { totalCount?: number };
};

/** Small in-process cache — directories change rarely and this kills re-fetch latency. */
const cache = new Map<string, { at: number; value: unknown }>();
const TTL = 10 * 60 * 1000;

function cached<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL) {
    cache.delete(key);
    return null;
  }
  return hit.value as T;
}

function store(key: string, value: unknown) {
  if (cache.size > 300) cache.clear();
  cache.set(key, { at: Date.now(), value });
}

async function request(
  apiKey: string,
  modelName: string,
  calledMethod: string,
  methodProperties: Record<string, unknown>,
): Promise<NpResponse> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey, modelName, calledMethod, methodProperties }),
  });
  if (!response.ok) throw new Error(`novaposhta_http_${response.status}`);
  return (await response.json()) as NpResponse;
}

async function call(
  modelName: string,
  calledMethod: string,
  methodProperties: Record<string, unknown>,
): Promise<NpResponse> {
  const key = process.env["NOVAPOSHTA_API_KEY"] ?? "";
  let payload = await request(key, modelName, calledMethod, methodProperties);
  // A missing/expired counterparty key must never break the address directories.
  if (!payload.success && key) {
    payload = await request("", modelName, calledMethod, methodProperties);
  }
  if (!payload.success) throw new Error(payload.errors?.join("; ") || "novaposhta_error");
  return payload;
}

const str = (row: NpItem, field: string) =>
  typeof row[field] === "string" ? (row[field] as string) : "";

/** Ukrainian directory strings, transliterated labels are not provided by the API. */
function cityHint(row: NpItem): string {
  const area = str(row, "Area");
  const region = str(row, "Region");
  const areaLabel = area ? `${area} обл.` : "";
  const regionLabel = region ? `${region} р-н` : "";
  return [regionLabel, areaLabel].filter(Boolean).join(", ");
}

/**
 * Search settlements across the whole country in one step.
 * `searchSettlements` only returns places that Nova Poshta actually serves.
 */
export async function searchCities(query: string): Promise<NpCity[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const key = `cities:${q.toLowerCase()}`;
  const hit = cached<NpCity[]>(key);
  if (hit) return hit;

  // Two directories complement each other: `searchSettlements` is fuzzy but
  // short, `getSettlements` returns the full served list for the same string.
  const [search, full] = await Promise.all([
    call("AddressGeneral", "searchSettlements", { CityName: q, Limit: "200", Page: "1" }).catch(
      () => null,
    ),
    call("Address", "getSettlements", {
      FindByString: q,
      Warehouse: "1",
      Limit: "150",
      Page: "1",
    }).catch(() => null),
  ]);
  if (!search && !full) throw new Error("novaposhta_error");

  const rows: NpItem[] = [
    ...((search?.data?.[0]?.["Addresses"] ?? []) as NpItem[]),
    ...((full?.data ?? []) as NpItem[]),
  ];
  const seen = new Set<string>();
  const labels = new Set<string>();
  const out: NpCity[] = [];
  for (const row of rows) {
    const ref = str(row, "Ref");
    const main = str(row, "MainDescription") || str(row, "Description");
    if (!ref || !main || seen.has(ref)) continue;
    seen.add(ref);
    const type = str(row, "SettlementTypeCode") || str(row, "SettlementTypeDescription");
    const hint =
      cityHint(row) ||
      [
        str(row, "RegionsDescription") ? `${str(row, "RegionsDescription")} р-н` : "",
        str(row, "AreaDescription") ? `${str(row, "AreaDescription")} обл.` : "",
      ]
        .filter(Boolean)
        .join(", ");
    // Same settlement can come back twice under different refs — keep the first.
    const label = `${type} ${main} ${hint}`.toLowerCase();
    if (labels.has(label)) continue;
    labels.add(label);
    const warehouses = Number(row["Warehouses"] ?? row["WarehousesCount"] ?? 0) || 0;
    out.push({
      ref,
      name: type ? `${type} ${main}` : main,
      hint,
      warehouses,
    });
  }
  // Bigger hubs first, then alphabetically — matches what people expect.
  out.sort((a, b) => b.warehouses - a.warehouses || a.name.localeCompare(b.name, "uk"));
  store(key, out);
  return out;
}

function kindOf(row: NpItem): NpPointKind {
  const category = str(row, "CategoryOfWarehouse");
  if (category === "Postomat") return "postomat";
  if (category === "DropOff") return "dropoff";
  return "branch";
}

function pointLabel(row: NpItem, kind: NpPointKind): { name: string; address: string } {
  const description = str(row, "Description");
  const number = str(row, "Number");
  const split = description.indexOf(":");
  const address = split > -1 ? description.slice(split + 1).trim() : description;
  const prefix =
    kind === "postomat" ? "Поштомат" : kind === "dropoff" ? "Пункт приймання" : "Відділення";
  return { name: number ? `${prefix} №${number}` : prefix, address };
}

const DAYS: [string, string][] = [
  ["Monday", "Пн"],
  ["Tuesday", "Вт"],
  ["Wednesday", "Ср"],
  ["Thursday", "Чт"],
  ["Friday", "Пт"],
  ["Saturday", "Сб"],
  ["Sunday", "Нд"],
];

/** Real API schedule; entries the API omits are simply not shown. */
function scheduleOf(row: NpItem): { day: string; hours: string }[] {
  const raw = row["Schedule"];
  if (!raw || typeof raw !== "object") return [];
  const src = raw as Record<string, unknown>;
  const out: { day: string; hours: string }[] = [];
  for (const [key, label] of DAYS) {
    const value = typeof src[key] === "string" ? (src[key] as string).trim() : "";
    if (value) out.push({ day: label, hours: value });
  }
  return out;
}

/** Only flags the directory actually reports as enabled. */
function featuresOf(row: NpItem): string[] {
  const on = (field: string) => {
    const v = row[field];
    return v === true || v === "1" || v === 1;
  };
  const flags: [string, string][] = [
    ["POSTerminal", "Оплата картою (POS-термінал)"],
    ["PaymentAccess", "Приймання платежів"],
    ["PostFinance", "Поштові фінанси"],
    ["BicycleParking", "Велопарковка"],
    ["InternationalShipping", "Міжнародні відправлення"],
    ["OnlyReceivingParcel", "Тільки видача відправлень"],
  ];
  const out = flags.filter(([f]) => on(f)).map(([, label]) => label);
  const workplaces = Number(row["SelfServiceWorkplacesCount"] ?? 0) || 0;
  if (workplaces > 0) out.push(`Самообслуговування: ${workplaces} місць`);
  return out;
}


/** Every Nova Poshta point of a settlement: branches, postomats and drop-off points. */
export async function listWarehouses(settlementRef: string): Promise<NpPoint[]> {
  const key = `wh:${settlementRef}`;
  const hit = cached<NpPoint[]>(key);
  if (hit) return hit;

  const PAGE = 500;
  const first = await call("Address", "getWarehouses", {
    SettlementRef: settlementRef,
    Limit: String(PAGE),
    Page: "1",
  });

  const rows: NpItem[] = [...(first.data ?? [])];
  const total = Number(first.info?.totalCount ?? rows.length) || rows.length;
  const pages = Math.min(Math.ceil(total / PAGE), 8);
  if (pages > 1) {
    const rest = await Promise.all(
      Array.from({ length: pages - 1 }, (_, i) =>
        call("Address", "getWarehouses", {
          SettlementRef: settlementRef,
          Limit: String(PAGE),
          Page: String(i + 2),
        }).then((p) => p.data ?? []),
      ),
    );
    for (const chunk of rest) rows.push(...chunk);
  }

  const seen = new Set<string>();
  const out: NpPoint[] = [];
  for (const row of rows) {
    const ref = str(row, "Ref");
    if (!ref || seen.has(ref)) continue;
    // Temporarily closed points must not be selectable.
    if (str(row, "WarehouseStatus") === "Closed") continue;
    seen.add(ref);
    const kind = kindOf(row);
    const { name, address } = pointLabel(row, kind);
    out.push({
      ref,
      name,
      number: str(row, "Number"),
      address,
      kind,
      description: str(row, "Description"),
      typeName: str(row, "CategoryOfWarehouse"),
      phone: str(row, "Phone"),
      placeMaxWeight: Number(row["PlaceMaxWeightAllowed"] ?? 0) || 0,
      totalMaxWeight: Number(row["TotalMaxWeightAllowed"] ?? 0) || 0,
      schedule: scheduleOf(row),
      features: featuresOf(row),
    });

  }

  const rank: Record<NpPointKind, number> = { branch: 0, postomat: 1, dropoff: 2 };
  out.sort(
    (a, b) =>
      rank[a.kind] - rank[b.kind] ||
      (Number(a.number) || 99999) - (Number(b.number) || 99999),
  );
  store(key, out);
  return out;
}
