"use client";

import type { MessageKey } from "@/lib/i18n";
import { useLocale } from "@/components/LocaleProvider";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { COVER_BG, COVER_ORDER } from "@/lib/cover";
import { formatKind, KINDS, makeSlug } from "@/lib/format";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { normalizeKaspiLink, normalizePhone } from "@/lib/pay";
import type { CoverColor, Visibility } from "@/lib/types";
import { eventStartIso, fundTarget, type AgentDraft } from "@/lib/event-agent";
import { EventAgent } from "./EventAgent";


export function NewEventForm() {
  const { t, locale } = useLocale();
  const COVER_NAME: Record<CoverColor, string> = { coral: t("coverCoral"), sun: t("coverYellow"), violet: t("coverLilac") };
  const router = useRouter();

  const titleInput = useRef<HTMLInputElement>(null);

  const [kind, setKind] = useState<string>(KINDS[1]);
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [place, setPlace] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [dress, setDress] = useState("");
  const [bring, setBring] = useState("");
  const [moneyOn, setMoneyOn] = useState(false);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalAmount, setGoalAmount] = useState("");
  const [payPhone, setPayPhone] = useState("");
  const [payRecipient, setPayRecipient] = useState("");
  const [payLink, setPayLink] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("link");
  const [cover, setCover] = useState<CoverColor>("coral");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<MessageKey | "">("");

  function applyDraft(draft: AgentDraft) {
    setKind(draft.kind);
    setTitle(draft.title);
    setDescription(draft.description);
    if (draft.starts_at) setStartsAt(draft.starts_at);
    if (draft.location_name) setPlace(draft.location_name);
    if (draft.address) setAddress(draft.address);
    if (draft.dress_code.length) setDress(draft.dress_code.join(", "));
    if (draft.bring.length) setBring(draft.bring.join("\n"));
    const amount = fundTarget(draft.fund);
    if (draft.fund && amount) {
      setMoneyOn(true);
      setGoalAmount(String(amount));
      if (draft.fund.title) setGoalTitle(draft.fund.title);
    }
    titleInput.current?.focus();
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const sb = getBrowserSupabase();
    if (!sb) return;
    if (!title.trim()) return setError("needTitle");
    const startsAtIso = eventStartIso(startsAt);
    if (!startsAtIso) return setError("needDate");
    const amount = Math.round(Number(goalAmount));
    if (moneyOn && (!Number.isFinite(amount) || amount <= 0)) return setError("needGoal");
    const phone = moneyOn ? normalizePhone(payPhone) : null;
    if (moneyOn && payPhone.trim() && !phone) return setError("needPhoneFormat");
    const link = moneyOn && payLink.trim() ? normalizeKaspiLink(payLink) : null;
    if (moneyOn && payLink.trim() && !link) return setError("needKaspiLink");
    if (moneyOn && !phone && !link) return setError("needPaymentDetails");

    setSaving(true);
    const { data: auth } = await sb.auth.getUser();
    if (!auth.user) {
      router.push("/login?next=/new");
      return;
    }

    const payload = {
      host_id: auth.user.id,
      kind,
      title: title.trim(),
      description: description.trim(),
      starts_at: startsAtIso,
      location_name: place.trim(),
      address: address.trim(),
      dress_code: dress
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 8),
      visibility,
      cover_color: cover,
      goal_title: moneyOn ? goalTitle.trim() || null : null,
      goal_amount: moneyOn ? amount : null,
      // Поля оплаты отправляем только при включённом сборе, чтобы создание встречи работало и без миграции 0002.
      ...(moneyOn
        ? { pay_phone: phone, pay_recipient: payRecipient.trim() || null, pay_link: link }
        : {}),
    };

    let slug = makeSlug(title);
    let { data, error: err } = await sb.from("events").insert({ ...payload, slug }).select("id, slug").single();
    if (err?.code === "23505") {
      slug = makeSlug(title);
      ({ data, error: err } = await sb.from("events").insert({ ...payload, slug }).select("id, slug").single());
    }
    if (err || !data) {
      setSaving(false);
      return setError("eventSaveFailed");
    }

    const items = bring
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20)
      .map((label) => ({ event_id: data.id, label: label.slice(0, 80) }));
    if (items.length) await sb.from("bring_items").insert(items);

    router.push(`/dashboard/${data.slug}`);
  }

  return (
    <>
      <EventAgent onApply={applyDraft} />
      <form onSubmit={save} className="mt-6 space-y-5">
        <section className="card bg-sun">
          <h2 className="h-display text-base">{t("eventType")}</h2>
          <div className="mt-3.5 flex flex-wrap gap-2.5">
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => setKind(k)}
                className={`chip ${kind === k ? "bg-ink text-white" : "bg-transparent"}`}
              >
                {formatKind(k, locale)}
              </button>
            ))}
          </div>
        </section>

        <section className="card bg-mint space-y-4">
          <div>
            <label htmlFor="title" className="block font-bold">
              {t("eventTitle")}
            </label>
            <input id="title" ref={titleInput} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required className="field mt-1.5" />
          </div>
          <div>
            <label htmlFor="when" className="block font-bold">
              {t("agentDateTimeAlmaty")}
            </label>
            <input id="when" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required className="field mt-1.5" />
          </div>
          <div>
            <label htmlFor="place" className="block font-bold">
              {t("location")}
            </label>
            <input id="place" value={place} onChange={(e) => setPlace(e.target.value)} maxLength={120} placeholder={t("sampleLocation")} className="field mt-1.5" />
          </div>
          <div>
            <label htmlFor="address" className="block font-bold">
              {t("address")}
            </label>
            <input id="address" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200} placeholder={t("addressExample")} className="field mt-1.5" />
          </div>
          <div>
            <label htmlFor="desc" className="block font-bold">
              {t("description")}
            </label>
            <textarea id="desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} className="field mt-1.5" />
          </div>
        </section>

        <section className="card bg-sky space-y-4">
          <div>
            <label htmlFor="dress" className="block font-bold">
              {t("dressCode")} <span className="font-medium">{t("commaSeparated")}</span>
            </label>
            <input id="dress" value={dress} onChange={(e) => setDress(e.target.value)} placeholder={t("dressExample")} className="field mt-1.5" />
          </div>
          <div>
            <label htmlFor="bring" className="block font-bold">
              {t("whoBringsWhat")} <span className="font-medium">{t("onePerLine")}</span>
            </label>
            <textarea id="bring" rows={3} value={bring} onChange={(e) => setBring(e.target.value)} placeholder={[t("cake"), t("drinks"), t("speaker")].join("\n")} className="field mt-1.5" />
          </div>
        </section>

        <section className="card bg-pink">
          <label className="flex min-h-[44px] items-center justify-between gap-3 font-bold">
            {t("collectMoney")}
            <input type="checkbox" checked={moneyOn} onChange={(e) => setMoneyOn(e.target.checked)} className="h-6 w-6 accent-ink" />
          </label>
          {moneyOn && (
            <div className="mt-3 space-y-3">
              <div>
                <label htmlFor="goalTitle" className="block text-sm font-bold">
                  {t("fundPurpose")}
                </label>
                <input id="goalTitle" value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)} placeholder={t("giftFund")} className="field mt-1" />
              </div>
              <div>
                <label htmlFor="goalAmount" className="block text-sm font-bold">
                  {t("fundTarget")}
                </label>
                <input id="goalAmount" inputMode="numeric" value={goalAmount} onChange={(e) => setGoalAmount(e.target.value)} placeholder="20000" className="field mt-1" />
              </div>
              <div>
                <label htmlFor="payPhone" className="block text-sm font-bold">
                  {t("personalPhone")}
                </label>
                <input id="payPhone" type="tel" inputMode="tel" autoComplete="tel" value={payPhone} onChange={(e) => setPayPhone(e.target.value)} placeholder="+7 707 123 45 67" className="field mt-1" />
              </div>
              <div>
                <label htmlFor="payRecipient" className="block text-sm font-bold">
                  {t("recipientDisplayName")} <span className="font-medium">{t("optional")}</span>
                </label>
                <input id="payRecipient" value={payRecipient} onChange={(e) => setPayRecipient(e.target.value)} maxLength={60} placeholder={t("recipientExample")} className="field mt-1" />
              </div>
              <div>
                <label htmlFor="payLink" className="block text-sm font-bold">
                  {t("kaspiPayLink")}
                </label>
                <input id="payLink" type="url" inputMode="url" value={payLink} onChange={(e) => setPayLink(e.target.value)} placeholder="https://kaspi.kz/..." className="field mt-1" />
                <p className="mt-1 text-sm font-medium">{t("kaspiBusinessHint")}</p>
              </div>
              <p className="text-sm font-medium">
                {t("paySetupHint")}
              </p>
            </div>
          )}
        </section>

        <section className="card bg-sun">
          <h2 className="h-display text-base">{t("eventVisibility")}</h2>
          <div className="mt-3.5 grid grid-cols-2 gap-2.5">
            {(
              [
                ["link", t("linkOnly")],
                ["public", t("publicEvent")],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                aria-pressed={visibility === v}
                onClick={() => setVisibility(v)}
                className={`min-h-[48px] rounded-full border-2 border-ink font-bold ${visibility === v ? "bg-ink text-white" : "bg-transparent"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <h2 className="h-display mt-5 text-base">{t("coverColor")}</h2>
          <div className="mt-3.5 flex gap-3">
            {COVER_ORDER.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={cover === c}
                aria-label={COVER_NAME[c]}
                onClick={() => setCover(c)}
                className={`h-11 w-11 rounded-full border-2 border-ink ${COVER_BG[c]} ${cover === c ? "ring-4 ring-ink/30" : ""}`}
              />
            ))}
          </div>
        </section>

        {error && (
          <p role="alert" className="rounded-2xl border-2 border-ink bg-coral p-3.5 font-semibold">
            {t(error)}
          </p>
        )}
        <button disabled={saving} className="btn-sun btn-big w-full disabled:opacity-60">
          {saving ? t("saving") : t("publishEvent")}
        </button>
      </form>
    </>
  );
}
