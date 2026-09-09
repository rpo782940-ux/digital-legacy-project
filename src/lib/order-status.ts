import type { Lang } from "./site";

/**
 * Order lifecycle. The list mirrors the SalesDrive pipeline one-to-one so the
 * CRM stays the single source of truth for the customer-visible status.
 */
export const ORDER_STATUSES = [
  "new",
  "production",
  "confirmed",
  "packing",
  "to_ship",
  "shipped",
  "done",
  "returned",
  "cancelled",
  "deleted",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** SalesDrive status id -> site status. */
export const SALESDRIVE_STATUS_MAP: Record<number, OrderStatus> = {
  1: "new",
  10: "production",
  2: "confirmed",
  9: "packing",
  3: "to_ship",
  4: "shipped",
  5: "done",
  6: "cancelled",
  7: "returned",
  8: "deleted",
  11: "cancelled",
};

export function statusFromSalesDrive(statusId: number | null | undefined): OrderStatus | null {
  if (statusId == null) return null;
  return SALESDRIVE_STATUS_MAP[statusId] ?? null;
}

const LABELS: Record<string, { ru: string; uk: string }> = {
  new: { ru: "Новый", uk: "Нове" },
  production: { ru: "Производство", uk: "Виробництво" },
  confirmed: { ru: "Подтверждён", uk: "Підтверджено" },
  packing: { ru: "Упаковка", uk: "Пакування" },
  to_ship: { ru: "На отправку", uk: "На відправлення" },
  shipped: { ru: "Отправлен", uk: "Відправлено" },
  done: { ru: "Выполнен", uk: "Виконано" },
  returned: { ru: "Возврат", uk: "Повернення" },
  cancelled: { ru: "Отменён", uk: "Скасовано" },
  deleted: { ru: "Удалён", uk: "Видалено" },
  // legacy value kept so old rows never render a raw technical id
  processing: { ru: "В обработке", uk: "В обробці" },
};

export function orderStatusLabel(status: string, lang: Lang): string {
  return (LABELS[status] ?? LABELS["new"]!)[lang];
}

export function orderStatusTone(status: string): string {
  switch (status) {
    case "done":
      return "bg-emerald-100 text-emerald-800";
    case "cancelled":
    case "deleted":
    case "returned":
      return "bg-destructive/10 text-destructive";
    case "shipped":
    case "to_ship":
      return "bg-sky-100 text-sky-800";
    case "confirmed":
    case "packing":
    case "production":
    case "processing":
      return "bg-amber-100 text-amber-900";
    default:
      return "bg-muted text-foreground";
  }
}

/** Linear progress track shown to the customer (terminal states excluded). */
export const ORDER_PROGRESS: OrderStatus[] = [
  "new",
  "confirmed",
  "production",
  "packing",
  "to_ship",
  "shipped",
  "done",
];

export function orderProgressIndex(status: string): number {
  const i = ORDER_PROGRESS.indexOf(status as OrderStatus);
  if (i >= 0) return i;
  if (status === "processing") return 1;
  return -1;
}

export function isTerminalFailure(status: string): boolean {
  return status === "cancelled" || status === "returned" || status === "deleted";
}
