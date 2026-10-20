'use client';

// Product search / scan and vendor search boxes for purchase orders.
import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Search, ScanLine, Store, X } from 'lucide-react';
import { apiErrorMessage, formatRs } from '@/lib/storeApi';
import { inputClass } from '@/components/admin/FormBits';
import { purchasingApi } from './purchasingApi';
import type { ProductUnit, VendorOption } from './types';

function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/**
 * Type a name or scan a barcode. Enter on a scanned code picks the matching
 * product straight away (barcode scanners type the code + Enter).
 */
export function ProductSearch({
  onPick,
  disabled,
  autoFocus,
  placeholder = 'Search product or scan barcode…',
}: {
  onPick: (u: ProductUnit) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<ProductUnit[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const debounced = useDebounced(q.trim());
  const seq = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const run = async (term: string) => {
    const my = ++seq.current;
    if (!term) {
      setRows([]);
      return [];
    }
    setLoading(true);
    setError(null);
    try {
      const data = await purchasingApi.searchProducts(term);
      if (my === seq.current) {
        setRows(data);
        setActive(0);
      }
      return data;
    } catch (e) {
      if (my === seq.current) setError(apiErrorMessage(e, 'Search failed'));
      return [];
    } finally {
      if (my === seq.current) setLoading(false);
    }
  };

  useEffect(() => {
    run(debounced);
  }, [debounced]);

  const pick = (u: ProductUnit) => {
    onPick(u);
    setQ('');
    setRows([]);
    setOpen(false);
    inputRef.current?.focus();
  };

  const onKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, rows.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const term = q.trim();
      if (!term) return;
      // Fresh results for exactly this text (a scanner is faster than the debounce).
      const data = debounced === term && rows.length ? rows : await run(term);
      const exact = data.find((r) => r.code.toUpperCase() === term.toUpperCase() || r.sku.toUpperCase() === term.toUpperCase());
      const chosen = exact || (data.length === 1 ? data[0] : data[active]);
      if (chosen) pick(chosen);
    }
  };

  return (
    <div className="relative">
      <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
      <input
        ref={inputRef}
        value={q}
        disabled={disabled}
        autoFocus={autoFocus}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={`${inputClass} pl-9 pr-8`}
      />
      {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />}
      {open && q.trim() && (rows.length > 0 || error || !loading) && (
        <div className="absolute z-30 mt-1 w-full max-h-72 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
          {error ? (
            <p className="px-3 py-2 text-xs text-red-600">{error}</p>
          ) : rows.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-500">{loading ? 'Searching…' : 'No product found.'}</p>
          ) : (
            rows.map((r, i) => (
              <button
                key={`${r.productId}|${r.variantId || ''}`}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(r)}
                className={`w-full text-left px-3 py-2 border-b border-gray-50 last:border-0 ${i === active ? 'bg-honey-50' : 'hover:bg-gray-50'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-gray-900 truncate">{r.productName}</span>
                  <span className="text-xs font-semibold text-gray-700 whitespace-nowrap">{formatRs(r.salePrice)}</span>
                </div>
                <div className="text-[11px] text-gray-500 flex flex-wrap gap-x-3">
                  {r.code && <span>#{r.code}</span>}
                  <span>Stock {r.branchStock}</span>
                  {r.piecesPerBox > 1 && <span>{r.piecesPerBox} per box/pack</span>}
                  {r.lastPurchasePrice !== null && <span>Last bought {formatRs(r.lastPurchasePrice, { decimals: 2 })}</span>}
                  {r.costPrice !== null && <span>Cost {formatRs(r.costPrice, { decimals: 2 })}</span>}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/** Vendor search (GET /api/vendors?search=). Shows the picked vendor as a chip. */
export function VendorSearch({
  value,
  onChange,
  disabled,
}: {
  value: VendorOption | null;
  onChange: (v: VendorOption | null) => void;
  disabled?: boolean;
}) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<VendorOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounced = useDebounced(q.trim());

  useEffect(() => {
    if (value) return;
    let alive = true;
    setLoading(true);
    setError(null);
    purchasingApi
      .searchVendors(debounced)
      .then((d) => alive && setRows(d))
      .catch((e) => alive && setError(apiErrorMessage(e, 'Could not load vendors')))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [debounced, value]);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 px-3 py-2 border border-honey-200 bg-honey-50 rounded-lg">
        <div className="flex items-center gap-2 min-w-0">
          <Store className="h-4 w-4 text-honey-700 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{value.name}</p>
            {(value.phone || value.city) && <p className="text-[11px] text-gray-500 truncate">{[value.phone, value.city].filter(Boolean).join(' · ')}</p>}
          </div>
        </div>
        {!disabled && (
          <button type="button" onClick={() => onChange(null)} className="p-1 text-gray-400 hover:text-gray-600" aria-label="Change vendor">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
      <input
        value={q}
        disabled={disabled}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search vendor by name or phone…"
        className={`${inputClass} pl-9`}
      />
      {open && (
        <div className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
          {error ? (
            <p className="px-3 py-2 text-xs text-red-600">{error}</p>
          ) : loading && !rows.length ? (
            <p className="px-3 py-2 text-xs text-gray-500">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-500">No vendor found. Add vendors on the Vendors page.</p>
          ) : (
            rows.map((v) => (
              <button
                key={v._id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(v);
                  setQ('');
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0"
              >
                <p className="text-sm font-medium text-gray-900">{v.name}</p>
                <p className="text-[11px] text-gray-500">
                  {[v.contactPerson, v.phone, v.city].filter(Boolean).join(' · ') || '—'}
                  {typeof v.balance === 'number' && v.balance !== 0 && <span className="ml-2">Balance {formatRs(v.balance)}</span>}
                </p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
