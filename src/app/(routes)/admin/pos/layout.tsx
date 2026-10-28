// POS only: installable app (manifest). The service worker is registered by the page.
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'DOLLAR & Co POS', statusBarStyle: 'black' },
};

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
};

export default function POSLayout({ children }: { children: React.ReactNode }) {
  return children;
}
