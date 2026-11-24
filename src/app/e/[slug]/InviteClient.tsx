"use client";

import { LOCALES, type MessageKey } from "@/lib/i18n";
import { useLocale } from "@/components/LocaleProvider";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { COVER_BG } from "@/lib/cover";
import { APP_TZ, daysLabel, formatDate, formatFundTitle, formatKind, formatMoney, formatTime, mapLink } from "@/lib/format";
import { getGuestKey, getGuestName, saveGuestName } from "@/lib/guest";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { copyText, formatPhone, normalizeKaspiLink } from "@/lib/pay";
import type { EventPublic, RsvpStatus } from "@/lib/types";


function icsEscape(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function downloadIcs(ev: EventPublic) {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const start = new Date(ev.starts_at);
  const end = new Date(start.getTime() + 3 * 3600_000);
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Lets meet//RU",
    "BEGIN:VEVENT",
    `UID:${ev.slug}@letsmeet`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${icsEscape(ev.title)}`,
    `LOCATION:${icsEscape([ev.location_name, ev.address].filter(Boolean).join(", "))}`,
    `DESCRIPTION:${icsEscape(ev.description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([body], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${ev.slug}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

export function InviteClient({ initial, demo }: { initial: EventPublic; demo: boolean }) {
  const { t, locale } = useLocale();
  const STATUS_TEXT: Record<RsvpStatus, string> = {
    yes: t("yesFeedback"),
    maybe: t("maybeFeedback"),
    no: t("noFeedback"),
  };
  const [eventState, setEv] = useState(initial);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | "">("");
  const [amount, setAmount] = useState("");
  const [payStep, setPayStep] = useState<"form" | "pay" | "done">("form");
  const [payerHint, setPayerHint] = useState("");
  const [moneyError, setMoneyError] = useState<MessageKey | "">("");
  const [copied, setCopied] = useState("");
  const [shareNote, setShareNote] = useState<MessageKey | "">("");
  const [cardNote, setCardNote] = useState<{ key: MessageKey; ok: boolean } | null>(null);

  const ev = demo ? {
    ...initial,
    counts: eventState.counts,
    my_rsvp: eventState.my_rsvp,
    items: initial.items.map((item) => {
      const current = eventState.items.find(({ id }) => id === item.id);
      return current?.mine ? { ...current, label: item.label } : item;
    }),
    contributions: [...initial.contributions, ...eventState.contributions.filter(({ mine }) => mine)],
  } : eventState;
  const payLink = ev.pay_link ? normalizeKaspiLink(ev.pay_link) : null;
  const payPhone = ev.pay_phone;
  const kaspiOn = Boolean(payPhone || payLink);
  // Тестовая оплата картой через Stripe: включается переменной NEXT_PUBLIC_CARD_PAYMENTS=test и только для настоящих встреч.
  const cardOn = !demo && process.env.NEXT_PUBLIC_CARD_PAYMENTS === "test";
  const canPay = demo || kaspiOn || cardOn;
  const pledgeAmount = Math.round(Number(amount.replace(/\s/g, "")));

  const refresh = useCallback(async () => {
    const sb = getBrowserSupabase();
    if (!sb) return;
    const { data } = await sb.rpc("get_event_public", { p_slug: initial.slug, p_guest_key: getGuestKey() });
    if (data) setEv(data as EventPublic);
  }, [initial.slug]);

  useEffect(() => {
    setName(getGuestName());
    if (!demo) void refresh();
  }, [demo, refresh]);

  // Возврат со страницы оплаты Stripe: ?card=ok&session_id=... или ?card=cancel.
  useEffect(() => {
    if (demo) return;
    const params = new URLSearchParams(window.location.search);
    const card = params.get("card");
    if (!card) return;
    const sessionId = params.get("session_id") ?? "";
    window.history.replaceState(null, "", window.location.pathname);
    if (card === "cancel") {
      setCardNote({ key: "cardCanceled", ok: false });
      return;
    }
    if (card !== "ok" || !sessionId) return;
    void (async () => {
      try {
        const res = await fetch(`/api/pay/confirm?session_id=${encodeURIComponent(sessionId)}`);
        const body = (await res.json()) as { status?: string };
        await refresh();
        const paid = body.status === "recorded" || body.status === "duplicate";
        setCardNote({ key: paid ? "cardPaidOk" : "cardPending", ok: paid });
      } catch {
        await refresh();
        setCardNote({ key: "cardPending", ok: false });
      }
    })();
  }, [demo, refresh]);

  async function call<T>(
    fn: () => PromiseLike<{ error: { message: string } | null; data?: T }>,
    report: (msg: MessageKey | "") => void = setError,
  ) {
    setBusy(true);
    report("");
    const res = await fn();
    setBusy(false);
    if (res.error) {
      report("saveFailed");
      return null;
    }
    return res;
  }

  async function answer(status: RsvpStatus) {
    const clean = name.trim();
    if (!clean) {
      setError("needGuestName");
      return;
    }
    saveGuestName(clean);
    setError("");
    if (demo) {
      setEv((cur) => {
        const counts = { ...cur.counts };
        if (cur.my_rsvp) counts[cur.my_rsvp] -= 1;
        counts[status] += 1;
        return { ...cur, counts, my_rsvp: status };
      });
      return;
    }
    const sb = getBrowserSupabase();
    if (!sb) return;
    const ok = await call(() =>
      sb.rpc("submit_rsvp", { p_slug: ev.slug, p_guest_key: getGuestKey(), p_name: clean, p_status: status }),
    );
    if (ok) await refresh();
  }

  async function takeItem(id: string) {
    const clean = name.trim();
    if (!clean) {
      setError("nameAbove");
      return;
    }
    saveGuestName(clean);
    if (demo) {
      setEv((cur) => ({
        ...cur,
        items: cur.items.map((i) => (i.id === id ? { ...i, taken_by: clean, mine: true } : i)),
      }));
      return;
    }
    const sb = getBrowserSupabase();
    if (!sb) return;
    const ok = await call(() => sb.rpc("claim_item", { p_item_id: id, p_guest_key: getGuestKey(), p_name: clean }));
    if (ok) await refresh();
  }

  async function dropItem(id: string) {
    if (demo) {
      setEv((cur) => ({
        ...cur,
        items: cur.items.map((i) => (i.id === id ? { ...i, taken_by: null, mine: false } : i)),
      }));
      return;
    }
    const sb = getBrowserSupabase();
    if (!sb) return;
    const ok = await call(() => sb.rpc("release_item", { p_item_id: id, p_guest_key: getGuestKey() }));
    if (ok) await refresh();
  }

  /** Проверяет имя и сумму; при ошибке показывает подсказку в блоке сбора. */
  function checkPledge(): { name: string; value: number } | null {
    const clean = name.trim();
    const value = pledgeAmount;
    if (!clean) {
      setMoneyError("nameForPledge");
      return null;
    }
    if (!Number.isFinite(value) || value <= 0 || value > 10_000_000) {
      setMoneyError("needAmount");
      return null;
    }
    setMoneyError("");
    saveGuestName(clean);
    return { name: clean, value };
  }

  /** Для событий без реквизитов гость может отметить уже внесённую сумму. */
  function startPay() {
    if (!checkPledge()) return;
    if (canPay) setPayStep("pay");
    else void sendPledge();
  }

  /** Тестовая оплата картой: создаём сессию Stripe на сервере и уходим на страницу оплаты. */
  async function startCard() {
    const chk = checkPledge();
    if (!chk) return;
    setBusy(true);
    setCardNote({ key: "cardRedirecting", ok: true });
    try {
      const res = await fetch("/api/pay/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: ev.slug, guestKey: getGuestKey(), name: chk.name, amount: chk.value }),
      });
      const body = (await res.json()) as { url?: string };
      if (res.ok && body.url) {
        window.location.href = body.url;
        return;
      }
    } catch {
      /* ниже покажем общую ошибку */
    }
    setBusy(false);
    setCardNote(null);
    setMoneyError("cardFailed");
  }

  /** Гость перевёл деньги в Kaspi и сообщает об этом. В «Собрано» сумма попадёт после подтверждения организатором. */
  async function sendPledge() {
    const chk = checkPledge();
    if (!chk) return;
    if (demo) {
      setEv((cur) => ({
        ...cur,
        contributions: [
          ...cur.contributions,
          { id: `demo-${Date.now()}`, name: chk.name, amount: chk.value, confirmed: false, mine: true },
        ],
      }));
      setPayStep("done");
      setAmount("");
      setPayerHint("");
      return;
    }
    const sb = getBrowserSupabase();
    if (!sb) return;
    const ok = await call(
      () =>
        sb.rpc("add_pledge", {
          p_slug: ev.slug,
          p_guest_key: getGuestKey(),
          p_name: chk.name,
          p_amount: chk.value,
          p_hint: payerHint.trim() || null,
        }),
      setMoneyError,
    );
    if (ok) {
      await refresh();
      setPayStep("done");
      setAmount("");
      setPayerHint("");
    }
  }

  async function cancelPledge(id: string) {
    if (demo) {
      setEv((cur) => ({ ...cur, contributions: cur.contributions.filter((c) => c.id !== id) }));
      return;
    }
    const sb = getBrowserSupabase();
    if (!sb) return;
    const ok = await call(() => sb.rpc("cancel_pledge", { p_id: id, p_guest_key: getGuestKey() }), setMoneyError);
    if (ok) await refresh();
  }

  async function copy(key: string, text: string) {
    if (await copyText(text)) {
      setCopied(key);
      setTimeout(() => setCopied(""), 2000);
    } else {
      setMoneyError("copyFailed");
    }
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: ev.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        setShareNote("linkCopied");
      }
    } catch {
      /* пользователь закрыл окно — ничего не делаем */
    }
  }

  const goalPct = ev.goal_amount ? Math.min(100, Math.round((ev.raised / ev.goal_amount) * 100)) : 0;
  const total = ev.counts.yes + ev.counts.maybe;

  return (
    <main className="invite-page mx-auto max-w-[90rem] px-4 pb-12 pt-4 sm:px-8 sm:pt-8">
      <header className={`rounded-[32px] border-2 border-ink p-5 text-ink shadow-pop-lg sm:p-9 lg:p-12 ${COVER_BG[ev.cover_color]}`}>
        <div className="flex items-start justify-between gap-4">
          <span className="rounded-full border-2 border-ink bg-ink px-4 py-2 font-bold text-white">
            {formatKind(ev.kind, locale)}
          </span>
          <div
            aria-hidden="true"
            className="flex h-24 w-24 shrink-0 rotate-[10deg] flex-col items-center justify-center rounded-full border-2 border-ink bg-sun font-display font-extrabold leading-none sm:h-36 sm:w-36"
          >
            <span className="text-4xl sm:text-5xl">{new Date(ev.starts_at).toLocaleDateString(LOCALES[locale].intl, { day: "numeric", timeZone: APP_TZ })}</span>
            <span className="mt-1 text-base sm:text-xl">
              {new Date(ev.starts_at).toLocaleDateString(LOCALES[locale].intl, { month: "short", timeZone: APP_TZ }).replace(".", "")}
            </span>
          </div>
        </div>
        <h1 className="h-display mt-4 max-w-6xl break-words text-[clamp(2.65rem,6.5vw,5.75rem)] leading-[1.06]">{ev.title}</h1>
        <p className="mt-3 font-semibold">{daysLabel(ev.starts_at, locale)}</p>
      </header>

      <div className="invite-grid mt-6 grid gap-5 lg:mt-8 lg:grid-cols-2 lg:gap-7">
        <section className="card-pop bg-violet" aria-labelledby="rsvp-h">
          <h2 id="rsvp-h" className="h-display">
            {t("areYouComing")}
          </h2>
          <label htmlFor="guest-name" className="mt-4 block font-bold">
            {t("yourName")}
          </label>
          <input
            id="guest-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            autoComplete="given-name"
            placeholder={t("name")}
            className="field mt-1.5"
          />
          <div className="mt-4 grid gap-2.5 min-[420px]:grid-cols-3">
            {(
              [
                ["yes", t("rsvpYes"), "bg-sun"],
                ["maybe", t("rsvpMaybe"), "bg-mint"],
                ["no", t("rsvpNo"), "bg-coral"],
              ] as const
            ).map(([s, label, bg]) => (
              <button
                key={s}
                disabled={busy}
                onClick={() => answer(s)}
                aria-pressed={ev.my_rsvp === s}
                className={`invite-rsvp-button rounded-full border-2 border-ink px-2 py-2 font-bold shadow-pop-sm transition-transform active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-60 ${
                  ev.my_rsvp === s ? `${bg} ring-4 ring-ink/25` : ev.my_rsvp ? "bg-transparent" : bg
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {ev.my_rsvp && (
            <p className="mt-4 rounded-2xl border-2 border-ink bg-ink p-3.5 font-semibold text-white" role="status">
              {STATUS_TEXT[ev.my_rsvp]}
            </p>
          )}
          {error && (
            <p role="alert" className="mt-4 rounded-2xl border-2 border-ink bg-coral p-3.5 font-semibold">
              {t(error)}
            </p>
          )}
          <p className="mt-4 font-medium">
            {ev.counts.yes} придут · {ev.counts.maybe} {t("countMaybe")}
            {total === 0 ? t("firstReply") : ""}
          </p>
        </section>

        <section className="card bg-mint" aria-labelledby="when-h">
          <h2 id="when-h" className="h-display">
            {t("whenWhere")}
          </h2>
          <p className="mt-4 font-semibold">
            {formatDate(ev.starts_at, locale)} · {formatTime(ev.starts_at, locale)}
          </p>
          {(ev.location_name || ev.address) && (
            <>
              <p className="mt-3 font-semibold">{ev.location_name}</p>
              {ev.address && <p>{ev.address}</p>}
              <a
                href={mapLink(ev.location_name, ev.address)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-dark mt-4 w-full"
              >
                {t("map")}
              </a>
            </>
          )}
          <button onClick={() => downloadIcs(ev)} className="btn-dark mt-3 w-full">
            {t("calendar")}
          </button>
        </section>

        {ev.description && (
          <section className="card bg-pink">
            <h2 className="h-display">{t("aboutEvent")}</h2>
            <p className="mt-3 whitespace-pre-line">{ev.description}</p>
          </section>
        )}

        {ev.dress_code.length > 0 && (
          <section className="card bg-sky">
            <h2 className="h-display">{t("dressCode")}</h2>
            <div className="mt-3.5 flex flex-wrap gap-2.5">
              {ev.dress_code.map((d, i) => (
                <span key={d} className={`chip ${["bg-sun", "bg-coral", "bg-violet"][i % 3]}`}>
                  {d}
                </span>
              ))}
            </div>
          </section>
        )}

        {ev.goal_amount ? (
          <section className="card bg-sun" aria-labelledby="money-h">
            <h2 id="money-h" className="h-display">
              {formatFundTitle(ev.goal_title, locale)}
            </h2>
            <div
              className="mt-3.5 h-6 overflow-hidden rounded-full border-2 border-ink bg-ink/20"
              role="progressbar"
              aria-valuenow={goalPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t("raised")}
            >
              <div className="h-full border-r-2 border-ink bg-sun" style={{ width: `${goalPct}%` }} />
            </div>
            <p className="mt-2.5 font-medium">
              {t("raisedTotal", { amount: formatMoney(ev.raised, locale), goal: formatMoney(ev.goal_amount, locale) })}
            </p>
            {payStep === "done" ? (
              <div className="mt-4">
                <p role="status" className="rounded-2xl border-2 border-ink bg-ink p-3.5 font-semibold text-white">
                  {demo
                    ? t("demoRecorded")
                    : t("contributionRecorded")}
                </p>
                <button onClick={() => setPayStep("form")} className="btn-dark mt-3 w-full">
                  {t("contributeAgain")}
                </button>
              </div>
            ) : payStep === "pay" && canPay ? (
              <div className="mt-4 space-y-3 rounded-2xl border-2 border-ink bg-white/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="h-display">{t("pledgeHeading", { amount: formatMoney(pledgeAmount, locale) })}</h3>
                  {!demo && kaspiOn && (
                    <button type="button" onClick={() => copy("sum", String(pledgeAmount))} className="chip bg-sun">
                      {copied === "sum" ? t("copied") : t("copyAmount")}
                    </button>
                  )}
                </div>
                {cardOn && (
                  <div className="space-y-2 rounded-xl border border-ink/30 p-3">
                    <button type="button" disabled={busy} onClick={startCard} className="btn-dark w-full disabled:opacity-60">
                      {t("payByCard")}
                    </button>
                    <p className="text-sm font-medium">{t("cardTestNote")}</p>
                  </div>
                )}
                {cardOn && kaspiOn && <p className="text-sm font-bold">{t("cardOr")}</p>}
                {demo ? (
                  <p className="font-medium">{t("demoPayHint")}</p>
                ) : (
                  <>
                    {payLink && (
                      <>
                        <a href={payLink} target="_blank" rel="noopener noreferrer" className="btn-dark w-full">
                          {t("openKaspi")}
                        </a>
                        <p className="text-sm font-medium">{t("kaspiEnterAmount")}</p>
                      </>
                    )}
                    {payPhone && (
                      <div className="space-y-2 rounded-xl border border-ink/30 p-3">
                        <h4 className="font-bold">{payLink ? t("orTransferByPhone") : t("personalTransfer")}</h4>
                        <p className="text-sm font-medium">{t("kaspiTransferSteps")}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <b className="whitespace-nowrap">{formatPhone(payPhone)}</b>
                          <button type="button" onClick={() => copy("phone", payPhone)} className="chip bg-sun">
                            {copied === "phone" ? t("copied") : t("copyNumber")}
                          </button>
                        </div>
                        <p className="text-sm font-medium">
                          {ev.pay_recipient ? t("recipient", { name: ev.pay_recipient }) : t("verifyRecipient")}
                        </p>
                      </div>
                    )}
                    {kaspiOn && <p className="text-sm font-medium">{t("returnAfterPay")}</p>}
                  </>
                )}
                {!demo && kaspiOn && <div>
                  <label htmlFor="payer-hint" className="block text-sm font-bold">
                    {t("payerName")} <span className="font-medium">{t("ifNameDiffers")}</span>
                  </label>
                  <input
                    id="payer-hint"
                    value={payerHint}
                    onChange={(e) => setPayerHint(e.target.value)}
                    maxLength={60}
                    placeholder={t("payerExample")}
                    className="field mt-1.5"
                  />
                  <p className="mt-1 text-sm font-medium">{t("payerHint")}</p>
                </div>}
                {(demo || kaspiOn) && (
                  <button disabled={busy} onClick={sendPledge} className="btn-sun w-full disabled:opacity-60">
                    {demo ? t("addDemoContribution") : t("sentPayment")}
                  </button>
                )}
                <button type="button" onClick={() => setPayStep("form")} className="chip bg-transparent">
                  {t("back")}
                </button>
              </div>
            ) : (
              <div className="mt-4">
                <div className="flex flex-col gap-2.5 sm:flex-row lg:flex-col xl:flex-row">
                  <label htmlFor="pledge" className="sr-only">
                    {t("amount")}
                  </label>
                  <input
                    id="pledge"
                    inputMode="numeric"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={t("yourAmount")}
                    className="field min-w-0 flex-1"
                  />
                  <button disabled={busy} onClick={startPay} className="btn-sun disabled:opacity-60">
                    {canPay ? t("continueToPay") : t("alreadyContributed")}
                  </button>
                </div>
                {!canPay && (
                  <p className="mt-2 text-sm font-medium">{t("missingPaymentDetails")}</p>
                )}
              </div>
            )}
            {cardNote && (
              <p
                role={cardNote.ok ? "status" : "alert"}
                className={`mt-3 rounded-2xl border-2 border-ink p-3.5 font-semibold ${cardNote.ok ? "bg-ink text-white" : "bg-coral"}`}
              >
                {t(cardNote.key)}
              </p>
            )}
            {moneyError && (
              <p role="alert" className="mt-3 rounded-2xl border-2 border-ink bg-coral p-3.5 font-semibold">
                {t(moneyError)}
              </p>
            )}

            <div className="mt-5">
              <h3 className="font-bold">{t("contributionList")}</h3>
              {ev.contributions.length === 0 ? (
                <p className="mt-1.5 font-medium">{t("noContributions")}</p>
              ) : (
                <ul className="mt-1">
                  {ev.contributions.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-ink/15 py-2.5 first:border-t-0">
                      <span className="font-semibold">
                        {c.name}
                        {c.mine ? ` ${t("you")}` : ""} · {formatMoney(c.amount, locale)}
                      </span>
                      <span className="flex flex-wrap items-center gap-2">
                        <span className={`chip ${c.confirmed ? "bg-mint" : "bg-transparent"}`}>
                          {c.confirmed ? t("confirmed") : t("pending")}
                        </span>
                        {c.mine && !c.confirmed && (
                          <button onClick={() => cancelPledge(c.id)} className="chip bg-transparent" aria-label={t("cancelContribution", { amount: formatMoney(c.amount, locale) })}>
                            {t("cancel")}
                          </button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-sm font-medium">
                {t("fundVisibility")}
              </p>
            </div>
          </section>
        ) : null}

        {ev.items.length > 0 && (
          <section className="card bg-mint" aria-labelledby="bring-h">
            <h2 id="bring-h" className="h-display">
              {t("whoBringsWhat")}
            </h2>
            <ul className="mt-2">
              {ev.items.map((it) => (
                <li key={it.id} className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-ink/15 py-2.5 first:border-t-0">
                  <span className="font-semibold">{it.label}</span>
                  {it.taken_by ? (
                    it.mine ? (
                      <button onClick={() => dropItem(it.id)} className="chip bg-sun" aria-label={t("unclaimItem", { item: it.label })}>
                        {t("unclaimMine")}
                      </button>
                    ) : (
                      <span className="chip bg-violet">{it.taken_by}</span>
                    )
                  ) : (
                    <button disabled={busy} onClick={() => takeItem(it.id)} className="chip bg-transparent disabled:opacity-60">
                      {t("claim")}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex flex-col gap-3 lg:col-span-2 lg:items-center">
          <button onClick={share} className="btn-mint lg:min-w-[20rem]">
            {t("shareEvent")}
          </button>
          {shareNote && (
            <p role="status" className="text-center text-sm font-semibold">
              {t(shareNote)}
            </p>
          )}
        </div>

        <footer className="pt-2 text-center font-medium lg:col-span-2">
          <p>
            {t("madeWith")}{" "}
            <Link href="/" className="font-bold underline">
              Let&apos;s meet!
            </Link>
          </p>
          <Link href="/new" className="mt-1 inline-block min-h-[44px] py-2 font-bold underline">
            {t("createYourEvent")}
          </Link>
        </footer>
      </div>
    </main>
  );
}
