import { getLocale, serverMessages } from "@/lib/i18n/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SetupNotice } from "@/components/SetupNotice";
import { SiteHeader } from "@/components/SiteHeader";
import { COVER_BG } from "@/lib/cover";
import { daysLabel, formatDate, formatKind, formatTime } from "@/lib/format";
import { getServerSupabase } from "@/lib/supabase/server";
import type { EventRow } from "@/lib/types";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  return { title: serverMessages()("myEvents") };
}

export default async function DashboardPage() {
  const t = serverMessages();
  const locale = getLocale();
  const sb = getServerSupabase();
  if (!sb) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-xl px-5">
          <SetupNotice />
        </main>
      </>
    );
  }
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/login?next=/dashboard");

  const { data: events } = await sb
    .from("events")
    .select("id, slug, kind, title, starts_at, location_name, cover_color")
    .eq("host_id", auth.user.id)
    .order("starts_at", { ascending: false });
  const list = (events ?? []) as Pick<EventRow, "id" | "slug" | "kind" | "title" | "starts_at" | "location_name" | "cover_color">[];

  const counts: Record<string, number> = {};
  if (list.length) {
    const { data: rs } = await sb.from("rsvps").select("event_id, status").in("event_id", list.map((e) => e.id));
    (rs ?? []).forEach((r: { event_id: string; status: string }) => {
      if (r.status === "yes") counts[r.event_id] = (counts[r.event_id] ?? 0) + 1;
    });
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 pb-12 pt-4 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="h-display text-3xl">{t("myEvents")}</h1>
          <Link href="/new" className="btn-sun">
            {t("newEvent")}
          </Link>
        </div>

        {list.length === 0 ? (
          <div className="card-pop bg-sun mt-8">
            <p className="text-lg font-semibold">{t("noEvents")}</p>
            <Link href="/new" className="btn-sun btn-big mt-5">
              {t("createEvent")}
            </Link>
          </div>
        ) : (
          <ul className="mt-8 grid gap-5 sm:grid-cols-2">
            {list.map((e) => (
              <li key={e.id}>
                <Link href={`/dashboard/${e.slug}`} className="block overflow-hidden rounded-3xl border-2 border-ink bg-sky text-ink shadow-pop">
                  <div className={`border-b-2 border-ink p-5 ${COVER_BG[e.cover_color]}`}>
                    <span className="rounded-full border-2 border-ink bg-ink px-3 py-1 text-xs font-bold text-white">{formatKind(e.kind, locale)}</span>
                    <div className="h-display mt-5 text-xl leading-tight">{e.title}</div>
                  </div>
                  <div className="space-y-1 p-5 text-[15px] font-semibold">
                    <p>
                      {formatDate(e.starts_at, locale)} · {formatTime(e.starts_at, locale)}
                    </p>
                    <p className="font-medium">{daysLabel(e.starts_at, locale)}</p>
                    <p className="font-medium">{t("goingCount", { count: counts[e.id] ?? 0 })}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
