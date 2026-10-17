"use client";

import React from "react";
import { RightSide } from "./components/RightSide";
import { LoginForm } from "./components/LoginForm";

const AuthPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-gradient-to-br from-[#dc2626] via-[#b91c1c] to-[#991b1b] lg:from-gray-50 lg:via-gray-50 lg:to-gray-50 relative overflow-hidden">
      {/* === Mobile background texture (hidden on lg+) === */}
      <div className="lg:hidden pointer-events-none absolute inset-0 overflow-hidden">
        {/* Subtle grid */}
        <div className="absolute inset-0 opacity-[0.08]">
          <div
            className="h-full w-full"
            style={{
              backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><path d="M 32 0 L 0 0 0 32" fill="none" stroke="%23ffffff" stroke-width="0.6"/></svg>')`,
            }}
          />
        </div>

        {/* Radial glow */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 50% 35%, rgba(255,255,255,0.18) 0%, transparent 65%)",
          }}
        />
      </div>

      {/* Mobile branded header - hidden on desktop */}
      <div className="lg:hidden relative overflow-hidden pt-8 pb-6 px-4 text-center z-10">
        {/* Subtle radial glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 50% 30%, rgba(255,255,255,0.18) 0%, transparent 70%)",
          }}
        />
        <div className="relative z-10">
          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-black/20">
            {/* Smartphone icon */}
            <svg
              className="w-6 h-6 text-[#dc2626]"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <rect x="6" y="2" width="12" height="20" rx="2.5" />
              <line x1="10" y1="5.5" x2="14" y2="5.5" strokeLinecap="round" />
              <circle cx="12" cy="18.5" r="1.1" fill="currentColor" stroke="none" />
            </svg>
          </div>
          <div className="inline-block px-3 py-1 rounded-full bg-white/10 border border-white/30 text-[10px] font-semibold tracking-[0.2em] text-white uppercase mb-2 backdrop-blur-sm">
            Hamza Mobile &amp; Communication
          </div>
          <h2 className="text-xl font-black text-white leading-tight">
            Mobiles, Accessories &amp; Stationery
          </h2>

          {/* Feature pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
            {[
              { icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", label: "Genuine Products" },
              { icon: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z", label: "Fast Service" },
              { icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z", label: "Fair Pricing" },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/25 backdrop-blur-sm"
              >
                <svg className="w-3.5 h-3.5 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                </svg>
                <span className="text-[11px] font-semibold text-white/90">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Left Side - custom staff login form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-6 py-4 relative z-10">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-xl border border-white/10 lg:border-gray-200 p-5 shadow-xl lg:shadow-sm">
            <LoginForm />
          </div>
        </div>
      </div>

      {/* Mobile footer stats - hidden on desktop */}
      <div className="lg:hidden pt-2 pb-6 px-6 relative z-10">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-lg font-black text-white drop-shadow">10K+</div>
            <div className="text-[10px] font-bold text-white/75 uppercase tracking-wider">Orders Served</div>
          </div>
          <div>
            <div className="text-lg font-black text-white drop-shadow">15+</div>
            <div className="text-[10px] font-bold text-white/75 uppercase tracking-wider">Years Trading</div>
          </div>
          <div>
            <div className="text-lg font-black text-white drop-shadow">100%</div>
            <div className="text-[10px] font-bold text-white/75 uppercase tracking-wider">Genuine Stock</div>
          </div>
        </div>
      </div>

      {/* Right Side - brand panel (desktop only) */}
      <RightSide />
    </div>
  );
};

export default AuthPage;
