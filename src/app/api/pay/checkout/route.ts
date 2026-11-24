import { NextResponse } from "next/server";
import { getStripe, chargeCurrency, rateLimited, siteOrigin, toMinorUnits } from "@/lib/stripe";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getLocale } from "@/lib/i18n/server";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9-]{1,80}$/;

/** Создаёт тестовую Checkout-сессию Stripe и возвращает адрес оплаты. Взнос появится только после оплаты. */
export async function POST(req: Request) {
  if (rateLimited(req, "checkout", 10)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const stripe = getStripe();
  const sb = getAdminSupabase();
  if (!stripe || !sb) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  let body: { slug?: unknown; guestKey?: unknown; name?: unknown; amount?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const slug = typeof body.slug === "string" ? body.slug : "";
  const guestKey = typeof body.guestKey === "string" ? body.guestKey : "";
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
  const amount = typeof body.amount === "number" ? body.amount : NaN;
  if (!SLUG.test(slug) || !UUID.test(guestKey) || !name || !Number.isInteger(amount) || amount < 1 || amount > 10_000_000) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { data: ev, error } = await sb
    .from("events")
    .select("title, goal_title, goal_amount")
    .eq("slug", slug)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });
  if (!ev || ev.goal_amount == null) return NextResponse.json({ error: "no_fund" }, { status: 404 });

  const origin = siteOrigin(req);
  const locale = getLocale();
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: chargeCurrency(),
            unit_amount: toMinorUnits(amount),
            product_data: { name: `${ev.goal_title || "Взнос"} · ${ev.title}`.slice(0, 200) },
          },
        },
      ],
      locale: locale === "ru" || locale === "en" ? locale : "auto",
      success_url: `${origin}/e/${slug}?card=ok&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/e/${slug}?card=cancel`,
      metadata: { app: "lets-meet", slug, guest_key: guestKey, guest_name: name, amount_kzt: String(amount) },
    });
    if (!session.url) return NextResponse.json({ error: "server_error" }, { status: 502 });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("stripe checkout failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "stripe_error" }, { status: 502 });
  }
}
