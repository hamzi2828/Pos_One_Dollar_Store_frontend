'use client';

// Step 1 — Check boxes: one card per vendor (open one at a time) with its
// bill photos and "expected N boxes/packs"; type how many came.
import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, Loader2, PackageCheck } from 'lucide-react';
import { apiErrorMessage } from '@/lib/storeApi';
import { ErrorBox, Field, inputClass, primaryBtn } from '@/components/admin/FormBits';
import { apiErrorCode, purchasingApi, toNum } from '../../../_shared/purchasingApi';
import { Card, NumberStepper, PhotoStrip } from '../../../_shared/ui';
import type { GoodsReceipt, GRNBox } from '../../../_shared/types';
import { SameReceiverNote } from './bits';

export default function BoxesStep({
  grn,
  mayEdit,
  onSaved,
}: {
  grn: GoodsReceipt;
  /** can edit at all (permission + not the buyer) */
  mayEdit: boolean;
  onSaved: (g: GoodsReceipt) => void;
}) {
  const boxes: GRNBox[] = grn.boxes || [];
  const checked = !!grn.boxesCheckedAt;
  const hasEntries = (grn.entries || []).length > 0;
  // Correcting the count is allowed until the first entry.
  const editable = mayEdit && (grn.status === 'pending' || (grn.status === 'in_progress' && !hasEntries));
  const [counts, setCounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(boxes.map((b) => [b.bill, String(checked ? b.received : b.expected)])),
  );
  const [note, setNote] = useState(grn.boxesNote || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sameReceiver, setSameReceiver] = useState(false);
  const lock = useRef(false);
  // Open vendor card (one at a time); '' = all closed.
  const [openBill, setOpenBill] = useState<string>(() => boxes[0]?.bill || '');

  const expected = boxes.reduce((s, b) => s + (b.expected || 0), 0);
  const received = boxes.reduce((s, b) => s + toNum(counts[b.bill]), 0);
  const diff = received - expected;
  const photosOf = (billId: string) => (grn.purchaseOrder.bills || []).find((x) => x._id === billId)?.photos || [];

  const submit = async () => {
    if (lock.current || !editable) return;
    for (const b of boxes) {
      const n = toNum(counts[b.bill]);
      if (!Number.isInteger(n) || n < 0) return setError(`Boxes/packs from ${b.vendorName} must be a whole number.`);
    }
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await purchasingApi.grnBoxes(grn._id, {
        boxes: boxes.map((b) => ({ bill: b.bill, received: toNum(counts[b.bill]) })),
        note: note.trim() || undefined,
      });
      res.warnings.forEach((w) => toast(w, { icon: '⚠️', duration: 6000 }));
      onSaved(res.grn);
    } catch (e) {
      if (apiErrorCode(e) === 'SAME_RECEIVER') setSameReceiver(true);
      else setError(apiErrorMessage(e, 'Could not save the box/pack count.'));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      {(sameReceiver || (!grn.canVerify && grn.status !== 'completed')) && <SameReceiverNote />}
      <Card
        title={
          <span className="flex items-center gap-2">
            <PackageCheck className="h-4 w-4 text-honey-700" /> Did all boxes/packs come?
          </span>
        }
        actions={<span className="text-xs text-gray-500">{expected} expected</span>}
      >
        <p className="text-xs text-gray-500 mb-3">Count the boxes/packs from each vendor. Change the number if some are missing.</p>
        <ul className="space-y-2">
          {boxes.map((b, i) => {
            const n = toNum(counts[b.bill]);
            const off = n !== b.expected;
            const isOpen = openBill === b.bill;
            const photos = photosOf(b.bill);
            const next = boxes[i + 1];
            return (
              <li key={b.bill} className={`rounded-lg border bg-white ${isOpen ? 'border-honey-400 ring-2 ring-honey-500/20' : off ? 'border-amber-300' : 'border-gray-200'}`}>
                <button
                  type="button"
                  onClick={() => setOpenBill(isOpen ? '' : b.bill)}
                  aria-expanded={isOpen}
                  className="w-full text-left px-3 py-2.5 flex items-center gap-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-gray-900 truncate">{b.vendorName}</span>
                    <span className="block text-[11px] text-gray-500">
                      {b.billNo ? `Bill ${b.billNo} · ` : ''}Expected {b.expected} box{b.expected === 1 ? '' : 'es'}/pack{b.expected === 1 ? '' : 's'}
                      {photos.length > 0 && ` · ${photos.length} bill file${photos.length === 1 ? '' : 's'}`}
                    </span>
                  </span>
                  {!off ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                  ) : (
                    <span className="text-xs font-semibold text-amber-700 whitespace-nowrap">{n - b.expected > 0 ? `+${n - b.expected}` : n - b.expected}</span>
                  )}
                  <ChevronDown className={`h-5 w-5 flex-shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="border-t border-gray-100 px-3 py-3 space-y-3">
                    {photos.length > 0 && (
                      <div>
                        <p className="text-[11px] text-gray-500 mb-1">Bill photos / PDFs of {b.vendorName}</p>
                        <PhotoStrip photos={photos} />
                      </div>
                    )}
                    <div>
                      <p className="text-[11px] text-gray-500 mb-1">How many boxes/packs came from {b.vendorName}?</p>
                      {editable ? (
                        <NumberStepper value={counts[b.bill] ?? ''} onChange={(v) => setCounts((c) => ({ ...c, [b.bill]: v }))} min={0} label={`boxes/packs from ${b.vendorName}`} disabled={busy} />
                      ) : (
                        <p className="text-lg font-semibold text-gray-900">{checked ? b.received : '—'} came</p>
                      )}
                    </div>
                    {next && (
                      <button type="button" onClick={() => setOpenBill(next.bill)} className="inline-flex items-center gap-1 text-xs font-medium text-honey-800 hover:underline">
                        Next vendor: {next.vendorName} <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <div className={`mt-4 flex items-center justify-between rounded-lg px-3 py-2.5 ${diff === 0 ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'}`}>
          <span className="text-sm font-medium">Total</span>
          <span className="text-base font-semibold tabular-nums">
            {received} of {expected} boxes/packs
          </span>
        </div>
        {diff !== 0 && (
          <div className="mt-2 flex items-start gap-2 text-xs text-amber-800">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>
              {diff < 0 ? `${-diff} box${diff === -1 ? '/pack is' : 'es/packs are'} missing.` : `${diff} more box${diff === 1 ? '/pack' : 'es/packs'} than expected.`} Tell the buyer, and write it in the note.
            </span>
          </div>
        )}

        <div className="mt-4">
          <Field label="Note (optional)">
            {editable ? (
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={inputClass} placeholder="e.g. 1 box/pack wet, 1 box/pack torn" disabled={busy} />
            ) : (
              <p className="text-sm text-gray-800">{grn.boxesNote || '—'}</p>
            )}
          </Field>
        </div>

        {editable && (
          <div className="mt-4 space-y-2">
            <ErrorBox message={error} />
            <button type="button" onClick={submit} disabled={busy} aria-busy={busy} className={`${primaryBtn} w-full !py-3 text-base`}>
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
              {busy ? 'Saving…' : checked ? 'Save box/pack count' : 'Boxes/packs are checked'}
            </button>
          </div>
        )}
        {mayEdit && hasEntries && <p className="mt-3 text-[11px] text-gray-500">Goods are already being entered, so the box/pack count can no longer be changed.</p>}
      </Card>

      {(grn.builty?.builtyNo || grn.builty?.transporter || (grn.builty?.photos || []).length > 0) && (
        <Card title="Builty">
          <div className="space-y-3 text-xs text-gray-600">
            {(grn.builty?.builtyNo || grn.builty?.transporter) && (
              <p>
                Builty {grn.builty.builtyNo || '—'}
                {grn.builty.transporter && ` · ${grn.builty.transporter}`}
              </p>
            )}
            <PhotoStrip photos={grn.builty?.photos || []} />
          </div>
        </Card>
      )}
    </div>
  );
}
