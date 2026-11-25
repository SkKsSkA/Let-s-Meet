"use client";

import { useState, type FormEvent } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { eventStartIso, fundAmount, fundTarget, type AgentDraft } from "@/lib/event-agent";
import { formatDate, formatKind, formatMoney, formatTime, mapLink } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n";

type Step = "request" | "when" | "where" | "fund" | "review" | "applied";

function nextStep(draft: AgentDraft, venueSkipped: boolean): Step {
  if (!draft.starts_at) return "when";
  if (!draft.location_name && !draft.address && !venueSkipped) return "where";
  if (draft.fund && !fundTarget(draft.fund)) return "fund";
  return "review";
}

export function EventAgent({ onApply }: { onApply: (draft: AgentDraft) => void }) {
  const { locale, t } = useLocale();
  const [step, setStep] = useState<Step>("request");
  const [draft, setDraft] = useState<AgentDraft | null>(null);
  const [prompt, setPrompt] = useState("");
  const [place, setPlace] = useState("");
  const [total, setTotal] = useState("");
  const [busy, setBusy] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [notice, setNotice] = useState<MessageKey | "">("");

  const perGuest = draft?.fund?.perGuest;
  const askGuestCount = Boolean(perGuest && !draft?.fund?.guestCount);
  const estimate = perGuest ?? draft?.estimatePerGuest;
  const target = draft ? fundTarget(draft.fund) : null;
  const when = draft?.starts_at ? eventStartIso(draft.starts_at) : null;

  function move(next: AgentDraft, skipVenue = false) {
    setDraft(next);
    setStep(nextStep(next, skipVenue));
    setNotice("");
  }

  function reset() {
    setDraft(null);
    setStep("request");
    setPlace("");
    setTotal("");
    setNotice("");
    setFallback(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    if (step === "request") {
      setNotice("");
      setBusy(true);
      try {
        const response = await fetch("/api/ai/draft", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ prompt, mode: "agent" }),
        });
        if (!response.ok) {
          setNotice(response.status === 401 ? "agentSignIn" : response.status === 400 ? "draftLength" : "draftFailed");
          return;
        }
        const result = (await response.json()) as { draft: AgentDraft; source: "ai" | "fallback" };
        setFallback(result.source === "fallback");
        move(result.draft);
      } catch {
        setNotice("draftOffline");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!draft) return;
    if (step === "when") {
      const details = new FormData(event.currentTarget);
      const starts_at = `${details.get("date")}T${String(details.get("time")).slice(0, 5)}`;
      if (!eventStartIso(starts_at)) return setNotice("needDate");
      move({ ...draft, starts_at });
    } else if (step === "where") {
      if (place.trim()) move({ ...draft, location_name: place.trim() });
    } else if (step === "fund" && draft.fund) {
      const value = Number(total.replace(/\s/g, ""));
      const amount = fundAmount(askGuestCount ? value * (perGuest ?? 0) : value);
      if (!Number.isSafeInteger(value) || !amount) return setNotice(askGuestCount ? "agentCountInvalid" : "agentAmountInvalid");
      move({ ...draft, fund: { ...draft.fund, total: amount } }, true);
    } else if (step === "review") {
      onApply(draft);
      setStep("applied");
    }
  }

  return (
    <form onSubmit={submit} className="card-pop mt-6 space-y-3 bg-violet" aria-labelledby="agent-title">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 id="agent-title" className="h-display text-xl">{t("agentTitle")}</h2>
        {step !== "request" && <button type="button" className="chip bg-transparent" onClick={reset}>{t("agentRestart")}</button>}
      </div>
      {step === "request" && (
        <>
          <p>{t("agentIntro")}</p>
          <label htmlFor="agent-prompt" className="sr-only">{t("eventDescription")}</label>
          <textarea id="agent-prompt" className="field" rows={3} maxLength={600} value={prompt} disabled={busy}
            onChange={(event) => setPrompt(event.target.value)} placeholder={t("agentExample")} />
          <button type="submit" className="btn-sun w-full disabled:opacity-60" disabled={busy || prompt.trim().length < 3}>
            {busy ? t("drafting") : t("agentStart")}
          </button>
        </>
      )}
      {draft && step !== "applied" && (
        <section className="space-y-3 rounded-2xl border-2 border-ink bg-white/75 p-4" aria-label={t("agentPlan")}>
          <p role="status" className="font-bold">{t(fallback ? "draftFallback" : "draftGemini")}</p>
          <p className="text-sm font-semibold">{formatKind(draft.kind, locale)}</p>
          <h3 className="h-display text-xl">{draft.title}</h3>
          {draft.description && <p>{draft.description}</p>}
          <dl className="space-y-3">
            <div><dt className="font-bold">{t("location")}</dt><dd>{[draft.location_name, draft.address].filter(Boolean).join(", ") || t("venueTbd")}</dd>
              {draft.venueSearch && <dd><a href={mapLink(draft.venueSearch, "")} target="_blank" rel="noreferrer" className="font-semibold underline">{t("agentVenueSearch")}</a></dd>}
            </div>
            {draft.dress_code.length > 0 && <div><dt className="font-bold">{t("dressCode")}</dt><dd>{draft.dress_code.join(", ")}</dd></div>}
            {draft.bring.length > 0 && <div><dt className="font-bold">{t("whoBringsWhat")}</dt><dd>{draft.bring.join(", ")}</dd></div>}
            {!draft.fund?.total && estimate != null && (
              <div><dt className="font-bold">{t("agentEstimate")}</dt>
                <dd>{formatMoney(estimate, locale)}</dd>
              </div>
            )}
          </dl>
          {when && <p>{formatDate(when, locale)} · {formatTime(when, locale)}</p>}
          {target && <p className="font-bold">{t("agentFundSummary", { amount: formatMoney(target, locale) })}</p>}
        </section>
      )}
      {step === "when" && (
        <>
          <p role="status" className="font-bold">{t("agentAskWhen")}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="min-w-0">{t("agentDate")}<input type="date" name="date" required defaultValue={draft?.date_hint ?? ""} className="field mt-1" /></label>
            <label className="min-w-0">{t("agentTime")}<input type="time" name="time" required className="field mt-1" /></label>
          </div>
          <button className="btn-sun w-full">{t("agentContinue")}</button>
        </>
      )}
      {step === "where" && draft && (
        <>
          <label htmlFor="agent-place" className="block font-bold">{t("agentAskWhere")}</label>
          <input id="agent-place" className="field" required maxLength={120} value={place} onChange={(event) => setPlace(event.target.value)} />
          <div className="flex flex-wrap gap-2">
            <button className="btn-sun">{t("agentContinue")}</button>
            <button type="button" className="chip bg-transparent" onClick={() => move(draft, true)}>{t("agentSkipPlace")}</button>
          </div>
        </>
      )}
      {step === "fund" && draft && (
        <>
          {perGuest && <p>{t("agentPerGuest", { amount: formatMoney(perGuest, locale) })}</p>}
          <label htmlFor="agent-total" className="block font-bold">{t(askGuestCount ? "agentGuestCount" : "agentAskFund")}</label>
          <input id="agent-total" className="field" inputMode="numeric" required maxLength={12} value={total}
            onChange={(event) => setTotal(event.target.value)} />
          <div className="flex flex-wrap gap-2">
            <button className="btn-sun">{t("agentContinue")}</button>
            <button type="button" className="chip bg-transparent" onClick={() => move({ ...draft, fund: null }, true)}>{t("agentSkipFund")}</button>
          </div>
        </>
      )}
      {step === "review" && draft && (
        <>
          {!draft.fund && Boolean(draft.estimatePerGuest) && (
            <button type="button" className="chip bg-transparent" onClick={() => move({
              ...draft,
              fund: { title: "", total: null, perGuest: draft.estimatePerGuest ?? null, guestCount: null },
            }, true)}>{t("agentUseEstimate")}</button>
          )}
          <button className="btn-sun w-full">{t("agentApply")}</button>
        </>
      )}
      {step === "applied" && <p role="status" className="rounded-2xl bg-ink p-3 font-semibold text-white">{t("agentApplied")}</p>}
      {notice && <p role="alert" className="font-bold">{t(notice)}</p>}
    </form>
  );
}
