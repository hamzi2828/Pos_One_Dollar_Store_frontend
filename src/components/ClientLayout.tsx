'use client';

import { CurrencyProvider } from "@/context/CurrencyContext";

// The storefront chrome (Header/Footer/WhatsApp/cart modal) was removed along
// with the public site. Every route here is either the admin panel — which
// brings its own layout — or the login page, so this just supplies context.
export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <CurrencyProvider>
      <main>{children}</main>
    </CurrencyProvider>
  );
}
