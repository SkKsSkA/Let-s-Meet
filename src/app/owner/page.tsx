import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { formatKind } from "@/lib/format";
import { getLocale, serverMessages } from "@/lib/i18n/server";
import { getOwnerAnalytics, isAnalyticsOwner } from "@/lib/owner-analytics";
import { getServerSupabase } from "@/lib/supabase/server";

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
            <div className="grid gap-6 md:grid-cols-2">
              {([
                { key: "analyticsKinds", rows: stats.kinds, color: "bg-mint" },
                { key: "analyticsVenues", rows: stats.venues, color: "bg-sky" },
              ] as const).map(({ key, rows, color }) => (
                <section key={key} className={`card-pop ${color}`}>
                  <h2 className="h-display text-2xl">{t(key)}</h2>
                  {rows.length ? (
                    <ol className="mt-4 space-y-3">
                      {rows.map(row => (
                        <li key={JSON.stringify([row.label, row.detail])} className="flex items-baseline justify-between gap-4 border-b border-ink/20 pb-2">
                          <span className="min-w-0 break-words font-semibold">
                            {key === "analyticsKinds" ? formatKind(row.label, locale) : row.label}
                            {row.detail && <span className="block text-sm font-normal">{row.detail}</span>}
                          </span>
                          <strong className="tabular-nums">{row.count}</strong>
                        </li>
                      ))}
                    </ol>
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
