import { getLocale, serverMessages } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SetupNotice } from "@/components/SetupNotice";
import { Logo } from "@/components/Logo";
import { demoEvent } from "@/lib/demo";
import { formatDate, formatTime } from "@/lib/format";
import { getServerSupabase } from "@/lib/supabase/server";
import type { EventPublic } from "@/lib/types";
import { InviteClient } from "./InviteClient";

async function loadEvent(slug: string, locale: Locale): Promise<EventPublic | "no-backend" | null> {
  if (slug === "demo") return demoEvent(locale);
  const sb = getServerSupabase();
  if (!sb) return "no-backend";
  const { data } = await sb.rpc("get_event_public", { p_slug: slug });
  return (data as EventPublic | null) ?? null;
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const t = serverMessages();
  const locale = getLocale();
  const ev = await loadEvent(params.slug, locale);
  if (!ev || ev === "no-backend") return { title: t("invitation") };
  return {
    title: ev.title,
    description: `${formatDate(ev.starts_at, locale)}, ${formatTime(ev.starts_at, locale)} · ${ev.location_name || t("venueTbd")}`,
    openGraph: { title: ev.title, description: ev.description.slice(0, 160) },
  };
}

export default async function InvitePage({ params }: { params: { slug: string } }) {
  const ev = await loadEvent(params.slug, getLocale());
  if (ev === "no-backend") {
    return (
      <main className="mx-auto max-w-xl px-5 py-8">
        <Logo />
        <SetupNotice />
      </main>
    );
  }
  if (!ev) notFound();
  return <InviteClient initial={ev} demo={params.slug === "demo"} />;
}
