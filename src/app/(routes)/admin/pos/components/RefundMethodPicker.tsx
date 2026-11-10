'use client';

// How the refund money went back to the customer. Cash = out of the till of the
// person refunding, even when the bill was paid by bank / JazzCash / card.
export type RefundMethod = 'cash' | 'bank_transfer' | 'jazzcash' | 'card';

const OPTIONS: { value: RefundMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank (UBL)' },
  { value: 'jazzcash', label: 'JazzCash' },
  { value: 'card', label: 'Card' },
];

export function RefundMethodPicker({ value, onChange, disabled }: { value: RefundMethod; onChange: (v: RefundMethod) => void; disabled?: boolean }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-gray-700">Money given back as</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={`rounded-lg border px-2 py-2 text-sm font-semibold ${
              value === o.value ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            } disabled:opacity-50`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="mt-1 text-[11px] text-gray-500">
        {value === 'cash' ? 'Comes out of your till cash.' : 'Not taken from the till cash.'}
      </p>
    </div>
  );
}
