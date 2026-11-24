import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { recordPaidSession } from "@/lib/pay-record";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Webhook Stripe. Подпись проверяется по сырому телу запроса; без неё запрос отклоняется. */
export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "no_signature" }, { status: 400 });

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, secret);
  } catch {
    return NextResponse.json({ error: "bad_signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    try {
      await recordPaidSession(event.data.object as Stripe.Checkout.Session);
    } catch (e) {
      console.error("webhook record failed:", e instanceof Error ? e.message : e);
      return NextResponse.json({ error: "record_failed" }, { status: 500 }); // Stripe повторит доставку
    }
  }
  return NextResponse.json({ received: true });
}
