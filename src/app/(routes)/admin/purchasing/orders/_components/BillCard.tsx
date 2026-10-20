'use client';

// One vendor bill of a purchase trip: vendor, bill no, boxes, bill photo,
// bill total / paid now / still owed. Typed items are optional and tucked
// away ("you can enter them while unpacking").
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Edit2, Loader2, PackagePlus, Plus, Receipt, Trash2 } from 'lucide-react';
import { apiErrorMessage, formatDate, formatRs } from '@/lib/storeApi';
import { inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { PAYMENT_METHODS } from '@/app/(routes)/admin/vendors/services/vendorApi';
import { purchasingApi, toNum } from '../../_shared/purchasingApi';
import { ProductSearch } from '../../_shared/Pickers';
import { Disclosure, PhotoStrip, billTotalOf, owedOf, paidOf } from '../../_shared/ui';
import type { POBill, POItem, ProductUnit, PurchaseOrder } from '../../_shared/types';

const cellInput = `${inputClass} !px-2 !py-1 text-right`;

export const methodLabel = (m?: string) =>
  m === 'bank_transfer' ? 'Bank transfer' : PAYMENT_METHODS.find((x) => x.value === m)?.label || (m ? m.replace(/_/g, ' ') : 'Cash');

export default function BillCard({
  poId,
  bill,
  editable,
  onChange,
  onEdit,
  onNewProduct,
}: {
  poId: string;
  bill: POBill;
  editable: boolean;
  onChange: (po: PurchaseOrder) => void;
  onEdit: () => void;
  onNewProduct?: () => void;
}) {
  const [removing, setRemoving] = useState(false);

  const removeBill = async () => {
    if (removing) return;
    if (!window.confirm(`Remove the bill from ${bill.vendorName}${bill.items.length ? ` with ${bill.items.length} items` : ''}?`)) return;
    setRemoving(true);
    try {
      onChange(await purchasingApi.removeBill(poId, bill._id));
      toast.success('Bill removed');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not remove the bill.'));
      setRemoving(false);
    }
  };

  const pieces = bill.items.reduce((s, i) => s + i.qty, 0);
  const total = billTotalOf(bill);
  const paid = paidOf(bill);
  const owed = owedOf(bill);
  const missingAmount = !(total > 0);
  const noBoxes = !(bill.cartons > 0);

  return (
    <section className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200">
      <div className="flex items-start justify-between gap-2 px-4 py-3 border-b border-gray-100">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-honey-50 text-honey-700 flex items-center justify-center flex-shrink-0">
            <Receipt className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 truncate">{bill.vendorName}</h3>
            <p className="text-[11px] text-gray-500">
              {bill.billNo ? `Bill ${bill.billNo}` : 'No bill no.'} · {formatDate(bill.billDate)} ·{' '}
              <span className={noBoxes ? 'text-red-600 font-semibold' : 'font-semibold text-gray-700'}>
                {bill.cartons || 0} box{bill.cartons === 1 ? '' : 'es'}/pack{bill.cartons === 1 ? '' : 's'}
              </span>
            </p>
          </div>
        </div>
        {editable && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button type="button" onClick={onEdit} className="p-2 rounded-md text-gray-500 hover:text-honey-700 hover:bg-honey-50" aria-label="Edit bill">
              <Edit2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={removeBill}
              disabled={removing}
              className="p-2 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
              aria-label="Remove bill"
            >
              {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </button>
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-gray-50 px-2 py-2">
            <p className="text-[11px] text-gray-500">Bill total</p>
            <p className={`text-sm font-semibold ${missingAmount ? 'text-red-600' : 'text-gray-900'}`}>{missingAmount ? 'Not set' : formatRs(total)}</p>
          </div>
          <div className="rounded-lg bg-gray-50 px-2 py-2">
            <p className="text-[11px] text-gray-500">Paid now</p>
            <p className="text-sm font-semibold text-green-700">{formatRs(paid)}</p>
            {paid > 0 && <p className="text-[10px] text-gray-500 truncate">{methodLabel(bill.paidMethod)}</p>}
          </div>
          <div className="rounded-lg bg-honey-50 px-2 py-2">
            <p className="text-[11px] text-gray-600">Still owed</p>
            <p className="text-sm font-semibold text-gray-900">{formatRs(owed)}</p>
          </div>
        </div>

        {(missingAmount || noBoxes) && editable && (
          <p className="text-xs text-red-600">
            {missingAmount && 'Enter the bill amount. '}
            {noBoxes && 'Enter how many boxes/packs came from this vendor.'}{' '}
            <button type="button" onClick={onEdit} className="underline font-semibold">
              Edit bill
            </button>
          </p>
        )}

        {bill.photos.length > 0 && <PhotoStrip photos={bill.photos} />}

        {(editable || bill.items.length > 0) && (
          <Disclosure
            className="border-t border-gray-100 pt-1"
            title={
              <span>
                Items <span className="font-normal text-gray-500">(optional — you can enter them while unpacking)</span>
                {bill.items.length > 0 && (
                  <span className="block text-[11px] font-normal text-gray-500">
                    {bill.items.length} typed · {pieces} pcs · {formatRs(bill.subtotal)}
                    {(bill.billAmount || 0) > 0 && ` of bill ${formatRs(bill.billAmount)}`}
                  </span>
                )}
              </span>
            }
          >
            <div className="space-y-3">
              {bill.items.length === 0 ? (
                <p className="text-xs text-gray-500">No items typed. Search or scan a product below if you want a checklist for unpacking.</p>
              ) : (
                <div className="overflow-x-auto -mx-4 px-4">
                  <table className="w-full text-sm min-w-[620px]">
                    <thead className="text-[11px] text-gray-500 uppercase tracking-wide">
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 pr-2">Product</th>
                        <th className="text-right py-2 px-2 w-24">Pieces</th>
                        <th className="text-right py-2 px-2 w-28">Price / pc</th>
                        <th className="text-right py-2 px-2 w-24">Discount</th>
                        <th className="text-right py-2 px-2 w-28">Total</th>
                        {editable && <th className="w-8" />}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {bill.items.map((item) => (
                        <ItemRow key={item._id} poId={poId} billId={bill._id} item={item} editable={editable} onChange={onChange} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {editable && <AddItemRow poId={poId} billId={bill._id} onChange={onChange} onNewProduct={onNewProduct} />}
              {bill.items.length > 0 && (
                <div className="flex flex-col items-end gap-0.5 text-xs text-gray-600 pt-2 border-t border-gray-100">
                  <span>Items {formatRs(bill.subtotal)}</span>
                  {bill.discount > 0 && <span>Discount − {formatRs(bill.discount)}</span>}
                </div>
              )}
            </div>
          </Disclosure>
        )}
      </div>
    </section>
  );
}

/** Item line: qty / price / discount save when the field loses focus. */
function ItemRow({ poId, billId, item, editable, onChange }: { poId: string; billId: string; item: POItem; editable: boolean; onChange: (po: PurchaseOrder) => void }) {
  const [qty, setQty] = useState(String(item.qty));
  const [price, setPrice] = useState(String(item.unitPrice));
  const [discount, setDiscount] = useState(item.discount ? String(item.discount) : '');
  const [busy, setBusy] = useState(false);

  // Follow the server after every save (merged quantities, rounding).
  useEffect(() => {
    setQty(String(item.qty));
    setPrice(String(item.unitPrice));
    setDiscount(item.discount ? String(item.discount) : '');
  }, [item.qty, item.unitPrice, item.discount]);

  const save = async () => {
    const body: { qty?: number; unitPrice?: number; discount?: number } = {};
    if (toNum(qty) !== item.qty) body.qty = toNum(qty);
    if (toNum(price) !== item.unitPrice) body.unitPrice = toNum(price);
    if (toNum(discount) !== item.discount) body.discount = toNum(discount);
    if (!Object.keys(body).length || busy) return;
    if (body.qty !== undefined && (!Number.isInteger(body.qty) || body.qty < 1)) {
      toast.error('Quantity must be a whole number of at least 1');
      setQty(String(item.qty));
      return;
    }
    setBusy(true);
    try {
      onChange(await purchasingApi.updateItem(poId, billId, item._id, body));
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not save the line.'));
      setQty(String(item.qty));
      setPrice(String(item.unitPrice));
      setDiscount(item.discount ? String(item.discount) : '');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      onChange(await purchasingApi.removeItem(poId, billId, item._id));
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not remove the line.'));
      setBusy(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
  };
  const boxes = item.piecesPerBox > 1 ? Math.floor(item.qty / item.piecesPerBox) : 0;
  const loose = item.piecesPerBox > 1 ? item.qty % item.piecesPerBox : 0;

  return (
    <tr className={busy ? 'opacity-60' : ''}>
      <td className="py-2 pr-2">
        <p className="font-medium text-gray-900 leading-tight">{item.productName}</p>
        <p className="text-[11px] text-gray-500">
          {item.code && `#${item.code} · `}Sale {formatRs(item.salePrice)}
          {item.piecesPerBox > 1 && ` · ${boxes} box/pack${loose ? ` + ${loose}` : ''} (${item.piecesPerBox} per box/pack)`}
        </p>
      </td>
      <td className="py-2 px-2 text-right">
        {editable ? (
          <input type="number" min={1} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} onBlur={save} onKeyDown={onKey} className={cellInput} disabled={busy} aria-label="Quantity" />
        ) : (
          item.qty
        )}
      </td>
      <td className="py-2 px-2 text-right">
        {editable ? (
          <input type="number" min={0} step="0.01" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} onBlur={save} onKeyDown={onKey} className={cellInput} disabled={busy} aria-label="Unit price" />
        ) : (
          formatRs(item.unitPrice, { decimals: 2 })
        )}
      </td>
      <td className="py-2 px-2 text-right">
        {editable ? (
          <input type="number" min={0} inputMode="decimal" value={discount} placeholder="0" onChange={(e) => setDiscount(e.target.value)} onBlur={save} onKeyDown={onKey} className={cellInput} disabled={busy} aria-label="Line discount" />
        ) : item.discount ? (
          formatRs(item.discount)
        ) : (
          '—'
        )}
      </td>
      <td className="py-2 px-2 text-right font-medium text-gray-900">{formatRs(item.lineTotal)}</td>
      {editable && (
        <td className="py-2 text-right">
          <button type="button" onClick={remove} disabled={busy} className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-50" aria-label="Remove line">
            <Trash2 className="h-4 w-4" />
          </button>
        </td>
      )}
    </tr>
  );
}

/** Pick a product, then pieces or boxes, price per piece or per box. */
function AddItemRow({ poId, billId, onChange, onNewProduct }: { poId: string; billId: string; onChange: (po: PurchaseOrder) => void; onNewProduct?: () => void }) {
  const [unit, setUnit] = useState<ProductUnit | null>(null);
  const [byBox, setByBox] = useState(false);
  const [qty, setQty] = useState('');
  const [loose, setLoose] = useState('');
  const [price, setPrice] = useState('');
  const [pricePerBox, setPricePerBox] = useState(false);
  const [discount, setDiscount] = useState('');
  const [busy, setBusy] = useState(false);
  const qtyRef = useRef<HTMLInputElement>(null);

  const choose = (u: ProductUnit) => {
    setUnit(u);
    setByBox(u.piecesPerBox > 1);
    setQty('');
    setLoose('');
    setPricePerBox(false);
    setPrice(u.lastPurchasePrice !== null ? String(u.lastPurchasePrice) : '');
    setDiscount('');
    setTimeout(() => qtyRef.current?.focus(), 0);
  };

  const perBox = unit?.piecesPerBox || 1;
  const pieces = byBox ? toNum(qty) * perBox + toNum(loose) : toNum(qty);
  const unitPrice = pricePerBox ? toNum(price) / perBox : toNum(price);
  const lineTotal = Math.max(0, pieces * unitPrice - toNum(discount));

  const add = async () => {
    if (!unit || busy) return;
    if (!(pieces >= 1) || !Number.isInteger(pieces)) return toast.error('Enter a whole quantity of at least 1');
    if (price === '') return toast.error('Enter the price');
    setBusy(true);
    try {
      const po = await purchasingApi.addItems(poId, billId, [
        {
          productId: unit.productId,
          variantId: unit.variantId,
          ...(byBox ? { boxes: toNum(qty), loosePieces: toNum(loose) } : { qty: toNum(qty) }),
          ...(pricePerBox ? { boxPrice: toNum(price) } : { unitPrice: toNum(price) }),
          discount: toNum(discount),
        },
      ]);
      onChange(po);
      setUnit(null);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not add the item.'));
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') add();
    if (e.key === 'Escape') setUnit(null);
  };

  if (!unit) {
    return (
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1">
          <ProductSearch onPick={choose} />
        </div>
        {onNewProduct && (
          <button type="button" onClick={onNewProduct} className={secondaryBtn}>
            <PackagePlus className="h-4 w-4" /> New product
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-honey-200 bg-honey-50/40 p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">{unit.productName}</p>
          <p className="text-[11px] text-gray-500">
            Sale {formatRs(unit.salePrice)} · stock {unit.branchStock}
            {unit.lastPurchasePrice !== null && ` · last bought ${formatRs(unit.lastPurchasePrice, { decimals: 2 })}${unit.lastVendorName ? ` from ${unit.lastVendorName}` : ''}`}
            {unit.costPrice !== null && ` · avg cost ${formatRs(unit.costPrice, { decimals: 2 })}`}
          </p>
        </div>
        <button type="button" onClick={() => setUnit(null)} className="text-xs text-gray-500 hover:text-gray-700">Change</button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
        {perBox > 1 && (
          <div className="col-span-2 sm:col-span-5 flex gap-1 text-xs">
            <button type="button" onClick={() => setByBox(false)} className={`px-2.5 py-1 rounded-md border ${!byBox ? 'bg-honey-500 text-gray-900 border-honey-500' : 'bg-white border-gray-200 text-gray-600'}`}>Pieces</button>
            <button type="button" onClick={() => setByBox(true)} className={`px-2.5 py-1 rounded-md border ${byBox ? 'bg-honey-500 text-gray-900 border-honey-500' : 'bg-white border-gray-200 text-gray-600'}`}>Boxes ({perBox} pcs)</button>
          </div>
        )}
        <label className="text-[11px] text-gray-600">
          {byBox ? 'Boxes/packs' : 'Pieces'}
          <input ref={qtyRef} type="number" min={0} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} onKeyDown={onKey} className={inputClass} />
        </label>
        {byBox && (
          <label className="text-[11px] text-gray-600">
            + loose pcs
            <input type="number" min={0} inputMode="numeric" value={loose} onChange={(e) => setLoose(e.target.value)} onKeyDown={onKey} className={inputClass} />
          </label>
        )}
        <label className="text-[11px] text-gray-600">
          <span className="flex items-center justify-between">
            Price / {pricePerBox ? 'box/pack' : 'pc'}
            {perBox > 1 && (
              <button type="button" className="text-honey-700 underline" onClick={() => setPricePerBox((v) => !v)}>
                per {pricePerBox ? 'pc' : 'box'}
              </button>
            )}
          </span>
          <input type="number" min={0} step="0.01" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} onKeyDown={onKey} className={inputClass} />
        </label>
        <label className="text-[11px] text-gray-600">
          Discount (Rs)
          <input type="number" min={0} inputMode="decimal" value={discount} placeholder="0" onChange={(e) => setDiscount(e.target.value)} onKeyDown={onKey} className={inputClass} />
        </label>
        <button type="button" onClick={add} disabled={busy} className={`${primaryBtn} h-[38px]`}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
        </button>
      </div>
      <p className="text-[11px] text-gray-600">
        {pieces || 0} pieces × {formatRs(unitPrice, { decimals: 2 })} = <strong>{formatRs(lineTotal)}</strong>
        {unitPrice > 0 && unitPrice >= unit.salePrice && <span className="ml-2 text-red-600 font-semibold">Price is above the sale price!</span>}
      </p>
    </div>
  );
}
