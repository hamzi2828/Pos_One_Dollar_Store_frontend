'use client';

// Step 2 — Unpack & enter, box by box: pick the vendor, open Box 1, scan or
// search each product (or make a new one), enter pieces + cost per piece
// (+ damaged, + shelf now), save -> stock is in the warehouse at once -> print
// tags and stick them on. "Box done" moves on to the next box.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, ArrowRight, Box, CheckCircle2, ListChecks, Loader2, PackageOpen, PackagePlus, Printer, RotateCcw, ScanLine, Search, X } from 'lucide-react';
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
import { STICKER_SIZES, printTags, saveTagSize, type StickerSize } from './tags';
import { SearchSelect } from '@/components/ui/SearchSelect';

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
}: {
  grn: GoodsReceipt;
  mayEdit: boolean;
  tagSize: StickerSize;
  onTagSize: (s: StickerSize) => void;
  onChanged: (g: GoodsReceipt) => void;
  onReload: () => Promise<void>;
  onFinish: () => void;
}) {
  const progress = billProgress(grn);
  const [billId, setBillId] = useState<string>(() => (progress.find((p) => p.left > 0) || progress[0])?.bill || '');
  const bill = progress.find((p) => p.bill === billId) || progress[0];
  const [unit, setUnit] = useState<ReceivingUnit | null>(null);
  const [presetCost, setPresetCost] = useState<number | null>(null);
  const [saved, setSaved] = useState<EntryResult | null>(null);
  const [newProduct, setNewProduct] = useState<string | null>(null);
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
  const pick = (u: ReceivingUnit, cost: number | null = null) => {
    setUnit(u);
    setPresetCost(cost);
    setSaved(null);
  };

  const lines = useMemo(() => (grn.lines || []).filter((l) => l.bill === bill?.bill), [grn.lines, bill?.bill]);

  if (!bill) return <p className="text-sm text-gray-500">This receipt has no vendor bills.</p>;

  const boxCount = boxCountOf(grn, bill.bill);
  const doneBoxes = doneBoxesOf(grn, bill.bill);
  const box = boxCount ? Math.min(Math.max(boxNo, 1), boxCount) : 0;
  const boxLabel = box ? `Box ${box} of ${boxCount}` : undefined;
  const liveEntries = (grn.entries || []).filter((e) => !e.undone && e.bill === bill.bill);
  const itemsIn = (n: number) => liveEntries.filter((e) => (e.boxNo || 0) === n).length;

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
          toast.success(`Box ${n} done. Now open Box ${next}.`);
        } else {
          toast.success(`All ${boxCount} boxes from ${bill.vendorName} are done.`);
        }
        setUnit(null);
        setSaved(null);
        focusScan();
      }
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not save the box.'));
    } finally {
      setBoxBusy(false);
    }
  };

  /** A product made with the full form: find its unit(s) on this receipt and pick it. */
  const afterCreate = async (p: ProductUI) => {
    setNewProduct(null);
    const cost = p.costPrice && p.costPrice > 0 ? p.costPrice : null;
    try {
      const rows = await purchasingApi.grnLookup(grn._id, p.shortCode || p.sku || p.name, bill.bill);
      const mine = rows.filter((r) => r.productId === p.id);
      if (mine.length === 1) return pick(mine[0], cost);
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

      {/* Which vendor's boxes */}
      <div>
        <p className="text-xs font-medium text-gray-600 mb-1.5">Whose boxes are you opening?</p>
        <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
          {progress.map((p) => {
            const pct = p.billTotal > 0 ? Math.min(100, Math.round((p.entered / p.billTotal) * 100)) : 0;
            const on = p.bill === bill.bill;
            return (
              <button
                key={p.bill}
                type="button"
                onClick={() => {
                  setBillId(p.bill);
                  setBoxNo(firstOpenBox(grn, p.bill));
                  setUnit(null);
                  setSaved(null);
                  setChoices(null);
                }}
                className={`min-w-[10rem] max-w-[14rem] flex-shrink-0 text-left rounded-lg border px-3 py-2 ${on ? 'border-honey-500 bg-honey-50 ring-2 ring-honey-500/30' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
              >
                <p className="text-sm font-semibold text-gray-900 truncate">{p.vendorName}</p>
                <p className="text-[11px] text-gray-600 tabular-nums">
                  {formatRs(p.entered)} / {formatRs(p.billTotal)}
                </p>
                <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className={`h-full ${pct >= 100 ? 'bg-green-500' : 'bg-honey-500'}`} style={{ width: `${pct}%` }} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {boxCount > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-gray-600">
              Which box of {bill.vendorName}? <span className="text-gray-400">({doneBoxes.size} of {boxCount} done)</span>
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
                  className={`min-w-[5.5rem] flex-shrink-0 rounded-lg border px-3 py-2 text-left ${
                    on ? 'border-honey-500 bg-honey-50 ring-2 ring-honey-500/30' : isDone ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <p className="flex items-center gap-1 text-sm font-semibold text-gray-900">
                    {isDone ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Box className="h-4 w-4 text-gray-400" />} Box {n}
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
                  {boxBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Box {box} is done · open again
                </button>
              ) : (
                <button type="button" onClick={() => markBox(box, true)} disabled={boxBusy || !!unit} className={`${primaryBtn} !py-2`}>
                  {boxBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Box {box} done
                  {doneBoxes.size + 1 < boxCount ? ' — next box' : ''}
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
                  title="Which one is in the box?"
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
          <button type="button" onClick={onFinish} className={`${primaryBtn} w-full !py-3 text-base`}>
            Done unpacking — finish <ArrowRight className="h-5 w-5" />
          </button>
          <p className="text-[11px] text-gray-500 text-center">Goods already entered are in the warehouse. You can finish later.</p>
        </div>
      </div>

      {newProduct !== null && canCreateProducts && (
        <FullProductModal vendorName={bill.vendorName} boxLabel={boxLabel} initialName={newProduct} onClose={() => setNewProduct(null)} onCreated={afterCreate} />
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
                  {r.piecesPerBox > 1 && <span>{r.piecesPerBox}/box</span>}
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
  shelfNow: boolean;
  onShelfNow: (v: boolean) => void;
  onCancel: () => void;
  onSaved: (r: EntryResult) => void;
  onSameReceiver: () => void;
  /** the receipt changed state on the server (not started / counted the old way): reload it */
  onStale: () => void;
}) {
  const ppb = Math.max(1, unit.piecesPerBox || 1);
  const left = unit.expected?.qtyLeft || 0;
  const [qty, setQty] = useState(String(left > 0 ? left : ppb > 1 ? ppb : 1));
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

  const n = toNum(qty);
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
    if (!Number.isInteger(n) || n < 1) return setError('Enter how many pieces (1 or more).');
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
          {ppb > 1 && ` · ${ppb} pcs per box`} · from {bill.vendorName}
          {boxLabel && <strong className="text-gray-800"> · {boxLabel}</strong>}
          {unit.expected && <span className="text-honey-800 font-semibold"> · on the bill: {unit.expected.qtyLeft} pcs left</span>}
        </p>

        <Field label="Pieces">
          <NumberStepper value={qty} onChange={setQty} min={0} label="pieces" />
          {ppb > 1 && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setQty(String(n + ppb))} className={`${secondaryBtn} !px-3 !py-2 text-xs`}>
                + 1 box ({ppb})
              </button>
              {[2, 5, 10].map((k) => (
                <button key={k} type="button" onClick={() => setQty(String(k * ppb))} className={`${secondaryBtn} !px-3 !py-2 text-xs`}>
                  {k} boxes
                </button>
              ))}
              <span className="text-[11px] text-gray-500">
                = {boxes} box{boxes === 1 ? '' : 'es'}
                {loose ? ` + ${loose} pcs` : ''}
              </span>
            </div>
          )}
        </Field>

        <Field label="Cost price per piece (Rs)" hint={unit.lastCost ? `Last cost ${formatRs(unit.lastCost, { decimals: 2 })}` : undefined}>
          <input
            ref={costRef}
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
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

        <Disclosure title={<span className="text-sm">Some pieces damaged?{d > 0 && <span className="ml-1 text-red-600">({d})</span>}</span>} defaultOpen={d > 0}>
          <NumberStepper value={damaged} onChange={setDamaged} min={0} max={n} label="damaged pieces" size="md" />
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
            {busy ? 'Saving…' : `Save ${good || ''} pcs`}
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
}: {
  result: EntryResult;
  tagSize: StickerSize;
  onTagSize: (s: StickerSize) => void;
  onNext: (scanned: string) => void;
}) {
  const [printing, setPrinting] = useState(false);
  const [code, setCode] = useState('');
  const lock = useRef(false);
  const e = result.entry;
  const copies = result.tags?.copies ?? e?.stockQty ?? 0;

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
                {e.qty} pcs of <strong>{e.productName}</strong> — {formatRs(e.value)}
                {e.damagedQty > 0 && <span className="text-red-600"> ({e.damagedQty} damaged)</span>}
              </p>
            )}
            {e && <p className="text-xs text-gray-500">{e.shelved > 0 ? `${e.shelved} pcs put on the shelf.` : 'In the warehouse.'}</p>}
          </div>
        </div>
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
            <button type="button" onClick={print} disabled={printing} aria-busy={printing} className={`${primaryBtn} !py-3 text-base`}>
              {printing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Printer className="h-5 w-5" />} Print tags ({copies})
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
