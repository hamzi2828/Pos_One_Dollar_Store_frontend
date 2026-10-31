'use client';

// Goods entered on this trip (newest first): tags again, undo, edit.
import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ListChecks, Loader2, Pencil, Printer, Undo2 } from 'lucide-react';
import { Field, Modal, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import MoneyInput from '@/components/ui/MoneyInput';
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
  const [editing, setEditing] = useState<GRNEntry | null>(null);
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

  const boxCount = (billId: string) => {
    const b = (grn.boxes || []).find((x) => x.bill === billId);
    return b ? b.received || b.expected || 0 : 0;
  };

  const tags = async (e: GRNEntry) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(`tags-${e._id}`);
    await printTags({ productId: e.product, variantId: e.variantId, copies: e.stockQty * Math.max(1, e.piecesPerSale || 1) }, tagSize);
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
                    {(e.boxNo || 0) > 0 && <span className="ml-1 rounded bg-gray-100 px-1.5 py-0.5 font-medium text-gray-700">Box/pack {e.boxNo}</span>}
                  </p>
                  <p className="text-xs text-gray-700 mt-0.5">
                    <strong>{(e.piecesPerSale || 1) > 1 ? `${e.qty} sales of ${e.piecesPerSale}` : `${e.qty} pcs`}</strong> × {formatRs(e.costPrice, { decimals: 2 })} = {formatRs(e.value)}
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
                  {canUndo && (
                    <button
                      type="button"
                      onClick={() => setEditing(e)}
                      disabled={!!busy}
                      className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <EditEntryModal
          grnId={grn._id}
          entry={editing}
          boxes={boxCount(editing.bill)}
          onClose={() => setEditing(null)}
          onSaved={async (g) => {
            setEditing(null);
            if (isReceipt(g)) onChanged(g);
            else await onReload();
          }}
        />
      )}
    </Card>
  );
}

function EditEntryModal({
  grnId,
  entry,
  boxes,
  onClose,
  onSaved,
}: {
  grnId: string;
  entry: GRNEntry;
  boxes: number;
  onClose: () => void;
  onSaved: (g: GoodsReceipt | undefined) => Promise<void>;
}) {
  const perSale = Math.max(1, entry.piecesPerSale || 1);
  const [qty, setQty] = useState(String(entry.qty));
  const [damaged, setDamaged] = useState(String(entry.damagedQty || 0));
  const [cost, setCost] = useState(String(entry.costPrice));
  const [boxNo, setBoxNo] = useState(String(entry.boxNo || ''));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = Math.floor(Number(qty) || 0);
  const d = Math.floor(Number(damaged) || 0);
  const c = Number(cost) || 0;
  const unit = perSale > 1 ? 'sales' : 'pcs';

  const save = async () => {
    if (q < 1) return setError(`Enter how many ${unit}.`);
    if (d > q) return setError(`Damaged (${d}) cannot be more than ${q}.`);
    if (!(c > 0)) return setError('Enter the cost price.');
    setSaving(true);
    setError(null);
    try {
      const res = await purchasingApi.grnEditEntry(grnId, entry._id, { qty: q, damagedQty: d, costPrice: c, boxNo: Math.floor(Number(boxNo) || 0) });
      const note = (res?.warnings || []).join(' ');
      if (note) toast(note);
      else toast.success('Entry updated');
      await onSaved(res?.grn);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not update this entry.'));
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Edit ${entry.productName}`}
      subtitle={`${entry.vendorName}${entry.code ? ` · #${entry.code}` : ''}`}
      icon={<Pencil className="h-5 w-5" />}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className={secondaryBtn}>
            Cancel
          </button>
          <button type="button" onClick={save} disabled={saving} className={primaryBtn}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />} Save changes
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label={perSale > 1 ? `Sales (of ${perSale} pcs)` : 'Pieces'} required>
          <input type="number" min={1} inputMode="numeric" value={qty} onChange={(ev) => setQty(ev.target.value)} className={inputClass} autoFocus />
        </Field>
        <Field label="Damaged">
          <input type="number" min={0} inputMode="numeric" value={damaged} onChange={(ev) => setDamaged(ev.target.value)} className={inputClass} />
        </Field>
        <Field label="Cost price (per piece)" required>
          <MoneyInput value={cost} onValue={setCost} className={inputClass} />
        </Field>
        <Field label="Box/pack no." hint={boxes ? `1 to ${boxes}, empty = not said` : 'Empty = not said'}>
          <input type="number" min={0} max={boxes || undefined} inputMode="numeric" value={boxNo} onChange={(ev) => setBoxNo(ev.target.value)} className={inputClass} />
        </Field>
      </div>
      <p className="mt-3 text-xs text-gray-700">
        New total: <strong>{formatRs(Math.round(q * c * 100) / 100)}</strong> · {Math.max(0, q - d)} good {unit} go into the warehouse
      </p>
      <p className="mt-1 text-[11px] text-gray-500">The old pieces are taken back out and the corrected entry is saved. Pieces already on a shelf or sold cannot be edited.</p>
      {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
    </Modal>
  );
}
