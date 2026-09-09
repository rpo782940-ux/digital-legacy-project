import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  User,
} from "lucide-react";
import {
  confirmRegistration,
  registerAccount,
  requestPasswordReset,
  resendRegistrationCode,
  resetPasswordWithCode,
  signInWithIdentifier,
} from "@/lib/auth.functions";
import { applyServerSession } from "@/lib/use-auth";
import { checkPassword, isValidPhone } from "@/lib/phone";
import { href, type Lang } from "@/lib/site";

type Mode = "login" | "register" | "forgot";

const TXT = {
  login: { ru: "Вход", uk: "Вхід" },
  register: { ru: "Регистрация", uk: "Реєстрація" },
  forgot: { ru: "Восстановление пароля", uk: "Відновлення пароля" },
  loginLead: {
    ru: "Войдите по e-mail или номеру телефона, чтобы видеть свои заказы.",
    uk: "Увійдіть за e-mail або номером телефону, щоб бачити свої замовлення.",
  },
  registerLead: {
    ru: "Создайте аккаунт — заказы, статусы и история в одном месте.",
    uk: "Створіть акаунт — замовлення, статуси та історія в одному місці.",
  },
  forgotLead: {
    ru: "Укажите e-mail аккаунта — пришлём код для смены пароля.",
    uk: "Вкажіть e-mail акаунта — надішлемо код для зміни пароля.",
  },
  identifier: { ru: "E-mail или телефон", uk: "E-mail або телефон" },
  firstName: { ru: "Имя", uk: "Ім'я" },
  lastName: { ru: "Фамилия", uk: "Прізвище" },
  email: { ru: "E-mail", uk: "E-mail" },
  phone: { ru: "Телефон", uk: "Телефон" },
  password: { ru: "Пароль", uk: "Пароль" },
  repeat: { ru: "Повторите пароль", uk: "Повторіть пароль" },
  newPassword: { ru: "Новый пароль", uk: "Новий пароль" },
  code: { ru: "Код из письма", uk: "Код із листа" },
  submitLogin: { ru: "Войти", uk: "Увійти" },
  submitRegister: { ru: "Создать аккаунт", uk: "Створити акаунт" },
  submitCode: { ru: "Подтвердить e-mail", uk: "Підтвердити e-mail" },
  resend: { ru: "Отправить код ещё раз", uk: "Надіслати код ще раз" },
  sendCode: { ru: "Получить код", uk: "Отримати код" },
  save: { ru: "Сохранить пароль", uk: "Зберегти пароль" },
  forgotLink: { ru: "Забыли пароль?", uk: "Забули пароль?" },
  backToLogin: { ru: "Вернуться ко входу", uk: "Повернутися до входу" },
  codeSent: {
    ru: "Код отправлен на вашу электронную почту. Если письма нет, проверьте папку «Спам».",
    uk: "Код надіслано на вашу електронну пошту. Якщо листа немає, перевірте теку «Спам».",
  },
  badIdentifier: {
    ru: "Введите e-mail или номер телефона",
    uk: "Введіть e-mail або номер телефону",
  },
  badEmail: { ru: "Введите корректный e-mail", uk: "Введіть коректний e-mail" },
  badPhone: { ru: "Введите корректный номер телефона", uk: "Введіть коректний номер телефону" },
  badName: { ru: "Имя и фамилия: минимум 2 символа", uk: "Ім'я та прізвище: мінімум 2 символи" },
  badPassword: {
    ru: "Пароль: минимум 8 символов, буквы и цифры",
    uk: "Пароль: щонайменше 8 символів, літери та цифри",
  },
  mismatch: { ru: "Пароли не совпадают", uk: "Паролі не збігаються" },
  badCreds: { ru: "Неверный логин или пароль", uk: "Невірний логін або пароль" },
  notConfirmed: {
    ru: "E-mail не подтверждён. Мы отправили новый код.",
    uk: "E-mail не підтверджено. Ми надіслали новий код.",
  },
  emailTaken: { ru: "Этот e-mail уже зарегистрирован", uk: "Цей e-mail вже зареєстрований" },
  phoneTaken: {
    ru: "Этот номер телефона уже зарегистрирован",
    uk: "Цей номер телефону вже зареєстрований",
  },
  mailFailed: {
    ru: "Не удалось отправить письмо. Попробуйте ещё раз.",
    uk: "Не вдалося надіслати лист. Спробуйте ще раз.",
  },
  badCode: { ru: "Неверный или устаревший код", uk: "Невірний або застарілий код" },
  generic: {
    ru: "Что-то пошло не так. Попробуйте ещё раз.",
    uk: "Щось пішло не так. Спробуйте ще раз.",
  },
  resetOk: { ru: "Пароль обновлён. Войдите заново.", uk: "Пароль оновлено. Увійдіть знову." },
  wait: { ru: "Повторно через", uk: "Повторно через" },
  perks1: { ru: "История заказов и статусы", uk: "Історія замовлень і статуси" },
  perks2: { ru: "Номер ТТН прямо в кабинете", uk: "Номер ТТН просто в кабінеті" },
  perks3: { ru: "Быстрое оформление без повторного ввода", uk: "Швидке оформлення без повторів" },
  brand: { ru: "Техно Форма", uk: "Техно Форма" },
  brandLead: {
    ru: "Формы для производства — личный кабинет клиента.",
    uk: "Форми для виробництва — особистий кабінет клієнта.",
  },
} as const;

const field =
  "w-full rounded-xl border border-input bg-background py-3.5 pl-11 pr-3 text-base outline-none transition-all duration-200 placeholder:text-muted-foreground/70 focus:border-accent focus:ring-4 focus:ring-ring/15 sm:text-sm";

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

function Field({
  icon: Icon,
  trailing,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  icon: typeof Mail;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="relative">
      <Icon
        className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <input {...props} className={`${field} ${trailing ? "pr-12" : ""}`} />
      {trailing}
    </div>
  );
}

export function AuthView({ lang }: { lang: Lang }) {
  const T = (k: keyof typeof TXT) => TXT[k][lang];
  const navigate = useNavigate();

  const doLogin = useServerFn(signInWithIdentifier);
  const doRegister = useServerFn(registerAccount);
  const doConfirm = useServerFn(confirmRegistration);
  const doResend = useServerFn(resendRegistrationCode);
  const doForgot = useServerFn(requestPasswordReset);
  const doReset = useServerFn(resetPasswordWithCode);

  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [step, setStep] = useState<"form" | "code">("form");
  const [cooldown, setCooldown] = useState(0);
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const [f, setF] = useState({
    identifier: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    repeat: "",
    code: "",
  });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const switchMode = (next: Mode) => {
    setMode(next);
    setStep("form");
    setError(null);
    setNotice(null);
  };

  const goAccount = () => navigate({ to: href("/account", lang) });

  const afterSend = () => {
    setStep("code");
    setError(null);
    setNotice(T("codeSent"));
    setCooldown(60);
  };

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const id = f.identifier.trim();
    if (!id || (!emailOk(id) && !isValidPhone(id))) return setError(T("badIdentifier"));
    setBusy(true);
    try {
      const res = await doLogin({ data: { identifier: id, password: f.password } });
      if (!res.ok) {
        if (res.error === "email_not_confirmed" && res.email) {
          set("email", res.email);
          await doResend({ data: { email: res.email } });
          setMode("register");
          afterSend();
          setError(T("notConfirmed"));
        } else setError(T("badCreds"));
        return;
      }
      await applyServerSession(res.accessToken, res.refreshToken);
      goAccount();
    } catch {
      setError(T("generic"));
    } finally {
      setBusy(false);
    }
  };

  const submitRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (f.firstName.trim().length < 2 || f.lastName.trim().length < 2)
      return setError(T("badName"));
    if (!emailOk(f.email)) return setError(T("badEmail"));
    if (!isValidPhone(f.phone)) return setError(T("badPhone"));
    if (!checkPassword(f.password).ok) return setError(T("badPassword"));
    if (f.password !== f.repeat) return setError(T("mismatch"));
    setBusy(true);
    try {
      const res = await doRegister({
        data: {
          firstName: f.firstName,
          lastName: f.lastName,
          email: f.email,
          phone: f.phone,
          password: f.password,
        },
      });
      if (!res.ok) {
        setError(
          T(
            res.error === "email_taken"
              ? "emailTaken"
              : res.error === "phone_taken"
                ? "phoneTaken"
                : res.error === "mail_failed"
                  ? "mailFailed"
                  : "generic",
          ),
        );
      } else afterSend();
    } catch {
      setError(T("generic"));
    } finally {
      setBusy(false);
    }
  };

  const submitConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await doConfirm({ data: { email: f.email, code: f.code } });
      if (!res.ok) setError(T("badCode"));
      else {
        const signIn = await doLogin({ data: { identifier: f.email, password: f.password } });
        if (signIn.ok) {
          await applyServerSession(signIn.accessToken, signIn.refreshToken);
          goAccount();
        } else {
          switchMode("login");
          set("identifier", f.email);
        }
      }
    } catch {
      setError(T("generic"));
    } finally {
      setBusy(false);
    }
  };

  const submitForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!emailOk(f.email)) return setError(T("badEmail"));
    setBusy(true);
    try {
      await doForgot({ data: { email: f.email } });
      afterSend();
    } catch {
      setError(T("generic"));
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!checkPassword(f.password).ok) return setError(T("badPassword"));
    if (f.password !== f.repeat) return setError(T("mismatch"));
    setBusy(true);
    try {
      const res = await doReset({
        data: { email: f.email, code: f.code, password: f.password },
      });
      if (!res.ok) setError(T("badCode"));
      else {
        const signIn = await doLogin({ data: { identifier: f.email, password: f.password } });
        if (signIn.ok) {
          await applyServerSession(signIn.accessToken, signIn.refreshToken);
          goAccount();
        } else {
          switchMode("login");
          setNotice(T("resetOk"));
        }
      }
    } catch {
      setError(T("generic"));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (cooldown > 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "register") await doResend({ data: { email: f.email } });
      else await doForgot({ data: { email: f.email } });
      afterSend();
    } catch {
      setError(T("generic"));
    } finally {
      setBusy(false);
    }
  };

  const onSubmit =
    mode === "login"
      ? submitLogin
      : mode === "register"
        ? step === "form"
          ? submitRegister
          : submitConfirm
        : step === "form"
          ? submitForgot
          : submitReset;

  const submitLabel =
    mode === "login"
      ? T("submitLogin")
      : mode === "register"
        ? step === "form"
          ? T("submitRegister")
          : T("submitCode")
        : step === "form"
          ? T("sendCode")
          : T("save");

  const eye = (
    <button
      type="button"
      onClick={() => setShowPw((v) => !v)}
      aria-label={showPw ? "hide" : "show"}
      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
    </button>
  );

  const tab = (m: Mode, label: string) => (
    <button
      key={m}
      type="button"
      onClick={() => switchMode(m)}
      className={`relative flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all duration-200 ${
        mode === m
          ? "bg-card text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="container-page py-8 sm:py-14">
      <div className="mx-auto grid w-full max-w-4xl gap-8 lg:grid-cols-[1fr_420px] lg:items-center">
        <aside className="hidden lg:block">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            {T("brand")}
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold leading-tight">{T("brandLead")}</h2>
          <ul className="mt-7 space-y-3 text-sm text-muted-foreground">
            {[T("perks1"), T("perks2"), T("perks3")].map((p, i) => (
              <li
                key={p}
                className="flex animate-in items-center gap-3 fade-in slide-in-from-left-2"
                style={{ animationDelay: `${i * 90}ms`, animationFillMode: "backwards" }}
              >
                <CheckCircle2 className="size-4 shrink-0 text-accent" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
        </aside>

        <div className="animate-in rounded-2xl border border-border bg-card p-5 shadow-plate duration-300 fade-in zoom-in-95 sm:p-7">
          <div className="mb-6 flex gap-1 rounded-xl bg-muted/70 p-1">
            {tab("login", T("login"))}
            {tab("register", T("register"))}
          </div>

          <h1 className="font-display text-2xl font-bold">
            {mode === "forgot" ? T("forgot") : mode === "login" ? T("login") : T("register")}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {mode === "forgot"
              ? T("forgotLead")
              : mode === "login"
                ? T("loginLead")
                : T("registerLead")}
          </p>

          <form
            key={`${mode}-${step}`}
            onSubmit={onSubmit}
            className="mt-6 animate-in space-y-3 duration-300 fade-in slide-in-from-bottom-2"
          >
            {mode === "login" && (
              <Field
                required
                icon={Mail}
                autoComplete="username"
                placeholder={T("identifier")}
                value={f.identifier}
                maxLength={255}
                onChange={(e) => set("identifier", e.target.value)}
              />
            )}

            {mode === "register" && step === "form" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  required
                  icon={User}
                  autoComplete="given-name"
                  placeholder={T("firstName")}
                  value={f.firstName}
                  maxLength={60}
                  onChange={(e) => set("firstName", e.target.value)}
                />
                <Field
                  required
                  icon={User}
                  autoComplete="family-name"
                  placeholder={T("lastName")}
                  value={f.lastName}
                  maxLength={60}
                  onChange={(e) => set("lastName", e.target.value)}
                />
              </div>
            )}

            {mode !== "login" && step === "form" && (
              <Field
                required
                icon={Mail}
                type="email"
                autoComplete="email"
                placeholder={T("email")}
                value={f.email}
                maxLength={255}
                onChange={(e) => set("email", e.target.value)}
              />
            )}

            {mode === "register" && step === "form" && (
              <Field
                required
                icon={Phone}
                type="tel"
                autoComplete="tel"
                placeholder="+380 50 235 33 00"
                value={f.phone}
                maxLength={30}
                onChange={(e) => set("phone", e.target.value)}
              />
            )}

            {step === "code" && (
              <div className="rounded-xl border border-dashed border-accent/40 bg-accent/5 p-3">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <ShieldCheck className="size-4 text-accent" aria-hidden />
                  {f.email}
                </div>
                <input
                  required
                  inputMode="numeric"
                  className="mt-3 w-full rounded-lg border border-input bg-background px-3 py-3 text-center text-xl font-bold tracking-[0.5em] outline-none transition-all focus:border-accent focus:ring-4 focus:ring-ring/15"
                  placeholder={T("code")}
                  value={f.code}
                  maxLength={6}
                  onChange={(e) => set("code", e.target.value.replace(/\D/g, ""))}
                />
              </div>
            )}

            {((mode !== "forgot" && step === "form") ||
              (mode === "forgot" && step === "code") ||
              (mode === "register" && step === "code")) && (
              <Field
                required
                icon={Lock}
                type={showPw ? "text" : "password"}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                placeholder={mode === "forgot" ? T("newPassword") : T("password")}
                value={f.password}
                maxLength={72}
                trailing={eye}
                onChange={(e) => set("password", e.target.value)}
              />
            )}

            {((mode === "register" && step === "form") ||
              (mode === "forgot" && step === "code")) && (
              <Field
                required
                icon={Lock}
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                placeholder={T("repeat")}
                value={f.repeat}
                maxLength={72}
                onChange={(e) => set("repeat", e.target.value)}
              />
            )}

            {notice && (
              <p className="animate-in rounded-xl bg-accent/10 px-3 py-2.5 text-sm text-foreground fade-in">
                {notice}
              </p>
            )}
            {error && (
              <p className="animate-in rounded-xl bg-destructive/10 px-3 py-2.5 text-sm font-medium text-destructive fade-in slide-in-from-top-1">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary/90 hover:shadow-md active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {submitLabel}
            </button>

            {step === "code" && (
              <button
                type="button"
                onClick={resend}
                disabled={busy || cooldown > 0}
                className="w-full rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-60"
              >
                {cooldown > 0 ? `${T("wait")} ${cooldown} c` : T("resend")}
              </button>
            )}

            {mode === "login" && (
              <button
                type="button"
                onClick={() => switchMode("forgot")}
                className="w-full py-1 text-center text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                {T("forgotLink")}
              </button>
            )}
            {mode === "forgot" && (
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="inline-flex w-full items-center justify-center gap-1.5 py-1 text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                <ArrowLeft className="size-3.5" aria-hidden />
                {T("backToLogin")}
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
