'use client';

// Date range picker and "day by day" totals shared by the Advances, Deductions
// and Tips tabs. Day totals come from the server (meta.byDay), so a day split
// over two pages still shows its full sum.
import React from 'react';
import { CalendarDays } from 'lucide-react';
import { formatRs } from '@/lib/storeApi';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { dayKeyPKT, dayLabel, todayPKT, type DayTotal } from '../../payroll/_shared/payrollApi';
import { cardClass } from '../../payroll/_shared/PayrollBits';

export type RangePreset = 'all' | 'today' | 'yesterday' | 'this_month' | 'last_month' | 'custom';
export interface DayRange {
  preset: RangePreset;
  from: string;
  to: string;
}

const PRESETS: [RangePreset, string][] = [
  ['all', 'All dates'],
  ['today', 'Today'],
  ['yesterday', 'Yesterday'],
  ['this_month', 'This month'],
  ['last_month', 'Last month'],
  ['custom', 'Pick dates'],
];

const shiftDay = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

export function makeRange(preset: RangePreset, custom?: { from: string; to: string }): DayRange {
  const today = todayPKT();
  if (preset === 'today') return { preset, from: today, to: today };
  if (preset === 'yesterday') {
    const y = shiftDay(today, -1);
    return { preset, from: y, to: y };
  }
  if (preset === 'this_month') return { preset, from: `${today.slice(0, 7)}-01`, to: today };
  if (preset === 'last_month') {
    const first = `${today.slice(0, 7)}-01`;
    const lastDay = shiftDay(first, -1);
    return { preset, from: `${lastDay.slice(0, 7)}-01`, to: lastDay };
  }
  if (preset === 'custom') return { preset, from: custom?.from || `${today.slice(0, 7)}-01`, to: custom?.to || today };
  return { preset: 'all', from: '', to: '' };
}

/** { from, to } for the API (empty = all dates). */
export const rangeParams = (r: DayRange) => (r.from || r.to ? { from: r.from || undefined, to: r.to || undefined } : {});

export const rangeText = (r: DayRange) => {
  if (!r.from && !r.to) return 'all dates';
  if (r.from === r.to) return dayLabel(r.from);
  return `${r.from ? dayLabel(r.from) : 'start'} – ${r.to ? dayLabel(r.to) : 'today'}`;
};

export function RangeFilter({ value, onChange }: { value: DayRange; onChange: (r: DayRange) => void }) {
  const dateCls = 'text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white';
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SearchSelect
        value={value.preset}
        onChange={(e) => onChange(makeRange(e.target.value as RangePreset, value))}
        className="text-sm border border-gray-300 rounded-lg px-2.5 py-2 bg-white"
        aria-label="Dates"
      >
        {PRESETS.map(([k, l]) => (
          <option key={k} value={k}>
            {l}
          </option>
        ))}
      </SearchSelect>
      {value.preset === 'custom' && (
        <>
          <input type="date" aria-label="From" value={value.from} max={value.to || todayPKT()} onChange={(e) => onChange({ ...value, from: e.target.value })} className={dateCls} />
          <span className="text-xs text-gray-500">to</span>
          <input type="date" aria-label="To" value={value.to} min={value.from || undefined} max={todayPKT()} onChange={(e) => onChange({ ...value, to: e.target.value })} className={dateCls} />
        </>
      )}
    </div>
  );
}

/** Rows split by shop day (newest first, rows keep their order). */
export function groupByDay<T>(rows: T[], dateOf: (r: T) => string): { day: string; rows: T[] }[] {
  const out: { day: string; rows: T[] }[] = [];
  for (const r of rows) {
    const day = dayKeyPKT(dateOf(r));
    const last = out[out.length - 1];
    if (last && last.day === day) last.rows.push(r);
    else out.push({ day, rows: [r] });
  }
  return out;
}

/** Day total from the server, or the page's own rows when the day is not listed. */
export function dayTotalOf<T>(byDay: DayTotal[] | undefined, day: string, rows: T[], amountOf: (r: T) => number): DayTotal {
  const hit = byDay?.find((d) => d.day === day);
  return hit || { day, count: rows.length, amount: rows.reduce((s, r) => s + (Number(amountOf(r)) || 0), 0) };
}

/** Grey day band inside a list / table: date on the left, count and day total on the right. */
export function DayBand({ total, tone = 'gray' }: { total: DayTotal; tone?: 'gray' | 'red' | 'green' }) {
  const amountCls = tone === 'red' ? 'text-red-700' : tone === 'green' ? 'text-emerald-700' : 'text-gray-900';
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-honey-50/70 border-y border-honey-100 text-xs">
      <span className="inline-flex items-center gap-1.5 font-semibold text-gray-800">
        <CalendarDays className="h-3.5 w-3.5 text-honey-700" />
        {dayLabel(total.day)}
        <span className="font-normal text-gray-500">
          · {total.count} item{total.count === 1 ? '' : 's'}
        </span>
      </span>
      <span className={`font-semibold tabular-nums ${amountCls}`}>Day total {formatRs(total.amount)}</span>
    </div>
  );
}

/** Card with one line per day and the grand total of the range. */
export function DailyTotalsCard({ byDay, title = 'Day by day', tone = 'gray' }: { byDay: DayTotal[] | undefined; title?: string; tone?: 'gray' | 'red' | 'green' }) {
  if (!byDay || !byDay.length) return null;
  const total = byDay.reduce((s, d) => s + d.amount, 0);
  const count = byDay.reduce((s, d) => s + d.count, 0);
  const amountCls = tone === 'red' ? 'text-red-700' : tone === 'green' ? 'text-emerald-700' : 'text-gray-900';
  return (
    <div className={`${cardClass} overflow-hidden`}>
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <span className="text-[11px] text-gray-500">
          {byDay.length} day{byDay.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="max-h-80 overflow-y-auto">
        <table className="min-w-full text-sm">
          <tbody className="divide-y divide-gray-50">
            {byDay.map((d) => (
              <tr key={d.day}>
                <td className="px-4 py-1.5 text-gray-700 whitespace-nowrap">{dayLabel(d.day)}</td>
                <td className="px-2 py-1.5 text-right text-xs text-gray-500 whitespace-nowrap">× {d.count}</td>
                <td className={`px-4 py-1.5 text-right tabular-nums font-medium whitespace-nowrap ${amountCls}`}>{formatRs(d.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-sm">
        <span className="font-semibold text-gray-700">Total ({count})</span>
        <span className={`font-bold tabular-nums ${amountCls}`}>{formatRs(total)}</span>
      </div>
    </div>
  );
}
