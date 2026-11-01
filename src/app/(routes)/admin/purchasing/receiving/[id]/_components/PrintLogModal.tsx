'use client';

// Sticker print history of one product: how many were printed, which way
// (by sale / all pieces / typed number), on what, by whom and when.
import { useEffect, useState } from 'react';
import { History, Loader2 } from 'lucide-react';
import { Modal } from '@/components/admin/FormBits';
import { apiErrorMessage, formatDate, storeApi } from '@/lib/storeApi';

interface PrintRow {
  id: string;
  count: number;
  total: number;
  mode: 'sale' | 'piece' | 'custom';
  piecesPerSale: number;
  via: 'printer' | 'browser';
  userName: string;
  at: string;
}
interface PrintLog {
  totalStickers: number;
  runs: number;
  prints: PrintRow[];
}

const modeText = (r: PrintRow) =>
  r.mode === 'sale' ? `By sale (1 per ${r.piecesPerSale} pcs)` : r.mode === 'piece' ? 'All pieces' : 'Typed number';

export default function PrintLogModal({ productId, variantId, name, onClose }: { productId: string; variantId?: string | null; name: string; onClose: () => void }) {
  const [log, setLog] = useState<PrintLog | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    storeApi
      .get<PrintLog>('/label-prints', { productId, ...(variantId ? { variantId } : {}) })
      .then((r) => alive && setLog(r.data))
      .catch((e) => alive && setError(apiErrorMessage(e, 'Could not load the print log.')));
    return () => {
      alive = false;
    };
  }, [productId, variantId]);

  return (
    <Modal title="Sticker print log" subtitle={name} icon={<History className="h-5 w-5" />} onClose={onClose}>
      {error ? (
        <p className="py-6 text-center text-sm text-red-600">{error}</p>
      ) : !log ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : log.prints.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">No stickers printed yet (prints are logged from 1 Nov 2026).</p>
      ) : (
        <>
          <p className="mb-3 rounded-lg bg-honey-50 px-3 py-2 text-sm text-gray-800">
            <strong>{log.totalStickers.toLocaleString()}</strong> sticker{log.totalStickers === 1 ? '' : 's'} printed in {log.runs} print{log.runs === 1 ? '' : 's'}
          </p>
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
            {log.prints.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-gray-900">
                    {r.count.toLocaleString()} of {r.total.toLocaleString()} printed
                  </span>
                  <span className="block text-xs text-gray-600">
                    {modeText(r)} · {r.via === 'printer' ? 'Label printer' : 'Print window'}
                  </span>
                </span>
                <span className="text-right text-[11px] text-gray-500">
                  {r.userName || '—'}
                  <br />
                  {formatDate(r.at, true)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}
