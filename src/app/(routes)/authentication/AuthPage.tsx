"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { IdCard } from "lucide-react";
import { Wordmark } from "@/components/ui/wordmark";
import { isPortalHost } from "@/lib/portalHost";
import { LoginForm, safeNext } from "./components/LoginForm";
import { PortalOtpForm } from "./components/PortalOtpForm";

// Staff sign-in, styled like the shop sign: lit letters on a black fascia.
const AuthPage: React.FC = () => {
  const asked = safeNext(useSearchParams()?.get("next"));
  // employee.dollarandco.org: only the Employee Portal sign-in, never the POS login.
  const [portalHost, setPortalHost] = useState(false);
  useEffect(() => setPortalHost(isPortalHost()), []);
  const next = portalHost && !(asked && asked.startsWith("/portal")) ? "/portal" : asked;
  // Opened from the "Employee Portal" button (or a /portal link), or on the employee address.
  const portal = portalHost || (!!next && next.startsWith("/portal"));

  return (
    <div className="relative min-h-screen overflow-hidden bg-brand-ink">
      {/* Warm shelf-light glow behind the sign */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(255,214,10,0.16) 0%, transparent 60%)",
        }}
      />

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-sm flex-col items-center justify-center px-4 py-10">
        <div className="mb-8 text-center">
          <h1>
            <Wordmark className="text-4xl sm:text-5xl" />
          </h1>
          {portal ? (
            <div className="mt-5 flex flex-col items-center">
              <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-yellow text-brand-ink shadow-lg shadow-brand-yellow/20">
                <IdCard className="h-6 w-6" />
              </span>
              <p className="text-3xl font-black uppercase tracking-wide text-brand-yellow sm:text-4xl">Employee Portal</p>
              <p className="mt-1.5 text-sm text-white/70">Your attendance, salary and payslips</p>
            </div>
          ) : (
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-white/60">Point of Sale</p>
          )}
        </div>

        <div className="w-full rounded-xl bg-white p-5 shadow-2xl shadow-black/40 sm:p-6">
          {portal ? <PortalOtpForm next={next} /> : <LoginForm next={next} />}
        </div>

        {portalHost ? null : portal ? (
          <Link
            href="/authentication"
            className="mt-5 text-center text-xs font-medium text-white/60 underline-offset-2 hover:text-white hover:underline"
          >
            Open the POS instead
          </Link>
        ) : (
          <Link
            href="/portal"
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-brand-yellow/60 bg-white/5 px-4 py-2.5 text-sm font-bold text-brand-yellow transition-colors hover:bg-brand-yellow hover:text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:ring-offset-2 focus:ring-offset-brand-ink"
          >
            <IdCard className="h-4 w-4" />
            Employee Portal
          </Link>
        )}
        <p className="mt-3 text-center text-[11px] text-white/40">
          {portal
            ? "Only employees with Active status can sign in. Wrong or missing email? Ask the shop admin."
            : "Staff: see your attendance and salary in the Employee Portal."}
        </p>
        {!portal && (
          <p className="mt-4 text-center text-xs text-white/40">
            Staff accounts are created by the shop admin.
          </p>
        )}
      </main>

      {/* Thin lit strip, like the LED line under the sign */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-brand-yellow/70 to-transparent"
      />
    </div>
  );
};

export default AuthPage;
