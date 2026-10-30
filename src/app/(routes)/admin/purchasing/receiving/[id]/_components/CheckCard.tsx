'use client';

// Count one vendor's boxes/packs (part of "Check & unpack"): bill photos, expected
// count, how many came, note. Saved → the same panel switches to unpacking.
import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { apiErrorMessage } from '@/lib/storeApi';
import { ErrorBox, Field, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { apiErrorCode, purchasingApi, toNum } from '../../../_shared/purchasingApi';
import { NumberStepper, PhotoStrip } from '../../../_shared/ui';
import type { GoodsReceipt, GRNBox } from '../../../_shared/types';
import { isBoxChecked } from './BoxesStep';

export default function CheckCard({
  grn,
  box,
  mayEdit,
  onSaved,
  onCancel,
  onSameReceiver,
}: {
  grn: GoodsReceipt;
  box: GRNBox;
  mayEdit: boolean;
  onSaved: (g: GoodsReceipt) => void;
  /** Shown when correcting a saved count. */
  onCancel?: () => void;
  onSameReceiver: () => void;
}) {
  const checked = isBoxChecked(grn, box);
  const [count, setCount] = useState(String(checked ? box.received : box.expected));
  const [note, setNote] = useState(grn.boxesNote || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const photos = (grn.purchaseOrder.bills || []).find((x) => x._id === box.bill)?.photos || [];
  const n = toNum(count);
  const open = grn.status === 'pending' || grn.status === 'in_progress';
  const editable = mayEdit && open;

  const save = async () => {
    if (lock.current || !editable) return;
    if (!Number.isInteger(n) || n < 0) return setError('Boxes/packs must be a whole number.');
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await purchasingApi.grnBoxes(grn._id, { boxes: [{ bill: box.bill, received: n }], note: note.trim() || undefined });
      res.warnings.forEach((w) => toast(w, { icon: '⚠️', duration: 6000 }));
      toast.success(`${box.vendorName}: ${n} box(es)/pack(s) checked. Now unpack.`);
      onSaved(res.grn);
    } catch (e) {
      if (apiErrorCode(e) === 'SAME_RECEIVER') onSameReceiver();
      else setError(apiErrorMessage(e, 'Could not save the box/pack count.'));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-3">
        <p className="text-xs text-gray-600">
          <span className="font-medium text-gray-800">1. Check boxes/packs</span> · Expected <strong className="text-gray-900">{box.expected}</strong> on the bill
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="sm:w-56 flex-shrink-0">
            <p className="text-[11px] text-gray-500 mb-1">How many came?</p>
            {editable ? (
              <NumberStepper value={count} onChange={setCount} min={0} label={`boxes/packs from ${box.vendorName}`} disabled={busy} />
            ) : (
              <p className="text-lg font-semibold text-gray-900">{checked ? `${box.received} came` : '-'}</p>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-gray-500 mb-1">Bill photos / PDFs</p>
            {photos.length ? <PhotoStrip photos={photos} size="h-20 w-20" /> : <p className="text-xs text-gray-400">No bill photo.</p>}
          </div>
        </div>
        {editable && n !== box.expected && (
          <p className="flex items-start gap-2 text-xs text-amber-800">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            {n < box.expected ? `${box.expected - n} box(es)/pack(s) missing.` : `${n - box.expected} more than the bill.`} Tell the buyer, and write it in the note.
          </p>
        )}
        {editable && (
          <Field label="Note (optional)">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={inputClass} placeholder="e.g. 1 box/pack wet, 1 box/pack torn" disabled={busy} />
          </Field>
        )}
        <ErrorBox message={error} />
        {editable && (
          <div className="flex gap-2">
            {onCancel && (
              <button type="button" onClick={onCancel} disabled={busy} className={secondaryBtn}>
                Cancel
              </button>
            )}
            <button type="button" onClick={save} disabled={busy} aria-busy={busy} className={`${primaryBtn} flex-1 !py-3 text-base`}>
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
              {busy ? 'Saving...' : checked ? 'Save count' : 'Save count & start unpacking'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
