'use client';

// Step 1 — Check boxes, vendor by vendor: pick a vendor, see its bill photos and
// "expected N boxes/packs", type how many came, save — step 2 opens that vendor.
// When it is unpacked, come back here for the next vendor.
import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Circle, Loader2, PackageCheck, PackageOpen } from 'lucide-react';
import { apiErrorMessage } from '@/lib/storeApi';
import { ErrorBox, Field, inputClass, primaryBtn } from '@/components/admin/FormBits';
import { apiErrorCode, purchasingApi, toNum } from '../../../_shared/purchasingApi';
import { Card, NumberStepper, PhotoStrip } from '../../../_shared/ui';
import type { GoodsReceipt, GRNBox } from '../../../_shared/types';
import { SameReceiverNote } from './bits';

/** Was this vendor's box/pack count saved? (Old receipts were checked all at once.) */
export function isBoxChecked(grn: GoodsReceipt, b: GRNBox): boolean {
  if (b.checkedAt) return true;
  return !!grn.boxesCheckedAt && !(grn.boxes || []).some((x) => x.checkedAt);
}

/** First vendor whose boxes/packs are not checked yet. */
export function firstUncheckedBill(grn: GoodsReceipt, after?: string): string | undefined {
  const boxes = grn.boxes || [];
  const from = after ? boxes.findIndex((b) => b.bill === after) + 1 : 0;
  return [...boxes.slice(from), ...boxes.slice(0, from)].find((b) => !isBoxChecked(grn, b))?.bill;
}

export default function BoxesStep({
  grn,
  mayEdit,
  startBill,
  onSaved,
  onGo,
}: {
  grn: GoodsReceipt;
  /** can edit at all (permission + not the buyer) */
  mayEdit: boolean;
  /** Vendor to show first. */
  startBill?: string;
  /** Saved one vendor; open it in step 2. */
  onSaved: (g: GoodsReceipt, bill: string) => void;
  /** Go to step 2 with this vendor open. */
  onGo: (bill: string) => void;
}) {
  const boxes: GRNBox[] = grn.boxes || [];
  const open = grn.status === 'pending' || grn.status === 'in_progress';
  const entriesOf = (bill: string) => (grn.entries || []).filter((e) => !e.undone && e.bill === bill).length;
  const [counts, setCounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(boxes.map((b) => [b.bill, String(isBoxChecked(grn, b) ? b.received : b.expected)])),
  );
  const [note, setNote] = useState(grn.boxesNote || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sameReceiver, setSameReceiver] = useState(false);
  const lock = useRef(false);
  const [openBill, setOpenBill] = useState<string>(
    () => (startBill && boxes.some((b) => b.bill === startBill) ? startBill : firstUncheckedBill(grn)) || boxes[0]?.bill || '',
  );
  const [search, setSearch] = useState('');

  const idx = Math.max(0, boxes.findIndex((b) => b.bill === openBill));
  const cur = boxes[idx];
  const prev = boxes[idx - 1];
  const next = boxes[idx + 1];
  const curChecked = !!cur && isBoxChecked(grn, cur);
  const curLocked = !!cur && entriesOf(cur.bill) > 0;
  // A vendor's count can be changed until its goods are being entered.
  const curEditable = mayEdit && open && !!cur && !curLocked;
  const photosOf = (billId: string) => (grn.purchaseOrder.bills || []).find((x) => x._id === billId)?.photos || [];
  const curPhotos = cur ? photosOf(cur.bill) : [];

  const checkedBoxes = boxes.filter((b) => isBoxChecked(grn, b));
  const expected = boxes.reduce((s, b) => s + (b.expected || 0), 0);
  const checkedExpected = checkedBoxes.reduce((s, b) => s + (b.expected || 0), 0);
  const checkedReceived = checkedBoxes.reduce((s, b) => s + (b.received || 0), 0);
  const diff = checkedReceived - checkedExpected;
  const offCount = checkedBoxes.filter((b) => b.received !== b.expected).length;

  const pick = (bill: string) => {
    setOpenBill(bill);
    setError(null);
  };

  const submit = async () => {
    if (lock.current || !cur || !curEditable) return;
    const n = toNum(counts[cur.bill]);
    if (!Number.isInteger(n) || n < 0) return setError(`Boxes/packs from ${cur.vendorName} must be a whole number.`);
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await purchasingApi.grnBoxes(grn._id, {
        boxes: [{ bill: cur.bill, received: n }],
        note: note.trim() || undefined,
      });
      res.warnings.forEach((w) => toast(w, { icon: '⚠️', duration: 6000 }));
      onSaved(res.grn, cur.bill);
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
          actions={
            <span className="text-xs text-gray-500">
              {checkedBoxes.length} of {boxes.length} checked
            </span>
          }
        >
          {boxes.length > 6 && (
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a vendor..." className={`${inputClass} !py-1.5 mb-2`} />
          )}
          <ul className="-mx-1 max-h-[60vh] overflow-y-auto space-y-0.5">
            {shown.map((b) => {
              const done = isBoxChecked(grn, b);
              const items = entriesOf(b.bill);
              const off = done && b.received !== b.expected;
              const on = !!cur && b.bill === cur.bill;
              return (
                <li key={b.bill}>
                  <button
                    type="button"
                    onClick={() => pick(b.bill)}
                    className={`w-full text-left rounded-md px-2 py-1.5 flex items-center gap-2 ${on ? 'bg-honey-100 ring-1 ring-honey-400' : 'hover:bg-gray-50'}`}
                  >
                    {done ? (
                      <CheckCircle2 className={`h-4 w-4 flex-shrink-0 ${off ? 'text-amber-600' : 'text-green-600'}`} />
                    ) : (
                      <Circle className="h-4 w-4 flex-shrink-0 text-gray-300" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-gray-900 truncate">{b.vendorName}</span>
                      <span className="block text-[11px] text-gray-500 truncate">
                        {done ? `${b.received} of ${b.expected} came` : `${b.expected} expected · not checked`}
                        {items > 0 && ` · ${items} item${items === 1 ? '' : 's'} entered`}
                      </span>
                    </span>
                    {off && (
                      <span className="text-[11px] font-semibold text-amber-700">{b.received - b.expected > 0 ? `+${b.received - b.expected}` : b.received - b.expected}</span>
                    )}
                  </button>
                </li>
              );
            })}
            {shown.length === 0 && <li className="px-2 py-2 text-xs text-gray-500">No vendor matches.</li>}
          </ul>
        </Card>

        {/* Right: the picked vendor: count, save, unpack */}
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
                {curChecked && <span className="ml-2 text-green-700">· Checked</span>}
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="sm:w-56 flex-shrink-0">
                  <p className="text-[11px] text-gray-500 mb-1">How many came?</p>
                  {curEditable ? (
                    <NumberStepper value={counts[cur.bill] ?? ''} onChange={(v) => setCounts((c) => ({ ...c, [cur.bill]: v }))} min={0} label={`boxes/packs from ${cur.vendorName}`} disabled={busy} />
                  ) : (
                    <p className="text-lg font-semibold text-gray-900">{curChecked ? `${cur.received} came` : '-'}</p>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-gray-500 mb-1">Bill photos / PDFs</p>
                  {curPhotos.length ? <PhotoStrip photos={curPhotos} size="h-20 w-20" /> : <p className="text-xs text-gray-400">No bill photo.</p>}
                </div>
              </div>

              {curEditable && toNum(counts[cur.bill]) !== cur.expected && (
                <div className="mt-3 flex items-start gap-2 text-xs text-amber-800">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span>
                    {toNum(counts[cur.bill]) < cur.expected
                      ? `${cur.expected - toNum(counts[cur.bill])} box(es)/pack(s) missing.`
                      : `${toNum(counts[cur.bill]) - cur.expected} more than the bill.`}{' '}
                    Tell the buyer, and write it in the note.
                  </span>
                </div>
              )}

              <div className="mt-3 space-y-2">
                <ErrorBox message={error} />
                {curEditable ? (
                  <button type="button" onClick={submit} disabled={busy} aria-busy={busy} className={`${primaryBtn} w-full !py-3 text-base`}>
                    {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                    {busy ? 'Saving...' : `Save count & unpack ${cur.vendorName}`}
                  </button>
                ) : curChecked && open ? (
                  <button type="button" onClick={() => onGo(cur.bill)} className={`${primaryBtn} w-full !py-3 text-base`}>
                    <PackageOpen className="h-5 w-5" /> Unpack {cur.vendorName} <ArrowRight className="h-5 w-5" />
                  </button>
                ) : null}
                {mayEdit && curLocked && <p className="text-[11px] text-gray-500">Goods of this vendor are being entered, so its count can no longer be changed.</p>}
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
                <button
                  type="button"
                  onClick={() => prev && pick(prev.bill)}
                  disabled={!prev}
                  className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900 disabled:opacity-30"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Previous
                </button>
                <button
                  type="button"
                  onClick={() => next && pick(next.bill)}
                  disabled={!next}
                  className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900 disabled:opacity-30"
                >
                  Next <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </Card>
          )}

          <Card title="Checked so far">
            <div className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 ${diff === 0 ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'}`}>
              <span className="text-sm font-medium">
                {checkedBoxes.length} of {boxes.length} vendors
                {offCount ? ` · ${offCount} not matching` : ''}
              </span>
              <span className="text-base font-semibold tabular-nums">
                {checkedReceived} of {checkedExpected} boxes/packs
              </span>
            </div>
            <p className="mt-1 text-[11px] text-gray-500">All vendors: {expected} boxes/packs on the bills.</p>
            <div className="mt-3">
              <Field label="Note (optional, saved with the count)">
                {mayEdit && open ? (
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={inputClass} placeholder="e.g. 1 box/pack wet, 1 box/pack torn" disabled={busy} />
                ) : (
                  <p className="text-sm text-gray-800">{grn.boxesNote || '-'}</p>
                )}
              </Field>
            </div>
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
