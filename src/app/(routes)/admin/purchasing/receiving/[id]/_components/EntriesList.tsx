'use client';

// Goods entered on this trip (newest first): tags again, undo, edit.
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { History, ListChecks, Loader2, Pencil, Printer, Undo2 } from 'lucide-react';
import { Field, Modal, inputClass, primaryBtn } from '@/components/admin/FormBits';
import MoneyInput from '@/components/ui/MoneyInput';
import { apiErrorMessage, formatDate, formatRs } from '@/lib/storeApi';
import { isReceipt, purchasingApi } from '../../../_shared/purchasingApi';
import { Card } from '../../../_shared/ui';
import type { GoodsReceipt, GRNEntry } from '../../../_shared/types';
import { STICKER_SIZES, printTags, type StickerSize } from './tags';
import PrintLogModal from './PrintLogModal';
import { billProgress } from './UnpackStep';
import ProductForm from '@/app/(routes)/admin/products/components/ProductForm';
import type { Product } from '@/app/(routes)/admin/products/components/AllProducts';
import type { Category } from '@/app/(routes)/admin/products/components/CategoriesTab';
import { loadCreateTabData } from '@/app/(routes)/admin/products/services/productOptionsService';
import { productService, type ProductUI } from '@/app/(routes)/admin/products/services/productService';

export default function EntriesList({
  grn,
  canUndo,
  tagSize,
  onTagSize,
  onChanged,
  onReload,
  billFilter,
}: {
  grn: GoodsReceipt;
  canUndo: boolean;
  tagSize: StickerSize;
  /** Change the sticker size used by the Tags buttons. */
  onTagSize?: (s: StickerSize) => void;
  onChanged: (g: GoodsReceipt) => void;
  onReload: () => Promise<void>;
  /** show only this vendor bill (null = all) */
  billFilter?: string | null;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<GRNEntry | null>(null);
  const [logOf, setLogOf] = useState<GRNEntry | null>(null);
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

  // Owner, 2026-11-02: the print log is kept per vendor. Tags / "left" use this product's pieces
  // from this entry's vendor (all its live entries there).
  const productPieces = (e: GRNEntry) =>
    all
      .filter((x) => x.product === e.product && (x.variantId || null) === (e.variantId || null) && x.bill === e.bill)
      .reduce((n, x) => n + (x.stockQty || 0) * Math.max(1, x.piecesPerSale || 1), 0);

  const tags = async (e: GRNEntry) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(`tags-${e._id}`);
    await printTags({ productId: e.product, variantId: e.variantId, copies: productPieces(e), bill: e.bill }, tagSize);
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
      {onTagSize && rows.length > 0 && (
        <label className="mb-2 flex items-center gap-2 text-xs text-gray-600">
          <Printer className="h-3.5 w-3.5 flex-shrink-0" /> Sticker size
          <select
            value={tagSize}
            onChange={(ev) => onTagSize(ev.target.value as StickerSize)}
            className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-900"
          >
            {STICKER_SIZES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      )}
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
                  <button
                    type="button"
                    onClick={() => setLogOf(e)}
                    className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                    title="Stickers printed: how many, which way, who and when"
                  >
                    <History className="h-3.5 w-3.5" /> Print log
                  </button>
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
      {logOf && <PrintLogModal productId={logOf.product} variantId={logOf.variantId} name={logOf.productName} need={productPieces(logOf)} bill={logOf.bill} vendorName={logOf.vendorName} onClose={() => setLogOf(null)} />}
      {editing && (
        <EditEntryModal
          grn={grn}
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
  grn,
  grnId,
  entry,
  boxes,
  onClose,
  onSaved,
}: {
  grn: GoodsReceipt;
  grnId: string;
  entry: GRNEntry;
  boxes: number;
  onClose: () => void;
  onSaved: (g: GoodsReceipt | undefined) => Promise<void>;
}) {
  const perSale = Math.max(1, entry.piecesPerSale || 1);
  const [qty, setQty] = useState(String(entry.qty));
  const [damaged, setDamaged] = useState(String(entry.damagedQty || 0));
  // The entry keeps the cost of one sale; the box takes one piece's cost.
  const [cost, setCost] = useState(String(Math.round(((Number(entry.costPrice) || 0) / perSale) * 10000) / 10000));
  const [boxNo, setBoxNo] = useState(String(entry.boxNo || ''));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ product: ProductUI; categories: Category[]; colorOptions: string[]; sizeOptions: string[] } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const q = Math.floor(Number(qty) || 0);
  const d = Math.floor(Number(damaged) || 0);
  const piece = Number(cost) || 0;
  const c = Math.round(piece * perSale * 10000) / 10000;
  const unit = perSale > 1 ? 'sales' : 'pcs';

  // Order totals after this edit: only good pieces count (good × cost), like the bill progress.
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const delta = r2(Math.max(0, q - d) * c - (entry.stockQty || 0) * (Number(entry.costPrice) || 0));
  const bills = billProgress(grn);
  const myBill = bills.find((b) => b.bill === entry.bill);
  const tripBill = grn.progress?.billTotal ?? bills.reduce((t, b) => t + b.billTotal, 0);
  const tripEntered = grn.progress?.entered ?? bills.reduce((t, b) => t + b.entered, 0);
  const totals = [
    ...(myBill ? [{ label: `${myBill.vendorName}${myBill.billNo ? ` · bill ${myBill.billNo}` : ''}`, bill: myBill.billTotal, entered: r2(myBill.entered + delta) }] : []),
    { label: 'Whole trip', bill: tripBill, entered: r2(tripEntered + delta) },
  ];

  // Product stock and cost after this edit (same math as the server: the old
  // pieces go out, the new good pieces come in at cost + charges, averaged).
  const fromEntry = (() => {
    const p = form?.product as unknown as { stock?: number; costPrice?: number } | undefined;
    if (!p || entry.variantId) return undefined;
    const stock = Number(p.stock) || 0;
    const avg = Number(p.costPrice) || 0;
    const oldGood = entry.stockQty || 0;
    const newGood = Math.max(0, q - d);
    const rate = typeof grn.chargeRate === 'number' ? grn.chargeRate : Number(entry.costPrice) > 0 ? (Number(entry.landedUnitCost) || 0) / Number(entry.costPrice) - 1 : 0;
    const landed = c * (1 + rate);
    const rest = Math.max(0, stock - oldGood);
    const cost = !newGood ? avg : rest > 0 && avg > 0 ? (rest * avg + newGood * landed) / (rest + newGood) : landed;
    return { stock: rest + newGood, costPrice: Math.round(cost * 100) / 100 };
  })();

  // The full product form (same as Products → Edit): name, barcodes, prices, category.
  useEffect(() => {
    let alive = true;
    Promise.all([productService.getProductById(entry.product), loadCreateTabData()])
      .then(([product, opts]) => {
        if (!alive) return;
        setForm({
          product,
          categories: (opts.categories as unknown as Category[]).filter((x) => x.active),
          colorOptions: opts.colorOptions,
          sizeOptions: opts.sizeOptions,
        });
      })
      .catch(() => alive && setFormError('Could not load the product. Close and try again.'));
    return () => {
      alive = false;
    };
  }, [entry.product]);

  const save = async () => {
    if (q < 1) return setError(`Enter how many ${unit}.`);
    if (d > q) return setError(`Damaged (${d}) cannot be more than ${q}.`);
    if (!(piece > 0)) return setError('Enter the cost price.');
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
      wide="xl"
      title={`Edit ${entry.productName}`}
      subtitle={`${entry.vendorName}${entry.code ? ` · #${entry.code}` : ''}`}
      icon={<Pencil className="h-5 w-5" />}
      onClose={onClose}
      busy={saving}
    >
      <section className="rounded-xl border border-honey-300 bg-honey-50/60 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-gray-900">This entry (pieces received on this trip)</h4>
          <button type="button" onClick={save} disabled={saving} className={primaryBtn}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />} Save entry
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Field label={perSale > 1 ? `Sales (of ${perSale} pcs)` : 'Pieces'} required>
            <input type="number" min={1} inputMode="numeric" value={qty} onChange={(ev) => setQty(ev.target.value)} className={inputClass} />
          </Field>
          <Field label="Damaged">
            <input type="number" min={0} inputMode="numeric" value={damaged} onChange={(ev) => setDamaged(ev.target.value)} className={inputClass} />
          </Field>
          <Field label={perSale > 1 ? 'Cost price of one piece' : 'Cost price'} required>
            <MoneyInput value={cost} onValue={setCost} className={inputClass} />
          </Field>
          <Field label="Box/pack no." hint={boxes ? `1 to ${boxes}, empty = not said` : 'Empty = not said'}>
            <input type="number" min={0} max={boxes || undefined} inputMode="numeric" value={boxNo} onChange={(ev) => setBoxNo(ev.target.value)} className={inputClass} />
          </Field>
        </div>
        {perSale > 1 && (
          <p className="mt-2 rounded bg-white px-2 py-1 text-xs text-gray-700">
            Cost of one sale ({perSale} pieces): {formatRs(piece, { decimals: 2 })} × {perSale} = <strong>{formatRs(c, { decimals: 2 })}</strong>
          </p>
        )}
        <p className="mt-2 text-xs text-gray-700">
          New total: <strong>{formatRs(Math.round(q * c * 100) / 100)}</strong> · {Math.max(0, q - d)} good {unit}
          {perSale > 1 ? ` (${Math.max(0, q - d) * perSale} pieces)` : ''} go into the warehouse
        </p>
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {totals.map((t) => {
            const left = r2(t.bill - t.entered);
            return (
              <div key={t.label} className="rounded-lg border border-honey-200 bg-white px-2.5 py-1.5 text-xs text-gray-700">
                <p className="font-medium text-gray-900 truncate">{t.label}</p>
                <p>
                  Order total <strong>{formatRs(t.bill)}</strong> · entered after save <strong>{formatRs(t.entered)}</strong>
                  {t.bill > 0 && (
                    <span className={`ml-1 font-semibold ${left > 0.5 ? 'text-red-600' : left < -0.5 ? 'text-blue-600' : 'text-green-600'}`}>
                      · {left > 0.5 ? `${formatRs(left)} left` : left < -0.5 ? `${formatRs(-left)} over` : 'all entered'}
                    </span>
                  )}
                </p>
              </div>
            );
          })}
        </div>
        <p className="mt-1 text-[11px] text-gray-500">The old pieces are taken back out and the corrected entry is saved. Pieces already on a shelf or sold cannot be edited.</p>
        {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      </section>

      <section className="mt-5">
        <h4 className="text-sm font-semibold text-gray-900">Product details (name, barcodes, prices, category)</h4>
        <p className="mb-3 text-xs text-gray-500">These have their own Save button at the bottom. Saving the entry above does not save these.</p>
        {formError ? (
          <p className="py-10 text-center text-sm text-red-600">{formError}</p>
        ) : !form ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading the product…
          </div>
        ) : (
          <ProductForm
            mode="edit"
            initialData={form.product as unknown as Product}
            fromEntry={fromEntry}
            categories={form.categories}
            colorOptions={form.colorOptions}
            sizeOptions={form.sizeOptions}
            onCancel={onClose}
            onSuccess={async () => {
              await onSaved(undefined);
            }}
          />
        )}
      </section>
    </Modal>
  );
}
