import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminListCategories, adminSaveCategory } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pencil, Plus } from "lucide-react";

type CatForm = {
  id: string | null;
  slug: string;
  name_ru: string;
  name_uk: string;
  sort_order: string;
  is_active: boolean;
  image_path: string;
};

const empty: CatForm = {
  id: null,
  slug: "",
  name_ru: "",
  name_uk: "",
  sort_order: "0",
  is_active: true,
  image_path: "",
};

export function AdminCategories() {
  const list = useServerFn(adminListCategories);
  const save = useServerFn(adminSaveCategory);
  const qc = useQueryClient();
  const [form, setForm] = useState<CatForm | null>(null);

  const cats = useQuery({ queryKey: ["admin", "categories"], queryFn: () => list() });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form) return;
      if (!form.slug.trim() || !form.name_ru.trim()) throw new Error("Укажите slug и название");
      return save({
        data: {
          id: form.id,
          slug: form.slug.trim(),
          name_ru: form.name_ru.trim(),
          name_uk: (form.name_uk || form.name_ru).trim(),
          sort_order: Number(form.sort_order) || 0,
          is_active: form.is_active,
          image_path: form.image_path.trim() || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Категория сохранена");
      setForm(null);
      qc.invalidateQueries({ queryKey: ["admin", "categories"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (form) {
    const set = (patch: Partial<CatForm>) => setForm({ ...form, ...patch });
    return (
      <Card>
        <CardContent className="grid gap-4 p-6 md:grid-cols-2">
          <div className="grid gap-2">
            <Label>Slug</Label>
            <Input value={form.slug} onChange={(e) => set({ slug: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label>Порядок</Label>
            <Input
              value={form.sort_order}
              onChange={(e) => set({ sort_order: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Название (RU)</Label>
            <Input value={form.name_ru} onChange={(e) => set({ name_ru: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label>Название (UK)</Label>
            <Input value={form.name_uk} onChange={(e) => set({ name_uk: e.target.value })} />
          </div>
          <div className="grid gap-2 md:col-span-2">
            <Label>Изображение (путь)</Label>
            <Input value={form.image_path} onChange={(e) => set({ image_path: e.target.value })} />
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={form.is_active} onCheckedChange={(v) => set({ is_active: v })} />
            <span className="text-sm">Активна</span>
          </div>
          <div className="flex justify-end gap-2 md:col-span-2">
            <Button variant="outline" onClick={() => setForm(null)}>
              Отмена
            </Button>
            <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
              Сохранить
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Button onClick={() => setForm(empty)}>
        <Plus className="mr-2 size-4" /> Новая категория
      </Button>

      {cats.isLoading ? <p className="text-sm text-muted-foreground">Загрузка…</p> : null}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-3">Категория</th>
              <th className="p-3">Slug</th>
              <th className="p-3">Порядок</th>
              <th className="p-3">Статус</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {(cats.data ?? []).map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-3 font-medium">{c.name_ru}</td>
                <td className="p-3 text-muted-foreground">{c.slug}</td>
                <td className="p-3">{c.sort_order}</td>
                <td className="p-3">
                  <Badge variant={c.is_active ? "default" : "secondary"}>
                    {c.is_active ? "активна" : "скрыта"}
                  </Badge>
                </td>
                <td className="p-3 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setForm({
                        id: c.id,
                        slug: c.slug,
                        name_ru: c.name_ru,
                        name_uk: c.name_uk,
                        sort_order: String(c.sort_order),
                        is_active: c.is_active,
                        image_path: c.image_path ?? "",
                      })
                    }
                  >
                    <Pencil className="mr-2 size-3.5" /> Изменить
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
