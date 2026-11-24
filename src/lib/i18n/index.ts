import en from "./en";
import kk from "./kk";
import ru from "./ru";

const messages = { ru, kk, en };

export type Locale = keyof typeof messages;
export type MessageKey = keyof typeof ru;
export const LOCALE_COOKIE = "meet_locale";

export const LOCALES = {
  ru: { label: "Русский", intl: "ru-RU" },
  kk: { label: "Қазақша", intl: "kk-KZ" },
  en: { label: "English", intl: "en-GB" },
} satisfies Record<Locale, { label: string; intl: string }>;

export function resolveLocale(value?: string): Locale {
  return value === "en" || value === "kk" ? value : "ru";
}

export function translate(locale: Locale) {
  return (key: MessageKey, values: Record<string, string | number> = {}) =>
    messages[locale][key].replace(/\{(\w+)\}/g, (token, name: string) => String(values[name] ?? token));
}
