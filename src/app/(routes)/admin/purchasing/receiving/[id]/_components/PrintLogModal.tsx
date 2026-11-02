'use client';

// Sticker print history of one product: how many were printed, which way
// (by sale / all pieces / typed number), on what, by whom and when.
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { EyeOff, History, Loader2 } from 'lucide-react';
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

export default function PrintLogModal({
  productId,
  variantId,
  name,
  need: needNow,
  parts,
  onClose,
}: {
  /** The product's live entries on this receipt, oldest first (vendor + pieces). */
  parts?: { key: string; label: string; pieces: number; current?: boolean }[];
  productId: string;
  variantId?: string | null;
  name: string;
  /** Stickers this entry needs now (its pieces, after any edit). Missing = the newest print's "of N". */
  need?: number;
  onClose: () => void;
}) {
  const [log, setLog] = useState<PrintLog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    storeApi
      .get<PrintLog>('/label-prints', { productId, ...(variantId ? { variantId } : {}) })
      .then((r) => alive && setLog(r.data))
      .catch((e) => alive && setError(apiErrorMessage(e, 'Could not load the print log.')));
    return () => {
      alive = false;
    };
  }, [productId, variantId, reload]);

  // Test / wrong print: leave it out of the count (kept in the database).
  const ignore = async (r: PrintRow) => {
    if (busy) return;
    setBusy(r.id);
    try {
      await storeApi.patch(`/label-prints/${r.id}`, { ignored: true });
      toast.success(`${r.count} sticker${r.count === 1 ? '' : 's'} ignored`);
      setReload((n) => n + 1);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not ignore this print.'));
    } finally {
      setBusy(null);
    }
  };

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
          {(() => {
            // Stickers needed: the entry's pieces now (an edit may have changed them), else the newest print's "of N".
            const need = needNow && needNow > 0 ? needNow : log.prints[0].total;
            const done = log.totalStickers;
            const left = Math.max(0, need - done);
            const pct = need > 0 ? Math.min(100, Math.round((done / need) * 100)) : 100;
            return (
              <div className="mb-3 rounded-lg bg-honey-50 px-3 py-2 text-sm text-gray-800">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span>
                    <strong>{done.toLocaleString()}</strong> of {need.toLocaleString()} printed · {log.runs} print{log.runs === 1 ? '' : 's'}
                  </span>
                  <strong className={left > 0 ? 'text-red-600' : 'text-green-600'}>{left > 0 ? `${left.toLocaleString()} left` : 'All printed'}</strong>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-white overflow-hidden">
                  <div className={`h-full rounded-full ${left > 0 ? 'bg-honey-500' : 'bg-green-500'}`} style={{ width: `${pct}%` }} />
                </div>
                {parts && parts.length > 1 && (
                  <ul className="mt-2 space-y-0.5 border-t border-honey-200 pt-1.5 text-xs">
                    {(() => {
                      // Printed stickers go to the entries oldest first: moved pieces take their printed count with them.
                      let pool = done;
                      return parts.map((p) => {
                        const got = Math.min(p.pieces, Math.max(0, pool));
                        pool -= got;
                        const rest = p.pieces - got;
                        return (
                          <li key={p.key} className={`flex justify-between gap-2 ${p.current ? 'font-semibold' : ''}`}>
                            <span className="truncate">
                              {p.label}
                              {p.current ? ' (this entry)' : ''}
                            </span>
                            <span className={`whitespace-nowrap tabular-nums ${rest > 0 ? 'text-red-600' : 'text-green-700'}`}>
                              {got.toLocaleString()} of {p.pieces.toLocaleString()} {rest > 0 ? `· ${rest.toLocaleString()} left` : '· done'}
                            </span>
                          </li>
                        );
                      });
                    })()}
                  </ul>
                )}
              </div>
            );
          })()}
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
            {log.prints.map((r, i) => {
              // Printed so far up to this print (list is newest first).
              const upTo = log.prints.slice(i).reduce((t, x) => t + x.count, 0) + (log.totalStickers - log.prints.reduce((t, x) => t + x.count, 0));
              const left = Math.max(0, (needNow && needNow > 0 ? needNow : r.total) - upTo);
              return (
              <li key={r.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-gray-900">
                    {r.count.toLocaleString()} of {r.total.toLocaleString()} printed
                    <span className={`ml-2 text-xs font-medium ${left > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {left > 0 ? `${left.toLocaleString()} left` : 'all done'}
                    </span>
                  </span>
                  <span className="block text-xs text-gray-600">
                    {modeText(r)} · {r.via === 'printer' ? 'Label printer' : 'Print window'}
                  </span>
                </span>
                <span className="flex flex-col items-end gap-1 text-right text-[11px] text-gray-500">
                  <span>
                    {r.userName || '—'}
                    <br />
                    {formatDate(r.at, true)}
                  </span>
                  <button
                    type="button"
                    onClick={() => ignore(r)}
                    disabled={!!busy}
                    title="Test or wrong print: don't count it"
                    className="inline-flex items-center gap-1 rounded border border-gray-300 px-1.5 py-0.5 text-[11px] font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {busy === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <EyeOff className="h-3 w-3" />} Ignore
                  </button>
                </span>
              </li>
              );
            })}
          </ul>
        </>
      )}
    </Modal>
  );
}
