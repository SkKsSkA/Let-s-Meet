import { KINDS } from "./format";
import { translate, type Locale } from "./i18n";
import type { EventPublic } from "./types";

/** Демо-встреча: открывается по /e/demo без базы данных. Ответы живут только в браузере. */
export function demoEvent(locale: Locale): EventPublic {
  const t = translate(locale);
  const start = new Date();
  start.setDate(start.getDate() + 4);
  start.setHours(19, 0, 0, 0);
  return {
    slug: "demo",
    kind: KINDS[0],
    title: t("demoTitle"),
    description: t("demoDescription"),
    starts_at: start.toISOString(),
    location_name: t("sampleLocation"),
    address: t("demoAddress"),
    lat: null,
    lng: null,
    dress_code: [t("bright"), t("noBlack"), t("comfyShoes")],
    cover_color: "coral",
    goal_title: t("giftFund"),
    goal_amount: 20000,
    pay_phone: null,
    pay_recipient: null,
    pay_link: null,
    counts: { yes: 12, maybe: 3, no: 1 },
    raised: 12000,
    my_rsvp: null,
    items: [
      { id: "d1", label: t("cake"), taken_by: locale === "en" ? "Aidana" : "Айдана", mine: false },
      { id: "d2", label: t("balloons"), taken_by: locale === "en" ? "Daniyar" : "Данияр", mine: false },
      { id: "d3", label: t("drinks"), taken_by: null, mine: false },
      { id: "d4", label: t("speaker"), taken_by: null, mine: false },
    ],
    contributions: [
      { id: "c1", name: locale === "en" ? "Aidana" : "Айдана", amount: 5000, confirmed: true, mine: false },
      { id: "c2", name: locale === "en" ? "Daniyar" : "Данияр", amount: 7000, confirmed: true, mine: false },
    ],
  };
}
