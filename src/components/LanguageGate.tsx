import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Globe } from "lucide-react";
import { t } from "@/lib/i18n";
import type { Lang } from "@/lib/site";

const KEY = "tf-lang";

/**
 * Asks a first-time visitor which language version to use.
 * The choice is remembered locally and never shown again.
 */
export function LanguageGate({ lang }: { lang: Lang }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setVisible(true);
    } catch {
      /* storage unavailable — stay silent */
    }
  }, []);

  if (!visible) return null;

  const remember = (choice: Lang) => {
    try {
      localStorage.setItem(KEY, choice);
    } catch {
      /* ignore */
    }
    setVisible(false);
    const target =
      choice === "uk"
        ? `/uk${pathname === "/" ? "/" : pathname}`
        : pathname.replace(/^\/uk/, "") || "/";
    if (choice !== lang) window.location.assign(target);
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-steel/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 text-center shadow-lift">
        <Globe className="mx-auto size-8 text-accent" aria-hidden />
        <h2 className="mt-3 font-display text-lg font-bold">{t("langAsk", lang)}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("langAskSub", lang)}</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            onClick={() => remember("uk")}
            className="rounded-lg bg-accent px-4 py-3 text-sm font-bold text-accent-foreground transition-transform hover:-translate-y-0.5"
          >
            Українська
          </button>
          <button
            onClick={() => remember("ru")}
            className="rounded-lg border border-border px-4 py-3 text-sm font-semibold transition-colors hover:bg-muted"
          >
            Русский
          </button>
        </div>
      </div>
    </div>
  );
}
