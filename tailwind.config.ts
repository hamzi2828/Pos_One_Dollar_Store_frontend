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
        // DOLLAR & Co sign colours (yellow "DOLLAR", green "&", white "Co" on black).
        // Used by the wordmark on the login / not-found pages.
        brand: {
          yellow: '#FFD60A',
          green: '#22C55E',
          ink: '#0A0A0A',
        },
        // Admin panel palette — neutrals plus the `honey` primary used by every page.
        sage: {
          50: '#fafaf9',
          100: '#f5f5f4',
          200: '#e7e5e4',
          300: '#D6D3D1',
          400: '#A8A29E',
          500: '#78716C',
          600: '#57534E',
          700: '#44403C',
          800: '#373534',
          900: '#2C2A29',
        },
        charcoal: {
          DEFAULT: '#141414',
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
          // DOLLAR & Co yellow. 400-600 are backgrounds (use BLACK text on them);
          // 700-900 are dark gold for text / icons on white (yellow text is unreadable).
          50: '#FFFCEB',
          100: '#FFF6C7',
          200: '#FFED8A',
          300: '#FFE24D',
          400: '#FFDA24',
          500: '#FFD60A',
          600: '#EBC200',
          700: '#856C00',
          800: '#665300',
          900: '#4A3C00',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
