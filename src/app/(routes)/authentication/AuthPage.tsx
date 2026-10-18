"use client";

import React from "react";
import { Wordmark } from "@/components/ui/wordmark";
import { LoginForm } from "./components/LoginForm";

// Staff sign-in, styled like the shop sign: lit letters on a black fascia.
const AuthPage: React.FC = () => {
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
            Point of Sale
          </p>
        </div>

        <div className="w-full rounded-xl bg-white p-5 shadow-2xl shadow-black/40 sm:p-6">
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs text-white/40">
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
