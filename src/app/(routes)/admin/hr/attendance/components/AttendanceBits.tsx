'use client';

// Small display pieces for the attendance tabs: status chips (icon + word),
// avatars, stat tiles, day / month pickers, photo viewer.
import React from 'react';
import {
  AlertTriangle,
  CalendarOff,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Fingerprint,
  Hourglass,
  Moon,
  PartyPopper,
  Pencil,
  Plane,
  User,
  X,
  XCircle,
} from 'lucide-react';
import {
  DESKTOP_NOTE,
  SOURCE_LABEL,
  addDays,
  addMonths,
  dayLabel,
  fileUrl,
  monthLabel,
  type AttendanceStatus,
  type PunchSource,
} from '../services/attendanceApi';

type ChipStatus = AttendanceStatus | 'upcoming' | 'not_employed';

const STATUS: Record<ChipStatus, { label: string; cls: string; Icon: React.ComponentType<{ className?: string }> }> = {
  present: { label: 'Present', cls: 'bg-green-50 text-green-700 border-green-200', Icon: CheckCircle2 },
  late: { label: 'Late', cls: 'bg-amber-50 text-amber-800 border-amber-200', Icon: Clock3 },
  half_day: { label: 'Half day', cls: 'bg-orange-50 text-orange-800 border-orange-200', Icon: Hourglass },
  absent: { label: 'Absent', cls: 'bg-red-50 text-red-700 border-red-200', Icon: XCircle },
  missing_out: { label: 'No check-out', cls: 'bg-purple-50 text-purple-700 border-purple-200', Icon: AlertTriangle },
  pending: { label: 'Not in yet', cls: 'bg-gray-50 text-gray-600 border-gray-200', Icon: Clock3 },
  leave: { label: 'On leave', cls: 'bg-blue-50 text-blue-700 border-blue-200', Icon: Plane },
  off: { label: 'Off', cls: 'bg-gray-50 text-gray-500 border-gray-200', Icon: Moon },
  holiday: { label: 'Holiday', cls: 'bg-teal-50 text-teal-700 border-teal-200', Icon: PartyPopper },
  upcoming: { label: 'Not yet', cls: 'bg-white text-gray-400 border-gray-200', Icon: Clock3 },
  not_employed: { label: 'Not employed', cls: 'bg-gray-50 text-gray-400 border-gray-200', Icon: CalendarOff },
};

export const statusLabel = (s: ChipStatus) => STATUS[s]?.label || s;

export function StatusChip({ status, small }: { status: ChipStatus; small?: boolean }) {
  const s = STATUS[status] || STATUS.pending;
  return (
    <span className={`inline-flex items-center gap-1 border rounded-full font-medium whitespace-nowrap ${small ? 'px-1.5 py-0 text-[10px]' : 'px-2 py-0.5 text-[11px]'} ${s.cls}`}>
      <s.Icon className={small ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      {s.label}
    </span>
  );
}

/** Where a time came from: fingerprint (desktop app) or a manager's correction. */
export function SourceTag({ source }: { source: PunchSource | null | undefined }) {
  if (!source) return null;
  const corrected = source === 'corrected';
  const Icon = source === 'device' ? Fingerprint : Pencil;
  return (
    <span
      title={SOURCE_LABEL[source]}
      className={`inline-flex items-center gap-0.5 rounded px-1 py-px text-[10px] font-medium ${corrected ? 'bg-honey-50 text-honey-800 border border-honey-200' : source === 'device' ? 'text-gray-500' : 'bg-gray-100 text-gray-500'}`}
    >
      <Icon className="h-3 w-3" />
      <span className={source === 'device' ? 'sr-only sm:not-sr-only' : ''}>{SOURCE_LABEL[source]}</span>
    </span>
  );
}

/** "Staff clock in with their fingerprint on the … desktop app." */
export function DesktopNote({ className = '' }: { className?: string }) {
  return (
    <p className={`inline-flex items-start gap-2 text-xs text-gray-600 ${className}`}>
      <span className="h-6 w-6 rounded-md bg-brand-ink text-brand-yellow flex items-center justify-center flex-shrink-0">
        <Fingerprint className="h-3.5 w-3.5" />
      </span>
      <span className="pt-1">{DESKTOP_NOTE}</span>
    </p>
  );
}

/** Month grid code colours (P, L, H, A, M, O, HO, LV, ·). */
export const CODE_STYLE: Record<string, string> = {
  P: 'bg-green-100 text-green-800',
  L: 'bg-amber-100 text-amber-800',
  H: 'bg-orange-100 text-orange-800',
  A: 'bg-red-100 text-red-700',
  M: 'bg-purple-100 text-purple-800',
  O: 'bg-gray-100 text-gray-500',
  HO: 'bg-teal-100 text-teal-800',
  LV: 'bg-blue-100 text-blue-800',
  '·': 'bg-white text-gray-300',
  '': 'bg-gray-50 text-gray-300',
};

export function Avatar({ url, name, size = 'md' }: { url?: string | null; name: string; size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm';
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={fileUrl(url)} alt={name} className={`${box} rounded-full object-cover border border-gray-200 bg-gray-100 flex-shrink-0`} />;
  }
  return (
    <div className={`${box} rounded-full bg-honey-50 text-honey-700 font-semibold flex items-center justify-center flex-shrink-0 border border-honey-100`}>
      {initials || <User className="h-4 w-4" />}
    </div>
  );
}

export function StatTile({
  label,
  value,
  tone = 'gray',
  active,
  onClick,
}: {
  label: string;
  value: number | string;
  tone?: 'gray' | 'green' | 'amber' | 'red' | 'blue' | 'purple' | 'teal' | 'honey';
  active?: boolean;
  onClick?: () => void;
}) {
  const tones: Record<string, string> = {
    gray: 'text-gray-900',
    green: 'text-green-700',
    amber: 'text-amber-700',
    red: 'text-red-600',
    blue: 'text-blue-700',
    purple: 'text-purple-700',
    teal: 'text-teal-700',
    honey: 'text-honey-700',
  };
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={`text-left bg-white rounded-lg border px-3 py-2.5 shadow-sm transition-colors ${
        active ? 'border-honey-500 ring-2 ring-honey-500/30' : 'border-gray-200'
      } ${onClick ? 'hover:border-honey-400' : ''}`}
    >
      <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide truncate">{label}</p>
      <p className={`mt-0.5 text-xl font-bold ${tones[tone]}`}>{value}</p>
    </Tag>
  );
}

const stepBtn = 'p-2 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40';

export function DayPicker({ value, onChange, max, disabled }: { value: string; onChange: (d: string) => void; max: string; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" className={stepBtn} onClick={() => onChange(addDays(value, -1))} disabled={disabled} aria-label="Previous day">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <input
        type="date"
        value={value}
        max={max}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        disabled={disabled}
        className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-honey-500/30 focus:border-honey-500"
        aria-label="Day"
      />
      <button type="button" className={stepBtn} onClick={() => onChange(addDays(value, 1))} disabled={disabled || value >= max} aria-label="Next day">
        <ChevronRight className="h-4 w-4" />
      </button>
      {value !== max && (
        <button type="button" onClick={() => onChange(max)} disabled={disabled} className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">
          Today
        </button>
      )}
      <span className="hidden md:inline text-xs text-gray-500 ml-1">{dayLabel(value, { weekday: 'long' })}</span>
    </div>
  );
}

export function MonthPicker({ value, onChange, max, disabled }: { value: string; onChange: (m: string) => void; max: string; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" className={stepBtn} onClick={() => onChange(addMonths(value, -1))} disabled={disabled} aria-label="Previous month">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="min-w-[8.5rem] text-center text-sm font-semibold text-gray-900">{monthLabel(value)}</span>
      <button type="button" className={stepBtn} onClick={() => onChange(addMonths(value, 1))} disabled={disabled || value >= max} aria-label="Next month">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Full-size view of a clock-in photo. */
export function PhotoViewer({ url, caption, onClose }: { url: string; caption?: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={onClose} role="dialog" aria-label="Photo">
      <div className="relative max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} className="absolute -top-10 right-0 p-1.5 rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Close">
          <X className="h-5 w-5" />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={fileUrl(url)} alt={caption || 'Clock-in photo'} className="w-full rounded-lg bg-black object-contain max-h-[80vh]" />
        {caption && <p className="mt-2 text-center text-sm text-white/80">{caption}</p>}
      </div>
    </div>
  );
}

export const cardClass = 'bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200';
