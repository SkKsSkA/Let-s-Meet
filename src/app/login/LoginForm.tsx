"use client";

import { useLocale } from "@/components/LocaleProvider";
import type { MessageKey } from "@/lib/i18n";
import { useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";

type Mode = "login" | "register";

const REGISTER_ERRORS: Record<string, MessageKey> = {
  exists: "accountExists",
  weak_password: "passwordTooShort",
  bad_email: "badEmail",
  rate_limited: "tooManyAttempts",
  not_configured: "registerNotConfigured",
};

export function LoginForm({ next }: { next?: string }) {
  const { t } = useLocale();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | "">("");

  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const sb = getBrowserSupabase();
    if (!sb) return;
    setError("");
    if (password.length < 8) return setError("passwordTooShort");
    const cleanEmail = email.trim().toLowerCase();
    setBusy(true);
    try {
      if (mode === "register") {
        // Аккаунт создаёт сервер, письмо не отправляется.
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: cleanEmail, password }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          setError(REGISTER_ERRORS[body.error ?? ""] ?? "registerFailed");
          return;
        }
      }
      const { error: err } = await sb.auth.signInWithPassword({ email: cleanEmail, password });
      if (err) {
        setError(/invalid login credentials/i.test(err.message) ? "wrongCredentials" : "signInFailed");
        return;
      }
      // Полная перезагрузка, чтобы сервер сразу увидел новую сессию.
      window.location.assign(target);
    } catch {
      setError("signInFailed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6">
      <div className="grid grid-cols-2 gap-2.5" role="tablist" aria-label={t("organizerLogin")}>
        {(["login", "register"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setError("");
            }}
            className={`min-h-[44px] rounded-full border-2 border-ink font-bold ${mode === m ? "bg-ink text-white" : "bg-transparent"}`}
          >
            {m === "login" ? t("signInTab") : t("registerTab")}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-5 flex flex-col gap-3">
        <label htmlFor="email" className="font-bold">
          {t("email")}
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          className="field"
        />
        <label htmlFor="password" className="font-bold">
          {t("password")}
        </label>
        <div className="flex gap-2">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            required
            minLength={8}
            maxLength={72}
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field min-w-0 flex-1"
          />
          <button type="button" onClick={() => setShowPassword((v) => !v)} className="chip bg-transparent" aria-pressed={showPassword}>
            {showPassword ? t("hidePassword") : t("showPassword")}
          </button>
        </div>
        {mode === "register" && <p className="text-sm font-medium">{t("passwordHint")}</p>}
        {error && (
          <p role="alert" className="rounded-2xl border-2 border-ink bg-coral px-4 py-3 font-semibold">
            {t(error)}
          </p>
        )}
        <button disabled={busy} className="btn-sun btn-big mt-2 disabled:opacity-60">
          {busy ? t("signingIn") : mode === "login" ? t("signInButton") : t("createAccount")}
        </button>
      </form>
    </div>
  );
}
