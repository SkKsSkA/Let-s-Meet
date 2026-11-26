import { getServerSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  // Ссылка из `npm run login-link` (без письма) приходит с token_hash вместо code.
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/dashboard";
  const safeNext = next.startsWith("/") && !next.startsWith("//") && !/[\\\u0000-\u0020]/u.test(next) ? next : "/dashboard";

  const sb = getServerSupabase();
  if (sb && code) {
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) return new Response(null, { status: 307, headers: { Location: safeNext } });
  }
  if (sb && tokenHash && type === "magiclink") {
    const { error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return new Response(null, { status: 307, headers: { Location: safeNext } });
  }
  return new Response(null, { status: 307, headers: { Location: "/login?error=1" } });
}
