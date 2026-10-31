'use client';

// Step 2 — Unpack & enter, box by box: open a vendor's card, open Box 1, scan or
// search each product (or make a new one), enter pieces + cost per piece
// (+ damaged, + shelf now), save -> stock is in the warehouse at once -> print
// tags and stick them on. "Box done" moves on to the next box.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, ArrowRight, Box, CheckCircle2, Circle, ListChecks, Loader2, PackageOpen, PackagePlus, Printer, RotateCcw, ScanLine, Search, X } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage, formatRs } from '@/lib/storeApi';
import { ErrorBox, Field, Toggle, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import ShelfPicker, { invalidateShelfOptions } from '@/components/store/ShelfPicker';
import { apiErrorCode, newRequestId, purchasingApi, toNum, type EntryResult } from '../../../_shared/purchasingApi';
import { Card, Disclosure, NumberStepper } from '../../../_shared/ui';
import type { GoodsReceipt, GRNBillProgress, GRNLine, ReceivingUnit } from '../../../_shared/types';
import EntriesList from './EntriesList';
import QuickProductModal from './QuickProductModal';
import FullProductModal from './FullProductModal';
import type { ProductUI } from '@/app/(routes)/admin/products/services/productService';
import { SameReceiverNote, marginPct, r2 } from './bits';
import { firstUncheckedBill, isBoxChecked } from './BoxesStep';
import CheckCard from './CheckCard';
import { STICKER_SIZES, printTags, saveTagSize, type StickerSize } from './tags';
import { SearchSelect } from '@/components/ui/SearchSelect';
import MoneyInput from '@/components/ui/MoneyInput';

/** Boxes of a bill that arrived (or were expected when not counted). */
const boxCountOf = (grn: GoodsReceipt, billId: string) => {
  const b = (grn.boxes || []).find((x) => x.bill === billId);
  return b ? b.received || b.expected || 0 : 0;
};
const doneBoxesOf = (grn: GoodsReceipt, billId: string) => new Set((grn.boxesDone || []).filter((d) => d.bill === billId).map((d) => d.boxNo));
/** First box of the bill not done yet (1 when all are done / no boxes). */
const firstOpenBox = (grn: GoodsReceipt, billId: string) => {
  const n = boxCountOf(grn, billId);
  const done = doneBoxesOf(grn, billId);
  for (let i = 1; i <= n; i++) if (!done.has(i)) return i;
  return n ? 1 : 0;
};

/** Per-bill progress: from the server, else worked out from boxes / entries. */
export function billProgress(grn: GoodsReceipt): GRNBillProgress[] {
  if (grn.progress?.byBill?.length) return grn.progress.byBill;
  const bills = grn.purchaseOrder.bills || [];
  return (grn.boxes || []).map((b) => {
    const billTotal = bills.find((x) => x._id === b.bill)?.billTotal || 0;
    const entered = r2((grn.entries || []).filter((e) => !e.undone && e.bill === b.bill).reduce((s, e) => s + e.stockQty * e.costPrice, 0));
    return {
      bill: b.bill,
      vendorName: b.vendorName,
      billNo: b.billNo,
      billTotal,
      entered,
      left: r2(billTotal - entered),
      boxesExpected: b.expected,
      boxesReceived: b.received,
    };
  });
}

export default function UnpackStep({
  grn,
  mayEdit,
  tagSize,
  onTagSize,
  onChanged,
  onReload,
  onFinish,
  startBill,
  onBill,
}: {
  grn: GoodsReceipt;
  mayEdit: boolean;
  tagSize: StickerSize;
  onTagSize: (s: StickerSize) => void;
  onChanged: (g: GoodsReceipt) => void;
  onReload: () => Promise<void>;
  onFinish: () => void;
  /** Vendor bill to open first (picked in step 1). */
  startBill?: string;
  /** The vendor on screen changed (kept in the URL). */
  onBill?: (bill: string) => void;
}) {
  // One step: pick a vendor; not checked yet → count its boxes/packs; checked → unpack it.
  const boxOf = (billId: string) => (grn.boxes || []).find((b) => b.bill === billId);
  const isChecked = (billId: string) => {
    const b = boxOf(billId);
    return !!b && isBoxChecked(grn, b);
  };
  const progress = billProgress(grn);
  const [search, setSearch] = useState('');
  const [showDone, setShowDone] = useState(false);
  // Owner, 2026-10-31: filter the vendor list by opened (unpacking started) / not opened.
  const [openFilter, setOpenFilter] = useState<'all' | 'not_opened' | 'opened'>('all');
  // Correcting the count of a checked vendor (before its goods are entered).
  const [recount, setRecount] = useState(false);
  const [billId, setBillId] = useState<string>(
    () =>
      (progress.find((p) => p.bill === startBill) || progress.find((p) => p.bill === firstUncheckedBill(grn)) || progress.find((p) => p.left > 0) || progress[0])
        ?.bill || '',
  );
  const bill = progress.find((p) => p.bill === billId) || progress[0];
  const [unit, setUnit] = useState<ReceivingUnit | null>(null);
  const [presetCost, setPresetCost] = useState<number | null>(null);
  // Pieces typed in the New product form: the entry is saved straight away.
  const [presetPieces, setPresetPieces] = useState<number | null>(null);
  const [saved, setSaved] = useState<EntryResult | null>(null);
  const [newProduct, setNewProduct] = useState<string | null>(null);
  // New products saved with their own printed barcode (product id -> code): no sticker needed.
  const [ownCodes, setOwnCodes] = useState<Record<string, string>>({});
  useEffect(() => {
    if (bill?.bill) onBill?.(bill.bill);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bill?.bill]);
  const [nextCode, setNextCode] = useState('');
  const [shelfNow, setShelfNow] = useState(false);
  const [sameReceiver, setSameReceiver] = useState(false);
  // Box being unpacked (0 = the bill has no box count).
  const [boxNo, setBoxNo] = useState<number>(() => (billId ? firstOpenBox(grn, billId) : 0));
  const [boxBusy, setBoxBusy] = useState(false);
  // A new product with variants: which one is in the box?
  const [choices, setChoices] = useState<{ units: ReceivingUnit[]; cost: number | null } | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);
  const canEnter = mayEdit && grn.status === 'in_progress';
  const canCreateProducts = useAccess().can('products', 'create');

  const focusScan = () => setTimeout(() => scanRef.current?.focus(), 50);
  const pick = (u: ReceivingUnit, cost: number | null = null, pieces: number | null = null) => {
    setUnit(u);
    setPresetCost(cost);
    setPresetPieces(pieces && pieces > 0 ? pieces : null);
    setSaved(null);
  };

  const lines = useMemo(() => (grn.lines || []).filter((l) => l.bill === bill?.bill), [grn.lines, bill?.bill]);

  if (!bill) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center space-y-3">
        <p className="text-sm text-gray-600">This receipt has no vendor bills.</p>
      </div>
    );
  }

  const boxCount = boxCountOf(grn, bill.bill);
  const doneBoxes = doneBoxesOf(grn, bill.bill);
  const box = boxCount ? Math.min(Math.max(boxNo, 1), boxCount) : 0;
  const boxLabel = box ? `Box/pack ${box} of ${boxCount}` : undefined;
  const liveEntries = (grn.entries || []).filter((e) => !e.undone && e.bill === bill.bill);
  const itemsIn = (n: number) => liveEntries.filter((e) => (e.boxNo || 0) === n).length;
  /** Vendor finished: all its boxes/packs done, or goods worth the whole bill entered. */
  const isOpened = (billId: string) =>
    (grn.entries || []).some((e) => !e.undone && e.bill === billId) || doneBoxesOf(grn, billId).size > 0;
  const vendorDone = (p: (typeof progress)[number]) => {
    if (!isChecked(p.bill)) return false;
    const n = boxCountOf(grn, p.bill);
    return (n > 0 && doneBoxesOf(grn, p.bill).size >= n) || (p.billTotal > 0 && p.entered >= p.billTotal);
  };

  const markBox = async (n: number, done: boolean) => {
    if (boxBusy) return;
    setBoxBusy(true);
    try {
      const g = await purchasingApi.grnBoxDone(grn._id, { bill: bill.bill, boxNo: n, done });
      onChanged(g);
      if (done) {
        const next = (() => {
          const all = new Set([...doneBoxes, n]);
          for (let i = n + 1; i <= boxCount; i++) if (!all.has(i)) return i;
          for (let i = 1; i < n; i++) if (!all.has(i)) return i;
          return 0;
        })();
        if (next) {
          setBoxNo(next);
          toast.success(`Box/pack ${n} done. Now open Box/pack ${next}.`);
        } else {
          toast.success(`All ${boxCount} boxes/packs from ${bill.vendorName} are done.`);
        }
        setUnit(null);
        setSaved(null);
        focusScan();
      }
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not save the box/pack.'));
    } finally {
      setBoxBusy(false);
    }
  };

  /** A product made with the full form: find its unit(s) on this receipt and pick it. */
  const afterCreate = async (p: ProductUI, receivedPieces = 0, barcode?: string) => {
    setNewProduct(null);
    if (barcode) setOwnCodes((m) => ({ ...m, [p.id]: barcode }));
    const cost = p.costPrice && p.costPrice > 0 ? p.costPrice : null;
    try {
      const rows = await purchasingApi.grnLookup(grn._id, p.shortCode || p.sku || p.name, bill.bill);
      const mine = rows.filter((r) => r.productId === p.id);
      if (mine.length === 1) return pick(mine[0], cost, receivedPieces);
      if (mine.length > 1) return setChoices({ units: mine, cost });
    } catch {
      /* fall through */
    }
    toast(`${p.name} was created. Search it to enter the pieces.`, { icon: 'ℹ️' });
    setNextCode(p.shortCode || p.name);
  };

  return (
    <div className="space-y-4">
      {(sameReceiver || !grn.canVerify) && <SameReceiverNote />}

      {/* Same as step 1: checked vendors on the left, the picked vendor on the right. */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] gap-4 items-start">
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <PackageOpen className="h-4 w-4 text-honey-700" /> Vendors ({progress.length})
            </p>
            <span className="text-xs text-gray-500">{progress.filter((p) => isChecked(p.bill)).length} checked</span>
          </div>
          <div className="p-3">
            {progress.length > 6 && (
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a vendor..." className={`${inputClass} !py-1.5 mb-2`} />
            )}
            <div className="mb-2 flex gap-0.5 rounded-md bg-gray-100 p-0.5 text-[11px] leading-4">
              {(
                [
                  ['all', 'All', progress.length],
                  ['not_opened', 'Not opened', progress.filter((p) => !isOpened(p.bill)).length],
                  ['opened', 'Opened', progress.filter((p) => isOpened(p.bill)).length],
                ] as const
              ).map(([key, label, n]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setOpenFilter(key)}
                  className={`flex-1 whitespace-nowrap rounded px-1 py-0.5 font-medium ${openFilter === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  {label} <span className="text-gray-400">{n}</span>
                </button>
              ))}
            </div>
            <ul className="-mx-1 max-h-[60vh] overflow-y-auto space-y-0.5">
              {progress
                .filter((p) => !search.trim() || `${p.vendorName} ${p.billNo || ''}`.toLowerCase().includes(search.trim().toLowerCase()))
                .filter((p) => openFilter === 'all' || (openFilter === 'opened') === isOpened(p.bill))
                .filter((p) => showDone || openFilter === 'opened' || p.bill === bill.bill || !vendorDone(p))
                .map((p) => {
                  const pct = p.billTotal > 0 ? Math.min(100, Math.round((p.entered / p.billTotal) * 100)) : 0;
                  const on = p.bill === bill.bill;
                  const pBoxes = boxCountOf(grn, p.bill);
                  const pDone = doneBoxesOf(grn, p.bill).size;
                  const pItems = (grn.entries || []).filter((e) => !e.undone && e.bill === p.bill).length;
                  const finished = vendorDone(p);
                  const pChecked = isChecked(p.bill);
                  return (
                    <li key={p.bill}>
                      <button
                        type="button"
                        onClick={() => {
                          if (on) return;
                          setBillId(p.bill);
                          setBoxNo(firstOpenBox(grn, p.bill));
                          setUnit(null);
                          setSaved(null);
                          setChoices(null);
                          setRecount(false);
                        }}
                        className={`w-full text-left rounded-md px-2 py-1.5 flex items-center gap-2 ${on ? 'bg-honey-100 ring-1 ring-honey-400' : 'hover:bg-gray-50'}`}
                      >
                        {finished ? (
                          <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-600" />
                        ) : !pChecked ? (
                          <Circle className="h-4 w-4 flex-shrink-0 text-gray-300" />
                        ) : (
                          <PackageOpen className={`h-4 w-4 flex-shrink-0 ${pItems || pDone ? 'text-honey-600' : 'text-gray-300'}`} />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-gray-900 truncate">{p.vendorName}</span>
                          <span className="block text-[11px] text-gray-500 truncate">
                            {!pChecked
                              ? `Not checked · ${boxOf(p.bill)?.expected ?? 0} boxes/packs expected`
                              : `${finished ? 'Done' : pItems || pDone ? 'Unpacking' : 'Checked'} · ${pItems} item${pItems === 1 ? '' : 's'}${pBoxes > 0 ? ` · ${pDone}/${pBoxes} boxes/packs` : ''}`}
                          </span>
                          <span className="mt-1 block h-1 rounded-full bg-gray-100 overflow-hidden">
                            <span className={`block h-full ${pct >= 100 ? 'bg-green-500' : 'bg-honey-500'}`} style={{ width: `${pct}%` }} />
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
            </ul>
            {(() => {
              const hidden = progress.filter((p) => p.bill !== bill.bill && vendorDone(p)).length;
              return openFilter !== 'opened' && (hidden > 0 || showDone) ? (
                <button
                  type="button"
                  onClick={() => setShowDone((v) => !v)}
                  className="mt-2 w-full rounded-md border border-dashed border-gray-300 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                >
                  {showDone ? 'Hide done vendors' : `Show done vendors (${hidden})`}
                </button>
              ) : null;
            })()}
          </div>
        </div>

        {(() => {
          const pct = bill.billTotal > 0 ? Math.min(100, Math.round((bill.entered / bill.billTotal) * 100)) : 0;
          const idx = progress.findIndex((p) => p.bill === bill.bill);
          return (
            <div className="min-w-0 rounded-xl border border-honey-300 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm sm:text-base font-semibold text-gray-900 truncate">{bill.vendorName}</p>
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    Vendor {idx + 1} of {progress.length}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-[11px] text-gray-500 whitespace-nowrap">{bill.billNo ? `Bill ${bill.billNo}` : 'No bill no.'}</span>
                  <span className="h-1.5 flex-1 rounded-full bg-gray-100 overflow-hidden">
                    <span className={`block h-full ${pct >= 100 ? 'bg-green-500' : 'bg-honey-500'}`} style={{ width: `${pct}%` }} />
                  </span>
                  <span className="text-[11px] text-gray-600 tabular-nums whitespace-nowrap">
                    {formatRs(bill.entered)} / {formatRs(bill.billTotal)}
                  </span>
                </div>
              </div>
                <div className="p-3 sm:p-4 space-y-4">
              {(!isChecked(bill.bill) || recount) && boxOf(bill.bill) ? (
                <CheckCard
                  key={`${bill.bill}-${recount}`}
                  grn={grn}
                  box={boxOf(bill.bill)!}
                  mayEdit={mayEdit}
                  onCancel={recount ? () => setRecount(false) : undefined}
                  onSameReceiver={() => setSameReceiver(true)}
                  onSaved={(g) => {
                    onChanged(g);
                    setRecount(false);
                    setBoxNo(firstOpenBox(g, bill.bill));
                    focusScan();
                  }}
                />
              ) : (
              <>
              {(() => {
                const b = boxOf(bill.bill);
                if (!b) return null;
                const locked = liveEntries.length > 0;
                return (
                  <p className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                    <CheckCircle2 className="h-4 w-4 text-green-600" /> Boxes/packs checked: <strong className="text-gray-900">{b.received} of {b.expected}</strong> came
                    {mayEdit && !locked && grn.status === 'in_progress' && (
                      <button type="button" onClick={() => setRecount(true)} className="text-honey-700 underline hover:text-honey-800">
                        Change count
                      </button>
                    )}
                  </p>
                );
              })()}
              {boxCount > 0 && (
                <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-medium text-gray-600">
                      Which box/pack of {bill.vendorName}? <span className="text-gray-400">({doneBoxes.size} of {boxCount} done)</span>
                    </p>
                  </div>
                  <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
                    {Array.from({ length: boxCount }, (_, i) => i + 1).map((n) => {
                      const on = n === box;
                      const isDone = doneBoxes.has(n);
                      const items = itemsIn(n);
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => {
                            setBoxNo(n);
                            setUnit(null);
                            setSaved(null);
                            setChoices(null);
                          }}
                          className={`min-w-[7rem] flex-shrink-0 rounded-lg border px-3 py-2 text-left ${
                            on ? 'border-honey-500 bg-honey-50 ring-2 ring-honey-500/30' : isDone ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                          }`}
                        >
                          <p className="flex items-center gap-1 text-sm font-semibold text-gray-900">
                            {isDone ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Box className="h-4 w-4 text-gray-400" />} Box/pack {n}
                          </p>
                          <p className="text-[11px] text-gray-500">{isDone ? 'Done' : items ? `${items} item${items === 1 ? '' : 's'}` : 'Not opened'}</p>
                        </button>
                      );
                    })}
                  </div>
                  {canEnter && (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
                      <p className="flex items-center gap-1.5 text-sm text-gray-700">
                        <PackageOpen className="h-4 w-4 text-honey-700" />
                        <span>
                          Opening <strong>{boxLabel}</strong> · {itemsIn(box)} item{itemsIn(box) === 1 ? '' : 's'} entered
                        </span>
                      </p>
                      {doneBoxes.has(box) ? (
                        <button type="button" onClick={() => markBox(box, false)} disabled={boxBusy} className={`${secondaryBtn} !py-2 text-xs`}>
                          {boxBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Box/pack {box} is done · open again
                        </button>
                      ) : (
                        <button type="button" onClick={() => markBox(box, true)} disabled={boxBusy || !!unit} className={`${primaryBtn} !py-2`}>
                          {boxBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Box/pack {box} done
                          {doneBoxes.size + 1 < boxCount ? ' — next box/pack' : ''}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 items-start">
                <div className="xl:col-span-3 space-y-4">
                  {canEnter ? (
                    <>
                      {saved ? (
                        <SavedCard
                          result={saved}
                          ownBarcode={ownCodes[saved.tags?.productId || saved.entry?.product || '']}
                          tagSize={tagSize}
                          onTagSize={(s) => {
                            onTagSize(s);
                            saveTagSize(s);
                          }}
                          onNext={(code) => {
                            setNextCode(code);
                            setSaved(null);
                            focusScan();
                          }}
                        />
                      ) : unit ? (
                        <EntryForm
                          grn={grn}
                          bill={bill}
                          boxNo={box}
                          boxLabel={boxLabel}
                          unit={unit}
                          presetCost={presetCost}
                          presetPieces={presetPieces}
                          shelfNow={shelfNow}
                          onShelfNow={setShelfNow}
                          onCancel={() => {
                            setUnit(null);
                            focusScan();
                          }}
                          onSameReceiver={() => setSameReceiver(true)}
                          onStale={onReload}
                          onSaved={(res) => {
                            setUnit(null);
                            setSaved(res);
                            if (res.repeated) toast('This was already saved — not entered twice.', { icon: 'ℹ️' });
                            res.warnings.forEach((w) => toast(w, { icon: '⚠️', duration: 7000 }));
                            if (res.grn && 'grnNumber' in res.grn) onChanged(res.grn);
                            else onReload();
                          }}
                        />
                      ) : choices ? (
                        <Card
                          className="border-honey-300"
                          title="Which one is in the box/pack?"
                          actions={
                            <button type="button" onClick={() => setChoices(null)} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">
                              Cancel
                            </button>
                          }
                        >
                          <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                            {choices.units.map((r) => (
                              <li key={`${r.productId}|${r.variantId || ''}`}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const cost = choices.cost;
                                    setChoices(null);
                                    pick(r, cost);
                                  }}
                                  className="w-full text-left px-3 py-2.5 hover:bg-honey-50"
                                >
                                  <span className="text-sm font-medium text-gray-900">{r.name || r.productName}</span>
                                  {r.variantLabel && <span className="text-sm text-gray-500"> · {r.variantLabel}</span>}
                                  {r.code && <span className="ml-2 font-mono text-[11px] text-gray-500">#{r.code}</span>}
                                </button>
                              </li>
                            ))}
                          </ul>
                        </Card>
                      ) : (
                        <LookupBox
                          key={nextCode || 'scan'}
                          grnId={grn._id}
                          billId={bill.bill}
                          initialCode={nextCode}
                          inputRef={scanRef}
                          onPick={(u) => {
                            setNextCode('');
                            pick(u);
                          }}
                          onNew={(text) => setNewProduct(text)}
                        />
                      )}
                    </>
                  ) : (
                    grn.status === 'in_progress' && !grn.canVerify ? null : (
                      <p className="text-sm text-gray-500">You can look at the entries but not add new ones.</p>
                    )
                  )}

                  {lines.length > 0 && <Checklist lines={lines} grn={grn} disabled={!canEnter || !!unit} onPick={(u) => pick(u)} />}
                </div>

                <div className="xl:col-span-2 space-y-4">
                  <EntriesList grn={grn} canUndo={canEnter} tagSize={tagSize} onChanged={onChanged} onReload={onReload} billFilter={bill.bill} />
                </div>
              </div>

              {/* Done with this vendor? Next one that is not done. */}
              {(() => {
                const at = progress.findIndex((p) => p.bill === bill.bill);
                const nextP = [...progress.slice(at + 1), ...progress.slice(0, at)].find((p) => !vendorDone(p));
                if (!nextP) return null;
                return (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-honey-200 bg-honey-50 px-3 py-2.5">
                    <p className="text-xs text-gray-700">
                      Done with <strong>{bill.vendorName}</strong>?
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setBillId(nextP.bill);
                        setBoxNo(firstOpenBox(grn, nextP.bill));
                        setUnit(null);
                        setSaved(null);
                        setChoices(null);
                        setRecount(false);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className={`${primaryBtn} !py-2 text-sm`}
                    >
                      Next: {nextP.vendorName} <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                );
              })()}
              </>
              )}

                </div>
            </div>
          );
        })()}
      </div>

      <div className="space-y-1">
        <button type="button" onClick={onFinish} className={`${primaryBtn} w-full !py-3 text-base`}>
          Done unpacking — finish <ArrowRight className="h-5 w-5" />
        </button>
        <p className="text-[11px] text-gray-500 text-center">Goods already entered are in the warehouse. You can finish later.</p>
      </div>

      {newProduct !== null && canCreateProducts && (
        <FullProductModal vendorName={bill.vendorName} vendorId={boxOf(bill.bill)?.vendor || undefined} boxLabel={boxLabel} initialName={newProduct} onClose={() => setNewProduct(null)} onCreated={afterCreate} />
      )}
      {newProduct !== null && !canCreateProducts && (
        <QuickProductModal
          grnId={grn._id}
          vendorName={bill.vendorName}
          initialName={newProduct}
          onClose={() => setNewProduct(null)}
          onCreated={(u, cost) => {
            setNewProduct(null);
            pick(u, cost > 0 ? cost : null);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- scan / search

function LookupBox({
  grnId,
  billId,
  initialCode = '',
  inputRef,
  onPick,
  onNew,
}: {
  grnId: string;
  billId: string;
  /** code scanned on the "Saved" card: looked up straight away */
  initialCode?: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onPick: (u: ReceivingUnit) => void;
  onNew: (typed: string) => void;
}) {
  const [q, setQ] = useState(initialCode);
  const [rows, setRows] = useState<ReceivingUnit[] | null>(null);
  const [searched, setSearched] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const run = useCallback(
    async (term: string) => {
      const my = ++seq.current;
      if (!term) {
        setRows(null);
        setLoading(false);
        return null;
      }
      setLoading(true);
      setError(null);
      try {
        const data = await purchasingApi.grnLookup(grnId, term, billId);
        if (my !== seq.current) return null;
        setRows(data);
        setSearched(term);
        return data;
      } catch (e) {
        if (my === seq.current) setError(apiErrorMessage(e, 'Search failed.'));
        return null;
      } finally {
        if (my === seq.current) setLoading(false);
      }
    },
    [grnId, billId],
  );

  // Live search while typing a name (scanners finish with Enter long before this fires).
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      if (!term) setRows(null);
      return;
    }
    const t = setTimeout(() => run(term), 350);
    return () => clearTimeout(t);
  }, [q, run]);

  const choose = (u: ReceivingUnit) => {
    setQ('');
    setRows(null);
    onPick(u);
  };

  const onEnter = async (text = q) => {
    const term = text.trim();
    if (!term) return;
    const data = searched === term && rows ? rows : await run(term);
    if (!data) return;
    const exact = data.find((r) => (r.code || '').toUpperCase() === term.toUpperCase() || (r.sku || '').toUpperCase() === term.toUpperCase());
    const only = exact || (data.length === 1 ? data[0] : null);
    if (only) choose(only);
  };

  // A code scanned on the "Saved" card: look it up once, like an Enter.
  const firstRun = useRef(initialCode);
  useEffect(() => {
    const code = firstRun.current;
    firstRun.current = '';
    if (code) onEnter(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <ScanLine className="h-4 w-4 text-honey-700" /> Scan or search a product
        </span>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onEnter();
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            ref={inputRef}
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Scan barcode or type name / code"
            className={`${inputClass} !h-12 !text-base pl-10 pr-9`}
            autoComplete="off"
            enterKeyHint="search"
          />
          {loading ? (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
          ) : (
            q && (
              <button type="button" onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" aria-label="Clear">
                <X className="h-4 w-4" />
              </button>
            )
          )}
        </div>
        <button type="submit" className={`${secondaryBtn} !h-12`} disabled={loading || !q.trim()} aria-label="Search">
          <Search className="h-5 w-5" />
        </button>
        <button type="button" onClick={() => onNew(q)} className={`${primaryBtn} !h-12 whitespace-nowrap`} title="Make a new product (not in the system yet)">
          <PackagePlus className="h-5 w-5" /> <span className="hidden sm:inline">New product</span>
        </button>
      </form>
      <ErrorBox message={error} />

      {rows && rows.length > 0 && (
        <ul className="mt-3 divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
          {rows.map((r) => (
            <li key={`${r.productId}|${r.variantId || ''}`}>
              <button type="button" onClick={() => choose(r)} className="w-full text-left px-3 py-2.5 hover:bg-honey-50 active:bg-honey-100">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {r.name || r.productName}
                    {r.variantLabel && <span className="text-gray-500 font-normal"> · {r.variantLabel}</span>}
                  </span>
                  <span className="text-sm font-semibold text-gray-800 whitespace-nowrap">{formatRs(r.salePrice)}</span>
                </div>
                <div className="text-[11px] text-gray-500 flex flex-wrap gap-x-3">
                  {r.code && <span className="font-mono">#{r.code}</span>}
                  {r.piecesPerBox > 1 && <span>{r.piecesPerBox * (r.piecesPerSale || 1)} per box/pack</span>}
                  {(r.piecesPerSale || 1) > 1 && <span className="font-semibold text-gray-700">sold {r.piecesPerSale} together</span>}
                  {r.lastCost !== null && r.lastCost !== undefined && <span>Last cost {formatRs(r.lastCost, { decimals: 2 })}</span>}
                  {r.expected && <span className="text-honey-800 font-semibold">On this bill: {r.expected.qtyLeft} pcs left</span>}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {rows && rows.length === 0 && !loading && (
        <div className="mt-3 rounded-lg border border-dashed border-gray-300 p-3 text-center">
          <p className="text-sm text-gray-600 mb-2">No product found for “{searched}”.</p>
          <button type="button" onClick={() => onNew(searched)} className={primaryBtn}>
            <PackagePlus className="h-4 w-4" /> New product
          </button>
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- entry form

function EntryForm({
  grn,
  bill,
  boxNo,
  boxLabel,
  unit,
  presetCost,
  presetPieces = null,
  shelfNow,
  onShelfNow,
  onCancel,
  onSaved,
  onSameReceiver,
  onStale,
}: {
  grn: GoodsReceipt;
  bill: GRNBillProgress;
  /** box being unpacked (0 = no box count) */
  boxNo: number;
  boxLabel?: string;
  unit: ReceivingUnit;
  presetCost: number | null;
  /** pieces typed in the New product form: start with them and save straight away */
  presetPieces?: number | null;
  shelfNow: boolean;
  onShelfNow: (v: boolean) => void;
  onCancel: () => void;
  onSaved: (r: EntryResult) => void;
  onSameReceiver: () => void;
  /** the receipt changed state on the server (not started / counted the old way): reload it */
  onStale: () => void;
}) {
  const ppb = Math.max(1, unit.piecesPerBox || 1); // sales in one box/pack
  const pps = Math.max(1, unit.piecesPerSale || 1); // pieces in one sale (e.g. 2 plates)
  const left = unit.expected?.qtyLeft || 0;
  // Typed in PIECES counted; saved as sales (pieces / pieces per sale).
  const [qty, setQty] = useState(String(presetPieces && presetPieces > 0 ? presetPieces : (left > 0 ? left : ppb > 1 ? ppb : 1) * pps));
  const startCost = presetCost ?? unit.expected?.unitPrice ?? unit.lastCost ?? null;
  const [cost, setCost] = useState(startCost !== null && startCost > 0 ? String(startCost) : '');
  const [damaged, setDamaged] = useState('0');
  const [shelfId, setShelfId] = useState<string | null>(null);
  const [shelfQty, setShelfQty] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const costRef = useRef<HTMLInputElement>(null);
  // One id per item being entered: pressing Save again after a lost answer never enters it twice.
  const requestId = useRef(newRequestId());

  const pieces = toNum(qty);
  const n = pps > 1 ? pieces / pps : pieces; // sales
  const d = toNum(damaged);
  const good = Math.max(0, n - d);
  const c = toNum(cost);
  const rate = grn.chargeRate || 0;
  const full = r2(c * (1 + rate));
  const margin = marginPct(unit.salePrice, c, rate);
  const value = r2(n * c);
  const boxes = ppb > 1 ? Math.floor(n / ppb) : 0;
  const loose = ppb > 1 ? n % ppb : 0;
  const shelfN = shelfQty === '' ? good : toNum(shelfQty);

  const save = async () => {
    if (lock.current) return;
    if (pps > 1 && Number.isInteger(pieces) && pieces % pps !== 0) {
      return setError(`${pieces} pieces do not make whole sales of ${pps}. Count again (e.g. ${Math.floor(pieces / pps) * pps} = ${Math.floor(pieces / pps)} sales).`);
    }
    if (!Number.isInteger(n) || n < 1) return setError(pps > 1 ? `Enter the pieces you counted (${pps} or more).` : 'Enter how many pieces (1 or more).');
    if (!(c > 0)) return setError('Enter the cost price per piece.');
    if (!Number.isInteger(d) || d < 0 || d > n) return setError('Damaged pieces must be between 0 and the pieces entered.');
    if (shelfNow) {
      if (!shelfId) return setError('Choose the shelf, or turn off “Put on a shelf now”.');
      if (!Number.isInteger(shelfN) || shelfN < 1 || shelfN > good) return setError(`Pieces for the shelf must be 1 to ${good}.`);
    }
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await purchasingApi.grnAddEntry(grn._id, {
        bill: bill.bill,
        productId: unit.productId,
        variantId: unit.variantId,
        qty: n,
        costPrice: c,
        damagedQty: d || undefined,
        ...(boxNo > 0 ? { boxNo } : {}),
        ...(shelfNow && shelfId ? { shelfId, shelfQty: shelfN } : {}),
        requestId: requestId.current,
      });
      if (shelfNow) invalidateShelfOptions();
      onSaved(res);
    } catch (e) {
      const code = apiErrorCode(e);
      if (code === 'SAME_RECEIVER') onSameReceiver();
      if (code === 'NOT_STARTED' || code === 'COUNTED_BY_LINES') onStale();
      setError(apiErrorMessage(e, 'Could not save this entry.'));
      lock.current = false;
      setBusy(false);
    }
  };

  // Pieces were typed with the new product: save at once (a problem shows here to fix).
  const autoSaved = useRef(false);
  useEffect(() => {
    if (autoSaved.current || !presetPieces) return;
    autoSaved.current = true;
    save();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card
      className="border-honey-300"
      title={<span className="block truncate">{unit.name || unit.productName}</span>}
      actions={
        <button type="button" onClick={onCancel} disabled={busy} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">
          Change
        </button>
      }
    >
      <fieldset disabled={busy} className="min-w-0 space-y-4">
        <p className="text-[11px] text-gray-500 -mt-1">
          {unit.code && <span className="font-mono">#{unit.code} · </span>}
          Sale price <strong className="text-gray-800">{formatRs(unit.salePrice)}</strong>
          {ppb > 1 && ` · ${ppb * pps} pcs per box/pack`}
          {pps > 1 && <strong className="text-gray-800"> · sold {pps} together</strong>} · from {bill.vendorName}
          {boxLabel && <strong className="text-gray-800"> · {boxLabel}</strong>}
          {unit.expected && <span className="text-honey-800 font-semibold"> · on the bill: {unit.expected.qtyLeft} pcs left</span>}
        </p>

        <Field label={pps > 1 ? `Pieces counted (sold ${pps} together)` : 'Pieces'}>
          <NumberStepper value={qty} onChange={setQty} min={0} label="pieces" />
          {pps > 1 && pieces > 0 && (
            <p className={`mt-1 text-xs font-semibold ${pieces % pps ? 'text-red-600' : 'text-gray-700'}`}>
              {pieces % pps ? `${pieces} pieces do not split into sales of ${pps}` : `= ${n} sale${n === 1 ? '' : 's'} of ${pps} (${n} tag${n === 1 ? '' : 's'})`}
            </p>
          )}
          {ppb > 1 && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setQty(String(pieces + ppb * pps))} className={`${secondaryBtn} !px-3 !py-2 text-xs`}>
                + 1 box/pack ({ppb * pps})
              </button>
              {[2, 5, 10].map((k) => (
                <button key={k} type="button" onClick={() => setQty(String(k * ppb * pps))} className={`${secondaryBtn} !px-3 !py-2 text-xs`}>
                  {k} boxes/packs
                </button>
              ))}
              <span className="text-[11px] text-gray-500">
                = {boxes} box{boxes === 1 ? '' : 'es'}/pack{boxes === 1 ? '' : 's'}
                {loose ? ` + ${loose} pcs` : ''}
              </span>
            </div>
          )}
        </Field>

        <Field label={pps > 1 ? `Cost price per sale (${pps} pieces) (Rs)` : 'Cost price per piece (Rs)'} hint={unit.lastCost ? `Last cost ${formatRs(unit.lastCost, { decimals: 2 })}` : undefined}>
          <MoneyInput
            ref={costRef}
            value={cost}
            onValue={setCost}
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            className={`${inputClass} !h-12 !text-lg font-semibold`}
            placeholder="0"
          />
        </Field>
        {c > 0 && (
          <div
            className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${
              margin === null ? 'bg-gray-50 text-gray-600' : margin < 0 ? 'bg-red-50 text-red-700' : margin < 15 ? 'bg-amber-50 text-amber-800' : 'bg-green-50 text-green-800'
            }`}
          >
            {margin !== null && margin < 15 && <AlertTriangle className="h-4 w-4 flex-shrink-0" />}
            <span>
              {n} × {formatRs(c, { decimals: 2 })} = <strong>{formatRs(value)}</strong>
              {rate > 0 && ` · with trip costs ${formatRs(full, { decimals: 2 })}/pc`}
              {margin !== null && (margin < 0 ? ` · LOSS: costs more than the sale price` : ` · profit about ${margin}%`)}
            </span>
          </div>
        )}

        <Disclosure title={<span className="text-sm">{pps > 1 ? `Some sales of ${pps} damaged?` : 'Some pieces damaged?'}{d > 0 && <span className="ml-1 text-red-600">({d})</span>}</span>} defaultOpen={d > 0}>
          <NumberStepper value={damaged} onChange={setDamaged} min={0} max={n} label={pps > 1 ? 'damaged sales' : 'damaged pieces'} size="md" />
          <p className="mt-1 text-[11px] text-gray-500">Damaged pieces are not put into stock; their money can be claimed back from the vendor at the end.</p>
        </Disclosure>

        <div className="rounded-lg border border-gray-200 p-3 space-y-3">
          <Toggle
            checked={shelfNow}
            onChange={onShelfNow}
            label="Put on a shelf now"
            hint={shelfNow ? 'Pieces go straight onto the shelf.' : 'Stays in the warehouse. Send it later from Warehouse → Shop.'}
          />
          {shelfNow && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Shelf">
                <ShelfPicker value={shelfId} onChange={(s) => setShelfId(s?._id ?? null)} />
              </Field>
              <Field label="Pieces on the shelf" hint={`Up to ${good}`}>
                <input
                  type="number"
                  min={1}
                  max={good}
                  inputMode="numeric"
                  value={shelfQty === '' ? String(good) : shelfQty}
                  onChange={(e) => setShelfQty(e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
          )}
        </div>

        <ErrorBox message={error} />
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className={`${secondaryBtn} !py-3`}>
            Cancel
          </button>
          <button type="button" onClick={save} disabled={busy} aria-busy={busy} className={`${primaryBtn} flex-1 !py-3 text-base`}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
            {busy ? 'Saving…' : pps > 1 ? `Save ${Number.isInteger(good) ? good : 0} sales (${(Number.isInteger(good) ? good : 0) * pps} pcs)` : `Save ${good || ''} pcs`}
          </button>
        </div>
      </fieldset>
    </Card>
  );
}

// ---------------------------------------------------------------- saved + tags

function SavedCard({
  result,
  tagSize,
  onTagSize,
  onNext,
  ownBarcode,
}: {
  result: EntryResult;
  /** The item has its own printed barcode: no sticker needed. */
  ownBarcode?: string;
  tagSize: StickerSize;
  onTagSize: (s: StickerSize) => void;
  onNext: (scanned: string) => void;
}) {
  const [printing, setPrinting] = useState(false);
  const [code, setCode] = useState('');
  const lock = useRef(false);
  const e = result.entry;
  const pps = Math.max(1, result.tags?.piecesPerSale || e?.piecesPerSale || 1);
  const copies = result.tags?.copies ?? (e?.stockQty ?? 0) * pps;

  const print = async () => {
    if (lock.current || !copies) return;
    lock.current = true;
    setPrinting(true);
    await printTags({ productId: result.tags?.productId || e.product, variantId: result.tags?.variantId ?? e.variantId, copies }, tagSize);
    lock.current = false;
    setPrinting(false);
  };

  return (
    <Card className="border-green-300">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-8 w-8 text-green-600 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-base font-semibold text-gray-900">Saved</p>
            {e && (
              <p className="text-sm text-gray-700">
                {pps > 1 ? `${e.qty} sales (${e.qty * pps} pcs)` : `${e.qty} pcs`} of <strong>{e.productName}</strong> — {formatRs(e.value)}
                {e.damagedQty > 0 && <span className="text-red-600"> ({e.damagedQty} damaged)</span>}
              </p>
            )}
            {e && <p className="text-xs text-gray-500">{e.shelved > 0 ? `${e.shelved} pcs put on the shelf.` : 'In the warehouse.'}</p>}
            {pps > 1 && copies > 0 && (
              <p className="mt-1 text-xs font-semibold text-gray-800">
                Sold {pps} together: stick one tag on every piece ({copies} tags). At the counter, scan any one piece of a set.
              </p>
            )}
          </div>
        </div>
        {ownBarcode && (
          <p className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
            <ScanLine className="h-4 w-4 flex-shrink-0" /> Has its own barcode <span className="font-mono">{ownBarcode}</span>. No sticker needed.
          </p>
        )}
        {copies > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
            <Field label="Tag size">
              <SearchSelect value={tagSize} onChange={(ev) => onTagSize(ev.target.value as StickerSize)} className={inputClass}>
                {STICKER_SIZES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </SearchSelect>
            </Field>
            <button type="button" onClick={print} disabled={printing} aria-busy={printing} className={`${ownBarcode ? secondaryBtn : primaryBtn} !py-3 text-base`}>
              {printing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Printer className="h-5 w-5" />} {ownBarcode ? 'Print tags anyway' : 'Print tags'} ({copies})
            </button>
          </div>
        )}
        <form
          onSubmit={(ev) => {
            ev.preventDefault();
            onNext(code.trim());
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              value={code}
              onChange={(ev) => setCode(ev.target.value)}
              autoFocus
              placeholder="Scan next item…"
              className={`${inputClass} !h-12 !text-base pl-10`}
              autoComplete="off"
              enterKeyHint="go"
              aria-label="Scan next item"
            />
          </div>
          <button type="submit" className={`${secondaryBtn} !h-12 whitespace-nowrap`}>
            Next item <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- typed items checklist

function Checklist({ lines, grn, disabled, onPick }: { lines: GRNLine[]; grn: GoodsReceipt; disabled: boolean; onPick: (u: ReceivingUnit) => void }) {
  const expected = lines.reduce((s, l) => s + l.expectedQty, 0);
  const got = lines.reduce((s, l) => s + Math.min(l.receivedQty, l.expectedQty), 0);
  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-honey-700" /> Items on the bill
        </span>
      }
      actions={
        <span className="text-xs text-gray-600 tabular-nums">
          {got} of {expected} pcs entered
        </span>
      }
    >
      <ul className="divide-y divide-gray-100 -my-2">
        {lines.map((l) => {
          const left = Math.max(0, l.expectedQty - l.receivedQty);
          const done = left === 0;
          return (
            <li key={l._id} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0 flex items-start gap-2">
                {done ? <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" /> : <span className="h-4 w-4 rounded-full border-2 border-gray-300 flex-shrink-0 mt-0.5" />}
                <div className="min-w-0">
                  <p className={`text-sm leading-tight ${done ? 'text-gray-500' : 'text-gray-900 font-medium'}`}>{l.productName}</p>
                  <p className="text-[11px] text-gray-500 tabular-nums">
                    {l.receivedQty} of {l.expectedQty} pcs · {formatRs(l.unitPrice, { decimals: 2 })}/pc
                  </p>
                </div>
              </div>
              {!done && !disabled && !l.productDeleted && (
                <button
                  type="button"
                  onClick={() =>
                    onPick({
                      productId: l.product,
                      variantId: l.variantId,
                      name: l.productName,
                      code: l.code,
                      salePrice: l.salePrice ?? 0,
                      lastCost: null,
                      piecesPerBox: l.piecesPerBox || 1,
                      expected: { lineId: l._id, qtyLeft: left, unitPrice: l.unitPrice },
                    })
                  }
                  className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-md bg-honey-500 text-gray-900 hover:bg-honey-600"
                >
                  Enter
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {grn.status === 'in_progress' && <p className="mt-3 text-[11px] text-gray-500">Not on the list? Scan it above — extra items are fine.</p>}
    </Card>
  );
}
