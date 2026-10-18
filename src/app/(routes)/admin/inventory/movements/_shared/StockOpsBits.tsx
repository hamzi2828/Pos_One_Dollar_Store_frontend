'use client';

// Shared UI for the stock-operations pages: scan/search product picker,
// movement type badges, status pills, small stat cards, error card.

import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, ScanLine, X } from 'lucide-react';
import { apiErrorMessage } from '@/lib/storeApi';
import { inputClass, primaryBtn } from '@/components/admin/FormBits';
import { lookupCode, searchUnits, unitTitle, type MovementType, type StockUnit } from './stockOpsApi';

/** A unit the picker returns (scanned units also carry the scanned code / batch). */
export interface PickedUnit extends StockUnit {
  scannedCode?: string;
  batchNo?: string | null;
  packQty?: number;
}

/**
 * Scan a barcode (Enter) or type a name and choose from the list.
 * Keeps focus after each pick so a cashier can scan many items in a row.
 */
export function ProductPicker({
  onPick,
  placeholder = 'Scan a barcode or type a product name',
  autoFocus,
  disabled,
}: {
  onPick: (unit: PickedUnit) => void;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<StockUnit[]>([]);
  const [variantChoice, setVariantChoice] = useState<{ name: string; scannedCode: string; options: StockUnit[] } | null>(null);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const busyRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Debounced name search.
  useEffect(() => {
    const text = q.trim();
    if (text.length < 2) {
      setResults([]);
      return;
    }
    let alive = true;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const rows = await searchUnits(text);
        if (alive) {
          setResults(rows);
          setOpen(true);
        }
      } catch {
        if (alive) setResults([]);
      } finally {
        if (alive) setSearching(false);
      }
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);

  // Close the list on outside click.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const finish = (unit: PickedUnit) => {
    onPick(unit);
    setQ('');
    setResults([]);
    setVariantChoice(null);
    setOpen(false);
    setError(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  // Enter: treat the text as a scanned code first, else take the first search hit.
  const onEnter = async () => {
    const code = q.trim();
    if (!code || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const hit = await lookupCode(code);
      if (hit.needsVariant) {
        setVariantChoice({ name: hit.name, scannedCode: hit.scannedCode, options: hit.variants || [] });
        setOpen(true);
      } else {
        finish({ ...(hit as StockUnit), scannedCode: hit.scannedCode, batchNo: hit.batchNo, packQty: hit.packQty });
      }
    } catch (e) {
      if (results.length) finish(results[0]);
      else setError(apiErrorMessage(e, 'No product found'));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const list = variantChoice ? variantChoice.options : results;

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <ScanLine className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={q}
          autoFocus={autoFocus}
          disabled={disabled}
          onChange={(e) => {
            setQ(e.target.value);
            setVariantChoice(null);
            setError(null);
          }}
          onFocus={() => list.length && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onEnter();
            } else if (e.key === 'Escape') setOpen(false);
          }}
          placeholder={placeholder}
          className={`${inputClass} pl-8 pr-8`}
          aria-label="Scan or search product"
        />
        {(busy || searching) && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-honey-700 animate-spin" />}
        {!busy && !searching && q && (
          <button type="button" onClick={() => setQ('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" aria-label="Clear">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {open && list.length > 0 && (
        <div className="absolute z-30 mt-1 w-full max-h-72 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
          {variantChoice && <div className="px-3 py-2 text-xs font-medium text-gray-500 border-b border-gray-100">Which variant of {variantChoice.name}?</div>}
          {list.map((u) => (
            <button
              key={`${u.productId}:${u.variantId || ''}`}
              type="button"
              onClick={() => finish({ ...u, scannedCode: variantChoice?.scannedCode })}
              className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-honey-50 border-b border-gray-50 last:border-0"
            >
              <span className="min-w-0">
                <span className="block text-sm text-gray-900 truncate">{unitTitle(u)}</span>
                <span className="block text-[11px] text-gray-500 font-mono">{u.code || '—'}</span>
              </span>
              <span className={`flex-shrink-0 text-xs font-medium ${u.available > 0 ? 'text-gray-700' : 'text-red-600'}`}>{u.available} pcs</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const TYPE_STYLES: Record<string, string> = {
  purchase_receipt: 'bg-blue-50 text-blue-700 border-blue-200',
  receive: 'bg-blue-50 text-blue-700 border-blue-200',
  opening: 'bg-blue-50 text-blue-700 border-blue-200',
  consignment_in: 'bg-teal-50 text-teal-700 border-teal-200',
  sale_return: 'bg-sky-50 text-sky-700 border-sky-200',
  adjustment_in: 'bg-sky-50 text-sky-700 border-sky-200',
  putaway: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  location_move: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  sale: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  gift: 'bg-pink-50 text-pink-700 border-pink-200',
  damage: 'bg-red-50 text-red-700 border-red-200',
  internal_use: 'bg-purple-50 text-purple-700 border-purple-200',
  vendor_return: 'bg-orange-50 text-orange-700 border-orange-200',
  consignment_return: 'bg-orange-50 text-orange-700 border-orange-200',
  adjustment_out: 'bg-gray-100 text-gray-700 border-gray-200',
};

export function MovementTypeBadge({ type, label }: { type: MovementType | string; label?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium whitespace-nowrap ${TYPE_STYLES[type] || 'bg-gray-50 text-gray-700 border-gray-200'}`}>
      {label || type}
    </span>
  );
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-green-50 text-green-700 border-green-200',
  applied: 'bg-green-50 text-green-700 border-green-200',
  active: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  voided: 'bg-gray-100 text-gray-600 border-gray-200',
  cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
  draft: 'bg-blue-50 text-blue-700 border-blue-200',
};

export function StatusPill({ status, label }: { status: string; label?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium capitalize ${STATUS_STYLES[status] || 'bg-gray-50 text-gray-700 border-gray-200'}`}>
      {label || status}
    </span>
  );
}

export function StatCard({ label, value, hint, tone = 'default' }: { label: string; value: React.ReactNode; hint?: string; tone?: 'default' | 'red' | 'green' | 'amber' }) {
  const toneClass = tone === 'red' ? 'text-red-700' : tone === 'green' ? 'text-green-700' : tone === 'amber' ? 'text-amber-700' : 'text-gray-900';
  return (
    <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 shadow-sm px-3 py-2.5 sm:px-4 sm:py-3">
      <div className="text-[11px] sm:text-xs text-gray-500">{label}</div>
      <div className={`text-base sm:text-lg font-semibold ${toneClass}`}>{value}</div>
      {hint && <div className="text-[11px] text-gray-400">{hint}</div>}
    </div>
  );
}

export function ErrorCard({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-red-200 text-center py-10 px-4">
      <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
      <p className="text-sm text-red-700 mb-4">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className={primaryBtn}>
          Try again
        </button>
      )}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">{title}</h1>
        {subtitle && <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export const thClass = 'px-3 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-xs font-medium tracking-wider text-left text-gray-500 uppercase whitespace-nowrap';
export const cardClass = 'bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200';
