'use client';

// Reusable searchable vendor select (GET /api/vendors). Shows each vendor's
// balance (red = we owe them, green = they owe us).
//
//   <VendorPicker value={vendorId} onChange={(id, vendor) => setVendorId(id)} />
//   <VendorPicker value={id} onChange={...} consignmentOnly placeholder="Consignment vendor…" />
//
// `value` is the vendor id (or null). `onChange` also passes the vendor row
// (with `balance`) so forms can show "current balance" without another call.

import React, { useEffect, useRef, useState } from 'react';
import { Search, Store, X, Loader2 } from 'lucide-react';
import { storeApi, formatRs, apiErrorMessage } from '@/lib/storeApi';
import { useDebounced } from '@/helper/useDebounced';

export interface VendorPickerOption {
  _id: string;
  name: string;
  code?: string;
  phone?: string;
  contactPerson?: string;
  city?: string;
  isConsignment?: boolean;
  isActive: boolean;
  /** > 0 we owe the vendor, < 0 the vendor owes us. */
  balance: number;
}

export interface VendorPickerProps {
  value: string | null;
  onChange: (vendorId: string | null, vendor: VendorPickerOption | null) => void;
  placeholder?: string;
  /** Only vendors that place sale-or-return stock. */
  consignmentOnly?: boolean;
  /** Include inactive vendors (default: active only). */
  includeInactive?: boolean;
  disabled?: boolean;
  className?: string;
  /** Called when a vendor given only by `value` (id) has been loaded. */
  onResolved?: (vendor: VendorPickerOption) => void;
}

const inputCls =
  'w-full pl-9 pr-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-honey-500/30 focus:border-honey-500 placeholder:text-gray-400 disabled:bg-gray-50';

function Balance({ amount }: { amount: number }) {
  if (!amount) return <span className="text-gray-400">Rs 0</span>;
  return (
    <span className={amount > 0 ? 'text-rose-600 font-medium' : 'text-emerald-600 font-medium'}>
      {formatRs(Math.abs(amount))} {amount > 0 ? 'payable' : 'receivable'}
    </span>
  );
}

export default function VendorPicker({
  value,
  onChange,
  placeholder = 'Search vendor by name, code or phone…',
  consignmentOnly = false,
  includeInactive = false,
  disabled = false,
  className = '',
  onResolved,
}: VendorPickerProps) {
  const [selected, setSelected] = useState<VendorPickerOption | null>(null);
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<VendorPickerOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);
  const debounced = useDebounced(q.trim(), 250);
  const boxRef = useRef<HTMLDivElement>(null);
  const onResolvedRef = useRef(onResolved);
  onResolvedRef.current = onResolved;

  // Load the picked vendor when only its id is known (e.g. from the URL).
  useEffect(() => {
    if (!value) {
      setSelected(null);
      return;
    }
    if ((selected && selected._id === value) || failedId === value) return;
    let alive = true;
    storeApi
      .get<VendorPickerOption>(`/vendors/${value}`)
      .then((res) => {
        if (!alive) return;
        setSelected(res.data);
        onResolvedRef.current?.(res.data);
      })
      .catch(() => {
        if (!alive) return;
        setSelected(null);
        setFailedId(value);
      });
    return () => {
      alive = false;
    };
  }, [value, selected, failedId]);

  useEffect(() => {
    if (!open || (value && failedId !== value)) return;
    let alive = true;
    setLoading(true);
    setError(null);
    storeApi
      .get<VendorPickerOption[]>('/vendors', {
        search: debounced,
        limit: 20,
        isActive: includeInactive ? undefined : 'true',
        isConsignment: consignmentOnly ? 'true' : undefined,
      })
      .then((res) => alive && setRows(res.data || []))
      .catch((e) => alive && setError(apiErrorMessage(e, 'Could not load vendors')))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [debounced, open, value, failedId, consignmentOnly, includeInactive]);

  // Close the list on outside click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const pick = (v: VendorPickerOption | null) => {
    setSelected(v);
    setQ('');
    setOpen(false);
    onChange(v ? v._id : null, v);
  };

  if (value && selected && selected._id === value) {
    return (
      <div className={`flex items-center justify-between gap-2 px-3 py-2 border border-honey-200 bg-honey-50 rounded-lg ${className}`}>
        <div className="flex items-center gap-2 min-w-0">
          <Store className="h-4 w-4 text-honey-700 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {selected.name}
              {selected.code && <span className="ml-1.5 text-[10px] font-mono text-gray-500">{selected.code}</span>}
            </p>
            <p className="text-[11px] text-gray-500 truncate">
              {[selected.phone, selected.city].filter(Boolean).join(' · ')}
              {(selected.phone || selected.city) && ' · '}
              <Balance amount={selected.balance} />
            </p>
          </div>
        </div>
        {!disabled && (
          <button type="button" onClick={() => pick(null)} className="p-1 text-gray-400 hover:text-gray-600" aria-label="Change vendor">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  if (value && !selected && failedId !== value) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin" /> Loading vendor…
      </div>
    );
  }

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
      <input
        value={q}
        disabled={disabled}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
          if (e.key === 'Enter' && rows.length === 1) {
            e.preventDefault();
            pick(rows[0]);
          }
        }}
        placeholder={placeholder}
        className={inputCls}
        aria-label="Vendor"
      />
      {open && (
        <div className="absolute z-40 mt-1 w-full max-h-72 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
          {error ? (
            <p className="px-3 py-2 text-xs text-red-600">{error}</p>
          ) : loading && !rows.length ? (
            <p className="px-3 py-2 text-xs text-gray-500 flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </p>
          ) : rows.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-500">
              {consignmentOnly ? 'No consignment vendor found.' : 'No vendor found.'} Add vendors on the Vendors page.
            </p>
          ) : (
            rows.map((v) => (
              <button
                key={v._id}
                type="button"
                onClick={() => pick(v)}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0"
              >
                <p className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                  <span className="truncate">{v.name}</span>
                  {v.code && <span className="text-[10px] font-mono text-gray-400">{v.code}</span>}
                  {v.isConsignment && <span className="px-1 py-px text-[9px] font-semibold rounded bg-purple-100 text-purple-700">CONSIGNMENT</span>}
                </p>
                <p className="text-[11px] text-gray-500 truncate">
                  {[v.contactPerson, v.phone, v.city].filter(Boolean).join(' · ') || '—'}
                  <span className="ml-2">
                    <Balance amount={v.balance} />
                  </span>
                </p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
