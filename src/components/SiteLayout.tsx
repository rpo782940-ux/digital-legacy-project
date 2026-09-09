import { type ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { LanguageGate } from "./LanguageGate";
import type { Lang } from "@/lib/site";

export function SiteLayout({ lang, children }: { lang: Lang; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header lang={lang} />
      <main className="flex-1">{children}</main>
      <Footer lang={lang} />
      <LanguageGate lang={lang} />
    </div>
  );
}
