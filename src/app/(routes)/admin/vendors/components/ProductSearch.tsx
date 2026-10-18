'use client';

// Product search / barcode scan for the vendor screens. Enter on a scanned
// code picks the matching unit straight away. Each unit shows its stock in
// the shop and the vendor's last price.

import React, { useEffect, useRef, useState } from 'react';
import { Search, ScanLine, Loader2, Package } from 'lucide-react';
import { apiErrorMessage } from '@/helper/access';
import { formatRs } from '@/lib/storeApi';
import { useDebounced } from '@/helper/useDebounced';
import { inputClass } from '@/components/admin/FormBits';
import { vendorApi, type LookupProduct, type LookupUnit } from '../services/vendorApi';

export default function ProductSearch({
  vendorId,
  onPick,
  placeholder = 'Search product name or scan barcode…',
  showStock = true,
  disabled,
}: {
  vendorId?: string | null;
  onPick: (product: LookupProduct, unit: LookupUnit) => void;
  placeholder?: string;
  showStock?: boolean;
  disabled?: boolean;
}) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<LookupProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const debounced = useDebounced(q.trim(), 300);
  const boxRef = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

  const run = async (text: string) => {
    const my = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const data = await vendorApi.searchProducts({ search: text, vendorId: vendorId || undefined, limit: 15 });
      if (my === seq.current) setRows(data);
      return data;
    } catch (e) {
      if (my === seq.current) setError(apiErrorMessage(e, 'Search failed'));
      return [];
    } finally {
      if (my === seq.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (debounced.length < 2) {
      setRows([]);
      return;
    }
    run(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, vendorId]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const pick = (p: LookupProduct, u: LookupUnit) => {
    onPick(p, u);
    setQ('');
    setRows([]);
    setOpen(false);
  };

  // Scanner = fast typing + Enter: pick the exact code match.
  const onEnter = async () => {
    const text = q.trim();
    if (!text) return;
    const data = await run(text);
    const exact = data.find((p) => p.match);
    if (exact) {
      const unit = exact.units.find((u) => u.variantId === (exact.match?.variantId ?? null)) || (exact.units.length === 1 ? exact.units[0] : null);
      if (unit) return pick(exact, unit);
    }
    if (data.length === 1 && data[0].units.length === 1) return pick(data[0], data[0].units[0]);
    setOpen(true);
  };

  return (
    <div ref={boxRef} className="relative">
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
          if (e.key === 'Enter') {
            e.preventDefault();
            onEnter();
          }
          if (e.key === 'Escape') setOpen(false);
        }}
        placeholder={placeholder}
        className={`${inputClass} pl-9 pr-9`}
        aria-label="Product"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
      </span>
      {open && q.trim().length >= 2 && (
        <div className="absolute z-40 mt-1 w-full max-h-80 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
          {error ? (
            <p className="px-3 py-2 text-xs text-red-600">{error}</p>
          ) : !rows.length ? (
            <p className="px-3 py-2 text-xs text-gray-500">{loading ? 'Searching…' : 'No product found.'}</p>
          ) : (
            rows.map((p) => (
              <div key={p._id} className="border-b border-gray-100 last:border-0">
                <div className="flex items-center gap-2 px-3 pt-2">
                  <Package className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                  <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                  {p.isConsignment && <span className="px-1 py-px text-[9px] font-semibold rounded bg-purple-100 text-purple-700">CONSIGNMENT</span>}
                </div>
                <div className="pb-1.5">
                  {p.units.map((u) => (
                    <button
                      key={u.variantId || 'single'}
                      type="button"
                      onClick={() => pick(p, u)}
                      className="w-full text-left pl-8 pr-3 py-1.5 hover:bg-honey-50 flex items-center justify-between gap-2"
                    >
                      <span className="text-xs text-gray-600 truncate">
                        {u.label || 'Item'} {u.code && <span className="font-mono text-gray-400">· {u.code}</span>}
                      </span>
                      <span className="text-[11px] text-gray-500 whitespace-nowrap">
                        {showStock && <span className={u.stock > 0 ? 'text-gray-700' : 'text-red-500'}>{u.stock} in stock</span>}
                        {u.vendorLastPrice !== null && <span className="ml-2">last {formatRs(u.vendorLastPrice)}</span>}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
