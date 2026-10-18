'use client';

import { CurrencyProvider } from "@/context/CurrencyContext";

// Every route is either the admin panel (which brings its own layout) or the
// staff sign-in page, so this only supplies app-wide client context.
export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <CurrencyProvider>
      <main>{children}</main>
    </CurrencyProvider>
  );
}
