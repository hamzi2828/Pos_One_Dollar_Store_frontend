'use client';

// Goods entered on this trip (newest first): tags again, undo.
import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ListChecks, Loader2, Printer, Undo2 } from 'lucide-react';
import { apiErrorMessage, formatDate, formatRs } from '@/lib/storeApi';
import { isReceipt, purchasingApi } from '../../../_shared/purchasingApi';
import { Card } from '../../../_shared/ui';
import type { GoodsReceipt, GRNEntry } from '../../../_shared/types';
import { printTags, type StickerSize } from './tags';

export default function EntriesList({
  grn,
  canUndo,
  tagSize,
  onChanged,
  onReload,
  billFilter,
}: {
  grn: GoodsReceipt;
  canUndo: boolean;
  tagSize: StickerSize;
  onChanged: (g: GoodsReceipt) => void;
  onReload: () => Promise<void>;
  /** show only this vendor bill (null = all) */
  billFilter?: string | null;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const lock = useRef(false);
  const all = [...(grn.entries || [])].filter((e) => !e.undone).sort((a, b) => (b.entryNo || 0) - (a.entryNo || 0));
  const rows = billFilter ? all.filter((e) => e.bill === billFilter) : all;

  const undo = async (e: GRNEntry) => {
    if (lock.current) return;
    if (!window.confirm(`Undo "${e.productName}" (${e.qty} pcs)? The pieces are taken back out of the warehouse.`)) return;
    lock.current = true;
    setBusy(`undo-${e._id}`);
    try {
      const res = await purchasingApi.grnUndoEntry(grn._id, e._id);
      if (isReceipt(res?.grn)) onChanged(res.grn);
      else await onReload();
      toast.success('Entry undone');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not undo this entry.'), { duration: 7000 });
    } finally {
      lock.current = false;
      setBusy(null);
    }
  };

  const tags = async (e: GRNEntry) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(`tags-${e._id}`);
    await printTags({ productId: e.product, variantId: e.variantId, copies: e.stockQty }, tagSize);
    lock.current = false;
    setBusy(null);
  };

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-honey-700" /> Entered {billFilter ? 'from this vendor' : 'on this trip'}
        </span>
      }
      actions={<span className="text-xs text-gray-500">{rows.length} entries</span>}
    >
      {rows.length === 0 ? (
        <p className="text-xs text-gray-500">Nothing entered yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100 -my-2">
          {rows.map((e) => (
            <li key={e._id} className="py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 leading-tight">{e.productName}</p>
                  <p className="text-[11px] text-gray-500">
                    {e.code && <span className="font-mono">#{e.code} · </span>}
                    {e.vendorName}
                    {(e.boxNo || 0) > 0 && <span className="ml-1 rounded bg-gray-100 px-1.5 py-0.5 font-medium text-gray-700">Box {e.boxNo}</span>}
                  </p>
                  <p className="text-xs text-gray-700 mt-0.5">
                    <strong>{e.qty} pcs</strong> × {formatRs(e.costPrice, { decimals: 2 })} = {formatRs(e.value)}
                    {e.damagedQty > 0 && <span className="text-red-600"> · {e.damagedQty} damaged</span>}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {e.shelved > 0 ? `${e.shelved} on shelf` : 'In warehouse'}
                    {e.shelved > 0 && e.stockQty > e.shelved && `, ${e.stockQty - e.shelved} in warehouse`} · {e.createdByName || '—'} · {formatDate(e.createdAt, true)}
                  </p>
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  {e.stockQty > 0 && (
                    <button
                      type="button"
                      onClick={() => tags(e)}
                      disabled={!!busy}
                      className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {busy === `tags-${e._id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />} Tags
                    </button>
                  )}
                  {canUndo && (
                    <button
                      type="button"
                      onClick={() => undo(e)}
                      disabled={!!busy}
                      className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {busy === `undo-${e._id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />} Undo
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
