import { serverMessages } from "@/lib/i18n/server";
/** Показывается, пока не заданы ключи Supabase (файл .env.local). */
export function SetupNotice() {
  const t = serverMessages();
  return (
    <div className="card-pop mx-auto mt-10 max-w-xl">
      <h2 className="h-display text-xl">{t("setupTitle")}</h2>
      <p className="mt-3">
        {t("setupInstructions", {
          migration: "supabase/migrations/0001_init.sql",
          env: ".env.local",
          example: ".env.example",
        })}
      </p>
      <a href="/e/demo" className="btn-sun mt-5">
        {t("setupDemo")}
      </a>
    </div>
  );
}
