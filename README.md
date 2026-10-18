# Pos_One_Dollar_Store_frontend — DOLLAR & Co POS admin

Staff-only admin panel for the DOLLAR & Co shop: point of sale, POS orders, products and
stock, purchasing, vendors, till, reports, HR and settings. One shop, prices in PKR (Rs).
There is no customer website — every page lives under `/admin`, and `/authentication`
is the staff sign-in.

Built with Next.js 15 (app router), React 19, TypeScript and Tailwind CSS. It talks to the
Express API in `../pos_backend`.

## Environment

Create `.env.local`:

| Variable | Example | What |
|---|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | `http://localhost:4000` | Base URL of the backend API (no trailing slash) |

## Scripts

```bash
npm install
npm run dev     # dev server on http://localhost:3000
npm run build   # production build
npm run start   # serve the production build
npm run lint    # ESLint
npx tsc --noEmit -p .   # type check
```

## Notes

- Sign-in stores the token in `localStorage` and an `auth_token` cookie; `middleware.ts`
  sends signed-out visitors from `/admin` to `/authentication`.
- What a staff member can see and do comes from their role (Admin → Roles).
- Shop name, phone, address, currency, logo and favicon are set in Admin → Settings.
