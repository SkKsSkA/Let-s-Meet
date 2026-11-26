// Ссылка для входа организатора БЕЗ отправки письма (обход лимита писем Supabase при разработке).
// Запуск: npm run login-link -- you@example.com
// Нужен SUPABASE_SERVICE_ROLE_KEY в .env.local. Ссылку никому не пересылай: она даёт вход в аккаунт.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
try {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].trim();
  }
} catch {
  console.error("Не найден файл .env.local. Запускай команду из папки проекта.");
  process.exit(1);
}

const email = (process.argv[2] || "").trim();
if (!email.includes("@")) {
  console.error("Укажи почту: npm run login-link -- you@example.com");
  process.exit(1);
}
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("В .env.local нужны NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const site = (process.env.SITE || env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
const next = process.argv[3] || "/dashboard";

const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

// Создаём пользователя, если его ещё нет (ошибку «уже существует» пропускаем).
const created = await sb.auth.admin.createUser({ email, email_confirm: true });
if (created.error && !/already|registered|exists/i.test(created.error.message)) {
  console.error("Не удалось создать пользователя:", created.error.message);
  process.exit(1);
}

const { data, error } = await sb.auth.admin.generateLink({ type: "magiclink", email });
if (error || !data?.properties?.hashed_token) {
  console.error("Не удалось создать ссылку:", error?.message ?? "нет токена в ответе");
  process.exit(1);
}
const link = `${site}/auth/callback?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=magiclink&next=${encodeURIComponent(next)}`;
console.log("\nОткрой эту ссылку в браузере (она одноразовая и действует недолго):\n");
console.log(link + "\n");
