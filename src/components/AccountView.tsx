import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, LogOut, Package, ShieldCheck, User } from "lucide-react";
import { changeMyPassword, getMyAccount, updateMyProfile } from "@/lib/account.functions";
import { amIAdmin } from "@/lib/admin.functions";

import {
  ORDER_PROGRESS,
  isTerminalFailure,
  orderProgressIndex,
  orderStatusLabel,
  orderStatusTone,
} from "@/lib/order-status";
import { formatPhone } from "@/lib/phone";
import { signOut } from "@/lib/use-auth";
import { fmtPrice } from "@/lib/i18n";
import { href, type Lang } from "@/lib/site";

const TXT = {
  title: { ru: "Мой кабинет", uk: "Мій кабінет" },
  profile: { ru: "Профиль", uk: "Профіль" },
  orders: { ru: "История заказов", uk: "Історія замовлень" },
  firstName: { ru: "Имя", uk: "Ім'я" },
  lastName: { ru: "Фамилия", uk: "Прізвище" },
  phone: { ru: "Телефон", uk: "Телефон" },
  save: { ru: "Сохранить", uk: "Зберегти" },
  saved: { ru: "Сохранено", uk: "Збережено" },
  password: { ru: "Смена пароля", uk: "Зміна пароля" },
  current: { ru: "Текущий пароль", uk: "Поточний пароль" },
  next: { ru: "Новый пароль", uk: "Новий пароль" },
  wrong: { ru: "Неверный текущий пароль", uk: "Невірний поточний пароль" },
  weak: { ru: "Пароль: минимум 8 символов, буквы и цифры", uk: "Пароль: щонайменше 8 символів, літери та цифри" },
  logout: { ru: "Выйти", uk: "Вийти" },
  empty: { ru: "Заказов пока нет.", uk: "Замовлень поки немає." },
  order: { ru: "Заказ", uk: "Замовлення" },
  total: { ru: "Сумма", uk: "Сума" },
  delivery: { ru: "Доставка", uk: "Доставка" },
  uah: { ru: "грн", uk: "грн" },
  ttn: { ru: "ТТН", uk: "ТТН" },
  admin: { ru: "Админ-панель", uk: "Адмін-панель" },
} as const;


const input =
  "w-full rounded-lg border border-input bg-background px-3 py-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-ring/25 sm:text-sm";

export function AccountView({ lang }: { lang: Lang }) {
  const T = (k: keyof typeof TXT) => TXT[k][lang];
  const navigate = useNavigate();
  const qc = useQueryClient();

  const load = useServerFn(getMyAccount);
  const saveProfile = useServerFn(updateMyProfile);
  const savePassword = useServerFn(changeMyPassword);

  const { data, isLoading } = useQuery({
    queryKey: ["account"],
    queryFn: () => load({}),
  });

  const checkAdmin = useServerFn(amIAdmin);
  const adminAccess = useQuery({
    queryKey: ["admin", "access"],
    queryFn: () => checkAdmin(),
    retry: false,
  });


  const [profile, setProfile] = useState({ firstName: "", lastName: "" });
  const [profileState, setProfileState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [pw, setPw] = useState({ current: "", next: "" });
  const [pwState, setPwState] = useState<"idle" | "busy" | "done" | "wrong" | "error">("idle");

  useEffect(() => {
    if (data?.profile)
      setProfile({
        firstName: data.profile.first_name,
        lastName: data.profile.last_name,
      });
  }, [data?.profile]);

  const onSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileState("busy");
    try {
      const res = await saveProfile({ data: profile });
      setProfileState(res.ok ? "done" : "error");
      if (res.ok) await qc.invalidateQueries({ queryKey: ["account"] });
    } catch {
      setProfileState("error");
    }
  };

  const onSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwState("busy");
    try {
      const res = await savePassword({
        data: { currentPassword: pw.current, newPassword: pw.next },
      });
      if (res.ok) {
        setPwState("done");
        setPw({ current: "", next: "" });
      } else setPwState(res.error === "wrong_password" ? "wrong" : "error");
    } catch {
      setPwState("error");
    }
  };

  const logout = async () => {
    await qc.cancelQueries();
    qc.clear();
    await signOut();
    navigate({ to: href("/auth", lang), replace: true });
  };

  if (isLoading)
    return (
      <div className="container-page flex justify-center py-24">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );

  return (
    <div className="container-page py-8 sm:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">{T("title")}</h1>
        <div className="flex flex-wrap items-center gap-3">
          {adminAccess.data?.admin ? (
            <Link
              to="/admin"
              className="inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              <ShieldCheck className="size-4" aria-hidden />
              {T("admin")}
            </Link>
          ) : null}
          <button
            onClick={logout}
            className="inline-flex items-center gap-2 rounded-sm border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted"
          >
            <LogOut className="size-4" aria-hidden />
            {T("logout")}
          </button>
        </div>
      </div>


      <div className="mt-8 grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="space-y-6">
          <form
            onSubmit={onSaveProfile}
            className="space-y-3 rounded-md border border-border bg-card p-5 shadow-plate"
          >
            <h2 className="flex items-center gap-2 font-display text-base font-bold">
              <User className="size-4" aria-hidden />
              {T("profile")}
            </h2>
            <input
              required
              className={input}
              placeholder={T("firstName")}
              value={profile.firstName}
              maxLength={60}
              onChange={(e) => setProfile((p) => ({ ...p, firstName: e.target.value }))}
            />
            <input
              required
              className={input}
              placeholder={T("lastName")}
              value={profile.lastName}
              maxLength={60}
              onChange={(e) => setProfile((p) => ({ ...p, lastName: e.target.value }))}
            />
            <div className="rounded-lg border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground">
              {T("phone")}: {data?.profile?.phone ? formatPhone(data.profile.phone) : "—"}
            </div>
            {profileState === "done" && <p className="text-sm text-emerald-700">{T("saved")}</p>}
            <button
              type="submit"
              disabled={profileState === "busy"}
              className="w-full rounded-sm bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {T("save")}
            </button>
          </form>

          <form
            onSubmit={onSavePassword}
            className="space-y-3 rounded-md border border-border bg-card p-5 shadow-plate"
          >
            <h2 className="font-display text-base font-bold">{T("password")}</h2>
            <input
              required
              type="password"
              autoComplete="current-password"
              className={input}
              placeholder={T("current")}
              value={pw.current}
              onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
            />
            <input
              required
              type="password"
              autoComplete="new-password"
              className={input}
              placeholder={T("next")}
              value={pw.next}
              onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
            />
            {pwState === "wrong" && <p className="text-sm text-destructive">{T("wrong")}</p>}
            {pwState === "error" && <p className="text-sm text-destructive">{T("weak")}</p>}
            {pwState === "done" && <p className="text-sm text-emerald-700">{T("saved")}</p>}
            <button
              type="submit"
              disabled={pwState === "busy"}
              className="w-full rounded-sm border border-border px-5 py-3 text-sm font-semibold hover:bg-muted disabled:opacity-60"
            >
              {T("save")}
            </button>
          </form>
        </div>

        <section className="rounded-md border border-border bg-card p-5 shadow-plate">
          <h2 className="flex items-center gap-2 font-display text-base font-bold">
            <Package className="size-4" aria-hidden />
            {T("orders")}
          </h2>

          {(data?.orders.length ?? 0) === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">{T("empty")}</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {data?.orders.map((o) => (
                <li key={o.id} className="rounded-md border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-display text-sm font-bold">
                      {T("order")} №{o.order_no}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${orderStatusTone(o.status)}`}
                    >
                      {orderStatusLabel(o.status, lang)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(o.created_at).toLocaleString(lang === "uk" ? "uk-UA" : "ru-RU")}
                  </p>
                  <ul className="mt-3 space-y-1 text-sm">
                    {o.items.map((i, idx) => (
                      <li key={idx} className="flex flex-wrap justify-between gap-2">
                        <span className="min-w-0 break-words">
                          {i.product_name}
                          {i.variant_label ? ` — ${i.variant_label}` : ""} × {i.quantity}
                        </span>
                        <span className="font-semibold">
                          {fmtPrice(Number(i.unit_price) * i.quantity, lang)} {T("uah")}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <OrderProgress status={o.status} lang={lang} />
                  {o.tracking_number && (
                    <p className="mt-3 text-xs">
                      <span className="text-muted-foreground">{T("ttn")}: </span>
                      <a
                        href={`https://novaposhta.ua/tracking/?cargo_number=${o.tracking_number}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold underline underline-offset-2"
                      >
                        {o.tracking_number}
                      </a>
                    </p>
                  )}
                  {(o.np_city || o.np_warehouse) && (
                    <p className="mt-3 break-words text-xs text-muted-foreground">
                      {T("delivery")}: {[o.np_city, o.np_warehouse, o.np_warehouse_address]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  )}
                  <p className="mt-2 text-right font-display text-base font-bold">
                    {T("total")}: {fmtPrice(Number(o.total), lang)} {T("uah")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

/** Linear order pipeline; terminal failures collapse to a single notice. */
function OrderProgress({ status, lang }: { status: string; lang: Lang }) {
  if (isTerminalFailure(status))
    return (
      <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
        {orderStatusLabel(status, lang)}
      </p>
    );

  const current = orderProgressIndex(status);
  if (current < 0) return null;

  return (
    <ol className="mt-4 flex gap-1" aria-label={orderStatusLabel(status, lang)}>
      {ORDER_PROGRESS.map((step, i) => (
        <li key={step} className="min-w-0 flex-1">
          <div
            className={`h-1.5 rounded-full ${i <= current ? "bg-accent" : "bg-muted"}`}
            aria-hidden
          />
          <span
            className={`mt-1 block truncate text-[10px] leading-tight ${
              i === current ? "font-semibold text-foreground" : "text-muted-foreground"
            }`}
          >
            {orderStatusLabel(step, lang)}
          </span>
        </li>
      ))}
    </ol>
  );
}
