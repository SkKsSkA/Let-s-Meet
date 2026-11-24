import Link from "next/link";
import { Logo } from "@/components/Logo";
import { serverMessages } from "@/lib/i18n/server";

export default function NotFound() {
  const t = serverMessages();
  return (
    <main className="mx-auto max-w-xl px-5 py-8">
      <Logo />
      <div className="card-pop mt-10">
        <h1 className="h-display text-2xl">{t("pageNotFound")}</h1>
        <p className="mt-3">{t("pageNotFoundHint")}</p>
        <Link href="/" className="btn-sun mt-5">{t("home")}</Link>
      </div>
    </main>
  );
}
