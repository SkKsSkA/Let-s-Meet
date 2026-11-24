"use client";

import { createContext, useContext, useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LOCALES, LOCALE_COOKIE, resolveLocale, translate, type Locale } from "@/lib/i18n";

const LocaleContext = createContext<Locale>("ru");

export function useLocale() {
  const locale = useContext(LocaleContext);
  return { locale, t: translate(locale) };
}

function LanguagePicker() {
  const router = useRouter();
  const { locale, t } = useLocale();
  const [ready, setReady] = useState(false);
  const [pending, startTransition] = useTransition();
  useEffect(() => setReady(true), []);

  return (
    <div className="relative z-10 mx-auto flex max-w-[90rem] justify-end px-4 pt-3 sm:px-8">
      <select
        aria-label={t("language")}
        className="min-h-[44px] rounded-full border border-white/40 bg-ink px-4 py-2 text-base font-bold text-white disabled:opacity-70"
        value={locale}
        disabled={!ready || pending}
        onChange={(event) => {
          const language = resolveLocale(event.target.value);
          document.cookie = `${LOCALE_COOKIE}=${language}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
          startTransition(() => router.refresh());
        }}
      >
        {(Object.keys(LOCALES) as Locale[]).map((language) => (
          <option key={language} value={language} lang={language}>{LOCALES[language].label}</option>
        ))}
      </select>
    </div>
  );
}

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <LocaleContext.Provider value={locale}>
      <LanguagePicker />
      {children}
    </LocaleContext.Provider>
  );
}
