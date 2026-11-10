"use client";

import React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { IdCard } from "lucide-react";
import { Wordmark } from "@/components/ui/wordmark";
import { LoginForm, safeNext } from "./components/LoginForm";

// Staff sign-in, styled like the shop sign: lit letters on a black fascia.
const AuthPage: React.FC = () => {
  const next = safeNext(useSearchParams()?.get("next"));
  // Opened from the "Employee Portal" button (or a /portal link).
  const portal = !!next && next.startsWith("/portal");

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
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-white/60">
            {portal ? "Employee Portal" : "Point of Sale"}
          </p>
        </div>

        <div className="w-full rounded-xl bg-white p-5 shadow-2xl shadow-black/40 sm:p-6">
          <LoginForm next={next} portal={portal} />
        </div>

        {portal ? (
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
            ? "See your attendance, salary and bonuses. Use the login the shop admin gave you."
            : "Staff: see your attendance and salary in the Employee Portal."}
        </p>
        <p className="mt-4 text-center text-xs text-white/40">
          Staff accounts are created by the shop admin.
        </p>
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
