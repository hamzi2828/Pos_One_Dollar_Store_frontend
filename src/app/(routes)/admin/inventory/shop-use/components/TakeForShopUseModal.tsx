'use client';

// "Take for shop use": scan the items, qty, purpose. Shows the cost that will be
// posted to expenses (average landed cost). The server recomputes everything.

import { useRef, useState } from 'react';
import { Minus, Plus, ShoppingBasket, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { ErrorBox, Field, HelpBox, Modal, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { storeApi, apiErrorMessage, formatRs } from '@/lib/storeApi';
import { newRequestId, unitKey, unitTitle, type ShopUseRecord } from '../../movements/_shared/stockOpsApi';
import { ProductPicker, type PickedUnit } from '../../movements/_shared/StockOpsBits';

interface Line {
  unit: PickedUnit;
  qty: number;
}

export default function TakeForShopUseModal({ onClose, onSaved }: { onClose: () => void; onSaved: (rec: ShopUseRecord) => void }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [purpose, setPurpose] = useState('');
  const [takenByName, setTakenByName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(newRequestId());

  const add = (u: PickedUnit) => {
    setError(null);
    setLines((ls) => {
      const i = ls.findIndex((l) => unitKey(l.unit) === unitKey(u));
      const step = Math.max(1, u.packQty || 1);
      if (i >= 0) return ls.map((l, j) => (j === i ? { ...l, qty: l.qty + step } : l));
      return [...ls, { unit: u, qty: step }];
    });
  };
  const setQty = (i: number, qty: number) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, qty: Math.max(1, Math.floor(qty) || 1) } : l)));

  const total = lines.reduce((s, l) => s + l.qty * (l.unit.costPrice || 0), 0);
  const overStock = lines.find((l) => l.qty > l.unit.available);

  const submit = async () => {
    if (saving) return;
    if (!lines.length) return setError('Scan at least one item');
    if (!purpose.trim()) return setError('Write what the items are for');
    if (overStock) return setError(`Only ${overStock.unit.available} of ${unitTitle(overStock.unit)} in stock`);
    setSaving(true);
    setError(null);
    try {
      const res = await storeApi.post<ShopUseRecord>('/shop-use', {
        lines: lines.map((l) => ({ productId: l.unit.productId, variantId: l.unit.variantId, qty: l.qty })),
        purpose: purpose.trim(),
        takenByName: takenByName.trim(),
        requestId: requestId.current,
      });
      toast.success(res.message || 'Saved');
      onSaved(res.data);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not save.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      wide
      title="Take for shop use"
      subtitle="Items taken from stock for the shop itself"
      icon={<ShoppingBasket className="h-5 w-5" />}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className={secondaryBtn}>
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={saving || !lines.length || !!overStock} className={primaryBtn}>
            {saving ? 'Saving…' : `Take ${lines.reduce((s, l) => s + l.qty, 0)} pcs · ${formatRs(total, { decimals: 2 })}`}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Items" hint="Scan each item (scan again to add one more) or type a name.">
          <ProductPicker onPick={add} autoFocus disabled={saving} />
        </Field>

        {lines.length > 0 && (
          <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
            {lines.map((l, i) => {
              const over = l.qty > l.unit.available;
              return (
                <div key={unitKey(l.unit)} className="flex flex-wrap sm:flex-nowrap items-center gap-2 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 truncate">{unitTitle(l.unit)}</div>
                    <div className={`text-[11px] ${over ? 'text-red-600' : 'text-gray-500'}`}>
                      {l.unit.available} in stock ({l.unit.warehouse} in warehouse) · {formatRs(l.unit.costPrice, { decimals: 2 })} / pc
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setQty(i, l.qty - 1)} className="p-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50" aria-label="Less">
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <input type="number" min={1} inputMode="numeric" value={l.qty} onChange={(e) => setQty(i, Number(e.target.value))} className={`${inputClass} w-16 text-center px-1`} aria-label="Quantity" />
                    <button type="button" onClick={() => setQty(i, l.qty + 1)} className="p-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50" aria-label="More">
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="w-24 text-right text-sm font-semibold text-gray-900">{formatRs(l.qty * l.unit.costPrice, { decimals: 2 })}</div>
                  <button type="button" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} className="p-1.5 text-gray-400 hover:text-red-600" aria-label="Remove">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Purpose" required>
            <input type="text" value={purpose} onChange={(e) => setPurpose(e.target.value)} maxLength={300} placeholder="e.g. Cleaning the shop floor" className={inputClass} />
          </Field>
          <Field label="Taken by" hint="Leave empty if it is you">
            <input type="text" value={takenByName} onChange={(e) => setTakenByName(e.target.value)} maxLength={120} placeholder="Staff name" className={inputClass} />
          </Field>
        </div>

        <HelpBox>
          <strong>{formatRs(total, { decimals: 2 })}</strong> (average landed cost) will be added to expenses under “Shop Use (from stock)”. Pieces are taken from
          the warehouse first.
        </HelpBox>
        <ErrorBox message={error} />
      </div>
    </Modal>
  );
}
