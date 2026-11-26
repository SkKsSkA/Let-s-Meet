// Создать аккаунт организатора с паролем или задать пароль уже существующему. Письма не отправляются.
// Запуск: npm run set-password -- you@example.com пароль_от_8_символов
// Нужен SUPABASE_SERVICE_ROLE_KEY в .env.local.
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
const email = (process.argv[2] || "").trim().toLowerCase();
const password = process.argv[3] || "";
if (!email.includes("@") || password.length < 8) {
  console.error("Использование: npm run set-password -- you@example.com пароль_от_8_символов");
  process.exit(1);
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
let user = null;
for (let page = 1; page <= 20 && !user; page++) {
  const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
  if (error) {
    console.error("Не удалось получить пользователей:", error.message);
    process.exit(1);
  }
  user = data.users.find((u) => (u.email || "").toLowerCase() === email) ?? null;
  if (data.users.length < 200) break;
}
if (!user) {
  const { error } = await sb.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) {
    console.error("Не удалось создать аккаунт:", error.message);
    process.exit(1);
  }
  console.log(`Аккаунт создан: войди на /login с почтой ${email} и этим паролем.`);
  process.exit(0);
}
const { error } = await sb.auth.admin.updateUserById(user.id, { password, email_confirm: true });
if (error) {
  console.error("Не удалось задать пароль:", error.message);
  process.exit(1);
}
console.log(`Готово: теперь можно войти на /login с почтой ${email} и этим паролем.`);
