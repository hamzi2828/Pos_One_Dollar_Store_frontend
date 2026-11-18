"use client";

// Employee Portal sign in without a password: type the email on your employee
// record -> we email a 6-digit code -> type it -> portal opens.
// Backend: POST /api/portal/login/request-code and /api/portal/login/verify
// (pos_backend/src/services/hr/portalLoginService.js). The token it gives opens
// only the Employee Portal.
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Mail } from "lucide-react";
import { setRole, setToken } from "@/helper/helper";
import { setStoredAccess } from "@/helper/access";
import { safeNext } from "./LoginForm";

const API = `${process.env.NEXT_PUBLIC_BACKEND_URL || ""}/api/portal/login`;
const CODE_LENGTH = 6;

type Step = "email" | "code";

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw Object.assign(new Error("No internet. Check the connection and try again."), { wait: 0 });
  }
  let json: { success?: boolean; data?: T; message?: string; available?: number } = {};
  try {
    json = await res.json();
  } catch {}
  if (!res.ok || !json.success) {
    throw Object.assign(new Error(json.message || "Something went wrong. Please try again."), {
      wait: res.status === 429 && typeof json.available === "number" ? json.available : 0,
    });
  }
  return json.data as T;
}

const maskEmail = (email: string) => {
  const [user, domain] = email.split("@");
  if (!domain) return email;
  const shown = user.length <= 2 ? user[0] || "" : user.slice(0, 2);
  return `${shown}${"•".repeat(Math.max(1, Math.min(6, user.length - shown.length)))}@${domain}`;
};

export const PortalOtpForm: React.FC<{ next?: string | null }> = ({ next = null }) => {
  const router = useRouter();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [digits, setDigits] = useState<string[]>(() => Array(CODE_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(10);
  const [cooldown, setCooldown] = useState(0);
  const lockRef = useRef(false);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  // Resend countdown.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (step === "code") inputsRef.current[0]?.focus();
  }, [step]);

  const run = async (fn: () => Promise<void>) => {
    if (lockRef.current) return;
    lockRef.current = true;
    setLoading(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      const err = e as Error & { wait?: number };
      setError(err.message);
      if (err.wait) setCooldown(err.wait);
    } finally {
      lockRef.current = false;
      setLoading(false);
    }
  };

  const sendCode = (resend = false) =>
    run(async () => {
      const value = email.trim().toLowerCase();
      if (!value) throw new Error("Enter your email.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error("This email is not valid.");
      const data = await post<{ minutes: number; resendSeconds: number }>("/request-code", { email: value });
      setEmail(value);
      setMinutes(data.minutes || 10);
      setCooldown(data.resendSeconds || 60);
      setDigits(Array(CODE_LENGTH).fill(""));
      setStep("code");
      setNotice(resend ? "A new code is on its way. Use the newest email." : null);
      if (resend) inputsRef.current[0]?.focus();
    });

  const verify = (code: string) =>
    run(async () => {
      if (code.length !== CODE_LENGTH) throw new Error(`Enter the ${CODE_LENGTH}-digit code from the email.`);
      const data = await post<{ token: string }>("/verify", { email, code });
      setToken(data.token);
      // Not an admin login: the admin panel stays closed; no staff permissions.
      setRole("user");
      setStoredAccess(null);
      const target = safeNext(next);
      router.replace(target && target.startsWith("/portal") ? target : "/portal");
      // Keep the button locked while the portal opens.
      lockRef.current = true;
      setLoading(true);
      await new Promise(() => {});
    }).catch(() => {});

  const setDigitAt = (index: number, raw: string) => {
    const clean = raw.replace(/\D/g, "");
    if (!clean) {
      setDigits((d) => d.map((v, i) => (i === index ? "" : v)));
      return;
    }
    // Typed or pasted several digits: fill from here.
    const next = [...digits];
    let i = index;
    for (const ch of clean) {
      if (i >= CODE_LENGTH) break;
      next[i++] = ch;
    }
    setDigits(next);
    setError(null);
    const code = next.join("");
    if (code.length === CODE_LENGTH && !next.includes("")) {
      inputsRef.current[CODE_LENGTH - 1]?.blur();
      verify(code);
    } else {
      inputsRef.current[Math.min(i, CODE_LENGTH - 1)]?.focus();
    }
  };

  const onKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      e.preventDefault();
      setDigits((d) => d.map((v, i) => (i === index - 1 ? "" : v)));
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < CODE_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const errorBox = error && (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
      <p className="text-xs font-medium text-red-700">{error}</p>
    </div>
  );

  const buttonClass =
    "flex w-full items-center justify-center gap-2 rounded-lg bg-brand-yellow py-2.5 text-sm font-bold text-brand-ink shadow-sm transition-colors hover:bg-yellow-300 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70";

  if (step === "email") {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendCode(false);
        }}
        className="w-full space-y-4"
        noValidate
      >
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900">Sign in with your email</h2>
          <p className="mt-1 text-xs text-gray-500">We&apos;ll email you a {CODE_LENGTH}-digit code. No password needed.</p>
        </div>

        {errorBox}

        <div className="space-y-1.5">
          <label htmlFor="portal-email" className="block text-xs font-semibold text-gray-700">
            Email
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              id="portal-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={loading}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-gray-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:opacity-60"
            />
          </div>
          <p className="text-[11px] text-gray-500">Use the email the shop saved on your employee record.</p>
        </div>

        <button type="submit" disabled={loading || cooldown > 0} aria-busy={loading} className={buttonClass}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending code…
            </>
          ) : cooldown > 0 ? (
            `Wait ${cooldown}s`
          ) : (
            "Send me a code"
          )}
        </button>
      </form>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        verify(digits.join(""));
      }}
      className="w-full space-y-4"
      noValidate
    >
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900">Enter your code</h2>
        <p className="mt-1 text-xs text-gray-500">
          We sent a {CODE_LENGTH}-digit code to <b className="text-gray-800">{maskEmail(email)}</b>. It works for {minutes} minutes.
        </p>
      </div>

      {notice && !error && (
        <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
          <p className="text-xs font-medium text-green-800">{notice}</p>
        </div>
      )}
      {errorBox}

      <fieldset disabled={loading} className="flex justify-center gap-1.5 sm:gap-2">
        <legend className="sr-only">Sign-in code</legend>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              inputsRef.current[i] = el;
            }}
            value={d}
            onChange={(e) => setDigitAt(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)}
            onPaste={(e) => {
              e.preventDefault();
              setDigitAt(i, e.clipboardData.getData("text"));
            }}
            onFocus={(e) => e.target.select()}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={CODE_LENGTH}
            aria-label={`Digit ${i + 1}`}
            className="h-12 w-10 sm:h-14 sm:w-12 rounded-lg border-2 border-gray-200 bg-gray-50 text-center font-mono text-xl sm:text-2xl font-bold text-gray-900 transition-colors focus:border-brand-yellow focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-yellow/40 disabled:opacity-60"
          />
        ))}
      </fieldset>

      <button type="submit" disabled={loading} aria-busy={loading} className={buttonClass}>
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking…
          </>
        ) : (
          "Open my portal"
        )}
      </button>

      <div className="flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={() => {
            setStep("email");
            setError(null);
            setNotice(null);
          }}
          disabled={loading}
          className="inline-flex items-center gap-1 font-medium text-gray-500 hover:text-gray-900 disabled:opacity-60"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Change email
        </button>
        <button
          type="button"
          onClick={() => sendCode(true)}
          disabled={loading || cooldown > 0}
          className="font-semibold text-honey-700 hover:underline disabled:cursor-not-allowed disabled:text-gray-400 disabled:no-underline"
        >
          {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </button>
      </div>
      <p className="text-center text-[11px] text-gray-400">Not in your inbox? Check the Spam / Junk folder.</p>
    </form>
  );
};

export default PortalOtpForm;
