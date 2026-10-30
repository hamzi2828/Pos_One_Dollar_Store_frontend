'use client';

// Step 1 — Check boxes: one card per vendor (open one at a time) with its
// bill photos and "expected N boxes/packs"; type how many came.
import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Loader2, PackageCheck } from 'lucide-react';
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
  onGo,
}: {
  grn: GoodsReceipt;
  /** can edit at all (permission + not the buyer) */
  mayEdit: boolean;
  /** Saved; `bill` = the vendor on screen, opened next in step 2. */
  onSaved: (g: GoodsReceipt, bill: string) => void;
  /** Go to step 2 with this vendor open (count already locked). */
  onGo?: (bill: string) => void;
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
  const [search, setSearch] = useState('');

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
      onSaved(res.grn, (boxes.find((b) => b.bill === openBill) || boxes[0])?.bill || '');
    } catch (e) {
      if (apiErrorCode(e) === 'SAME_RECEIVER') setSameReceiver(true);
      else setError(apiErrorMessage(e, 'Could not save the box/pack count.'));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const q = search.trim().toLowerCase();
  const shown = q ? boxes.filter((b) => `${b.vendorName} ${b.billNo || ''}`.toLowerCase().includes(q)) : boxes;
  const idx = Math.max(0, boxes.findIndex((b) => b.bill === openBill));
  const cur = boxes[idx];
  const prev = boxes[idx - 1];
  const next = boxes[idx + 1];
  const curPhotos = cur ? photosOf(cur.bill) : [];
  const offCount = boxes.filter((b) => toNum(counts[b.bill]) !== b.expected).length;

  return (
    <div className="space-y-4">
      {(sameReceiver || (!grn.canVerify && grn.status !== 'completed')) && <SameReceiverNote />}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] gap-4 items-start">
        {/* Left: all vendors, compact; pick one */}
        <Card
          title={
            <span className="flex items-center gap-2">
              <PackageCheck className="h-4 w-4 text-honey-700" /> Vendors ({boxes.length})
            </span>
          }
          actions={<span className="text-xs text-gray-500">{expected} boxes/packs</span>}
        >
          {boxes.length > 6 && (
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a vendor..." className={`${inputClass} !py-1.5 mb-2`} />
          )}
          <ul className="-mx-1 max-h-[60vh] overflow-y-auto space-y-0.5">
            {shown.map((b) => {
              const n = toNum(counts[b.bill]);
              const off = n !== b.expected;
              const on = !!cur && b.bill === cur.bill;
              return (
                <li key={b.bill}>
                  <button
                    type="button"
                    onClick={() => setOpenBill(b.bill)}
                    className={`w-full text-left rounded-md px-2 py-1.5 flex items-center gap-2 ${on ? 'bg-honey-100 ring-1 ring-honey-400' : 'hover:bg-gray-50'}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-gray-900 truncate">{b.vendorName}</span>
                      <span className="block text-[11px] text-gray-500 truncate">
                        {b.billNo ? `${b.billNo} · ` : ''}
                        {n} of {b.expected}
                      </span>
                    </span>
                    {!off ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                    ) : (
                      <span className="text-[11px] font-semibold text-amber-700">{n - b.expected > 0 ? `+${n - b.expected}` : n - b.expected}</span>
                    )}
                  </button>
                </li>
              );
            })}
            {shown.length === 0 && <li className="px-2 py-2 text-xs text-gray-500">No vendor matches.</li>}
          </ul>
        </Card>

        {/* Right: the picked vendor, then the total + save */}
        <div className="space-y-4 min-w-0">
          {cur && (
            <Card
              className="border-honey-300"
              title={<span className="truncate">{cur.vendorName}</span>}
              actions={
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  Vendor {idx + 1} of {boxes.length}
                </span>
              }
            >
              <p className="text-xs text-gray-500 mb-3">
                {cur.billNo ? `Bill ${cur.billNo} · ` : ''}Expected <strong className="text-gray-800">{cur.expected}</strong> box{cur.expected === 1 ? '' : 'es'}/pack
                {cur.expected === 1 ? '' : 's'}
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="sm:w-56 flex-shrink-0">
                  <p className="text-[11px] text-gray-500 mb-1">How many came?</p>
                  {editable ? (
                    <NumberStepper value={counts[cur.bill] ?? ''} onChange={(v) => setCounts((c) => ({ ...c, [cur.bill]: v }))} min={0} label={`boxes/packs from ${cur.vendorName}`} disabled={busy} />
                  ) : (
                    <p className="text-lg font-semibold text-gray-900">{checked ? cur.received : '-'} came</p>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-gray-500 mb-1">Bill photos / PDFs</p>
                  {curPhotos.length ? <PhotoStrip photos={curPhotos} size="h-20 w-20" /> : <p className="text-xs text-gray-400">No bill photo.</p>}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
                <button
                  type="button"
                  onClick={() => prev && setOpenBill(prev.bill)}
                  disabled={!prev}
                  className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900 disabled:opacity-30"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Previous
                </button>
                {next ? (
                  <button type="button" onClick={() => setOpenBill(next.bill)} className={`${primaryBtn} !py-1.5 text-sm`}>
                    Next: <span className="max-w-[12rem] truncate">{next.vendorName}</span> <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <span className="text-xs text-green-700">Last vendor. Save below.</span>
                )}
              </div>
            </Card>
          )}

          <Card title="Total">
            <div className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 ${diff === 0 ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'}`}>
              <span className="text-sm font-medium">{offCount ? `${offCount} vendor${offCount === 1 ? '' : 's'} not matching` : 'All vendors match'}</span>
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
            <div className="mt-3">
              <Field label="Note (optional)">
                {editable ? (
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={inputClass} placeholder="e.g. 1 box/pack wet, 1 box/pack torn" disabled={busy} />
                ) : (
                  <p className="text-sm text-gray-800">{grn.boxesNote || '-'}</p>
                )}
              </Field>
            </div>
            {editable && (
              <div className="mt-3 space-y-2">
                <ErrorBox message={error} />
                <button type="button" onClick={submit} disabled={busy} aria-busy={busy} className={`${primaryBtn} w-full !py-3 text-base`}>
                  {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                  {busy ? 'Saving...' : `Save count & unpack ${cur?.vendorName || ''}`.trim()}
                </button>
              </div>
            )}
            {mayEdit && hasEntries && <p className="mt-3 text-[11px] text-gray-500">Goods are already being entered, so the box/pack count can no longer be changed.</p>}
            {!editable && checked && onGo && cur && (
              <button type="button" onClick={() => onGo(cur.bill)} className={`${primaryBtn} mt-3 w-full !py-3 text-base`}>
                Unpack {cur.vendorName} <ArrowRight className="h-5 w-5" />
              </button>
            )}
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
      </div>
    </div>
  );
}
