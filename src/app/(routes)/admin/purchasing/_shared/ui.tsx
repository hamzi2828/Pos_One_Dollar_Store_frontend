'use client';

// Small UI pieces shared by the purchasing pages.
import React, { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { fileUrl } from './purchasingApi';
import type { GRNStatus, POStatus } from './types';

const PO_BADGE: Record<POStatus, { label: string; cls: string }> = {
  open: { label: 'Open', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  closed: { label: 'Awaiting receiving', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  receiving: { label: 'Receiving', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  received: { label: 'Received', cls: 'bg-green-50 text-green-700 border-green-200' },
  cancelled: { label: 'Cancelled', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
};

const GRN_BADGE: Record<GRNStatus, { label: string; cls: string }> = {
  pending: { label: 'Waiting', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  in_progress: { label: 'Counting', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  completed: { label: 'Completed', cls: 'bg-green-50 text-green-700 border-green-200' },
  cancelled: { label: 'Cancelled', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
};

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
