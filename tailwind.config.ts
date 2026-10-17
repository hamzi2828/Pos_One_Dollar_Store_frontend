import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // HK Auto Care Brand Colors (Premium Red, Platinum, Black)
        sage: {
          50: '#fafaf9',
          100: '#f5f5f4',
          200: '#e7e5e4',
          300: '#D6D3D1', // Primary - Warm Platinum
          400: '#A8A29E',
          500: '#78716C',
          600: '#57534E',
          700: '#44403C',
          800: '#373534',
          900: '#2C2A29',
        },
        charcoal: {
          DEFAULT: '#141414', // Primary Text - Rich Black
          50: '#f7f7f7',
          100: '#ededed',
          200: '#d4d4d4',
          300: '#a3a3a3',
          400: '#737373',
          500: '#525252',
          600: '#404040',
          700: '#333333',
          800: '#1F1F1F',
          900: '#141414',
        },
        honey: {
          50: '#FEF2F2',
          100: '#FEE2E2',
          200: '#FECACA',
          300: '#FCA5A5', // Light Red
          400: '#EF4444', // Accent / CTA - Tailwind red-500
          500: '#DC2626',
          600: '#B91C1C',
          700: '#991B1B',
          800: '#7F1D1D',
          900: '#641717',
        },
      },
      animation: {
        breathe: 'breathe 2s ease-in-out infinite',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.25)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
