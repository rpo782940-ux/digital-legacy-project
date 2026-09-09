import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  adminGetProduct,
  adminListCategories,
  adminListProducts,
  adminSaveProduct,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Pencil, Search } from "lucide-react";

export type ProductForm = {
  id: string | null;
  category_id: string;
  slug: string;
  sku: string;
  name_ru: string;
  name_uk: string;
  description_ru: string;
  description_uk: string;
  price: string;
  old_price: string;
  special_price: string;
  image_path: string;
  gallery: string;
  specs_ru: string;
  specs_uk: string;
  is_active: boolean;
  in_stock: boolean;
  sort_order: string;
  meta_title_ru: string;
  meta_title_uk: string;
  meta_desc_ru: string;
  meta_desc_uk: string;
};

export const emptyProduct = (categoryId = ""): ProductForm => ({
  id: null,
  category_id: categoryId,
  slug: "",
  sku: "",
  name_ru: "",
  name_uk: "",
  description_ru: "",
  description_uk: "",
  price: "",
  old_price: "",
  special_price: "",
  image_path: "",
  gallery: "",
  specs_ru: "",
  specs_uk: "",
  is_active: true,
  in_stock: true,
  sort_order: "0",
  meta_title_ru: "",
  meta_title_uk: "",
  meta_desc_ru: "",
  meta_desc_uk: "",
});

const strList = (v: unknown): string =>
  Array.isArray(v)
    ? v
        .map((x) => (typeof x === "string" ? x : typeof x === "object" && x ? JSON.stringify(x) : ""))
        .filter(Boolean)
        .join("\n")
    : "";

const num = (v: string): number | null => {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const lines = (v: string): string[] =>
  v
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

export function useCategories() {
  const list = useServerFn(adminListCategories);
  return useQuery({ queryKey: ["admin", "categories"], queryFn: () => list() });
}

/* ------------------------------- form ------------------------------- */

export function ProductForm({
  value,
  onSaved,
  onCancel,
}: {
  value: ProductForm;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState<ProductForm>(value);
  useEffect(() => setForm(value), [value]);
  const cats = useCategories();
  const save = useServerFn(adminSaveProduct);
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.category_id) throw new Error("Выберите категорию");
      if (!form.name_ru.trim()) throw new Error("Укажите название");
      return save({
        data: {
          id: form.id,
          category_id: form.category_id,
          slug: form.slug.trim(),
          sku: form.sku.trim() || null,
          name_ru: form.name_ru.trim(),
          name_uk: (form.name_uk || form.name_ru).trim(),
          description_ru: form.description_ru.trim() || null,
          description_uk: form.description_uk.trim() || null,
          price: num(form.price),
          old_price: num(form.old_price),
          special_price: num(form.special_price),
          image_path: form.image_path.trim(),
          gallery: lines(form.gallery),
          specs_ru: lines(form.specs_ru),
          specs_uk: lines(form.specs_uk),
          is_active: form.is_active,
          in_stock: form.in_stock,
          sort_order: Number(form.sort_order || 0),
          meta_title_ru: form.meta_title_ru.trim() || null,
          meta_title_uk: form.meta_title_uk.trim() || null,
          meta_desc_ru: form.meta_desc_ru.trim() || null,
          meta_desc_uk: form.meta_desc_uk.trim() || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Товар сохранён");
      qc.invalidateQueries({ queryKey: ["admin", "products"] });
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = <K extends keyof ProductForm>(k: K, v: ProductForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <Card>
      <CardContent className="grid gap-5 p-6 md:grid-cols-2">
        <div className="md:col-span-2 grid gap-2">
          <Label>Категория</Label>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={form.category_id}
            onChange={(e) => set("category_id", e.target.value)}
          >
            <option value="">— выберите —</option>
            {(cats.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name_ru}
              </option>
            ))}
          </select>
        </div>

        <Field label="Название (RU)" value={form.name_ru} onChange={(v) => set("name_ru", v)} />
        <Field label="Название (UA)" value={form.name_uk} onChange={(v) => set("name_uk", v)} />
        <Field label="SKU / артикул" value={form.sku} onChange={(v) => set("sku", v)} />
        <Field label="URL (slug)" value={form.slug} onChange={(v) => set("slug", v)} />
        <Field label="Цена, грн" value={form.price} onChange={(v) => set("price", v)} />
        <Field label="Старая цена" value={form.old_price} onChange={(v) => set("old_price", v)} />
        <Field
          label="Акционная цена"
          value={form.special_price}
          onChange={(v) => set("special_price", v)}
        />
        <Field
          label="Порядок сортировки"
          value={form.sort_order}
          onChange={(v) => set("sort_order", v)}
        />

        <div className="md:col-span-2 grid gap-2">
          <Label>Главное изображение (путь или URL)</Label>
          <Input value={form.image_path} onChange={(e) => set("image_path", e.target.value)} />
          {form.image_path ? (
            <img
              src={form.image_path}
              alt=""
              className="mt-2 h-28 w-28 rounded-md border object-cover"
            />
          ) : null}
        </div>

        <Area
          className="md:col-span-2"
          label="Галерея (по одному URL в строке)"
          value={form.gallery}
          onChange={(v) => set("gallery", v)}
        />
        <Area label="Описание (RU)" value={form.description_ru} onChange={(v) => set("description_ru", v)} />
        <Area label="Описание (UA)" value={form.description_uk} onChange={(v) => set("description_uk", v)} />
        <Area label="Характеристики (RU)" value={form.specs_ru} onChange={(v) => set("specs_ru", v)} />
        <Area label="Характеристики (UA)" value={form.specs_uk} onChange={(v) => set("specs_uk", v)} />
        <Field label="Meta title (RU)" value={form.meta_title_ru} onChange={(v) => set("meta_title_ru", v)} />
        <Field label="Meta title (UA)" value={form.meta_title_uk} onChange={(v) => set("meta_title_uk", v)} />
        <Area label="Meta description (RU)" value={form.meta_desc_ru} onChange={(v) => set("meta_desc_ru", v)} />
        <Area label="Meta description (UA)" value={form.meta_desc_uk} onChange={(v) => set("meta_desc_uk", v)} />

        <div className="flex items-center gap-3">
          <Switch checked={form.in_stock} onCheckedChange={(v) => set("in_stock", v)} />
          <Label>В наличии</Label>
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} />
          <Label>Показывать на сайте</Label>
        </div>

        <div className="md:col-span-2 flex gap-3">
          <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Сохранить
          </Button>
          {onCancel ? (
            <Button variant="outline" onClick={onCancel}>
              Отмена
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Area({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div className={`grid gap-2 ${className ?? ""}`}>
      <Label>{label}</Label>
      <Textarea rows={4} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/* ------------------------------- list ------------------------------- */

export function AdminProducts() {
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);

  const list = useServerFn(adminListProducts);
  const getOne = useServerFn(adminGetProduct);

  const products = useQuery({
    queryKey: ["admin", "products", term, page],
    queryFn: () => list({ data: { q: term || undefined, page } }),
  });

  const current = useQuery({
    queryKey: ["admin", "product", editingId],
    queryFn: () => getOne({ data: { id: editingId as string } }),
    enabled: Boolean(editingId),
  });

  const formValue = useMemo<ProductForm | null>(() => {
    const p = current.data as Record<string, unknown> | null | undefined;
    if (!p) return null;
    const s = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : "");
    const n = (k: string) => (p[k] === null || p[k] === undefined ? "" : String(p[k]));
    return {
      id: String(p["id"]),
      category_id: String(p["category_id"] ?? ""),
      slug: s("slug"),
      sku: s("sku"),
      name_ru: s("name_ru"),
      name_uk: s("name_uk"),
      description_ru: s("description_ru"),
      description_uk: s("description_uk"),
      price: n("price"),
      old_price: n("old_price"),
      special_price: n("special_price"),
      image_path: s("image_path"),
      gallery: strList(p["gallery"]),
      specs_ru: strList(p["specs_ru"]),
      specs_uk: strList(p["specs_uk"]),
      is_active: Boolean(p["is_active"]),
      in_stock: Boolean(p["in_stock"]),
      sort_order: n("sort_order") || "0",
      meta_title_ru: s("meta_title_ru"),
      meta_title_uk: s("meta_title_uk"),
      meta_desc_ru: s("meta_desc_ru"),
      meta_desc_uk: s("meta_desc_uk"),
    };
  }, [current.data]);

  if (editingId && formValue) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => setEditingId(null)}>
          ← К списку
        </Button>
        <ProductForm
          value={formValue}
          onSaved={() => setEditingId(null)}
          onCancel={() => setEditingId(null)}
        />
      </div>
    );
  }

  const total = products.data?.count ?? 0;
  const size = products.data?.size ?? 40;

  return (
    <div className="space-y-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(0);
          setTerm(q.trim());
        }}
      >
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск по названию, SKU или slug"
        />
        <Button type="submit">
          <Search className="mr-2 size-4" /> Найти
        </Button>
      </form>

      {products.isLoading ? (
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3">Товар</th>
                <th className="p-3">SKU</th>
                <th className="p-3">Цена</th>
                <th className="p-3">Статус</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {(products.data?.rows ?? []).map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      {p.image_path ? (
                        <img src={p.image_path} alt="" className="size-10 rounded border object-cover" />
                      ) : null}
                      <div>
                        <div className="font-medium">{p.name_ru}</div>
                        <div className="text-xs text-muted-foreground">{p.slug}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">{p.sku ?? "—"}</td>
                  <td className="p-3">{p.price ?? "—"}</td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <Badge variant={p.is_active ? "default" : "secondary"}>
                        {p.is_active ? "активен" : "скрыт"}
                      </Badge>
                      <Badge variant={p.in_stock ? "outline" : "destructive"}>
                        {p.in_stock ? "в наличии" : "нет"}
                      </Badge>
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => setEditingId(p.id)}>
                      <Pencil className="mr-2 size-3.5" /> Изменить
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Всего: {total}. Страница {page + 1}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Назад
          </Button>
          <Button
            variant="outline"
            disabled={(page + 1) * size >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            Вперёд
          </Button>
        </div>
      </div>
    </div>
  );
}
