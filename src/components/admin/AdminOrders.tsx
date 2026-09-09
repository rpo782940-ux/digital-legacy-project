import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminListOrders, adminRefreshOrders, adminUpdateOrder } from "@/lib/admin.functions";
import { ORDER_STATUSES, orderStatusLabel } from "@/lib/order-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, RefreshCw, Search } from "lucide-react";

const DELIVERY_LABEL: Record<string, string> = {
  novaposhta: "Нова Пошта",
  pickup: "Самовывоз",
  carrier: "Перевозчик",
};

export function AdminOrders() {
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const list = useServerFn(adminListOrders);
  const update = useServerFn(adminUpdateOrder);
  const refresh = useServerFn(adminRefreshOrders);
  const qc = useQueryClient();

  const orders = useQuery({
    queryKey: ["admin", "orders", term],
    queryFn: () => list({ data: { q: term || undefined } }),
  });

  const save = useMutation({
    mutationFn: (vars: { id: string; status?: string; tracking_number?: string | null }) =>
      update({ data: vars }),
    onSuccess: () => {
      toast.success("Заказ обновлён");
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pull = useMutation({
    mutationFn: () => refresh({}),
    onSuccess: (r) => {
      toast.success(`Обновлено заказов: ${r.updated}`);
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <form
          className="flex flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setTerm(q.trim());
          }}
        >
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск: имя, телефон, ТТН"
          />
          <Button type="submit">
            <Search className="mr-2 size-4" /> Найти
          </Button>
        </form>
        <Button variant="outline" disabled={pull.isPending} onClick={() => pull.mutate()}>
          {pull.isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 size-4" />
          )}
          Статусы из SalesDrive
        </Button>
      </div>

      {orders.isLoading ? <p className="text-sm text-muted-foreground">Загрузка…</p> : null}
      {orders.error ? (
        <p className="text-sm text-destructive">{(orders.error as Error).message}</p>
      ) : null}

      <div className="space-y-3">
        {(orders.data ?? []).map((o) => {
          const open = openId === o.id;
          return (
            <Card key={o.id}>
              <CardContent className="p-4">
                <button
                  className="flex w-full flex-wrap items-center justify-between gap-3 text-left"
                  onClick={() => setOpenId(open ? null : o.id)}
                >
                  <div>
                    <div className="font-semibold">
                      №{o.order_no} · {o.customer_name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(o.created_at).toLocaleString("ru-UA")} · {o.phone}
                      {o.email ? ` · ${o.email}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{orderStatusLabel(o.status, "ru")}</Badge>
                    <span className="font-semibold">{Number(o.total).toLocaleString("uk-UA")} ₴</span>
                  </div>
                </button>

                {open ? (
                  <div className="mt-4 grid gap-4 border-t pt-4 md:grid-cols-2">
                    <div className="space-y-1 text-sm">
                      <Row label="Доставка" value={DELIVERY_LABEL[o.delivery ?? ""] ?? o.delivery ?? "—"} />
                      <Row label="Город" value={o.np_city ?? "—"} />
                      <Row
                        label="Отделение"
                        value={[o.np_warehouse, o.np_warehouse_address].filter(Boolean).join(", ") || "—"}
                      />
                      <Row label="ТТН" value={o.tracking_number ?? "—"} />
                      <Row label="SalesDrive ID" value={o.salesdrive_order_id ? String(o.salesdrive_order_id) : "—"} />
                      <Row label="Синхронизация" value={o.salesdrive_sync_status} />
                      {o.comment ? <Row label="Комментарий" value={o.comment} /> : null}
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm font-medium">Товары</div>
                      <ul className="space-y-1 text-sm">
                        {o.items.map((i, idx) => (
                          <li key={idx} className="flex justify-between gap-3">
                            <span>
                              {i.product_name}
                              {i.variant_label ? ` (${i.variant_label})` : ""}
                              {i.product_sku ? ` · ${i.product_sku}` : ""} × {i.quantity}
                            </span>
                            <span>{Number(i.unit_price).toLocaleString("uk-UA")} ₴</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <OrderEditor
                      status={o.status}
                      tracking={o.tracking_number ?? ""}
                      pending={save.isPending}
                      onSave={(status, tracking_number) =>
                        save.mutate({ id: o.id, status, tracking_number: tracking_number || null })
                      }
                    />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="w-36 shrink-0 text-muted-foreground">{label}</span>
      <span className="font-medium break-words">{value}</span>
    </div>
  );
}

function OrderEditor({
  status,
  tracking,
  pending,
  onSave,
}: {
  status: string;
  tracking: string;
  pending: boolean;
  onSave: (status: string, tracking: string) => void;
}) {
  const [s, setS] = useState(status);
  const [t, setT] = useState(tracking);
  return (
    <div className="md:col-span-2 flex flex-wrap items-end gap-3">
      <div className="grid gap-1">
        <span className="text-xs text-muted-foreground">Статус</span>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={s}
          onChange={(e) => setS(e.target.value)}
        >
          {ORDER_STATUSES.map((k) => (
            <option key={k} value={k}>
              {orderStatusLabel(k, "ru")}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1">
        <span className="text-xs text-muted-foreground">ТТН</span>
        <Input value={t} onChange={(e) => setT(e.target.value)} className="w-56" />
      </div>
      <Button disabled={pending} onClick={() => onSave(s, t.trim())}>
        Сохранить
      </Button>
    </div>
  );
}
