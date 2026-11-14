'use client';

// Category "Refund": find the POS bill by its number (type at least 3 characters),
// pick it, then the expense amount is how much is given back. All refunds of one
// bill together can't go over what was paid on it (the server checks too).

import { useEffect, useRef, useState } from 'react';
import { Loader2, Search, X, FileText } from 'lucide-react';
import { useDebounced } from '@/helper/useDebounced';
import { expenseService } from '../service/expenseService';
import type { RefundBill } from '../types';

const MIN_CHARS = 3;
const rs = (n: number) => `Rs ${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-PK')}`;
const when = (d: string) =>
  new Date(d).toLocaleString('en-PK', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function RefundBillSelect({
  value,
  onChange,
  disabled,
}: {
  /** Picked bill (null = none yet). */
  value: RefundBill | null;
  onChange: (bill: RefundBill | null) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState('');
  const q = useDebounced(query.trim(), 300);
  const [bills, setBills] = useState<RefundBill[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (q.length < MIN_CHARS) {
      setBills([]);
      setError(null);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    expenseService
      .searchRefundBills(q, ctrl.signal)
      .then((list) => {
        setBills(list);
        setOpen(true);
      })
      .catch((e: unknown) => {
        if ((e as { code?: string })?.code === 'ERR_CANCELED') return;
        setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Could not search bills');
        setBills([]);
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [q]);

  // Close the list on a click outside.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  if (value) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-emerald-700" />
              Bill {value.orderNumber}
            </p>
            <p className="mt-0.5 text-xs text-gray-600">
              {when(value.createdAt)}
              {value.customerName ? ` · ${value.customerName}` : ''}
            </p>
            <p className="mt-1.5 text-xs text-gray-700">
              Bill total <strong>{rs(value.total)}</strong> · paid <strong>{rs(value.paid)}</strong>
              {value.refunded > 0 && (
                <>
                  {' '}· already refunded <strong>{rs(value.refunded)}</strong>
                </>
              )}
            </p>
            <p className="mt-1 text-sm font-semibold text-emerald-800">You can refund up to {rs(value.refundable)}</p>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            disabled={disabled}
            className="shrink-0 rounded p-1 text-gray-500 hover:bg-white hover:text-gray-800 disabled:opacity-50"
            title="Pick another bill"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  const short = query.trim().length > 0 && query.trim().length < MIN_CHARS;
  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          inputMode="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => bills.length && setOpen(true)}
          placeholder="Type the bill number (at least 3 numbers)"
          className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-9 focus:border-transparent focus:ring-2 focus:ring-honey-500"
          disabled={disabled}
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />}
      </div>
      <p className={`mt-1 text-xs ${error ? 'text-red-600' : 'text-gray-500'}`}>
        {error || (short ? `Type ${MIN_CHARS - query.trim().length} more…` : 'Pick the bill the money is given back on.')}
      </p>

      {open && q.length >= MIN_CHARS && !loading && (
        <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {bills.length === 0 ? (
            <p className="px-3 py-3 text-sm text-gray-500">No bill found for “{q}”.</p>
          ) : (
            bills.map((b) => {
              const none = b.refundable <= 0;
              return (
                <button
                  key={b._id}
                  type="button"
                  disabled={none}
                  onClick={() => {
                    onChange(b);
                    setOpen(false);
                    setQuery('');
                  }}
                  className="flex w-full items-center justify-between gap-3 border-b border-gray-100 px-3 py-2 text-left last:border-b-0 hover:bg-honey-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-gray-900">{b.orderNumber}</span>
                    <span className="block text-xs text-gray-500">
                      {when(b.createdAt)}
                      {b.customerName ? ` · ${b.customerName}` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-semibold text-gray-900">{rs(b.total)}</span>
                    <span className={`block text-[11px] ${none ? 'text-red-600' : 'text-emerald-700'}`}>
                      {b.orderStatus === 'refunded' ? 'Already refunded' : none ? 'Nothing left to refund' : `Can refund ${rs(b.refundable)}`}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
