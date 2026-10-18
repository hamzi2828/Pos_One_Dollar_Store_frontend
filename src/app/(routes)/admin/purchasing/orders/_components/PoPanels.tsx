'use client';

// Purchase order workspace panels: trip charges, landed-cost preview, suggested items.
import { useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, Calculator, Lightbulb, Loader2, Plus, Trash2, Truck } from 'lucide-react';
import { apiErrorMessage, formatRs } from '@/lib/storeApi';
import { inputClass, primaryBtn } from '@/components/admin/FormBits';
import { purchasingApi, toNum } from '../../_shared/purchasingApi';
import { Card } from '../../_shared/ui';
import type { AllocationMethod, ChargeType, Costing, POMeta, ProductUnit, PurchaseOrder } from '../../_shared/types';

// ---------------------------------------------------------------- charges

export function ChargesCard({ po, meta, editable, onChange }: { po: PurchaseOrder; meta: POMeta | null; editable: boolean; onChange: (po: PurchaseOrder) => void }) {
  const [type, setType] = useState<ChargeType>('car_rent');
  const [amount, setAmount] = useState('');
  const [paidTo, setPaidTo] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const label = (t: string) => meta?.chargeTypes.find((c) => c.value === t)?.label || t;

  const add = async () => {
    if (busy) return;
    if (!(toNum(amount) > 0)) return toast.error('Enter the amount');
    setBusy('add');
    try {
      onChange(await purchasingApi.addCharge(po._id, { type, amount: toNum(amount), paidTo: paidTo.trim(), note: note.trim() }));
      setAmount('');
      setPaidTo('');
      setNote('');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not add the charge.'));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string) => {
    if (busy) return;
    setBusy(id);
    try {
      onChange(await purchasingApi.removeCharge(po._id, id));
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not remove the charge.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-honey-700" /> Trip charges
        </span>
      }
      actions={<span className="text-sm font-semibold text-gray-900">{formatRs(po.totals.charges)}</span>}
    >
      <p className="text-[11px] text-gray-500 mb-3">Car rent, transport, builty freight, loading / unloading, landing, labour, misc — spread over the goods as landed cost.</p>
      {po.charges.length === 0 ? (
        <p className="text-xs text-gray-500 mb-3">No charges yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100 mb-3">
          {po.charges.map((c) => (
            <li key={c._id} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="text-sm text-gray-900">
                  {label(c.type)}
                  {c.source === 'builty' && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">from builty</span>}
                </p>
                {(c.paidTo || c.note) && <p className="text-[11px] text-gray-500 truncate">{[c.paidTo && `Paid to ${c.paidTo}`, c.note].filter(Boolean).join(' · ')}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{formatRs(c.amount)}</span>
                {editable && (
                  <button type="button" onClick={() => remove(c._id)} disabled={!!busy} className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-50" aria-label="Remove charge">
                    {busy === c._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
          <select value={type} onChange={(e) => setType(e.target.value as ChargeType)} className={inputClass} aria-label="Charge type">
            {(meta?.chargeTypes || []).map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <input type="number" min={0} inputMode="decimal" placeholder="Amount (Rs)" value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} className={inputClass} />
          <input placeholder="Paid to" value={paidTo} onChange={(e) => setPaidTo(e.target.value)} className={inputClass} />
          <input placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
          <button type="button" onClick={add} disabled={!!busy} className={primaryBtn}>
            {busy === 'add' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
          </button>
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- landed cost preview

const WARN: Record<string, { row: string; text: string }> = {
  loss: { row: 'bg-red-50', text: 'Loss: landed cost ≥ sale price' },
  low_margin: { row: 'bg-amber-50', text: 'Low margin' },
  no_price: { row: 'bg-gray-50', text: 'No sale price' },
};

export function CostingCard({
  po,
  meta,
  costing,
  loading,
  error,
  editable,
  onMethod,
}: {
  po: PurchaseOrder;
  meta: POMeta | null;
  costing: Costing | null;
  loading: boolean;
  error: string | null;
  editable: boolean;
  onMethod: (m: AllocationMethod) => void;
}) {
  const t = costing?.totals;
  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-honey-700" /> Landed cost preview
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />}
        </span>
      }
      actions={
        editable ? (
          <select value={po.allocationMethod} onChange={(e) => onMethod(e.target.value as AllocationMethod)} className={`${inputClass} !py-1 !w-auto`} aria-label="Spread charges">
            {(meta?.allocationMethods || []).map((m) => (
              <option key={m.value} value={m.value}>Spread {m.label.toLowerCase()}</option>
            ))}
          </select>
        ) : (
          <span className="text-xs text-gray-500">Charges spread by {po.allocationMethod}</span>
        )
      }
    >
      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : !costing || costing.lines.length === 0 ? (
        <p className="text-xs text-gray-500">Add items to see the cost of every piece all the way to the shelf.</p>
      ) : (
        <>
          {t && t.warnings > 0 && (
            <div className="mb-3 flex items-start gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>
                {t.warnings} line{t.warnings > 1 ? 's' : ''} below {costing.minMarginPct}% margin or at a loss. Check the price with the vendor or the sale price.
              </span>
            </div>
          )}
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-xs sm:text-sm min-w-[720px]">
              <thead className="text-[11px] text-gray-500 uppercase tracking-wide">
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 pr-2">Product</th>
                  <th className="text-right py-2 px-2">Qty</th>
                  <th className="text-right py-2 px-2">Vendor price</th>
                  <th className="text-right py-2 px-2">+ Charges</th>
                  <th className="text-right py-2 px-2">Landed cost</th>
                  <th className="text-right py-2 px-2">Sale price</th>
                  <th className="text-right py-2 px-2">Margin</th>
                  <th className="text-right py-2 pl-2">New avg cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {costing.lines.map((l) => (
                  <tr key={l.itemId} className={l.warning ? WARN[l.warning].row : ''}>
                    <td className="py-2 pr-2">
                      <p className="font-medium text-gray-900 leading-tight">{l.productName}</p>
                      <p className="text-[11px] text-gray-500">
                        {l.vendorName}
                        {l.warning && <span className={`ml-1.5 font-semibold ${l.warning === 'loss' ? 'text-red-600' : 'text-amber-700'}`}>{WARN[l.warning].text}</span>}
                      </p>
                    </td>
                    <td className="py-2 px-2 text-right">{l.qty}</td>
                    <td className="py-2 px-2 text-right">{formatRs(l.netUnitPrice, { decimals: 2 })}</td>
                    <td className="py-2 px-2 text-right text-gray-600">+{formatRs(l.chargePerPiece, { decimals: 2 })}</td>
                    <td className="py-2 px-2 text-right font-semibold text-gray-900">{formatRs(l.landedUnitCost, { decimals: 2 })}</td>
                    <td className="py-2 px-2 text-right">{formatRs(l.salePrice)}</td>
                    <td className={`py-2 px-2 text-right font-semibold ${l.warning === 'loss' ? 'text-red-600' : l.warning === 'low_margin' ? 'text-amber-700' : 'text-green-700'}`}>
                      {l.marginPct}%
                    </td>
                    <td className="py-2 pl-2 text-right text-gray-600">
                      {formatRs(l.newAverageCost, { decimals: 2 })}
                      {l.currentCost !== null && <p className="text-[10px] text-gray-400">now {formatRs(l.currentCost, { decimals: 2 })}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {t && (
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Sum label="Goods" value={formatRs(t.goods)} />
              <Sum label={`Charges (${t.chargesPct}% of goods)`} value={formatRs(t.charges)} />
              <Sum label="Landed total" value={formatRs(t.landed)} strong />
              <Sum label={`Expected profit (${t.marginPct}%)`} value={formatRs(t.expectedProfit)} tone={t.expectedProfit < 0 ? 'text-red-600' : 'text-green-700'} />
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function Sum({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className={`${strong ? 'font-semibold text-gray-900' : 'font-medium'} ${tone || ''}`}>{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------- suggested items (demand report)

export function SuggestedItems({
  po,
  units,
  onChange,
  onDismiss,
}: {
  po: PurchaseOrder;
  units: ProductUnit[];
  onChange: (po: PurchaseOrder) => void;
  onDismiss: () => void;
}) {
  const [billId, setBillId] = useState(po.bills[0]?._id || '');
  const [busy, setBusy] = useState<string | null>(null);
  const onPO = new Set(po.bills.flatMap((b) => b.items.map((i) => `${i.product}|${i.variantId || ''}`)));
  const left = units.filter((u) => !onPO.has(`${u.productId}|${u.variantId || ''}`));
  const target = po.bills.find((b) => b._id === billId) || po.bills[0];

  const add = async (u: ProductUnit) => {
    if (busy || !target) return;
    const key = `${u.productId}|${u.variantId || ''}`;
    setBusy(key);
    try {
      // One box (or one piece) at the last purchase price — adjust in the bill.
      onChange(
        await purchasingApi.addItems(po._id, target._id, [
          { productId: u.productId, variantId: u.variantId, qty: Math.max(1, u.piecesPerBox), unitPrice: u.lastPurchasePrice ?? 0 },
        ]),
      );
      toast.success(`${u.productName} added to ${target.vendorName}`);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not add the item.'));
    } finally {
      setBusy(null);
    }
  };

  if (!left.length) return null;
  return (
    <Card
      className="border-amber-200"
      title={
        <span className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500" /> Suggested from the demand report ({left.length})
        </span>
      }
      actions={
        <button type="button" onClick={onDismiss} className="text-xs text-gray-500 hover:text-gray-700">Hide</button>
      }
    >
      {po.bills.length === 0 ? (
        <p className="text-xs text-gray-600 mb-3">Add a vendor bill first, then add these items to it.</p>
      ) : (
        po.bills.length > 1 && (
          <label className="block text-xs text-gray-600 mb-3">
            Add to bill of{' '}
            <select value={target?._id} onChange={(e) => setBillId(e.target.value)} className={`${inputClass} !inline-block !w-auto !py-1 ml-1`}>
              {po.bills.map((b) => (
                <option key={b._id} value={b._id}>{b.vendorName}{b.billNo ? ` (${b.billNo})` : ''}</option>
              ))}
            </select>
          </label>
        )
      )}
      <ul className="divide-y divide-gray-100">
        {left.map((u) => {
          const key = `${u.productId}|${u.variantId || ''}`;
          return (
            <li key={key} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="text-sm text-gray-900 truncate">{u.productName}</p>
                <p className="text-[11px] text-gray-500">
                  Stock {u.branchStock} · sale {formatRs(u.salePrice)}
                  {u.lastPurchasePrice !== null && ` · last bought ${formatRs(u.lastPurchasePrice, { decimals: 2 })}`}
                  {u.lastVendorName && ` from ${u.lastVendorName}`}
                </p>
              </div>
              <button type="button" onClick={() => add(u)} disabled={!target || !!busy} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border border-honey-300 text-honey-700 hover:bg-honey-50 disabled:opacity-50">
                {busy === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
