import Stripe from "stripe";

/** Тестовые оплаты работают только с ключами sk_test_. Боевой ключ нужен явное разрешение. */
export function stripeConfigured() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return false;
  if (key.startsWith("sk_live_") && process.env.STRIPE_ALLOW_LIVE !== "1") return false;
  return true;
}

let client: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!stripeConfigured()) return null;
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY as string);
  return client;
}

/** Валюта списания. Если аккаунт Stripe не принимает тенге, поставь usd и курс в STRIPE_KZT_PER_UNIT. */
export function chargeCurrency() {
  return (process.env.STRIPE_CURRENCY || "kzt").toLowerCase();
}

/** Сколько тенге в одной единице валюты списания (для usd, например, 500). Для kzt всегда 1. */
export function kztPerUnit() {
  if (chargeCurrency() === "kzt") return 1;
  const rate = Number(process.env.STRIPE_KZT_PER_UNIT);
  return Number.isFinite(rate) && rate > 0 ? rate : 500;
}

/** Сумма в тенге -> минимальные единицы валюты списания (тиыны, центы). */
export function toMinorUnits(amountKzt: number) {
  return Math.round((amountKzt / kztPerUnit()) * 100);
}

export function siteOrigin(req: Request) {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env && /^https?:\/\//.test(env)) return env.replace(/\/+$/, "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : new URL(req.url).origin;
}

/** Простой лимит запросов с одного адреса. Живёт в памяти одного экземпляра сервера. */
const hits = new Map<string, number[]>();
export function rateLimited(req: Request, bucket: string, max = 10, windowMs = 60_000) {
  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) hits.clear();
  return list.length > max;
}
