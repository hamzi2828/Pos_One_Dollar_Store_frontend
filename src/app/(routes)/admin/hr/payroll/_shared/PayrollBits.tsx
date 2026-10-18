'use client';

// Small shared pieces for the payroll + advances pages.
import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, Search, X } from 'lucide-react';
import { apiErrorMessage, formatRs } from '@/lib/storeApi';
import { inputClass, primaryBtn } from '@/components/admin/FormBits';
import { payrollApi, type StaffOption } from './payrollApi';

export const cardClass = 'bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200';
export const thClass = 'px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap';
export const tdClass = 'px-3 py-2.5 text-sm text-gray-700 whitespace-nowrap';

const CHIP: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 border-gray-200',
  approved: 'bg-honey-100 text-honey-900 border-honey-200',
  paid: 'bg-green-50 text-green-700 border-green-200',
  pending: 'bg-amber-50 text-amber-800 border-amber-200',
  waived: 'bg-gray-100 text-gray-500 border-gray-200',
  applied: 'bg-green-50 text-green-700 border-green-200',
  open: 'bg-honey-100 text-honey-900 border-honey-200',
  recovered: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
  to_pay: 'bg-amber-50 text-amber-800 border-amber-200',
};
const CHIP_LABEL: Record<string, string> = {
  draft: 'Draft',
  approved: 'Approved',
  paid: 'Paid',
  pending: 'Waiting approval',
  waived: 'Waived',
  applied: 'Cut from pay',
  open: 'Open',
  recovered: 'Recovered',
  cancelled: 'Cancelled',
  to_pay: 'To pay',
};

export function StatusChip({ status, label }: { status: string; label?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-full border whitespace-nowrap ${CHIP[status] || CHIP.draft}`}>
      {label || CHIP_LABEL[status] || status}
    </span>
  );
}

export function StatTile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'good' | 'warn' | 'accent' }) {
  const color = tone === 'good' ? 'text-green-700' : tone === 'warn' ? 'text-amber-700' : tone === 'accent' ? 'text-honey-700' : 'text-gray-900';
  return (
    <div className={`${cardClass} px-4 py-3`}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-1 text-lg sm:text-xl font-semibold tabular-nums ${color}`}>{value}</p>
      {hint && <p className="text-[11px] text-gray-500 mt-0.5">{hint}</p>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-5">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">{title}</h1>
        {subtitle && <div className="text-xs sm:text-sm text-gray-500 mt-0.5">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function ErrorCard({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className={`${cardClass} border-red-200 text-center py-10 px-4`}>
      <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
      <p className="text-sm text-red-700 mb-4">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className={primaryBtn}>
          Try again
        </button>
      )}
    </div>
  );
}

/** Rs value with a minus sign for deductions. */
export const minusRs = (n: number) => (n ? `− ${formatRs(n)}` : formatRs(0));

/** Search active staff by name / code / phone and pick one. */
export function StaffPicker({
  value,
  onChange,
  autoFocus,
  disabled,
}: {
  value: StaffOption | null;
  onChange: (s: StaffOption | null) => void;
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<StaffOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) return;
    let alive = true;
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await payrollApi.staff(q.trim());
        if (alive) setRows(res.data || []);
      } catch (e) {
        if (alive) setError(apiErrorMessage(e, 'Could not load staff'));
      } finally {
        if (alive) setLoading(false);
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, value]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 px-3 py-2 border border-honey-300 bg-honey-50 rounded-lg">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {value.name} {value.code && <span className="text-xs text-gray-500">· {value.code}</span>}
          </p>
          <p className="text-[11px] text-gray-600 truncate">
            {value.designation || 'Staff'} · {value.payType === 'daily' ? `${formatRs(value.dailyRate)}/day` : `${formatRs(value.salary)}/month`}
            {value.advanceBalance > 0 && ` · advance balance ${formatRs(value.advanceBalance)}`}
          </p>
        </div>
        {!disabled && (
          <button type="button" onClick={() => onChange(null)} className="p-1 rounded text-gray-500 hover:bg-white" aria-label="Change employee">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Type a name, code or phone"
          className={`${inputClass} pl-9`}
          autoFocus={autoFocus}
          disabled={disabled}
        />
        {loading && <Loader2 className="h-4 w-4 text-gray-400 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />}
      </div>
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
          {error ? (
            <p className="px-3 py-2 text-xs text-red-600">{error}</p>
          ) : rows.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-500">{loading ? 'Searching…' : 'No staff found'}</p>
          ) : (
            rows.map((s) => (
              <button
                key={s._id}
                type="button"
                onClick={() => {
                  onChange(s);
                  setOpen(false);
                  setQ('');
                }}
                className="w-full text-left px-3 py-2 hover:bg-honey-50 border-b border-gray-50 last:border-0"
              >
                <span className="block text-sm text-gray-900">
                  {s.name} {s.code && <span className="text-xs text-gray-500">· {s.code}</span>}
                </span>
                <span className="block text-[11px] text-gray-500">
                  {s.designation || 'Staff'}
                  {s.advanceBalance > 0 && ` · advance balance ${formatRs(s.advanceBalance)}`}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
