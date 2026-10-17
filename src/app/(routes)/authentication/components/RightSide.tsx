"use client";

import React from "react";

interface LoginContentData {
  mainTitle: string;
  highlightedTitle: string;
  description: string;
  stats: { value: string; label: string }[];
  features: string[];
}

// Previously overridable from the "login-content" CMS page. That admin section
// went away with the storefront, so this copy is now the single source.
const content: LoginContentData = {
  mainTitle: "Mirpur Mobile",
  highlightedTitle: "& Stationery",
  description:
    "Genuine handsets, accessories and stationery — sold and served over the counter every day",
  stats: [
    { value: "10K+", label: "Orders Served" },
    { value: "15+", label: "Years Trading" },
    { value: "100%", label: "Genuine Stock" },
  ],
  features: [
    "Genuine Products",
    "Fast Counter Service",
    "Transparent Pricing",
  ],
};

export const RightSide: React.FC = () => {
  return (
    <div className="hidden lg:block lg:w-1/2 relative overflow-hidden">
      {/* Premium red gradient panel */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#dc2626] via-[#b91c1c] to-[#991b1b]"></div>

      {/* Soft white radial glow */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 60% 40%, rgba(255,255,255,0.18) 0%, transparent 60%)",
        }}
      ></div>

      {/* Subtle grid texture */}
      <div className="absolute inset-0 opacity-[0.09]">
        <div
          className="h-full w-full"
          style={{
            backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="%23ffffff" stroke-width="0.8"/></svg>')`,
          }}
        ></div>
      </div>

      {/* Main content */}
      <div className="relative z-20 h-full flex flex-col justify-center items-center text-white p-4 lg:p-6">
        <div className="text-center max-w-md">
          <div className="mb-3 lg:mb-4">
            <div className="w-12 h-12 lg:w-16 lg:h-16 bg-white rounded-xl lg:rounded-2xl flex items-center justify-center mx-auto mb-3 lg:mb-4 shadow-2xl shadow-black/20 ring-1 ring-white/30">
              {/* Smartphone icon */}
              <svg
                className="w-6 h-6 lg:w-8 lg:h-8 text-[#dc2626]"
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
            <div className="inline-block px-3 py-1 rounded-full bg-white/10 border border-white/30 text-[10px] font-semibold tracking-[0.2em] text-white uppercase backdrop-blur-sm">
              Point of Sale
            </div>
          </div>

          <h2 className="text-xl lg:text-3xl font-black mb-3 lg:mb-4 text-white font-sans leading-tight drop-shadow-lg">
            {content.mainTitle}
            <span className="block text-white/95">{content.highlightedTitle}</span>
          </h2>

          <p className="text-sm lg:text-base text-white/85 mb-4 lg:mb-6 font-medium leading-relaxed drop-shadow">
            {content.description}
          </p>

          <div className="grid grid-cols-3 gap-3 lg:gap-4 text-center">
            {content.stats.map((stat, index) => (
              <div key={index}>
                <div className="text-lg lg:text-2xl font-black text-white mb-0.5 lg:mb-1 drop-shadow">
                  {stat.value}
                </div>
                <div className="text-[10px] lg:text-xs font-bold text-white/80 uppercase tracking-wider">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          {/* Features */}
          <div className="mt-4 lg:mt-6 space-y-1.5 lg:space-y-2">
            {content.features.map((feature, index) => (
              <div
                key={index}
                className="flex items-center justify-center space-x-1.5 lg:space-x-2 text-white/90"
              >
                <svg
                  className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-white flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-xs lg:text-sm font-medium">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom accent */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white/70 to-transparent"></div>
    </div>
  );
};

export default RightSide;
