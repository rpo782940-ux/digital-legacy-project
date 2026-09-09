import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminListSnapshots, adminRollbackSnapshot } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, Loader2, Undo2 } from "lucide-react";

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Product-only restore points, created automatically before every import. */
export function AdminHistory() {
  const list = useServerFn(adminListSnapshots);
  const rollback = useServerFn(adminRollbackSnapshot);
  const qc = useQueryClient();

  const snapshots = useQuery({
    queryKey: ["admin", "snapshots"],
    queryFn: () => list(),
  });

  const restore = useMutation({
    mutationFn: (id: string) => rollback({ data: { id } }),
    onSuccess: (r) => {
      toast.success(`Каталог восстановлен: ${r.restored} товаров, удалено новых: ${r.removed}`);
      qc.invalidateQueries({ queryKey: ["admin"] });
      qc.invalidateQueries({ queryKey: ["catalog"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = snapshots.data ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-2 p-6">
          <h3 className="flex items-center gap-2 font-semibold">
            <History className="size-4" /> История изменений товаров
          </h3>
          <p className="text-sm text-muted-foreground">
            Перед каждым применением импорта сохраняется полное состояние каталога. Хранятся
            последние 5 версий. Откат затрагивает только товары — заказы, пользователи и SalesDrive
            не изменяются.
          </p>
        </CardContent>
      </Card>

      {snapshots.isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Пока нет сохранённых версий каталога.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((s, i) => (
            <Card key={s.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{s.source}</span>
                    {i === 0 ? <Badge variant="secondary">последняя</Badge> : null}
                    {s.status !== "done" ? <Badge variant="outline">не завершён</Badge> : null}
                  </div>
                  <div className="text-sm text-muted-foreground">{fmt(s.created_at)}</div>
                  <div className="text-sm text-muted-foreground">
                    В снимке товаров: {s.products_count} · обновлено: {s.products_updated} ·
                    добавлено: {s.products_created}
                    {s.note ? ` · ${s.note}` : ""}
                  </div>
                </div>
                <Button
                  variant="outline"
                  disabled={restore.isPending}
                  onClick={() => {
                    if (
                      !window.confirm(
                        `Вы уверены, что хотите вернуть каталог товаров к состоянию от ${fmt(
                          s.created_at,
                        )}? Изменения товаров после этой версии будут отменены.`,
                      )
                    )
                      return;
                    restore.mutate(s.id);
                  }}
                >
                  {restore.isPending && restore.variables === s.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Undo2 className="size-4" />
                  )}
                  Откатить к этой версии
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
