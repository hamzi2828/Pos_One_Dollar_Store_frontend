// Manual item — something not in the product list (e.g. shopping bag):
// the cashier types a name and price and sells it. No stock is taken.
'use client';

import { useEffect, useRef, useState } from 'react';
import { X, PenLine } from 'lucide-react';
import MoneyInput from '@/components/ui/MoneyInput';
import { MANUAL_NAME_MAX } from '../utils/cartPayload';

export interface ManualItemInput {
  name: string;
  price: number;
  quantity: number;
}

interface ManualItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (input: ManualItemInput) => void;
  currency?: string;
}

export default function ManualItemModal({ isOpen, onClose, onAdd, currency = 'Rs' }: ManualItemModalProps) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // Fresh form on open.
  useEffect(() => {
    if (!isOpen) return;
    setName('');
    setPrice('');
    setQty('1');
    setError(null);
    setTimeout(() => nameRef.current?.focus(), 0);
  }, [isOpen]);

  if (!isOpen) return null;

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const n = name.trim().replace(/\s+/g, ' ');
    const p = Number(price);
    const q = Number(qty);
    if (!n) return setError('Enter a name');
    if (!Number.isFinite(p) || p <= 0) return setError('Enter a price');
    if (!Number.isInteger(q) || q < 1) return setError('Quantity must be 1 or more');
    onAdd({ name: n.slice(0, MANUAL_NAME_MAX), price: Math.round(p * 100) / 100, quantity: q });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
      <form
        onSubmit={submit}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
        className="w-full max-w-sm rounded-xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <PenLine className="h-4 w-4" /> Add manual item
          </h3>
          <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 px-4 py-4">
          <p className="text-xs text-gray-500">Not in the product list. Sold at the price you type; no stock is taken.</p>
          <label className="block">
            <span className="text-xs font-medium text-gray-700">Name</span>
            <input
              ref={nameRef}
              type="text"
              value={name}
              maxLength={MANUAL_NAME_MAX}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Shopping bag"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-honey-500 focus:outline-none"
            />
          </label>
          <div className="flex gap-3">
            <label className="block flex-1">
              <span className="text-xs font-medium text-gray-700">Price ({currency})</span>
              <MoneyInput
                value={price}
                onValue={setPrice}
                placeholder="0"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-honey-500 focus:outline-none"
              />
            </label>
            <label className="block w-24">
              <span className="text-xs font-medium text-gray-700">Qty</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-honey-500 focus:outline-none"
              />
            </label>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 px-4 py-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" className="rounded-lg bg-honey-500 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-honey-600">
            Add to cart
          </button>
        </div>
      </form>
    </div>
  );
}
