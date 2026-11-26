"use client";

import { useState, type FormEvent } from "react";
import { useLocale } from "@/components/LocaleProvider";
import type { MessageKey } from "@/lib/i18n";
import { getBrowserSupabase } from "@/lib/supabase/client";

const modes = [
  { value: "password", label: "signInTab" },
  { value: "register", label: "registerTab" },
  { value: "link", label: "signInLinkTab" },
] as const;
type Mode = (typeof modes)[number]["value"];

export function LoginForm({ next }: { next?: string }) {
  const { t } = useLocale();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<MessageKey | "">("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const sb = getBrowserSupabase();
    if (!sb || busy) return;

    setError("");
    setBusy(true);
    const origin = window.location.origin;
    const target = next?.startsWith("/") && !next.startsWith("//") && !/[\\\u0000-\u0020]/u.test(next) ? next : "/dashboard";
    const emailRedirectTo = `${origin}/auth/callback?next=${encodeURIComponent(target)}`;
    const cleanEmail = email.trim().toLowerCase();
    try {
      if (mode === "link") {
        const { error: failure } = await sb.auth.signInWithOtp({
          email: cleanEmail,
          options: { emailRedirectTo },
        });
        if (failure) setError(failure.status === 429 ? "loginRateLimit" : "loginError");
        else setSent(true);
        return;
      }
      if (mode === "register") {
        const { data, error: failure } = await sb.auth.signUp({
          email: cleanEmail, password, options: { emailRedirectTo },
        });
        if (failure) {
          setError(failure.status === 429 ? "loginRateLimit" : "registerFailed");
          return;
        }
        if (!data.session) {
          setSent(true);
          return;
        }
      } else {
        const { error: failure } = await sb.auth.signInWithPassword({ email: cleanEmail, password });
        if (failure) {
          const key = failure.status === 429 ? "tooManyAttempts"
            : failure.code === "invalid_credentials" ? "wrongCredentials" : "signInFailed";
          setError(key);
          return;
        }
      }
      window.location.assign(target);
    } catch {
      setError(mode === "register" ? "registerFailed" : mode === "link" ? "loginError" : "signInFailed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-2" role="group" aria-label={t("organizerLogin")}>
        {modes.map(({ value, label }) => (
          <button key={value} type="button" aria-pressed={mode === value} disabled={busy}
            onClick={() => {
              setMode(value);
              setPassword("");
              setShowPassword(false);
              setSent(false);
              setError("");
            }}
            className={`min-h-[44px] rounded-full border-2 border-ink px-4 font-bold ${mode === value ? "bg-ink text-white" : "bg-transparent"}`}>
            {t(label)}
          </button>
        ))}
      </div>

      {sent ? (
        <p className="mt-6 rounded-2xl border-2 border-ink bg-sun p-4 font-semibold" role="status">
          {t("loginCheckInbox")}
        </p>
      ) : (
        <form onSubmit={submit} className="mt-5 flex flex-col gap-3">
          <label htmlFor="email" className="font-bold">{t("email")}</label>
          <input id="email" type="email" required autoComplete="email" value={email}
            onChange={event => setEmail(event.target.value)} placeholder="name@example.com" className="field" />
          {mode !== "link" && (
            <>
              <label htmlFor="password" className="font-bold">{t("password")}</label>
              <div className="flex gap-2">
                <input id="password" type={showPassword ? "text" : "password"} required
                  minLength={mode === "register" ? 8 : undefined}
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  value={password} onChange={event => setPassword(event.target.value)} className="field min-w-0 flex-1" />
                <button type="button" onClick={() => setShowPassword(value => !value)}
                  className="chip bg-transparent" aria-pressed={showPassword}>
                  {showPassword ? t("hidePassword") : t("showPassword")}
                </button>
              </div>
              {mode === "register" && <p className="text-sm font-medium">{t("passwordHint")}</p>}
            </>
          )}
          {error && (
            <p role="alert" className="rounded-2xl border-2 border-ink bg-coral px-4 py-3 font-semibold">{t(error)}</p>
          )}
          <button disabled={busy} className="btn-sun btn-big mt-2 disabled:opacity-60">
            {t(busy ? "signingIn" : mode === "register" ? "createAccount" : mode === "link" ? "getLoginLink" : "signInButton")}
          </button>
        </form>
      )}
    </div>
  );
}
