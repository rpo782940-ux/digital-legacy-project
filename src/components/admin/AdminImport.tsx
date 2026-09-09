import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  adminCreateSnapshot,
  adminFinalizeSnapshot,
  adminImportProducts,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload } from "lucide-react";

type PlanRow = {
  line: number;
  key: string;
  name: string;
  action: "create" | "update" | "skip" | "error";
  reason?: string;
};

type Plan = {
  applied: boolean;
  toCreate: number;
  toUpdate: number;
  skipped: number;
  errors: number;
  withCategory: number;
  withoutCategory: number;
  categories: string[];
  unmatchedCategories: { key: string; count: number }[];
  rows: PlanRow[];
};


/** Result of reading an OpenCart export workbook. */
type Parsed = {
  fileName: string;
  rows: Record<string, unknown>[];
  products: number;
  images: number;
  imagesMatched: number;
  attributes: number;
  attributesMatched: number;
  seo: number;
  seoMatched: number;
  specials: number;
  supported: string[];
  unsupported: { sheet: string; count: number }[];
};

const TONE: Record<PlanRow["action"], string> = {
  create: "bg-emerald-100 text-emerald-800",
  update: "bg-sky-100 text-sky-800",
  skip: "bg-muted text-muted-foreground",
  error: "bg-destructive/10 text-destructive",
};

const LABEL: Record<PlanRow["action"], string> = {
  create: "новый",
  update: "обновление",
  skip: "пропуск",
  error: "ошибка",
};

const CHUNK = 100;
const UNSUPPORTED_SHEETS = [
  "Discounts",
  "Rewards",
  "ProductOptions",
  "ProductOptionValues",
  "ProductFilters",
];

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());
/** An OpenCart export pads the sheet with fully blank rows — those are not products. */
const isBlank = (r: Record<string, unknown>) => Object.values(r).every((v) => str(v) === "");

export function AdminImport() {
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState(0);
  const run = useServerFn(adminImportProducts);
  const snapshot = useServerFn(adminCreateSnapshot);
  const finalize = useServerFn(adminFinalizeSnapshot);
  const qc = useQueryClient();
  const rows = parsed?.rows ?? [];

  const preview = useMutation({
    // Large catalogs are sent in chunks: one 14 MB request would exceed request limits.
    mutationFn: async (apply: boolean) => {
      const total: Plan = {
        applied: apply,
        toCreate: 0,
        toUpdate: 0,
        skipped: 0,
        errors: 0,
        withCategory: 0,
        withoutCategory: 0,
        categories: [],
        unmatchedCategories: [],
        rows: [],
      };
      const cats = new Set<string>();
      const unmatched = new Map<string, number>();
      setProgress(0);

      // A restore point is always taken before the catalog is touched.
      const snapshotId = apply
        ? (await snapshot({ data: { source: "Импорт OpenCart", note: parsed?.fileName } })).id
        : null;

      try {
        for (let i = 0; i < rows.length; i += CHUNK) {
          const slice = rows.slice(i, i + CHUNK);
          const r = (await run({ data: { rows: slice, apply } })) as Plan;
          total.toCreate += r.toCreate;
          total.toUpdate += r.toUpdate;
          total.skipped += r.skipped;
          total.errors += r.errors;
          total.withCategory += r.withCategory;
          total.withoutCategory += r.withoutCategory;
          for (const c of r.categories) cats.add(c);
          for (const u of r.unmatchedCategories)
            unmatched.set(u.key, (unmatched.get(u.key) ?? 0) + u.count);
          total.rows.push(...r.rows.map((x) => ({ ...x, line: x.line + i })));
          setProgress(Math.min(i + CHUNK, rows.length));
        }
      } catch (e) {
        if (snapshotId)
          await finalize({ data: { id: snapshotId, created: 0, updated: 0, cancel: true } });
        throw e;
      }

      total.categories = [...cats].sort();
      total.unmatchedCategories = [...unmatched]
        .map(([key, count]) => ({ key, count }))
        .sort((a, b) => b.count - a.count);

      if (snapshotId)
        await finalize({
          data: { id: snapshotId, created: total.toCreate, updated: total.toUpdate },
        });

      return total;
    },
    onSuccess: (r) => {
      setPlan(r);
      if (r.applied) {
        toast.success(`Импорт применён: создано ${r.toCreate}, обновлено ${r.toUpdate}`);
        qc.invalidateQueries({ queryKey: ["admin"] });
        qc.invalidateQueries({ queryKey: ["catalog"] });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });


  async function onFile(file: File) {
    setParsing(true);
    setPlan(null);
    setParsed(null);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = (name: string) => {
        const ws = wb.Sheets[name];
        const json = ws ? XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" }) : [];
        return json.filter((r) => !isBlank(r));
      };

      // Step 1 — the Products sheet is the only source of products.
      const mainName = wb.SheetNames.includes("Products") ? "Products" : wb.SheetNames[0];
      if (!mainName) throw new Error("Пустой файл");
      const products = sheet(mainName).filter((r) => str(r["name(ru-ru)"]) || str(r["name(uk-ua)"]) || str(r["name"]));
      if (!products.length) throw new Error("На листе Products нет строк с товарами");

      // Step 2 — map OpenCart product_id → product row.
      const ids = new Set(products.map((r) => str(r["product_id"])).filter(Boolean));

      // Step 3+ — related sheets are attached to products, never imported as products.
      const galleries = new Map<string, string[]>();
      const imageRows = sheet("AdditionalImages");
      let imagesMatched = 0;
      for (const r of imageRows) {
        const id = str(r["product_id"]);
        const img = str(r["image"]);
        if (!id || !img) continue;
        if (!ids.has(id)) continue;
        imagesMatched++;
        galleries.set(id, [...(galleries.get(id) ?? []), img]);
      }

      const slugs = new Map<string, string>();
      const seoRows = sheet("ProductSEOKeywords");
      let seoMatched = 0;
      for (const r of seoRows) {
        const id = str(r["product_id"]);
        const kw = str(r["keyword(ru-ru)"]) || str(r["keyword(uk-ua)"]);
        if (!id || !kw || !ids.has(id) || slugs.has(id)) continue;
        slugs.set(id, kw);
        seoMatched++;
      }

      const specsRu = new Map<string, string[]>();
      const specsUk = new Map<string, string[]>();
      const attrRows = sheet("ProductAttributes");
      let attributesMatched = 0;
      for (const r of attrRows) {
        const id = str(r["product_id"]);
        if (!id || !ids.has(id)) continue;
        const ru = str(r["text(ru-ru)"]);
        const uk = str(r["text(uk-ua)"]) || ru;
        if (!ru && !uk) continue;
        attributesMatched++;
        if (ru) specsRu.set(id, [...(specsRu.get(id) ?? []), ru]);
        if (uk) specsUk.set(id, [...(specsUk.get(id) ?? []), uk]);
      }

      const specials = new Map<string, string>();
      const specialRows = sheet("Specials");
      for (const r of specialRows) {
        const id = str(r["product_id"]);
        const price = str(r["price"]);
        if (id && price && ids.has(id) && !specials.has(id)) specials.set(id, price);
      }

      const merged = products.map((r) => {
        const id = str(r["product_id"]);
        const out: Record<string, unknown> = { ...r };
        const g = galleries.get(id);
        if (g?.length) out["gallery"] = g.join("\n");
        const s = slugs.get(id);
        if (s) out["seo_url"] = s;
        const sp = specials.get(id);
        if (sp) out["special_price"] = sp;
        const ru = specsRu.get(id);
        if (ru?.length) out["specs_ru"] = ru.join("\n");
        const uk = specsUk.get(id);
        if (uk?.length) out["specs_uk"] = uk.join("\n");
        return out;
      });

      const unsupported = UNSUPPORTED_SHEETS.map((name) => ({
        sheet: name,
        count: sheet(name).length,
      })).filter((s) => s.count > 0);

      setParsed({
        fileName: file.name,
        rows: merged,
        products: merged.length,
        images: imageRows.length,
        imagesMatched,
        attributes: attrRows.length,
        attributesMatched,
        seo: seoRows.length,
        seoMatched,
        specials: specialRows.length,
        supported: ["Products", "AdditionalImages", "ProductAttributes", "ProductSEOKeywords", "Specials"],
        unsupported,
      });
      toast.success(`Файл OpenCart распознан: товаров ${merged.length}`);
    } catch (e) {
      toast.error((e as Error).message);
      setParsed(null);
    } finally {
      setParsing(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-6">
          <p className="text-sm text-muted-foreground">
            Загрузите выгрузку OpenCart (.xlsx / .csv). Товары берутся только с листа Products,
            остальные листы привязываются по product_id. Существующие товары никогда не удаляются.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input px-4 py-2 text-sm hover:bg-accent">
              <Upload className="size-4" />
              Выбрать файл
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onFile(f);
                }}
              />
            </label>
            {parsing ? <Loader2 className="size-4 animate-spin" /> : null}
            {parsed ? (
              <span className="text-sm">
                {parsed.fileName} · товаров: <b>{parsed.products}</b>
              </span>
            ) : null}
            <Button disabled={!rows.length || preview.isPending} onClick={() => preview.mutate(false)}>
              Предпросмотр
            </Button>
            <Button
              variant="default"
              disabled={!plan || plan.applied || preview.isPending}
              onClick={() => preview.mutate(true)}
            >
              Применить импорт
            </Button>
            {preview.isPending ? (
              <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                {progress} / {rows.length}
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {parsed ? (
        <Card>
          <CardContent className="space-y-4 p-6">
            <h3 className="font-semibold">Файл OpenCart успешно распознан</h3>
            <div className="flex flex-wrap gap-4 text-sm">
              <Stat label="Товаров найдено" value={parsed.products} />
              <Stat label="Доп. изображения" value={parsed.imagesMatched} />
              <Stat label="Характеристики" value={parsed.attributesMatched} />
              <Stat label="SEO URL" value={parsed.seoMatched} />
              <Stat label="Акционные цены" value={parsed.specials} />
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <div className="mb-1 font-medium">Обработанные листы</div>
                <ul className="space-y-1 text-muted-foreground">
                  {parsed.supported.map((s) => (
                    <li key={s}>✓ {s}</li>
                  ))}
                </ul>
              </div>
              {parsed.unsupported.length ? (
                <div>
                  <div className="mb-1 font-medium">Пропущено (пока не поддерживается)</div>
                  <ul className="space-y-1 text-muted-foreground">
                    {parsed.unsupported.map((s) => (
                      <li key={s.sheet}>
                        ⚠ {s.sheet}: {s.count} строк — данные пропущены
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {plan ? (
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex flex-wrap gap-4 text-sm">
              <Stat label="Новые" value={plan.toCreate} />
              <Stat label="Обновления" value={plan.toUpdate} />
              <Stat label="Пропущено" value={plan.skipped} />
              <Stat label="Ошибки" value={plan.errors} />
              {plan.applied ? <Badge>Применено</Badge> : <Badge variant="secondary">Черновик</Badge>}
            </div>

            <div className="max-h-[480px] overflow-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/70 text-left">
                  <tr>
                    <th className="p-2">Строка</th>
                    <th className="p-2">Ключ</th>
                    <th className="p-2">Название</th>
                    <th className="p-2">Действие</th>
                    <th className="p-2">Причина</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.rows.map((r) => (
                    <tr key={`${r.line}-${r.key}`} className="border-t">
                      <td className="p-2">{r.line}</td>
                      <td className="p-2 text-muted-foreground">{r.key || "—"}</td>
                      <td className="p-2">{r.name}</td>
                      <td className="p-2">
                        <span className={`rounded px-2 py-0.5 text-xs ${TONE[r.action]}`}>
                          {LABEL[r.action]}
                        </span>
                      </td>
                      <td className="p-2 text-muted-foreground">{r.reason ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
