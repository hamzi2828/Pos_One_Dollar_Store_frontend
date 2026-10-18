'use client';

// "Put on shelf": move pieces of one unit from the warehouse onto a shelf.

import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Check, Loader2, PackagePlus } from 'lucide-react';
import { Modal, Field, Toggle, ErrorBox, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import ShelfPicker, { invalidateShelfOptions } from '@/components/store/ShelfPicker';
import { apiErrorMessage } from '@/lib/storeApi';
import { racksApi, unitName, type UnitLocation, type UnitShelf } from '../../racks/services/racksApi';

export type PutawayTarget = UnitLocation & { homeShelf?: UnitShelf | null };

export default function PutawayModal({ item, onClose, onDone }: { item: PutawayTarget; onClose: () => void; onDone: () => void }) {
  const home = item.homeShelf || item.shelves.find((s) => s.isHome) || null;
  // Default shelf: the home shelf, else where most of it already is.
  const initial = home?.shelfId ?? [...item.shelves].sort((a, b) => b.qty - a.qty)[0]?.shelfId ?? null;
  const [shelfId, setShelfId] = useState<string | null>(initial);
  const [shelfCode, setShelfCode] = useState<string>('');
  const [qty, setQty] = useState(String(item.warehouse));
  const [makeHome, setMakeHome] = useState(!home);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const qtyRef = useRef<HTMLInputElement>(null);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (lock.current) return;
    const n = Number(qty);
    if (!shelfId) return setError('Choose the shelf (type or scan its code).');
    if (!Number.isInteger(n) || n < 1) return setError('Enter how many pieces (1 or more).');
    if (n > item.warehouse) return setError(`Only ${item.warehouse} piece(s) are in the warehouse.`);
    lock.current = true;
    try {
      setSaving(true);
      setError(null);
      const { message } = await racksApi.putaway({
        productId: item.productId,
        variantId: item.variantId,
        shelfId,
        qty: n,
        note: note.trim() || undefined,
      });
      if (makeHome && shelfId !== home?.shelfId) {
        try {
          await racksApi.homeShelf({ productId: item.productId, variantId: item.variantId, shelfId, isHome: true });
        } catch (err) {
          toast.error(apiErrorMessage(err, 'Sent to shop, but the home shelf was not saved.'));
        }
      }
      invalidateShelfOptions();
      toast.success(message || `${n} piece(s) put on ${shelfCode || 'the shelf'}`);
      onDone();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not put the stock away.'));
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Send to shop"
      subtitle={`${unitName(item)} · ${item.warehouse} pcs in the warehouse`}
      icon={<PackagePlus className="h-5 w-5" />}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className={secondaryBtn}>
            Cancel
          </button>
          <button type="button" onClick={() => submit()} disabled={saving} aria-busy={saving} className={primaryBtn}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? 'Saving…' : 'Send to shop'}
          </button>
        </>
      }
    >
      <form onSubmit={submit}>
        <fieldset disabled={saving} className="space-y-4 min-w-0">
          <ErrorBox message={error} />
          <Field label="Display on (rack / shelf)" required hint={home ? `Home shelf: ${home.code}` : undefined}>
            <ShelfPicker
              value={shelfId}
              onChange={(s) => {
                setShelfId(s?._id ?? null);
                setShelfCode(s?.code ?? '');
              }}
              autoFocus
              onPicked={() => qtyRef.current?.focus()}
            />
          </Field>
          <Field label="Pieces" required hint={`All ${item.warehouse} by default`}>
            <input
              ref={qtyRef}
              type="number"
              inputMode="numeric"
              min={1}
              max={item.warehouse}
              step={1}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              className={`${inputClass} tabular-nums`}
            />
          </Field>
          <Toggle
            checked={makeHome}
            onChange={setMakeHome}
            label="Make this its home shelf"
            hint="The usual place of this item. It is suggested first next time."
          />
          <Field label="Note">
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Optional" className={inputClass} />
          </Field>
          {item.shelves.length > 0 && (
            <p className="text-[11px] text-gray-500">
              Already on: {item.shelves.filter((s) => s.qty > 0).map((s) => `${s.code} (${s.qty})`).join(', ') || '—'}
            </p>
          )}
          <button type="submit" className="hidden" />
        </fieldset>
      </form>
    </Modal>
  );
}
