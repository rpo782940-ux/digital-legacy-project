import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Building2, Check, Loader2, MapPin, PackageOpen, Search, X } from "lucide-react";
import { npCitySearch, npCityWarehouses } from "@/lib/novaposhta.functions";
import type { NpCity, NpPoint } from "@/lib/novaposhta-types";
import { t } from "@/lib/i18n";
import type { Lang } from "@/lib/site";

export type NpSelection = {
  city: string;
  warehouse: string;
  warehouseAddress: string;
  point: NpPoint | null;
  /** Plain settlement name ("м. Харків") and its Nova Poshta ref. */
  cityName?: string;
  cityRef?: string;
};

const POPULAR = ["Київ", "Харків", "Одеса", "Дніпро", "Львів", "Запоріжжя"];

const field =
  "w-full rounded-lg border border-input bg-background py-3 pl-10 pr-10 text-base outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-ring/25 sm:text-sm";

/** Normalises Ukrainian/Russian input so "харьков"/"Харків" both match locally. */
const norm = (value: string) => value.toLowerCase().replace(/[ʼ'’`]/g, "").trim();

/**
 * Nova Poshta picker — two steps only: find the city, pick the point.
 * Branches, postomats and drop-off points live in one list; no delivery-type step.
 */
export function NovaPoshtaPicker({
  lang,
  onChange,
}: {
  lang: Lang;
  onChange: (value: NpSelection) => void;
}) {
  const findCities = useServerFn(npCitySearch);
  const loadPoints = useServerFn(npCityWarehouses);

  const [cityQuery, setCityQuery] = useState("");
  const [cities, setCities] = useState<NpCity[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [city, setCity] = useState<NpCity | null>(null);

  const [points, setPoints] = useState<NpPoint[]>([]);
  const [pointsLoading, setPointsLoading] = useState(false);
  const [pointQuery, setPointQuery] = useState("");
  const [point, setPoint] = useState<NpPoint | null>(null);
  const [pointsOpen, setPointsOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  const cityBox = useRef<HTMLDivElement>(null);
  // Monotonic request ids: a stale response can never overwrite a newer one.
  const cityReq = useRef(0);
  const pointReq = useRef(0);

  useEffect(() => {
    if (!cityOpen) return;
    const close = (e: MouseEvent) => {
      if (cityBox.current && !cityBox.current.contains(e.target as Node)) setCityOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [cityOpen]);

  // Debounced country-wide city search.
  useEffect(() => {
    const q = cityQuery.trim();
    if (city && q === city.name) return;
    if (q.length < 2) {
      cityReq.current++;
      setCities([]);
      setCitiesLoading(false);
      return;
    }
    const req = ++cityReq.current;
    setCitiesLoading(true);
    const timer = setTimeout(() => {
      findCities({ data: { query: q } })
        .then((rows) => {
          if (req !== cityReq.current) return;
          setCities(rows);
          setFailed(false);
        })
        .catch(() => {
          if (req !== cityReq.current) return;
          setCities([]);
          setFailed(true);
        })
        .finally(() => {
          if (req === cityReq.current) setCitiesLoading(false);
        });
    }, 220);
    return () => clearTimeout(timer);
  }, [cityQuery, city, findCities]);

  const selectCity = useCallback(
    (next: NpCity) => {
      setCity(next);
      setCityQuery(next.name);
      setCityOpen(false);
      setPoint(null);
      setPointQuery("");
      setPoints([]);
      setPointsOpen(true);
      onChange({
        city: `${next.name}, ${next.hint}`.replace(/,\s*$/, ""),
        warehouse: "",
        warehouseAddress: "",
        point: null,
        cityName: next.name,
        cityRef: next.ref,
      });

      const req = ++pointReq.current;
      setPointsLoading(true);
      loadPoints({ data: { settlementRef: next.ref } })
        .then((rows) => {
          if (req !== pointReq.current) return;
          setPoints(rows);
          setFailed(false);
        })
        .catch(() => {
          if (req !== pointReq.current) return;
          setPoints([]);
          setFailed(true);
        })
        .finally(() => {
          if (req === pointReq.current) setPointsLoading(false);
        });
    },
    [loadPoints, onChange],
  );

  const reset = () => {
    cityReq.current++;
    pointReq.current++;
    setCity(null);
    setCityQuery("");
    setCities([]);
    setPoints([]);
    setPoint(null);
    setPointQuery("");
    setPointsOpen(false);
    setFailed(false);
    onChange({ city: "", warehouse: "", warehouseAddress: "", point: null });
  };

  // Points are fully loaded for the settlement, so filtering is instant and local.
  // Ranking: exact branch number → prefix → contains → name → address.
  const visiblePoints = useMemo(() => {
    const raw = pointQuery.trim();
    if (!raw) return points;
    const digits = raw.replace(/\D+/g, "");
    const needle = norm(raw);
    const scored: { p: NpPoint; s: number }[] = [];
    for (const p of points) {
      let s = -1;
      if (digits) {
        if (p.number === digits) s = 0;
        else if (p.number.startsWith(digits)) s = 1;
        else if (p.number.includes(digits)) s = 2;
      }
      if (s < 0 && needle && norm(p.name).includes(needle)) s = 3;
      if (s < 0 && needle && norm(p.address).includes(needle)) s = 4;
      if (s >= 0) scored.push({ p, s });
    }
    scored.sort(
      (a, b) =>
        a.s - b.s ||
        (Number(a.p.number) || 1e9) - (Number(b.p.number) || 1e9) ||
        a.p.name.localeCompare(b.p.name),
    );
    return scored.map((x) => x.p);
  }, [points, pointQuery]);


  const iconFor = (kind: NpPoint["kind"]) =>
    kind === "postomat" ? PackageOpen : kind === "dropoff" ? MapPin : Building2;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-3">
      {/* Step 1 — city */}
      <div className="relative" ref={cityBox}>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          type="text"
          inputMode="search"
          autoComplete="off"
          value={cityQuery}
          placeholder={t("npCityPlaceholder", lang)}
          aria-label={t("npCity", lang)}
          onFocus={() => setCityOpen(true)}
          onChange={(e) => {
            setCityQuery(e.target.value);
            setCityOpen(true);
            if (city) {
              setCity(null);
              setPoints([]);
              setPoint(null);
              setPointsOpen(false);
              onChange({ city: "", warehouse: "", warehouseAddress: "", point: null });
            }
          }}
          className={field}
        />
        {citiesLoading ? (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : (
          (cityQuery || city) && (
            <button
              type="button"
              onClick={reset}
              aria-label={t("clear", lang)}
              className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
            >
              <X className="size-4" />
            </button>
          )
        )}

        {cityOpen && !city && (
          <div className="absolute z-50 mt-1 max-h-96 w-full overflow-y-auto overscroll-contain rounded-lg border border-border bg-card shadow-lift">
            {cityQuery.trim().length < 2 ? (
              <div className="p-3">
                <p className="text-xs text-muted-foreground">{t("npCityHint", lang)}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {POPULAR.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setCityQuery(name)}
                      className="rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            ) : citiesLoading && cities.length === 0 ? (
              <p className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> {t("loading", lang)}
              </p>
            ) : cities.length === 0 ? (
              <p className="px-3 py-3 text-sm text-muted-foreground">
                {failed ? t("npError", lang) : t("nothingFound", lang)}
              </p>
            ) : (
              <ul className="py-1">
                {cities.map((c) => (
                  <li key={c.ref}>
                    <button
                      type="button"
                      onClick={() => selectCity(c)}
                      className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-muted"
                    >
                      <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{c.name}</span>
                        {c.hint && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {c.hint}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Step 2 — delivery point */}
      {city && point && !pointsOpen && (
        <div className="rounded-lg border border-accent bg-background px-3 py-3">
          <button
            type="button"
            onClick={() => setPointsOpen(true)}
            className="flex w-full items-start gap-2.5 text-left"
          >
            <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{point.name}</span>
              <span className="block break-words text-xs text-muted-foreground">
                {point.description || point.address}
              </span>
            </span>
            <span className="shrink-0 text-xs font-medium text-accent underline">
              {t("npChange", lang)}
            </span>
          </button>

          {/* Everything the Nova Poshta directory actually returns for this point. */}
          <dl className="mt-3 space-y-1.5 border-t border-border pt-3 text-xs">
            {point.number && (
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-muted-foreground">Номер</dt>
                <dd className="min-w-0 flex-1 break-words">№{point.number}</dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 text-muted-foreground">Адреса</dt>
              <dd className="min-w-0 flex-1 break-words">{point.address}</dd>
            </div>
            {point.phone && (
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-muted-foreground">Телефон</dt>
                <dd className="min-w-0 flex-1 break-words">
                  <a href={`tel:${point.phone}`} className="underline">
                    {point.phone}
                  </a>
                </dd>
              </div>
            )}
            {point.placeMaxWeight > 0 && (
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-muted-foreground">Макс. вага місця</dt>
                <dd className="min-w-0 flex-1">{point.placeMaxWeight} кг</dd>
              </div>
            )}
            {point.totalMaxWeight > 0 && (
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-muted-foreground">Макс. вага</dt>
                <dd className="min-w-0 flex-1">{point.totalMaxWeight} кг</dd>
              </div>
            )}
            {point.schedule.length > 0 && (
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-muted-foreground">Графік</dt>
                <dd className="min-w-0 flex-1">
                  <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5 sm:grid-cols-3">
                    {point.schedule.map((s) => (
                      <li key={s.day} className="flex justify-between gap-2">
                        <span className="text-muted-foreground">{s.day}</span>
                        <span>{s.hours}</span>
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
            {point.features.length > 0 && (
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-muted-foreground">Сервіси</dt>
                <dd className="min-w-0 flex-1 break-words">{point.features.join(" · ")}</dd>
              </div>
            )}
          </dl>
        </div>
      )}


      {city && (!point || pointsOpen) && (
        <div className="space-y-2">
          {pointsLoading ? (
            <p className="flex items-center gap-2 px-1 py-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> {t("npLoadingPoints", lang)}
            </p>
          ) : points.length === 0 ? (
            <p className="rounded-lg border border-border bg-background px-3 py-3 text-sm text-muted-foreground">
              {failed ? t("npError", lang) : t("npNoWarehouses", lang)}
            </p>
          ) : (
            <>
              {points.length > 8 && (
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <input
                    type="text"
                    inputMode="search"
                    value={pointQuery}
                    placeholder={t("npFilterPoints", lang)}
                    aria-label={t("npFilterPoints", lang)}
                    onChange={(e) => setPointQuery(e.target.value)}
                    className={field}
                  />
                </div>
              )}

              <ul
                role="listbox"
                aria-label={t("npWarehouse", lang)}
                className="max-h-72 divide-y divide-border overflow-y-auto overscroll-contain rounded-lg border border-border bg-background"
              >
                {visiblePoints.length === 0 && (
                  <li className="px-3 py-3 text-sm text-muted-foreground">
                    {t("nothingFound", lang)}
                  </li>
                )}
                {visiblePoints.slice(0, 300).map((p) => {
                  const Icon = iconFor(p.kind);
                  const active = point?.ref === p.ref;
                  return (
                    <li key={p.ref}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => {
                          setPoint(p);
                          setPointsOpen(false);
                          setPointQuery("");
                          onChange({
                            city: `${city.name}, ${city.hint}`.replace(/,\s*$/, ""),
                            warehouse: p.name,
                            warehouseAddress: p.address,
                            point: p,
                            cityName: city.name,
                            cityRef: city.ref,
                          });
                        }}
                        className={`flex w-full items-start gap-2.5 px-3 py-3 text-left transition-colors ${
                          active ? "bg-accent/10" : "hover:bg-muted"
                        }`}
                      >
                        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">{p.name}</span>
                          <span className="block break-words text-xs text-muted-foreground">
                            {p.address}
                          </span>
                        </span>
                        {active && <Check className="mt-0.5 size-4 shrink-0 text-accent" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
