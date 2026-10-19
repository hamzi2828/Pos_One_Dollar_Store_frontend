'use client';

// Step 3 — Finish: per vendor bill vs entered, claim the shortfall back, close.
// Plus the "all done" screen.
import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, CheckCircle2, ClipboardList, Loader2, PackageCheck, Store } from 'lucide-react';
import { apiErrorMessage, formatDate, formatRs } from '@/lib/storeApi';
import { ErrorBox, Field, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { apiErrorCode, purchasingApi } from '../../../_shared/purchasingApi';
import { Card, StatTile } from '../../../_shared/ui';
import type { GoodsReceipt } from '../../../_shared/types';
import { SameReceiverNote, r2 } from './bits';
import { billProgress } from './UnpackStep';

/** pieces = entered incl. damaged; good = put in the warehouse. */
function pieceTotals(grn: GoodsReceipt) {
  if (grn.progress) {
    const { pieces, damaged } = grn.progress;
    return { pieces, damaged, good: grn.progress.stocked ?? Math.max(0, pieces - damaged) };
  }
  const live = (grn.entries || []).filter((e) => !e.undone);
  const pieces = live.reduce((s, e) => s + e.qty, 0);
  const damaged = live.reduce((s, e) => s + (e.damagedQty || 0), 0);
  return { pieces, damaged, good: pieces - damaged };
}

/** Per bill: the server's Finish preview (`closing`), else worked out from progress. */
function finishRows(grn: GoodsReceipt) {
  const prog = billProgress(grn);
  const closing = grn.closing?.byBill || [];
  return prog.map((p) => {
    const c = closing.find((x) => x.bill === p.bill);
    const diff = r2(c ? c.difference : p.billTotal - p.entered);
    return {
      bill: p.bill,
      vendorName: c?.vendorName || p.vendorName,
      billNo: c?.billNo ?? p.billNo,
      billTotal: c?.billTotal ?? p.billTotal,
      entered: c?.entered ?? p.entered,
      diff,
      claimDefault: c ? !!c.claim && diff > 0 : diff > 0,
      warning: c?.warning || null,
      boxesExpected: p.boxesExpected,
      boxesReceived: p.boxesReceived,
    };
  });
}

export default function FinishStep({
  grn,
  mayEdit,
  onBack,
  onDone,
}: {
  grn: GoodsReceipt;
  mayEdit: boolean;
  onBack: () => void;
  onDone: (g: GoodsReceipt) => void;
}) {
  const rows = finishRows(grn);
  const [claims, setClaims] = useState<Record<string, boolean>>(() => Object.fromEntries(rows.map((r) => [r.bill, r.claimDefault])));
  const [notes, setNotes] = useState(grn.notes || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sameReceiver, setSameReceiver] = useState(false);
  const lock = useRef(false);

  const boxes = grn.boxes || [];
  const boxesExpected = boxes.reduce((s, b) => s + b.expected, 0);
  const boxesReceived = boxes.reduce((s, b) => s + b.received, 0);
  const { pieces, damaged } = pieceTotals(grn);
  const entries = (grn.entries || []).filter((e) => !e.undone).length;
  const shortLines = grn.closing?.shortLines
    ? grn.closing.shortLines.map((l, i) => ({
        _id: l.lineId || String(i),
        productName: l.productName,
        vendorName: l.vendorName || '',
        receivedQty: l.receivedQty ?? Math.max(0, (l.expectedQty || 0) - (l.shortQty || 0)),
        expectedQty: l.expectedQty ?? 0,
      }))
    : (grn.lines || []).filter((l) => l.receivedQty < l.expectedQty);
  const serverWarnings = grn.closing?.warnings || [];
  const nothingFrom = rows.filter((r) => r.entered === 0 && r.billTotal > 0);
  const claimTotal = r2(rows.reduce((s, r) => s + (r.diff > 0 && claims[r.bill] ? r.diff : 0), 0));
  const canFinish = mayEdit && grn.status === 'in_progress';

  const finish = async () => {
    if (lock.current || !canFinish) return;
    const wholeBills = nothingFrom.filter((r) => claims[r.bill]);
    if (
      wholeBills.length &&
      !window.confirm(
        `Nothing was entered from ${wholeBills.map((r) => r.vendorName).join(', ')}.\nThe WHOLE bill (${formatRs(wholeBills.reduce((s, r) => s + r.billTotal, 0))}) will be claimed back.\n\nFinish anyway?`,
      )
    )
      return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await purchasingApi.grnFinish(grn._id, {
        claims: rows.map((r) => ({ bill: r.bill, claim: r.diff > 0 && !!claims[r.bill] })),
        notes: notes.trim() || undefined,
      });
      res.warnings.forEach((w) => toast(w, { icon: '⚠️', duration: 7000 }));
      onDone(res.grn);
    } catch (e) {
      if (apiErrorCode(e) === 'SAME_RECEIVER') setSameReceiver(true);
      else setError(apiErrorMessage(e, 'Could not finish.'));
      lock.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      {(sameReceiver || !grn.canVerify) && <SameReceiverNote />}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatTile label="Boxes" value={`${boxesReceived} of ${boxesExpected}`} tone={boxesReceived === boxesExpected ? 'green' : 'amber'} />
        <StatTile label="Pieces entered" value={pieces} sub={`${entries} entries`} />
        <StatTile label="Damaged" value={damaged} tone={damaged ? 'red' : 'gray'} />
        <StatTile label="Claim back" value={formatRs(claimTotal)} tone={claimTotal ? 'amber' : 'gray'} />
      </div>

      {serverWarnings.length > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <ul className="space-y-0.5">
            {serverWarnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}
      <Card
        title={
          <span className="flex items-center gap-2">
            <Store className="h-4 w-4 text-honey-700" /> Each vendor
          </span>
        }
      >
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.bill} className="rounded-lg border border-gray-200 p-3">
              <p className="text-sm font-semibold text-gray-900">
                {r.vendorName}
                {r.billNo && <span className="font-normal text-gray-500"> · bill {r.billNo}</span>}
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-md bg-gray-50 px-2 py-1.5">
                  <p className="text-[11px] text-gray-500">Bill</p>
                  <p className="font-semibold text-gray-900">{formatRs(r.billTotal)}</p>
                </div>
                <div className="rounded-md bg-gray-50 px-2 py-1.5">
                  <p className="text-[11px] text-gray-500">Entered</p>
                  <p className="font-semibold text-gray-900">{formatRs(r.entered)}</p>
                </div>
                <div className={`rounded-md px-2 py-1.5 ${r.diff > 0 ? 'bg-amber-50' : r.diff < 0 ? 'bg-blue-50' : 'bg-green-50'}`}>
                  <p className="text-[11px] text-gray-500">Difference</p>
                  <p className={`font-semibold ${r.diff > 0 ? 'text-amber-700' : r.diff < 0 ? 'text-blue-700' : 'text-green-700'}`}>
                    {r.diff === 0 ? 'None' : formatRs(Math.abs(r.diff))}
                  </p>
                </div>
              </div>
              {r.entered === 0 && r.billTotal > 0 && (
                <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-red-700">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  Nothing entered from this vendor. If ticked, the whole bill is claimed back. Untick if you still owe it (e.g. goods coming later).
                </p>
              )}
              {r.warning && <p className="mt-2 text-xs text-amber-700">{r.warning}</p>}
              {r.diff > 0 && (
                <label className={`mt-3 flex items-start gap-3 rounded-lg p-2.5 ${claims[r.bill] ? 'bg-amber-50' : 'bg-gray-50'} ${canFinish ? 'cursor-pointer' : ''}`}>
                  <input
                    type="checkbox"
                    checked={!!claims[r.bill]}
                    disabled={!canFinish || busy}
                    onChange={(e) => setClaims((c) => ({ ...c, [r.bill]: e.target.checked }))}
                    className="mt-0.5 h-5 w-5 rounded border-gray-300 accent-honey-500"
                  />
                  <span className="text-sm text-gray-800">
                    Claim <strong>{formatRs(r.diff)}</strong> back from {r.vendorName}
                    <span className="block text-[11px] text-gray-500">
                      {claims[r.bill] ? 'We will owe them less (goods not received or damaged).' : 'Not claimed: we still owe the full bill.'}
                    </span>
                  </span>
                </label>
              )}
              {r.diff < 0 && <p className="mt-2 text-xs text-blue-700">{formatRs(-r.diff)} more was entered than the bill. Check the cost prices — nothing is added to the vendor account.</p>}
              {r.boxesExpected !== r.boxesReceived && (
                <p className="mt-2 text-[11px] text-amber-700">
                  Boxes: {r.boxesReceived} of {r.boxesExpected} came.
                </p>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {shortLines.length > 0 && (
        <Card
          title={
            <span className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-gray-500" /> Typed items not fully entered
            </span>
          }
        >
          <ul className="space-y-1 text-xs text-gray-700">
            {shortLines.map((l) => (
              <li key={l._id} className="flex justify-between gap-2">
                <span className="min-w-0 truncate">
                  {l.productName} <span className="text-gray-400">· {l.vendorName}</span>
                </span>
                <span className="text-amber-700 whitespace-nowrap">
                  {l.receivedQty} of {l.expectedQty} pcs
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-gray-500">Just for your information — the money difference above already counts them.</p>
        </Card>
      )}

      {canFinish && (
        <Card>
          <div className="space-y-3">
            <Field label="Note (optional)">
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} disabled={busy} placeholder="Anything the owner should know" />
            </Field>
            {!entries && (
              <div className="flex items-start gap-2 text-xs text-red-700">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" /> Nothing has been entered yet — finishing now claims every ticked bill back in full.
              </div>
            )}
            <ErrorBox message={error} />
            <div className="flex gap-2">
              <button type="button" onClick={onBack} disabled={busy} className={`${secondaryBtn} !py-3`}>
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <button type="button" onClick={finish} disabled={busy} aria-busy={busy} className={`${primaryBtn} flex-1 !py-3 text-base`}>
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <PackageCheck className="h-5 w-5" />}
                {busy ? 'Finishing…' : 'Finish'}
              </button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

/** After Finish. */
export function DoneView({ grn }: { grn: GoodsReceipt }) {
  const { good, damaged } = pieceTotals(grn);
  const claimed = r2((grn.claims || []).reduce((s, c) => s + (c.amount || 0), 0));
  const inWarehouse = (grn.entries || []).filter((e) => !e.undone).reduce((s, e) => s + Math.max(0, e.stockQty - e.shelved), 0);
  return (
    <div className="space-y-4 max-w-2xl">
      <div className="bg-white rounded-xl shadow-sm border border-green-200 p-5 text-center">
        <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-2" />
        <h2 className="text-lg font-semibold text-gray-900">All done</h2>
        <p className="text-sm text-gray-600">
          {good} pieces received{damaged ? `, ${damaged} damaged` : ''}
          {claimed > 0 && ` · ${formatRs(claimed)} claimed back from vendors`}.
        </p>
        {grn.completedAt && <p className="text-[11px] text-gray-400 mt-1">Finished {formatDate(grn.completedAt, true)}{grn.receiverName && ` by ${grn.receiverName}`}</p>}
        <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-center">
          <Link href="/admin/inventory/putaway" className={`${primaryBtn} !py-3`}>
            <PackageCheck className="h-5 w-5" /> Put goods on shelves{inWarehouse > 0 ? ` (${inWarehouse} pcs)` : ''}
          </Link>
          <Link href="/admin/purchasing/orders" className={`${secondaryBtn} !py-3`}>
            Back to purchases
          </Link>
        </div>
      </div>
      {(grn.claims || []).length > 0 && (
        <Card title="Claimed back">
          <ul className="divide-y divide-gray-100 text-sm -my-2">
            {grn.claims.map((c) => (
              <li key={c.bill} className="flex justify-between gap-2 py-2">
                <span className="min-w-0 truncate">
                  {c.vendorName}
                  {c.billNo && <span className="text-gray-400"> · bill {c.billNo}</span>}
                </span>
                <span className="font-semibold text-amber-700 whitespace-nowrap">− {formatRs(c.amount)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
