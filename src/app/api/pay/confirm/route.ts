import { NextResponse } from "next/server";
import { getStripe, rateLimited } from "@/lib/stripe";
import { recordPaidSession } from "@/lib/pay-record";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]{10,200}$/;

/**
 * Запасной путь без webhook: после возврата со Stripe страница просит сервер проверить сессию.
 * Сервер сам запрашивает её у Stripe секретным ключом, поэтому подделать «оплачено» нельзя.
 */
export async function GET(req: Request) {
  if (rateLimited(req, "confirm", 30)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const id = new URL(req.url).searchParams.get("session_id") ?? "";
  if (!SESSION_ID.test(id)) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  try {
    const session = await stripe.checkout.sessions.retrieve(id);
    const result = await recordPaidSession(session);
    return NextResponse.json({ status: result });
  } catch (e) {
    console.error("confirm failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
