'use client';

// Small, dependency-free charts for the dashboard (plain HTML/CSS).
// Rules (see the dataviz guide): one series per chart, thin columns (<= 24px)
// with a 4px rounded top on a single baseline, hairline solid grid, values in
// text colours (never the bar colour), a tooltip on hover AND keyboard focus,
// and every value also reachable without hovering (table view / lists).
import { useMemo, useState } from 'react';

// Chart colours (validated: dark gold passes lightness, chroma and 3:1 contrast on white).
export const SERIES = '#b77900';
export const MUTED = '#d6d3d1'; // de-emphasised bars
export const TRACK = '#f5f5f4'; // bar-list track

/** Rs 950 / Rs 12.5K / Rs 1.2M */
export function compactRs(n: number): string {
  const v = Number(n) || 0;
  const a = Math.abs(v);
  if (a >= 1e6) return `Rs ${(v / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, '')}M`;
  if (a >= 1e3) return `Rs ${(v / 1e3).toFixed(a >= 1e5 ? 0 : 1).replace(/\.0$/, '')}K`;
  return `Rs ${Math.round(v).toLocaleString('en-PK')}`;
}

/** Axis ticks: 0 / 1K / 2.5K ... */
const compactNum = (n: number) => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${+(n / 1e3).toFixed(1)}K` : `${Math.round(n)}`);

/** Round the axis top up to 1 / 2 / 2.5 / 5 × 10^k. */
function niceMax(max: number): number {
  if (max <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= max) return m * p;
  return 10 * p;
}

export interface Column {
  key: string;
  label: string;
  value: number;
  /** Extra tooltip rows, e.g. [{ label: 'Bills', value: '12' }] */
  extra?: { label: string; value: string }[];
}

/**
 * Column chart. `emphasis="peak"` paints only the highest column in the
 * series colour and the rest grey (the story is "this one").
 */
export function ColumnChart({
  data,
  height = 180,
  format = compactRs,
  emphasis = 'none',
  ariaLabel,
  emptyText = 'No sales in this period yet',
  maxLabels = 8,
}: {
  data: Column[];
  height?: number;
  format?: (n: number) => string;
  emphasis?: 'none' | 'peak';
  ariaLabel: string;
  emptyText?: string;
  /** At most this many x-axis labels (narrow cards need fewer). */
  maxLabels?: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const max = useMemo(() => Math.max(0, ...data.map((d) => d.value)), [data]);
  const top = niceMax(max);
  const peak = useMemo(() => (max > 0 ? data.findIndex((d) => d.value === max) : -1), [data, max]);
  // Show at most `maxLabels` x-labels so they never collide or get cut.
  const every = Math.max(1, Math.ceil(data.length / maxLabels));
  const empty = max <= 0;

  return (
    <div className="relative select-none" role="group" aria-label={ariaLabel}>
      <div className="flex">
        {/* y-axis ticks */}
        <div className="relative w-12 flex-shrink-0 text-[10px] text-gray-400 tabular-nums" style={{ height }}>
          {[1, 0.5, 0].map((f) => (
            <span key={f} className="absolute right-2 -translate-y-1/2" style={{ top: `${(1 - f) * 100}%` }}>
              {compactNum(top * f)}
            </span>
          ))}
        </div>
        {/* plot */}
        <div className="relative flex-1 min-w-0" style={{ height }}>
          {[1, 0.5, 0].map((f) => (
            <div key={f} className="absolute left-0 right-0 border-t border-gray-100" style={{ top: `${(1 - f) * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-[2px]">
            {data.map((d, i) => {
              const h = empty ? 0 : (d.value / top) * 100;
              const color = emphasis === 'peak' ? (i === peak ? SERIES : MUTED) : SERIES;
              return (
                <button
                  key={d.key}
                  type="button"
                  className="relative h-full flex-1 min-w-0 flex items-end justify-center focus:outline-none group"
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  aria-label={`${d.label}: ${format(d.value)}`}
                >
                  <span
                    className={`block w-full rounded-t-[4px] transition-opacity ${active === i ? 'opacity-75' : ''} group-focus-visible:ring-2 group-focus-visible:ring-gray-900/40`}
                    style={{ height: `${h}%`, maxWidth: 24, minHeight: d.value > 0 ? 2 : 0, backgroundColor: color }}
                  />
                </button>
              );
            })}
          </div>
          {empty && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-xs text-gray-400">{emptyText}</p>
            </div>
          )}
          {/* tooltip */}
          {active !== null && !empty && data[active] && (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-gray-900 px-2.5 py-1.5 text-white shadow-lg"
              style={{
                left: `${((active + 0.5) / data.length) * 100}%`,
                top: `${Math.max(0, 100 - (data[active].value / top) * 100)}%`,
                marginTop: -6,
              }}
            >
              <p className="text-sm font-semibold whitespace-nowrap">{format(data[active].value)}</p>
              <p className="text-[11px] text-gray-300 whitespace-nowrap">{data[active].label}</p>
              {data[active].extra?.map((x) => (
                <p key={x.label} className="text-[11px] text-gray-300 whitespace-nowrap">
                  <span className="text-white font-medium">{x.value}</span> {x.label}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* x labels */}
      <div className="flex pl-12 mt-1.5 gap-[2px]">
        {data.map((d, i) => (
          <span key={d.key} className="relative flex-1 min-w-0 h-3.5">
            {i % every === 0 && (
              <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-gray-400">{d.label}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Horizontal bars: label · value, with a thin track (part of a whole or ranking). */
export function BarList({
  rows,
  emptyText = 'Nothing yet',
}: {
  rows: { key: string; label: string; value: string; pct: number; sub?: string }[];
  emptyText?: string;
}) {
  if (!rows.length) return <p className="py-4 text-center text-xs text-gray-400">{emptyText}</p>;
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-gray-700">{r.label}</span>
            <span className="flex-shrink-0 font-semibold text-gray-900 tabular-nums">{r.value}</span>
          </div>
          <div className="mt-1 h-1.5 w-full rounded-full" style={{ backgroundColor: TRACK }}>
            <div className="h-1.5 rounded-full" style={{ width: `${Math.max(2, Math.min(100, r.pct))}%`, backgroundColor: SERIES }} />
          </div>
          {r.sub && <p className="mt-0.5 text-[11px] text-gray-400">{r.sub}</p>}
        </li>
      ))}
    </ul>
  );
}

/** Mini columns for the hero tile (dark background): past in muted yellow, latest in brand yellow. */
export function Sparkline({ values, ariaLabel }: { values: number[]; ariaLabel: string }) {
  const max = Math.max(0, ...values);
  if (!values.length || max <= 0) return null;
  return (
    <div className="flex h-12 items-end gap-[2px]" role="img" aria-label={ariaLabel}>
      {values.map((v, i) => (
        <span
          key={i}
          className="flex-1 rounded-t-[3px]"
          style={{
            height: `${Math.max(v > 0 ? 6 : 0, (v / max) * 100)}%`,
            maxWidth: 14,
            backgroundColor: i === values.length - 1 ? '#FFD60A' : 'rgba(255, 214, 10, 0.35)',
          }}
        />
      ))}
    </div>
  );
}
