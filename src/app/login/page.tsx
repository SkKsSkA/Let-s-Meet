import { serverMessages } from "@/lib/i18n/server";
import { Logo } from "@/components/Logo";
import { SetupNotice } from "@/components/SetupNotice";
import { supabaseConfigured } from "@/lib/supabase/server";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  return { title: serverMessages()("login") };
}

export default function LoginPage({ searchParams }: { searchParams: { next?: string; error?: string } }) {
  const t = serverMessages();
  return (
    <main className="mx-auto max-w-md px-5 py-8">
      <Logo />
      {supabaseConfigured ? (
        <div className="card-pop mt-10">
          <h1 className="h-display text-2xl">{t("organizerLogin")}</h1>
          <p className="mt-3">
            {t("loginDescription")}
          </p>
          {searchParams.error === "1" && <p role="alert" className="mt-3 font-semibold">{t("loginLinkInvalid")}</p>}
          <LoginForm next={searchParams.next} />
        </div>
      ) : (
        <SetupNotice />
      )}
    </main>
  );
}
