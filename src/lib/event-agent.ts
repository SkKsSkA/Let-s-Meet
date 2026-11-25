import { APP_TZ } from "./format";
import type { AiDraft } from "./types";

export const MAX_FUND_TARGET = 10_000_000;

export type AgentDraft = AiDraft & {
  venueSearch?: string;
  estimatePerGuest?: number;
  date_hint: string | null;
  address: string;
  fund: {
    title: string;
    total: number | null;
    perGuest: number | null;
    guestCount: number | null;
  } | null;
};

export function fundAmount(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= MAX_FUND_TARGET
    ? value
    : null;
}

export function fundTarget(fund: AgentDraft["fund"]): number | null {
  if (!fund) return null;
  return fund.total ?? fundAmount((fund.perGuest ?? 0) * (fund.guestCount ?? 0));
}

export function eventStartIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const sample = new Date(value + "Z");
  if (Number.isNaN(sample.getTime()) || sample.toISOString().slice(0, 16) !== value) return null;

  const offset = new Intl.DateTimeFormat("en-GB", { timeZone: APP_TZ, timeZoneName: "longOffset" })
    .formatToParts(sample)
    .find(({ type }) => type === "timeZoneName")?.value.slice(3) || "+00:00";

  return new Date(value + offset).toISOString();
}
