"use client";

import type { MessageKey } from "@/lib/i18n";
import { useLocale } from "@/components/LocaleProvider";

import Link from "next/link";
import { useEffect, useState } from "react";
import { COVER_BG } from "@/lib/cover";
import { daysLabel, formatDate, formatFundTitle, formatMoney, formatTime } from "@/lib/format";
import { randomKey } from "@/lib/guest";
import { formatPhone, normalizeKaspiLink, normalizePhone } from "@/lib/pay";
import { getBrowserSupabase } from "@/lib/supabase/client";
import type { BringItemRow, ContributionRow, EventRow, RsvpRow, RsvpStatus } from "@/lib/types";

const STATUS_BG: Record<RsvpStatus, string> = { yes: "bg-sun", maybe: "bg-violet", no: "bg-pink" };

export function OrganizerPanel({
  event,
  rsvps,
  contributions: initialContrib,
  items: initialItems,
  siteUrl,
}: {
  event: EventRow;
  rsvps: RsvpRow[];
  contributions: ContributionRow[];
  items: BringItemRow[];
  siteUrl: string;
}) {
  const { t, locale } = useLocale();
  const STATUS_LABEL: Record<RsvpStatus, string> = { yes: t("statusYes"), maybe: t("statusMaybe"), no: t("statusNo") };
  const [origin, setOrigin] = useState(siteUrl);
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState<"all" | RsvpStatus>("all");
  const [contrib, setContrib] = useState(initialContrib);
  const [items, setItems] = useState(initialItems);
  const [newItem, setNewItem] = useState("");
  const [error, setError] = useState<MessageKey | "">("");
  const [payPhone, setPayPhone] = useState(event.pay_phone ? formatPhone(event.pay_phone) : "");
  const [payRecipient, setPayRecipient] = useState(event.pay_recipient ?? "");
  const [payLink, setPayLink] = useState(event.pay_link ?? "");
  const [payNote, setPayNote] = useState<MessageKey | "">("");
  const [manualName, setManualName] = useState("");
  const [manualAmount, setManualAmount] = useState("");

  useEffect(() => {
    if (!siteUrl) setOrigin(window.location.origin);
  }, [siteUrl]);

  const link = `${origin}/e/${event.slug}`;
  const count = (s: RsvpStatus) => rsvps.filter((r) => r.status === s).length;
  const shown = filter === "all" ? rsvps : rsvps.filter((r) => r.status === filter);
  const raised = contrib.filter((c) => c.confirmed).reduce((sum, c) => sum + c.amount, 0);
  const pending = contrib.filter((c) => !c.confirmed);
  const confirmedList = contrib.filter((c) => c.confirmed);
  const pct = event.goal_amount ? Math.min(100, Math.round((raised / event.goal_amount) * 100)) : 0;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("copyLinkFailed");
    }
  }

  async function shareReminder() {
    const text = t("reminder", {
      title: event.title,
      date: formatDate(event.starts_at, locale),
      time: formatTime(event.starts_at, locale),
      link,
    });
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* окно закрыли */
    }
  }

  async function confirm(id: string) {
    const sb = getBrowserSupabase();
    if (!sb) return;
    const { error: err } = await sb.from("contributions").update({ confirmed: true }).eq("id", id);
    if (err) return setError("confirmFailed");
    setContrib((cur) => cur.map((c) => (c.id === id ? { ...c, confirmed: true } : c)));
  }

  /** Отклонить ошибочный или неоплаченный взнос. */
  async function reject(id: string) {
    const sb = getBrowserSupabase();
    if (!sb) return;
    const { error: err } = await sb.from("contributions").delete().eq("id", id);
    if (err) return setError("rejectFailed");
    setContrib((cur) => cur.filter((c) => c.id !== id));
  }

  /** Взнос, который внёс сам организатор или принял наличными: сразу подтверждён. */
  async function addManual(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const sb = getBrowserSupabase();
    const nameClean = manualName.trim();
    const value = Math.round(Number(manualAmount.replace(/\s/g, "")));
    if (!sb) return;
    if (!nameClean) return setError("needPayer");
    if (!Number.isFinite(value) || value <= 0 || value > 10_000_000) return setError("needAmount");
    const { data, error: err } = await sb
      .from("contributions")
      .insert({ event_id: event.id, guest_key: randomKey(), guest_name: nameClean.slice(0, 60), amount: value, confirmed: true })
      .select("id, guest_name, amount, confirmed, payer_hint, created_at")
      .single();
    if (err || !data) return setError("addContributionFailed");
    setContrib((cur) => [...cur, data as ContributionRow]);
    setManualName("");
    setManualAmount("");
  }

  async function savePay(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPayNote("");
    const sb = getBrowserSupabase();
    if (!sb) return;
    const phone = payPhone.trim() ? normalizePhone(payPhone) : null;
    if (payPhone.trim() && !phone) return setError("phoneFormat");
    const link = payLink.trim() ? normalizeKaspiLink(payLink) : null;
    if (payLink.trim() && !link) return setError("needKaspiLink");
    const { error: err } = await sb
      .from("events")
      .update({ pay_phone: phone, pay_recipient: payRecipient.trim() || null, pay_link: link })
      .eq("id", event.id);
    if (err) return setError("savePayFailed");
    setPayPhone(phone ? formatPhone(phone) : "");
    setPayLink(link ?? "");
    setPayNote(phone || link ? "payDetailsSaved" : "payDetailsRemoved");
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    const label = newItem.trim();
    const sb = getBrowserSupabase();
    if (!label || !sb) return;
    const { data, error: err } = await sb
      .from("bring_items")
      .insert({ event_id: event.id, label: label.slice(0, 80) })
      .select("id, label, taken_by")
      .single();
    if (err || !data) return setError("addItemFailed");
    setItems((cur) => [...cur, data as BringItemRow]);
    setNewItem("");
  }

  async function removeItem(id: string) {
    const sb = getBrowserSupabase();
    if (!sb) return;
    const { error: err } = await sb.from("bring_items").delete().eq("id", id);
    if (err) return setError("removeItemFailed");
    setItems((cur) => cur.filter((i) => i.id !== id));
  }

  return (
    <main className="mx-auto max-w-2xl px-5 pb-12 pt-2 sm:px-8">
      <div className={`rounded-3xl border-2 border-ink p-6 text-ink ${COVER_BG[event.cover_color]}`}>
        <span className="rounded-full border-2 border-ink bg-ink px-3.5 py-1.5 text-sm font-bold text-white">{t("organizerPanel")}</span>
        <h1 className="h-display mt-5 text-3xl leading-tight">{event.title}</h1>
        <p className="mt-2 font-semibold">
          {formatDate(event.starts_at, locale)} · {formatTime(event.starts_at, locale)} · {daysLabel(event.starts_at, locale)}
        </p>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        {(["yes", "maybe", "no"] as const).map((s) => (
          <div key={s} className={`rounded-2xl border-2 border-ink p-3.5 text-center text-ink shadow-pop-sm ${STATUS_BG[s]}`}>
            <div className="h-display text-3xl">{count(s)}</div>
            <div className="text-sm font-semibold">{s === "yes" ? t("countYes") : s === "maybe" ? t("countMaybe") : t("countNo")}</div>
          </div>
        ))}
      </div>

      {error && (
        <p role="alert" className="mt-5 rounded-2xl border-2 border-ink bg-coral p-3.5 font-semibold">
          {t(error)}
        </p>
      )}

      <section className="card bg-sky mt-5" aria-labelledby="link-h">
        <h2 id="link-h" className="h-display text-base">
          {t("guestLink")}
        </h2>
        <div className="mt-3 flex items-center gap-2.5">
          <input readOnly value={link} aria-label={t("eventLink")} onFocus={(e) => e.currentTarget.select()} className="field min-w-0 flex-1 text-[15px]" />
          <button onClick={copy} className="btn-sun">
            {copied ? t("done") : t("copy")}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2.5">
          <Link href={`/e/${event.slug}`} className="btn-dark">
            {t("openAsGuest")}
          </Link>
          <button onClick={shareReminder} className="btn-dark">
            {t("shareReminder")}
          </button>
        </div>
      </section>

      <section className="card bg-mint mt-5" aria-labelledby="guests-h">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="guests-h" className="h-display text-base">
            {t("guests")}
          </h2>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t("guestFilter")}>
            {(
              [
                ["all", t("all")],
                ["yes", t("filterYes")],
                ["maybe", t("filterMaybe")],
                ["no", t("filterNo")],
              ] as const
            ).map(([k, label]) => (
              <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)} className={`chip ${filter === k ? "bg-ink text-white" : "bg-transparent"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {shown.length === 0 ? (
          <p className="mt-4 font-medium">
            {rsvps.length === 0 ? t("noReplies") : t("emptyGroup")}
          </p>
        ) : (
          <ul className="mt-3">
            {shown.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 border-t-2 border-ink/15 py-2.5 first:border-t-0">
                <span className="font-semibold">{r.guest_name}</span>
                <span className={`rounded-full border-2 border-ink px-3 py-1 text-[13px] font-bold ${STATUS_BG[r.status]}`}>
                  {STATUS_LABEL[r.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-sm font-medium">
          {t("reminderHint")}
        </p>
      </section>

      {event.goal_amount ? (
        <section className="card bg-sun mt-5" aria-labelledby="money-h">
          <h2 id="money-h" className="h-display text-base">
            {formatFundTitle(event.goal_title, locale)}
          </h2>
          <div className="mt-3.5 h-5 overflow-hidden rounded-full border-2 border-ink bg-ink/20">
            <div className="h-full border-r-2 border-ink bg-sun" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2.5 text-[15px] font-medium">
            {t("confirmedTotal", { amount: formatMoney(raised, locale), goal: formatMoney(event.goal_amount, locale) })}
          </p>
          {pending.length > 0 ? (
            <div className="mt-4">
              <h3 className="font-bold">{t("pendingPlural")}</h3>
              <p className="mt-1 text-sm font-medium">
                {t("confirmHint")}
              </p>
              <ul className="mt-1">
                {pending.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-ink/15 py-2.5 first:border-t-0">
                    <span className="font-semibold">
                      {c.guest_name} · {formatMoney(c.amount, locale)}
                      {c.payer_hint ? <span className="block text-sm font-medium">{t("bankPayer", { name: c.payer_hint })}</span> : null}
                    </span>
                    <span className="flex items-center gap-2">
                      <button onClick={() => confirm(c.id)} className="chip bg-sun">
                        {t("paymentReceived")}
                      </button>
                      <button onClick={() => reject(c.id)} className="chip bg-transparent" aria-label={t("rejectContribution", { name: c.guest_name })}>
                        {t("reject")}
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {confirmedList.length > 0 && (
            <div className="mt-4">
              <h3 className="font-bold">{t("contributors")}</h3>
              <ul className="mt-1">
                {confirmedList.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 border-t-2 border-ink/15 py-2.5 first:border-t-0">
                    <span className="font-semibold">
                      {c.guest_name} · {formatMoney(c.amount, locale)}
                      {c.method === "card_test" ? <span className="ml-2 chip bg-sky">{t("cardMethod")}</span> : null}
                    </span>
                    <button onClick={() => reject(c.id)} className="chip bg-transparent" aria-label={t("removeContribution", { name: c.guest_name })}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <form onSubmit={addManual} className="mt-4 rounded-2xl border-2 border-ink bg-white/60 p-4">
            <h3 className="font-bold">{t("addManual")}</h3>
            <p className="mt-1 text-sm font-medium">{t("addManualHint")}</p>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-[1fr_8rem_auto]">
              <label htmlFor="manual-name" className="sr-only">
                {t("name")}
              </label>
              <input id="manual-name" value={manualName} onChange={(e) => setManualName(e.target.value)} maxLength={60} placeholder={t("name")} className="field min-w-0" />
              <label htmlFor="manual-amount" className="sr-only">
                {t("amount")}
              </label>
              <input id="manual-amount" inputMode="numeric" value={manualAmount} onChange={(e) => setManualAmount(e.target.value)} placeholder={t("amount")} className="field min-w-0" />
              <button className="btn-sun">{t("add")}</button>
            </div>
          </form>

          <form onSubmit={savePay} className="mt-4 rounded-2xl border-2 border-ink bg-white/60 p-4">
            <h3 className="font-bold">{t("howToPay")}</h3>
            <p className="mt-1 text-sm font-medium">{t("organizerPayHint")}</p>
            <div className="mt-3 space-y-3">
              <div>
                <label htmlFor="pay-phone" className="block text-sm font-bold">
                  {t("personalPhone")}
                </label>
                <input id="pay-phone" type="tel" inputMode="tel" value={payPhone} onChange={(e) => setPayPhone(e.target.value)} placeholder="+7 707 123 45 67" className="field mt-1" />
              </div>
              <div>
                <label htmlFor="pay-recipient" className="block text-sm font-bold">
                  {t("nameInKaspi")} <span className="font-medium">{t("optional")}</span>
                </label>
                <input id="pay-recipient" value={payRecipient} onChange={(e) => setPayRecipient(e.target.value)} maxLength={60} placeholder={t("recipientExample")} className="field mt-1" />
              </div>
              <div>
                <label htmlFor="pay-link" className="block text-sm font-bold">
                  {t("kaspiPayLink")}
                </label>
                <input id="pay-link" type="url" inputMode="url" value={payLink} onChange={(e) => setPayLink(e.target.value)} placeholder="https://kaspi.kz/..." className="field mt-1" />
                <p className="mt-1 text-sm font-medium">{t("kaspiBusinessHint")}</p>
              </div>
              <button className="btn-dark">{t("saveDetails")}</button>
              {payNote && (
                <p role="status" className="text-sm font-semibold">
                  {t(payNote)}
                </p>
              )}
            </div>
          </form>
        </section>
      ) : null}

      <section className="card bg-pink mt-5" aria-labelledby="bring-h">
        <h2 id="bring-h" className="h-display text-base">
          {t("whoBringsWhat")}
        </h2>
        {items.length > 0 && (
          <ul className="mt-2">
            {items.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 border-t-2 border-ink/15 py-2.5 first:border-t-0">
                <span className="font-semibold">{i.label}</span>
                <span className="flex items-center gap-2">
                  <span className={`chip ${i.taken_by ? "bg-violet" : "bg-transparent"}`}>{i.taken_by ?? t("unclaimed")}</span>
                  <button onClick={() => removeItem(i.id)} aria-label={t("removeItem", { item: i.label })} className="chip bg-transparent">
                    ×
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={addItem} className="mt-4 flex gap-2.5">
          <label htmlFor="new-item" className="sr-only">
            {t("newItem")}
          </label>
          <input id="new-item" value={newItem} onChange={(e) => setNewItem(e.target.value)} maxLength={80} placeholder={t("itemExample")} className="field min-w-0 flex-1" />
          <button className="btn-sun">{t("add")}</button>
        </form>
      </section>
    </main>
  );
}
