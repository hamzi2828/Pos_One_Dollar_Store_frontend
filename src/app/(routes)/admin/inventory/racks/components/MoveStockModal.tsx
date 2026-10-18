'use client';

// Move pieces of one unit off a shelf: to another shelf, or back to the warehouse.

import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowRightLeft, Check, Loader2, Warehouse } from 'lucide-react';
import { Modal, Field, ErrorBox, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import ShelfPicker, { invalidateShelfOptions } from '@/components/store/ShelfPicker';
import { apiErrorMessage } from '@/lib/storeApi';
import { racksApi, unitName } from '../services/racksApi';

export interface MoveTarget {
  productId: string;
  variantId: string | null;
  name: string;
  variantLabel?: string;
  from: { shelfId: string; code: string; qty: number };
}

export default function MoveStockModal({
  target,
  toWarehouse = false,
  onClose,
  onDone,
}: {
  target: MoveTarget;
  /** open with "back to warehouse" selected */
  toWarehouse?: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [dest, setDest] = useState<'shelf' | 'warehouse'>(toWarehouse ? 'warehouse' : 'shelf');
  const [toShelfId, setToShelfId] = useState<string | null>(null);
  const [qty, setQty] = useState(String(target.from.qty));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const qtyRef = useRef<HTMLInputElement>(null);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (lock.current) return;
    const n = Number(qty);
    if (!Number.isInteger(n) || n < 1) return setError('Enter how many pieces to move (1 or more).');
    if (n > target.from.qty) return setError(`Only ${target.from.qty} piece(s) are on ${target.from.code}.`);
    if (dest === 'shelf' && !toShelfId) return setError('Choose the shelf to move to.');
    lock.current = true;
    try {
      setSaving(true);
      setError(null);
      const msg = await racksApi.move({
        productId: target.productId,
        variantId: target.variantId,
        fromShelfId: target.from.shelfId,
        toShelfId: dest === 'shelf' ? toShelfId : null,
        qty: n,
        note: note.trim() || undefined,
      });
      invalidateShelfOptions();
      toast.success(msg);
      onDone();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not move the stock.'));
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  return (
    <Modal
      title={dest === 'warehouse' ? 'Back to warehouse' : 'Move to another shelf'}
      subtitle={`${unitName(target)} · ${target.from.qty} pcs on ${target.from.code}`}
      icon={<ArrowRightLeft className="h-5 w-5" />}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className={secondaryBtn}>
            Cancel
          </button>
          <button type="button" onClick={() => submit()} disabled={saving} aria-busy={saving} className={primaryBtn}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? 'Moving…' : 'Move'}
          </button>
        </>
      }
    >
      <form onSubmit={submit}>
        <fieldset disabled={saving} className="space-y-4 min-w-0">
          <ErrorBox message={error} />
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { key: 'shelf', label: 'Another shelf', icon: <ArrowRightLeft className="h-4 w-4" /> },
                { key: 'warehouse', label: 'Warehouse', icon: <Warehouse className="h-4 w-4" /> },
              ] as const
            ).map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => setDest(o.key)}
                className={`flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${
                  dest === o.key ? 'border-honey-500 bg-honey-50 text-honey-700 font-semibold' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {o.icon}
                {o.label}
              </button>
            ))}
          </div>
          {dest === 'shelf' && (
            <Field label="Move to shelf" required>
              <ShelfPicker
                value={toShelfId}
                onChange={(s) => setToShelfId(s?._id ?? null)}
                excludeIds={[target.from.shelfId]}
                autoFocus
                onPicked={() => qtyRef.current?.focus()}
              />
            </Field>
          )}
          <Field label="Pieces" required hint={`Up to ${target.from.qty}`}>
            <input
              ref={qtyRef}
              type="number"
              inputMode="numeric"
              min={1}
              max={target.from.qty}
              step={1}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className={`${inputClass} tabular-nums`}
              autoFocus={dest === 'warehouse'}
            />
          </Field>
          <Field label="Note">
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Optional, e.g. shelf re-arranged" className={inputClass} />
          </Field>
          <button type="submit" className="hidden" />
        </fieldset>
      </form>
    </Modal>
  );
}
