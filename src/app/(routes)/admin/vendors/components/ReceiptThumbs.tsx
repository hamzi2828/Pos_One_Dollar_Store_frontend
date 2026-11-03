'use client';

// Small receipt photos (payment screenshots) that open full size in a new tab.

import { BACKEND_URL } from '@/lib/storeApi';

export const fileUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : `${BACKEND_URL}${u}`);

export default function ReceiptThumbs({ urls, size = 40 }: { urls?: string[]; size?: number }) {
  if (!urls || urls.length === 0) return null;
  return (
    <span className="mt-1 flex flex-wrap gap-1.5">
      {urls.map((u, i) => (
        <a
          key={u}
          href={fileUrl(u)}
          target="_blank"
          rel="noreferrer"
          title={`Receipt ${urls.length > 1 ? i + 1 : ''} (opens full size)`}
          className="block overflow-hidden rounded border border-gray-200 bg-gray-50 hover:ring-2 hover:ring-honey-400"
          style={{ width: size, height: size }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={fileUrl(u)} alt={`Receipt ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
        </a>
      ))}
    </span>
  );
}
