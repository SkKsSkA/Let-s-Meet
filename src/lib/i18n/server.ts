import "server-only";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, resolveLocale, translate } from ".";

export function getLocale() {
  return resolveLocale(cookies().get(LOCALE_COOKIE)?.value);
}

export function serverMessages() {
  return translate(getLocale());
}
