'use client';

// Small UI pieces shared by the purchasing pages.
import React, { useEffect, useRef, useState } from 'react';
import { Camera, Check, ChevronDown, Minus, Plus, X } from 'lucide-react';
import { fileUrl, toNum } from './purchasingApi';
import type { GRNStatus, POBill, POStatus } from './types';

// Plain words for where a trip / receipt is (Buy -> Send -> Check boxes -> Unpack -> Done).
const PO_BADGE: Record<POStatus, { label: string; cls: string }> = {
  open: { label: 'Buying', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  closed: { label: 'On the way', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  receiving: { label: 'Unpacking', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  received: { label: 'Done', cls: 'bg-green-50 text-green-700 border-green-200' },
  cancelled: { label: 'Cancelled', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
};

const GRN_BADGE: Record<GRNStatus, { label: string; cls: string }> = {
  pending: { label: 'Check boxes/packs', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  in_progress: { label: 'Unpacking', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  completed: { label: 'Done', cls: 'bg-green-50 text-green-700 border-green-200' },
  cancelled: { label: 'Cancelled', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
};

// ---------------------------------------------------------------- bill money

/** What we owe for a bill (server value, else the same rule as the server). */
export const billTotalOf = (b: POBill) =>
  b.billTotal > 0 ? b.billTotal : (b.billAmount || 0) > 0 ? b.billAmount || 0 : Math.max(0, (b.subtotal || 0) - (b.discount || 0));
export const paidOf = (b: POBill) => Math.max(0, b.paidNow || 0);
export const owedOf = (b: POBill) => Math.max(0, Math.round((billTotalOf(b) - paidOf(b)) * 100) / 100);

// ---------------------------------------------------------------- step strip

/**
 * Numbered steps; `current` is highlighted, earlier ones get a tick. current >= steps.length = all done.
 * With `onPick`, steps up to `reached` (default: current) can be tapped.
 */
export function StepStrip({ steps, current, reached, onPick }: { steps: string[]; current: number; reached?: number; onPick?: (i: number) => void }) {
  return (
    <ol className="flex items-stretch gap-1 overflow-x-auto -mx-1 px-1 pb-1" aria-label="Steps">
      {steps.map((label, i) => {
        const done = i < current;
        const now = i === current;
        const clickable = !!onPick && i <= Math.max(current, reached ?? current) && !now;
        const cls = `w-full h-full flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-1 py-2 rounded-lg border text-center ${
          now
            ? 'bg-honey-500 border-honey-500 text-gray-900 font-semibold'
            : done
              ? 'bg-white border-green-200 text-green-700'
              : 'bg-white border-gray-200 text-gray-400'
        } ${clickable ? 'hover:bg-gray-50' : ''}`;
        const inner = (
          <>
            <span
              className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                now ? 'bg-gray-900 text-honey-400' : done ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className="text-[11px] sm:text-xs leading-tight">{label}</span>
          </>
        );
        return (
          <li key={label} className="flex-1 min-w-[3.6rem]" aria-current={now ? 'step' : undefined}>
            {clickable ? (
              <button type="button" onClick={() => onPick?.(i)} className={cls}>
                {inner}
              </button>
            ) : (
              <div className={cls}>{inner}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------- inputs

/** Whole-number box with big − / + buttons (phone friendly). */
export function NumberStepper({
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  disabled,
  label,
  size = 'lg',
}: {
  value: string;
  onChange: (v: string) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  label: string;
  size?: 'md' | 'lg';
}) {
  const n = toNum(value);
  const clamp = (x: number) => Math.max(min, max !== undefined ? Math.min(max, x) : x);
  const btn = `${size === 'lg' ? 'h-12 w-12' : 'h-10 w-10'} flex-shrink-0 inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-800 active:bg-gray-100 hover:bg-gray-50 disabled:opacity-40`;
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" className={btn} disabled={disabled || n <= min} onClick={() => onChange(String(clamp(n - step)))} aria-label={`Less ${label}`}>
        <Minus className="h-5 w-5" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        aria-label={label}
        className={`${size === 'lg' ? 'h-12 text-lg' : 'h-10 text-base'} w-full min-w-0 px-2 text-center font-semibold tabular-nums text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-honey-500/30 focus:border-honey-500 disabled:bg-gray-50`}
      />
      <button type="button" className={btn} disabled={disabled || (max !== undefined && n >= max)} onClick={() => onChange(String(clamp(n + step)))} aria-label={`More ${label}`}>
        <Plus className="h-5 w-5" />
      </button>
    </div>
  );
}

/** Small "show more" section, closed by default. */
export function Disclosure({ title, children, defaultOpen = false, className = '' }: { title: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean; className?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 py-2 text-left text-sm font-medium text-gray-700 hover:text-gray-900"
      >
        <span className="min-w-0">{title}</span>
        <ChevronDown className={`h-4 w-4 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="pt-1">{children}</div>}
    </div>
  );
}

/** Choice chips (payment method etc.). */
export function Chips<T extends string>({ options, value, onChange, disabled }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
            value === o.value ? 'bg-honey-500 text-gray-900 border-honey-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function POStatusBadge({ status }: { status: POStatus }) {
  const b = PO_BADGE[status] || PO_BADGE.open;
  return <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-full border ${b.cls}`}>{b.label}</span>;
}

export function GRNStatusBadge({ status }: { status: GRNStatus }) {
  const b = GRN_BADGE[status] || GRN_BADGE.pending;
  return <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-full border ${b.cls}`}>{b.label}</span>;
}

export function StatTile({ label, value, sub, tone = 'gray' }: { label: string; value: React.ReactNode; sub?: string; tone?: 'gray' | 'honey' | 'green' | 'red' | 'amber' }) {
  const tones: Record<string, string> = {
    gray: 'text-gray-900',
    honey: 'text-honey-700',
    green: 'text-green-700',
    red: 'text-red-600',
    amber: 'text-amber-600',
  };
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm px-3 py-2.5 min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-gray-500 truncate">{label}</p>
      <p className={`text-base sm:text-lg font-semibold truncate ${tones[tone]}`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-500 truncate">{sub}</p>}
    </div>
  );
}

export function Card({ title, actions, children, className = '' }: { title?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-100">
          <div className="text-sm font-semibold text-gray-900 min-w-0">{title}</div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

/** Thumbnails that open the full photo in a new tab. */
export function PhotoStrip({ photos, onRemove, size = 'h-14 w-14' }: { photos: string[]; onRemove?: (url: string) => void; size?: string }) {
  if (!photos.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {photos.map((p) => (
        <div key={p} className={`relative ${size} rounded-md overflow-hidden border border-gray-200 bg-gray-50`}>
          <a href={fileUrl(p)} target="_blank" rel="noreferrer" title="Open photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fileUrl(p)} alt="Photo" className="h-full w-full object-cover" />
          </a>
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(p)}
              className="absolute top-0.5 right-0.5 rounded-full bg-white/90 p-0.5 text-gray-600 hover:text-red-600"
              aria-label="Remove photo"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/** Pick photos (camera on phones) with local previews. */
export function PhotoPicker({ files, onChange, max = 5, label = 'Add photo' }: { files: File[]; onChange: (f: File[]) => void; max?: number; label?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<{ f: File; url: string }[]>([]);
  // Object URLs made and freed in the same effect (safe with React strict mode).
  useEffect(() => {
    const list = files.map((f) => ({ f, url: URL.createObjectURL(f) }));
    setPreviews(list);
    return () => list.forEach((p) => URL.revokeObjectURL(p.url));
  }, [files]);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {previews.map(({ f, url }, i) => (
        <div key={url} className="relative h-14 w-14 rounded-md overflow-hidden border border-gray-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={f.name} className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange(files.filter((_, j) => j !== i))}
            className="absolute top-0.5 right-0.5 rounded-full bg-white/90 p-0.5 text-gray-600 hover:text-red-600"
            aria-label="Remove photo"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
      {files.length < max && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="h-14 px-3 inline-flex flex-col items-center justify-center gap-0.5 rounded-md border border-dashed border-gray-300 text-[11px] text-gray-500 hover:border-honey-400 hover:text-honey-700"
        >
          <Camera className="h-4 w-4" />
          {label}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const picked = Array.from(e.target.files || []);
          onChange([...files, ...picked].slice(0, max));
          e.target.value = '';
        }}
      />
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { value: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          className={`whitespace-nowrap px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg border transition-colors ${
            value === t.value ? 'bg-honey-500 border-honey-500 text-gray-900' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          {t.label}
          {t.count !== undefined && <span className={`ml-1.5 text-[11px] ${value === t.value ? 'text-gray-900/70' : 'text-gray-400'}`}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: React.ReactNode; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 text-center py-10 sm:py-14 px-4">
      <div className="mx-auto mb-3 flex justify-center text-gray-300">{icon}</div>
      <h3 className="text-base font-medium text-gray-900 mb-1">{title}</h3>
      {text && <p className="text-sm text-gray-500 mb-4">{text}</p>}
      {action}
    </div>
  );
}

/** Today as yyyy-mm-dd for <input type="date">. */
export const todayInput = () => new Date().toISOString().slice(0, 10);
export const dateInput = (v: string | null | undefined) => (v ? new Date(v).toISOString().slice(0, 10) : '');
