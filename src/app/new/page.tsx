import { serverMessages } from "@/lib/i18n/server";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { SetupNotice } from "@/components/SetupNotice";
import { getServerSupabase } from "@/lib/supabase/server";
import { NewEventForm } from "./NewEventForm";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  return { title: serverMessages()("newEvent") };
}

export default async function NewEventPage() {
  const t = serverMessages();
  const sb = getServerSupabase();
  if (!sb) {
    return (
      <main className="mx-auto max-w-xl px-5 py-8">
        <Logo />
        <SetupNotice />
      </main>
    );
  }
  const { data } = await sb.auth.getUser();
  if (!data.user) redirect("/login?next=/new");

  return (
    <main className="mx-auto max-w-md px-5 pb-12 pt-5">
      <Logo />
      <h1 className="h-display mt-4 text-3xl leading-tight">{t("newEvent")}</h1>
      <NewEventForm />
    </main>
  );
}
