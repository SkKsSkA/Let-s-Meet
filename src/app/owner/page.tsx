import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { formatKind } from "@/lib/format";
import { getLocale, serverMessages } from "@/lib/i18n/server";
import { getOwnerAnalytics, isAnalyticsOwner } from "@/lib/owner-analytics";
import { getServerSupabase } from "@/lib/supabase/server";

import { Ranking } from "./Ranking";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return { title: serverMessages()("ownerAnalytics"), robots: { index: false, follow: false } };
}

export default async function OwnerPage({ searchParams }: { searchParams: { period?: string } }) {
  const db = getServerSupabase();
  const user = db ? (await db.auth.getUser()).data.user : null;
  if (!user) redirect("/login?next=/owner");
  if (!isAnalyticsOwner(user)) notFound();

  const t = serverMessages();
  const locale = getLocale();
  const lastMonth = searchParams.period === "30";
  const stats = await getOwnerAnalytics(user, lastMonth);
  const periods = [
    { name: t("analyticsAll"), href: "/owner", active: !lastMonth },
    { name: t("analyticsMonth"), href: "/owner?period=30", active: lastMonth },
  ];
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl space-y-6 px-5 pb-12 pt-4 sm:px-8">
        <h1 className="h-display text-3xl">{t("ownerAnalytics")}</h1>
        <nav className="flex flex-wrap gap-3" aria-label={t("analyticsPeriod")}>
          {periods.map(period => <Link key={period.href} href={period.href}
            aria-current={period.active ? "page" : undefined}
            className={period.active ? "btn-sun" : "btn-mint"}>{period.name}</Link>)}
        </nav>
        {stats ? (
          <>
            <div className="card-pop bg-violet">
              <p className="text-xl font-bold">{t("analyticsTotal", { count: stats.total })}</p>
              <p>{t("analyticsWithVenue", { count: stats.withVenue })}</p>
            </div>
            <section className="card-pop bg-violet space-y-2">
              <h2 className="h-display text-2xl">{t("analyticsAI")}</h2>
              <p>{t("analyticsAgentScope")}</p>
              {stats.agent ? (
                <ul className="flex flex-wrap gap-x-6 gap-y-2 font-semibold">
                  <li>{t("analyticsRequests", { count: stats.agent.requests })}</li>
                  <li>{t("analyticsFallbackRequests", { count: stats.agent.fallbackRequests })}</li>
                  <li>{t("analyticsAgentEvents", { count: stats.agent.events })}</li>
                </ul>
              ) : <p role="status">{t("analyticsAgentUnavailable")}</p>}
            </section>
            <div className="grid gap-6 md:grid-cols-2">
              {([
                { key: "analyticsKinds", rows: stats.kinds, total: stats.total, color: "bg-mint", kind: true },
                { key: "analyticsVenues", rows: stats.venues, total: stats.withVenue, color: "bg-sky", kind: false },
              ] as const).map(({ key, rows, total, color, kind }) => (
                <section key={key} className={`card-pop min-w-0 ${color}`}>
                  <h2 className="h-display text-2xl">{t(key)}</h2>
                  {rows.length ? (
                    <Ranking
                      rows={rows.map(row => ({
                        ...row,
                        label: kind ? formatKind(row.label, locale) : row.label,
                      }))}
                      total={total}
                      locale={locale}
                      otherLabel={t("analyticsOther")}
                    />
                  ) : <p className="mt-3">{t("analyticsEmpty")}</p>}
                </section>
              ))}
            </div>
          </>
        ) : <p className="card-pop bg-sun" role="alert">{t("analyticsFailed")}</p>}
      </main>
    </>
  );
}
