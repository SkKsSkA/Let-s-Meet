import { createClient } from "@supabase/supabase-js";

/**
 * Клиент с ключом service_role. Обходит RLS, поэтому используется ТОЛЬКО в серверных роутах
 * оплаты (webhook и проверка сессии). Ключ нельзя называть NEXT_PUBLIC_*, иначе он попадёт в браузер.
 */
export function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
