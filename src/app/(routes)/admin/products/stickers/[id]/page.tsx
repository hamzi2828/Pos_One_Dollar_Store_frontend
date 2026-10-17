'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import StickerPrinter from './StickerPrinter';

// /admin/products/stickers/[id]
// Query params (all optional, used as the starting choices):
//   new=1          show "Product saved" banner
//   type           unit | box | full-box | batch
//   variantId      one id or a comma-separated list
//   batchNo        pre-select one batch (with type=batch)
//   copies         copies for every pre-selected line
//   size           38x25 | 50x25 | 50x30 | 40x30 | 60x40 | a4
//   showPrice      0 | 1
function StickerPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  if (!id) return null;
  // Remount when the query changes (e.g. "Print stickers for this delivery").
  return <StickerPrinter key={`${id}?${searchParams.toString()}`} productId={id} searchParams={searchParams} />;
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-honey-500 border-t-transparent" />
        </div>
      }
    >
      <StickerPage />
    </Suspense>
  );
}
