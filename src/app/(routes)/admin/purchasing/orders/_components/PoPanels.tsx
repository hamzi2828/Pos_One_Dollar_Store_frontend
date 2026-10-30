'use client';

// Purchase trip panels: trip costs, cost-per-piece preview (advanced), suggested items.
import { useRef, useState } from 'react';
import MoneyInput from '@/components/ui/MoneyInput';
import toast from 'react-hot-toast';
import { AlertTriangle, Calculator, Lightbulb, Loader2, Plus, Trash2, Truck } from 'lucide-react';
import { apiErrorMessage, formatRs } from '@/lib/storeApi';
import { inputClass, primaryBtn } from '@/components/admin/FormBits';
import { purchasingApi, toNum } from '../../_shared/purchasingApi';
import { Card, PhotoPicker, PhotoStrip } from '../../_shared/ui';
import type { AllocationMethod, ChargeType, Costing, POMeta, ProductUnit, PurchaseOrder } from '../../_shared/types';
import { SearchSelect } from '@/components/ui/SearchSelect';

// ---------------------------------------------------------------- trip costs

const MAX_COST_FILES = 5;
const NO_FILES: File[] = [];

export function ChargesCard({ po, meta, editable, onChange }: { po: PurchaseOrder; meta: POMeta | null; editable: boolean; onChange: (po: PurchaseOrder) => void }) {
  const [type, setType] = useState<ChargeType>('car_rent');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const lock = useRef(false);
  const label = (t: string) => meta?.chargeTypes.find((c) => c.value === t)?.label || t.replace(/_/g, ' ');

  const run = async (key: string, fn: () => Promise<PurchaseOrder>, fail: string) => {
    if (lock.current) return false;
    lock.current = true;
    setBusy(key);
    try {
      onChange(await fn());
      return true;
    } catch (e) {
      toast.error(apiErrorMessage(e, fail));
      return false;
    } finally {
      lock.current = false;
      setBusy(null);
    }
  };

  const add = async () => {
    if (!(toNum(amount) > 0)) return toast.error('Enter the amount');
    const ok = await run('add', () => purchasingApi.addCharge(po._id, { type, amount: toNum(amount), note: note.trim() }, files), 'Could not add the cost.');
    if (ok) {
      setFiles([]);
      setAmount('');
      setNote('');
    }
  };

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-honey-700" /> Trip costs
        </span>
      }
      actions={<span className="text-sm font-semibold text-gray-900">{formatRs(po.totals.charges)}</span>}
    >
      <p className="text-[11px] text-gray-500 mb-2">Added to the cost of the goods.</p>
      {po.charges.length === 0 ? (
        <p className="text-xs text-gray-500 mb-2">No trip costs yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100 mb-2">
          {po.charges.map((c) => {
            const photos = c.photos || [];
            const ownFiles = editable && c.source === 'manual';
            const detail = [c.paidTo && `Paid to ${c.paidTo}`, c.note].filter(Boolean).join(' · ');
            return (
              <li key={c._id} className="py-1.5 flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-900 truncate">
                    {label(c.type)}
                    {c.source === 'builty' && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">freight</span>}
                  </p>
                  {detail && <p className="text-[11px] text-gray-500 truncate" title={detail}>{detail}</p>}
                </div>
                <PhotoStrip
                  photos={photos}
                  size="h-8 w-8"
                  onRemove={
                    ownFiles && !busy
                      ? (url) => run(c._id, () => purchasingApi.updateCharge(po._id, c._id, { removePhotos: [url] }), 'Could not remove the file.')
                      : undefined
                  }
                />
                {ownFiles && photos.length < MAX_COST_FILES && (
                  <PhotoPicker
                    files={NO_FILES}
                    max={MAX_COST_FILES - photos.length}
                    allowPdf
                    compact
                    label="Proof"
                    onChange={(picked) => {
                      if (picked.length) run(c._id, () => purchasingApi.updateCharge(po._id, c._id, {}, picked), 'Could not upload the file.');
                    }}
                  />
                )}
                <span className="text-sm font-medium whitespace-nowrap">{formatRs(c.amount)}</span>
                {editable && (
                  <button
                    type="button"
                    onClick={() => run(c._id, () => purchasingApi.removeCharge(po._id, c._id), 'Could not remove the cost.')}
                    disabled={!!busy}
                    className="p-1.5 -mr-1 text-gray-400 hover:text-red-600 disabled:opacity-50"
                    aria-label="Remove cost"
                  >
                    {busy === c._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {editable && (
        <div className="space-y-2 border-t border-gray-100 pt-2">
          <div className="grid grid-cols-[1fr_7.5rem] gap-2">
            <SearchSelect value={type} onChange={(e) => setType(e.target.value as ChargeType)} className={inputClass} aria-label="What for">
              {(meta?.chargeTypes || []).map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </SearchSelect>
            <MoneyInput
              placeholder="Rs"
              aria-label="Amount (Rs)"
              value={amount}
              onValue={setAmount}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              className={inputClass}
            />
          </div>
          <input
            placeholder="Note (optional) — e.g. paid to driver Ali"
            aria-label="Note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            className={inputClass}
          />
          <div className="flex items-center gap-2">
            <PhotoPicker files={files} onChange={setFiles} max={MAX_COST_FILES} allowPdf compact label="Screenshot" />
            <button type="button" onClick={add} disabled={!!busy} className={`${primaryBtn} flex-1`}>
              {busy === 'add' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add cost
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- cost per piece (advanced)

const WARN: Record<string, { row: string; text: string }> = {
  loss: { row: 'bg-red-50', text: 'Loss: cost is more than the sale price' },
  low_margin: { row: 'bg-amber-50', text: 'Low profit' },
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
  className,
}: {
  po: PurchaseOrder;
  meta: POMeta | null;
  costing: Costing | null;
  loading: boolean;
  error: string | null;
  editable: boolean;
  onMethod: (m: AllocationMethod) => void;
  className?: string;
}) {
  const t = costing?.totals;
  return (
    <Card
      className={className}
      title={
        <span className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-honey-700" /> Cost per piece (typed items)
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />}
        </span>
      }
      actions={
        editable ? (
          <SearchSelect value={po.allocationMethod} onChange={(e) => onMethod(e.target.value as AllocationMethod)} className={`${inputClass} !py-1 !w-auto`} aria-label="Share trip costs">
            {(meta?.allocationMethods || []).map((m) => (
              <option key={m.value} value={m.value}>
                Share costs {m.label.toLowerCase()}
              </option>
            ))}
          </SearchSelect>
        ) : (
          <span className="text-xs text-gray-500">Costs shared by {po.allocationMethod}</span>
        )
      }
    >
      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : !costing || costing.lines.length === 0 ? (
        <p className="text-xs text-gray-500">Type items on a bill to see what each piece costs with the trip costs added.</p>
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
                  <th className="text-right py-2 px-2">+ Trip costs</th>
                  <th className="text-right py-2 px-2">Full cost</th>
                  <th className="text-right py-2 px-2">Sale price</th>
                  <th className="text-right py-2 px-2">Profit</th>
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
              <Sum label={`Trip costs (${t.chargesPct}% of goods)`} value={formatRs(t.charges)} />
              <Sum label="Full cost" value={formatRs(t.landed)} strong />
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
            <SearchSelect value={target?._id} onChange={(e) => setBillId(e.target.value)} className={`${inputClass} !inline-block !w-auto !py-1 ml-1`}>
              {po.bills.map((b) => (
                <option key={b._id} value={b._id}>{b.vendorName}{b.billNo ? ` (${b.billNo})` : ''}</option>
              ))}
            </SearchSelect>
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
