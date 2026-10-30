'use client';

// OLD receipts (before the Oct 2026 "check boxes -> unpack & enter" flow):
// count every line, mark damaged, then complete. Kept so receipts that were
// started the old way can still be finished.
import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { AlertTriangle, ArrowLeft, CheckCircle2, ClipboardCheck, Loader2, PackageCheck, Play, ScanLine, Upload } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage, formatDate, formatRs } from '@/lib/storeApi';
import { HelpBox, Modal, Toggle, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { purchasingApi, toNum } from '../../../_shared/purchasingApi';
import { Card, GRNStatusBadge, PhotoPicker, PhotoStrip, StatTile } from '../../../_shared/ui';
import type { GoodsReceipt, GRNLine } from '../../../_shared/types';

type SaveBody = Parameters<typeof purchasingApi.grnSave>[1];

export default function OldCounting({ grn, setGrn }: { grn: GoodsReceipt; setGrn: (g: GoodsReceipt) => void }) {
  const { can } = useAccess();
  const id = grn._id;
  const [busy, setBusy] = useState<string | null>(null);
  const [review, setReview] = useState(false);
  const inflight = useRef(new Set<Promise<unknown>>());

  /** Save counts; tracked so "Review & complete" waits for the last save. */
  const save = useCallback(
    async (body: SaveBody) => {
      const p = purchasingApi.grnSave(id, body);
      inflight.current.add(p);
      try {
        setGrn(await p);
        return true;
      } catch (e) {
        toast.error(apiErrorMessage(e, 'Could not save the count.'));
        return false;
      } finally {
        inflight.current.delete(p);
      }
    },
    [id, setGrn],
  );

  const mayEdit = can('goods_receiving', 'edit') && grn.canVerify;
  const counting = grn.status === 'in_progress' && mayEdit;
  const posting = grn.lines.some((l) => l.posted) && grn.status === 'in_progress'; // a completion failed half way
  const t = grn.summary.totals;

  const start = async () => {
    if (busy) return;
    setBusy('start');
    try {
      setGrn(await purchasingApi.grnStart(grn._id));
      toast.success('Receiving started — scan or count every item');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not start.'));
    } finally {
      setBusy(null);
    }
  };

  const receivedAll = async () => {
    if (busy) return;
    const lines = grn.lines.filter((l) => l.receivedQty < l.expectedQty).map((l) => ({ lineId: l._id, receivedQty: l.expectedQty }));
    if (!lines.length) return;
    if (!window.confirm(`Mark all ${lines.length} remaining lines as fully received?`)) return;
    setBusy('all');
    await save({ lines });
    setBusy(null);
  };

  const openReview = async () => {
    await Promise.all([...inflight.current]);
    setReview(true);
  };

  const byBill = groupByBill(grn.lines);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
          <div className="min-w-0">
            <Link href="/admin/purchasing/receiving" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mb-1">
              <ArrowLeft className="h-3.5 w-3.5" /> Receive goods
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">{grn.grnNumber}</h1>
              <GRNStatusBadge status={grn.status} />
            </div>
            <p className="mt-0.5 text-xs sm:text-sm text-gray-500">
              {can('purchase_orders', 'view') ? (
                <Link href={`/admin/purchasing/orders/${grn.purchaseOrder._id}`} className="underline hover:text-gray-700">{grn.poNumber}</Link>
              ) : (
                grn.poNumber
              )}{' '}
              · bought by {grn.buyerName || '—'}
              {grn.receiverName && ` · received by ${grn.receiverName}`}
              {grn.completedAt && ` · completed ${formatDate(grn.completedAt, true)}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {grn.status === 'pending' && mayEdit && (
              <button className={primaryBtn} onClick={start} disabled={!!busy}>
                {busy === 'start' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Start counting
              </button>
            )}
            {counting && !posting && (
              <button className={secondaryBtn} onClick={receivedAll} disabled={!!busy}>
                <ClipboardCheck className="h-4 w-4" /> {busy === 'all' ? 'Saving…' : 'All received'}
              </button>
            )}
            {counting && (
              <button className={primaryBtn} onClick={openReview} disabled={!!busy}>
                <PackageCheck className="h-4 w-4" /> {posting ? 'Finish completing' : 'Review & complete'}
              </button>
            )}
          </div>
        </div>

        {!grn.canVerify && grn.status !== 'completed' && grn.status !== 'cancelled' && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>You bought these goods, so another staff member must verify and receive them.</span>
          </div>
        )}
        {posting && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>Completing stopped half way ({grn.lines.filter((l) => l.posted).length} of {grn.lines.length} lines are in stock). Fix the problem and press &quot;Finish completing&quot; — nothing is received twice.</span>
          </div>
        )}

        {/* Totals */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          <StatTile label="Expected" value={`${t.expected} pcs`} sub={`${grn.expectedCartons} cartons`} />
          <StatTile label="Received" value={`${t.received} pcs`} sub={`${grn.cartonsReceived || 0} cartons`} tone={t.received === t.expected ? 'green' : 'gray'} />
          <StatTile label="Short" value={t.short} tone={t.short ? 'amber' : 'gray'} />
          <StatTile label="Damaged" value={t.damaged} tone={t.damaged ? 'red' : 'gray'} />
          <StatTile label="To warehouse" value={`${t.accepted} pcs`} sub={formatRs(t.stockValue)} tone="honey" />
          <StatTile label="Claim from vendors" value={formatRs(t.claimed)} sub={grn.claimFromVendor ? 'debit notes' : 'not claimed'} />
        </div>

        {grn.status === 'pending' && mayEdit && (
          <HelpBox>This receipt uses the old way of counting. Press <strong>Start counting</strong>, then scan each piece (or a box/pack barcode) or type the counts. Damaged pieces are not put into stock.</HelpBox>
        )}

        {counting && !posting && <ScanBar grnId={grn._id} onScanned={setGrn} />}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
          <div className="xl:col-span-2 space-y-4">
            {byBill.map(({ key, vendorName, billNo, lines }) => (
              <Card key={key} title={`${vendorName}${billNo ? ` · bill ${billNo}` : ''}`} actions={<span className="text-xs text-gray-500">{lines.length} lines</span>}>
                <div className="overflow-x-auto -mx-4 px-4">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead className="text-[11px] text-gray-500 uppercase tracking-wide">
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 pr-2">Product</th>
                        <th className="text-right py-2 px-2">Expected</th>
                        <th className="text-right py-2 px-2 w-24">Received</th>
                        <th className="text-right py-2 px-2 w-24">Damaged</th>
                        <th className="text-right py-2 px-2">Short</th>
                        <th className="text-right py-2 px-2">To stock</th>
                        {grn.status === 'completed' && <th className="text-right py-2 pl-2">Landed cost</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {lines.map((l) => (
                        <LineRow key={l._id} line={l} editable={counting && !posting} completed={grn.status === 'completed'} onSave={save} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ))}
          </div>

          <div className="space-y-4">
            <Card title="Builty">
              <div className="text-xs text-gray-600 space-y-1 mb-2">
                <p>No. {grn.builty.builtyNo || '—'} · {grn.builty.transporter || 'transporter —'}</p>
                <p>{formatDate(grn.builty.date)} · {grn.builty.cartons} cartons</p>
              </div>
              <PhotoStrip photos={grn.builty.photos || []} />
              {(grn.purchaseOrder.bills || []).some((b) => b.photos.length) && (
                <div className="mt-3">
                  <p className="text-[11px] text-gray-500 mb-1">Vendor bill photos / PDFs</p>
                  <PhotoStrip photos={(grn.purchaseOrder.bills || []).flatMap((b) => b.photos)} />
                </div>
              )}
            </Card>
            <ReceiptDetails grn={grn} editable={counting && !posting} onSave={save} onPhotos={setGrn} />
            {grn.status === 'completed' && <ResultCard grn={grn} />}
          </div>
        </div>
      </div>

      {review && <ReviewModal grn={grn} onClose={() => setReview(false)} onDone={(g) => { setGrn(g); setReview(false); }} />}
    </div>
  );
}

function groupByBill(lines: GRNLine[]) {
  const map = new Map<string, { key: string; vendorName: string; billNo: string; lines: GRNLine[] }>();
  for (const l of lines) {
    const g = map.get(l.bill) || { key: l.bill, vendorName: l.vendorName, billNo: l.billNo, lines: [] };
    g.lines.push(l);
    map.set(l.bill, g);
  }
  return [...map.values()];
}

/** Barcode scanner input: every Enter counts the scanned code once (box codes count a full box). */
function ScanBar({ grnId, onScanned }: { grnId: string; onScanned: (g: GoodsReceipt) => void }) {
  const [code, setCode] = useState('');
  const [damaged, setDamaged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<{ ok: boolean; text: string } | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  const scan = async () => {
    const c = code.trim();
    if (!c || busy) return;
    setBusy(true);
    try {
      const res = await purchasingApi.grnScan(grnId, c, damaged);
      onScanned(res.data);
      const s = res.scanned || [];
      setLast({ ok: true, text: s.map((x) => `+${x.added} ${x.productName} (${x.receivedQty}/${x.expectedQty})`).join(', ') + (damaged ? ' — damaged' : '') });
    } catch (e) {
      setLast({ ok: false, text: apiErrorMessage(e, 'Scan failed') });
    } finally {
      setCode('');
      setBusy(false);
      ref.current?.focus();
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-honey-200 p-3 sm:p-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative flex-1">
          <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-honey-700" />
          <input
            ref={ref}
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && scan()}
            placeholder="Scan barcode or type code + Enter"
            className={`${inputClass} pl-9`}
            disabled={busy}
          />
        </div>
        <Toggle checked={damaged} onChange={setDamaged} label="Damaged" hint="Count scans as damaged" />
      </div>
      {last && <p className={`mt-2 text-xs ${last.ok ? 'text-green-700' : 'text-red-600'}`}>{last.text}</p>}
    </div>
  );
}

/** One line: received / damaged inputs save when they lose focus. */
function LineRow({ line, editable, completed, onSave }: { line: GRNLine; editable: boolean; completed: boolean; onSave: (b: SaveBody) => Promise<boolean> }) {
  const [received, setReceived] = useState(String(line.receivedQty));
  const [damaged, setDamaged] = useState(String(line.damagedQty));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setReceived(String(line.receivedQty));
    setDamaged(String(line.damagedQty));
  }, [line.receivedQty, line.damagedQty]);

  const commit = async () => {
    const r = toNum(received);
    const d = toNum(damaged);
    if (r === line.receivedQty && d === line.damagedQty) return;
    if (!Number.isInteger(r) || r < 0 || r > line.expectedQty) {
      toast.error(`Received must be 0 to ${line.expectedQty}`);
      setReceived(String(line.receivedQty));
      return;
    }
    if (!Number.isInteger(d) || d < 0 || d > r) {
      toast.error('Damaged cannot be more than received');
      setDamaged(String(line.damagedQty));
      return;
    }
    setBusy(true);
    const ok = await onSave({ lines: [{ lineId: line._id, receivedQty: r, damagedQty: d }] });
    if (!ok) {
      setReceived(String(line.receivedQty));
      setDamaged(String(line.damagedQty));
    }
    setBusy(false);
  };

  const r = toNum(received);
  const d = Math.min(toNum(damaged), r);
  const short = Math.max(0, line.expectedQty - r);
  const accepted = Math.max(0, r - d);
  const full = r === line.expectedQty && d === 0;
  const rowTone = d > 0 ? 'bg-red-50/60' : short > 0 && r > 0 ? 'bg-amber-50/60' : full ? 'bg-green-50/50' : '';
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && (e.target as HTMLInputElement).blur();
  const cell = `${inputClass} !px-2 !py-1 text-right`;

  return (
    <tr className={`${rowTone} ${busy ? 'opacity-60' : ''}`}>
      <td className="py-2 pr-2">
        <p className="font-medium text-gray-900 leading-tight flex items-center gap-1">
          {full && <CheckCircle2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />}
          {line.productName}
        </p>
        <p className="text-[11px] text-gray-500">
          {line.code && `#${line.code}`}
          {line.piecesPerBox > 1 && ` · ${line.piecesPerBox} per box/pack`}
          {line.productDeleted && <span className="text-red-600"> · product deleted</span>}
        </p>
      </td>
      <td className="py-2 px-2 text-right">{line.expectedQty}</td>
      <td className="py-2 px-2 text-right">
        {editable ? (
          <input type="number" min={0} max={line.expectedQty} inputMode="numeric" value={received} onChange={(e) => setReceived(e.target.value)} onBlur={commit} onKeyDown={onKey} className={cell} disabled={busy} aria-label="Received" />
        ) : (
          line.receivedQty
        )}
      </td>
      <td className="py-2 px-2 text-right">
        {editable ? (
          <input type="number" min={0} inputMode="numeric" value={damaged} onChange={(e) => setDamaged(e.target.value)} onBlur={commit} onKeyDown={onKey} className={cell} disabled={busy} aria-label="Damaged" />
        ) : (
          <span className={line.damagedQty ? 'text-red-600 font-semibold' : ''}>{line.damagedQty}</span>
        )}
      </td>
      <td className={`py-2 px-2 text-right ${short ? 'text-amber-700 font-semibold' : 'text-gray-400'}`}>{short}</td>
      <td className="py-2 px-2 text-right font-semibold text-gray-900">{accepted}</td>
      {completed && <td className="py-2 pl-2 text-right">{line.acceptedQty ? formatRs(line.landedUnitCost, { decimals: 2 }) : '—'}</td>}
    </tr>
  );
}

function ReceiptDetails({ grn, editable, onSave, onPhotos }: { grn: GoodsReceipt; editable: boolean; onSave: (b: SaveBody) => Promise<boolean>; onPhotos: (g: GoodsReceipt) => void }) {
  const [cartons, setCartons] = useState(String(grn.cartonsReceived || ''));
  const [notes, setNotes] = useState(grn.notes || '');
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => setCartons(String(grn.cartonsReceived || '')), [grn.cartonsReceived]);

  const upload = async () => {
    if (!files.length || uploading) return;
    setUploading(true);
    try {
      onPhotos(await purchasingApi.grnPhotos(grn._id, files));
      setFiles([]);
      toast.success('Photos added');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not upload.'));
    } finally {
      setUploading(false);
    }
  };

  const mismatch = toNum(cartons) > 0 && toNum(cartons) !== grn.expectedCartons;
  return (
    <Card title="Unloading">
      <div className="space-y-3">
        <label className="block text-xs text-gray-600">
          Cartons received <span className="text-gray-400">(builty: {grn.expectedCartons})</span>
          {editable ? (
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={cartons}
              onChange={(e) => setCartons(e.target.value)}
              onBlur={() => toNum(cartons) !== grn.cartonsReceived && onSave({ cartonsReceived: toNum(cartons) })}
              className={inputClass}
            />
          ) : (
            <p className="text-sm text-gray-900">{grn.cartonsReceived || 0}</p>
          )}
        </label>
        {mismatch && <p className="text-xs text-amber-700">Carton count differs from the builty.</p>}
        <label className="block text-xs text-gray-600">
          Notes
          {editable ? (
            <textarea value={notes} rows={2} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== grn.notes && onSave({ notes })} className={inputClass} placeholder="e.g. 1 carton wet" />
          ) : (
            <p className="text-sm text-gray-900">{grn.notes || '—'}</p>
          )}
        </label>
        <Toggle
          checked={grn.claimFromVendor}
          disabled={!editable}
          onChange={(v) => onSave({ claimFromVendor: v })}
          label="Claim short & damaged from vendor"
          hint={grn.claimFromVendor ? 'A debit note reduces what we owe each vendor.' : 'Not claimed: their cost is added to the pieces that arrived.'}
        />
        <div>
          <p className="text-xs text-gray-600 mb-1">Photos (damage, cartons)</p>
          <PhotoStrip photos={grn.photos || []} />
          {(grn.status === 'pending' || grn.status === 'in_progress') && editable && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <PhotoPicker files={files} onChange={setFiles} max={5} />
              {files.length > 0 && (
                <button type="button" onClick={upload} disabled={uploading} className={secondaryBtn}>
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

/** What completing will do: stock lines at landed cost, vendor claims. Confirm posts it. */
function ReviewModal({ grn, onClose, onDone }: { grn: GoodsReceipt; onClose: () => void; onDone: (g: GoodsReceipt) => void }) {
  const [busy, setBusy] = useState(false);
  const s = grn.summary;
  const notArrived = useMemo(() => s.lines.filter((l) => l.received === 0), [s.lines]);
  const toStock = s.lines.filter((l) => l.accepted > 0);

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const g = await purchasingApi.grnComplete(grn._id);
      toast.success(`${grn.grnNumber} completed — ${g.summary.totals.accepted} pcs in the warehouse`);
      onDone(g);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not complete.'), { duration: 8000 });
      // Reload state: some lines may already be in stock.
      try {
        onDone(await purchasingApi.grnGet(grn._id));
      } catch {
        /* keep the modal */
      }
      setBusy(false);
    }
  };

  return (
    <Modal
      wide
      title={`Complete ${grn.grnNumber}`}
      subtitle="Check what goes into stock and what is claimed from vendors."
      icon={<PackageCheck className="h-5 w-5" />}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button className={secondaryBtn} onClick={onClose} disabled={busy}>Back to counting</button>
          <button className={primaryBtn} onClick={confirm} disabled={busy}>{busy ? 'Completing…' : `Put ${s.totals.accepted} pcs into warehouse`}</button>
        </>
      }
    >
      <div className="space-y-4">
        {notArrived.length > 0 && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>Nothing counted for: {notArrived.map((l) => l.productName).join(', ')}. They will be treated as short.</span>
          </div>
        )}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Into the warehouse ({s.totals.accepted} pcs · {formatRs(s.totals.stockValue)})</h3>
          {toStock.length === 0 ? (
            <p className="text-xs text-gray-500">Nothing will be put into stock.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[520px]">
                <thead className="text-[11px] text-gray-500 uppercase">
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-1.5 pr-2">Product</th>
                    <th className="text-right py-1.5 px-2">Pieces</th>
                    <th className="text-right py-1.5 px-2">Vendor price</th>
                    <th className="text-right py-1.5 px-2">+ Charges</th>
                    <th className="text-right py-1.5 pl-2">Landed / pc</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {toStock.map((l) => (
                    <tr key={l.lineId}>
                      <td className="py-1.5 pr-2">
                        {l.productName}
                        <span className="text-gray-400"> · {l.vendorName}</span>
                      </td>
                      <td className="py-1.5 px-2 text-right">{l.accepted}</td>
                      <td className="py-1.5 px-2 text-right">{formatRs(l.unitPrice, { decimals: 2 })}</td>
                      <td className="py-1.5 px-2 text-right text-gray-600">{formatRs(l.allocatedCharges)}</td>
                      <td className="py-1.5 pl-2 text-right font-semibold">{formatRs(l.landedUnitCost, { decimals: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {s.totals.unallocatedCharges > 0 && <p className="mt-1 text-[11px] text-red-600">{formatRs(s.totals.unallocatedCharges)} of charges have no pieces to sit on.</p>}
        </div>
        <ClaimsList grn={grn} />
      </div>
    </Modal>
  );
}

function ClaimsList({ grn }: { grn: GoodsReceipt }) {
  const s = grn.summary;
  const short = s.totals.short + s.totals.damaged;
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 mb-2">Claimed from vendors</h3>
      {!s.claimFromVendor ? (
        <p className="text-xs text-gray-600">{short ? `${short} short / damaged pieces are not claimed — their cost is added to the pieces that arrived.` : 'Nothing short or damaged.'}</p>
      ) : s.claims.length === 0 ? (
        <p className="text-xs text-gray-600">Nothing short or damaged — no claim.</p>
      ) : (
        <ul className="divide-y divide-gray-100 text-xs">
          {s.claims.map((c) => (
            <li key={c.bill} className="flex items-center justify-between py-1.5">
              <span>
                {c.vendorName}
                {c.billNo && <span className="text-gray-400"> · bill {c.billNo}</span>}
                <span className="text-gray-500"> — {c.shortQty} short, {c.damagedQty} damaged</span>
              </span>
              <span className="font-semibold text-red-600">− {formatRs(c.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ResultCard({ grn }: { grn: GoodsReceipt }) {
  return (
    <Card title="Result">
      <div className="space-y-3">
        <p className="text-xs text-gray-600">
          {grn.summary.totals.accepted} pieces are in the <strong>warehouse</strong> at landed cost ({formatRs(grn.summary.totals.stockValue)}). Put them on shelves from the
          {' '}<Link href="/admin/inventory/putaway" className="underline">Putaway</Link> page.
        </p>
        <ClaimsList grn={grn} />
      </div>
    </Card>
  );
}
