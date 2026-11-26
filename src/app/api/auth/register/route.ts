import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { rateLimited } from "@/lib/stripe";

export const runtime = "nodejs";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Регистрация организатора по почте и паролю без писем (лимит писем Supabase не мешает).
 * Аккаунт создаётся сразу подтверждённым через service_role, затем браузер входит по паролю.
 * Существующий аккаунт этим путём не меняется: задать пароль чужому аккаунту нельзя.
 */
export async function POST(req: Request) {
  if (rateLimited(req, "register", 5)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  let body: { email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!EMAIL.test(email) || email.length > 254) return NextResponse.json({ error: "bad_email" }, { status: 400 });
  if (password.length < 8 || password.length > 72) return NextResponse.json({ error: "weak_password" }, { status: 400 });

  const { error } = await sb.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) {
    if (/already|registered|exists/i.test(error.message)) return NextResponse.json({ error: "exists" }, { status: 409 });
    console.error("register failed:", error.message);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
