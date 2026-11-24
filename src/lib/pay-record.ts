import type Stripe from "stripe";
import { getAdminSupabase } from "@/lib/supabase/admin";

export type RecordResult = "recorded" | "duplicate" | "unpaid" | "skipped";

/**
 * Записывает оплаченную сессию Stripe как подтверждённый взнос.
 * Вызывается из webhook и из проверки сессии после возврата на сайт; безопасна при повторах:
 * provider_ref (id сессии) уникален, второй вызов ничего не добавляет.
 */
export async function recordPaidSession(session: Stripe.Checkout.Session): Promise<RecordResult> {
  if (session.payment_status !== "paid") return "unpaid";
  const meta = session.metadata ?? {};
  if (meta.app !== "lets-meet") return "skipped";

  const amount = Number(meta.amount_kzt);
  if (!meta.slug || !meta.guest_key || !meta.guest_name || !Number.isInteger(amount) || amount < 1 || amount > 10_000_000) {
    throw new Error("session metadata is invalid");
  }

  const sb = getAdminSupabase();
  if (!sb) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");

  const { data: ev, error: evErr } = await sb
    .from("events")
    .select("id, goal_amount")
    .eq("slug", meta.slug)
    .maybeSingle();
  if (evErr) throw new Error(evErr.message);
  if (!ev || ev.goal_amount == null) return "skipped";

  const { data, error } = await sb
    .from("contributions")
    .upsert(
      {
        event_id: ev.id,
        guest_key: meta.guest_key,
        guest_name: meta.guest_name.slice(0, 60),
        amount,
        confirmed: true,
        method: "card_test",
        provider_ref: session.id,
      },
      { onConflict: "provider_ref", ignoreDuplicates: true },
    )
    .select("id");
  if (error) throw new Error(error.message);
  return data && data.length > 0 ? "recorded" : "duplicate";
}
