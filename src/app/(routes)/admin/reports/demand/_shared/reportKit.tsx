'use client';

// Shared pieces for the store-analytics report pages (demand, trends, slow
// moving, footfall, category performance, expenses) and Category Staff.
// (Kept in this private `_shared` folder because of the module file-ownership rules.)
//
//   const range = useDateRange('month');            // { from, to, label } in Pakistan time
//   const r = useReport<T>('/analytics/footfall', { from, to }); // data, meta, loading, error, reload
//   await downloadCsv('/analytics/footfall/export', params, 'footfall');
//   buildPdf({ title, subtitle, summary, tables, fileName });

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import { Calendar, Download, FileText, Inbox, Loader2, RefreshCw, Search, AlertCircle } from 'lucide-react';
import { API_URL, storeApi, apiErrorMessage, formatRs, type PageMeta } from '@/lib/storeApi';
import { getAuthHeader } from '@/helper/helper';
import { SearchSelect } from '@/components/ui/SearchSelect';

export { formatRs };

/* ------------------------------------------------------------------ */
/* Dates (Pakistan time: UTC+5 all year)                               */
/* ------------------------------------------------------------------ */

const PKT_MS = 5 * 60 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Today's date in Pakistan as YYYY-MM-DD. */
export const pktToday = (): string => new Date(Date.now() + PKT_MS).toISOString().slice(0, 10);

export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** '2026-10-18' -> '18 Oct 2026' ; '2026-10' -> 'Oct 2026'. */
export function fmtDay(key: string | null | undefined, withYear = true): string {
  if (!key) return '—';
  const [y, m, d] = key.slice(0, 10).split('-').map(Number);
  if (!d) return `${MONTHS[m - 1]} ${y}`;
  return `${d} ${MONTHS[m - 1]}${withYear ? ` ${y}` : ''}`;
}
export const fmtMonth = (key: string, short = false): string => {
  const [y, m] = key.split('-').map(Number);
  return short ? `${MONTHS[m - 1]} ’${String(y).slice(2)}` : `${MONTHS[m - 1]} ${y}`;
};

/** A date/time value shown as a Pakistan calendar day. */
export function fmtDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return '—';
  return fmtDay(new Date(t + PKT_MS).toISOString().slice(0, 10));
}

export type RangePreset = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'lastMonth' | '90d' | 'year' | 'custom';

const PRESET_LABELS: Record<RangePreset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  month: 'This month',
  lastMonth: 'Last month',
  '90d': 'Last 90 days',
  year: 'This year',
  custom: 'Custom',
};

export interface DateRange {
  from: string;
  to: string;
  label: string;
}

export function presetRange(preset: RangePreset, customFrom?: string, customTo?: string): DateRange | null {
  const today = pktToday();
  const month = today.slice(0, 7);
  switch (preset) {
    case 'today':
      return { from: today, to: today, label: 'Today' };
    case 'yesterday': {
      const y = addDays(today, -1);
      return { from: y, to: y, label: 'Yesterday' };
    }
    case '7d':
      return { from: addDays(today, -6), to: today, label: 'Last 7 days' };
    case '30d':
      return { from: addDays(today, -29), to: today, label: 'Last 30 days' };
    case '90d':
      return { from: addDays(today, -89), to: today, label: 'Last 90 days' };
    case 'month':
      return { from: `${month}-01`, to: today, label: fmtMonth(month) };
    case 'lastMonth': {
      const first = addDays(`${month}-01`, -1).slice(0, 7);
      return { from: `${first}-01`, to: addDays(`${month}-01`, -1), label: fmtMonth(first) };
    }
    case 'year':
      return { from: `${today.slice(0, 4)}-01-01`, to: today, label: today.slice(0, 4) };
    case 'custom':
      if (!customFrom || !customTo || customFrom > customTo) return null;
      return { from: customFrom, to: customTo, label: `${fmtDay(customFrom)} – ${fmtDay(customTo)}` };
    default:
      return null;
  }
}

export function useDateRange(initial: RangePreset = 'month') {
  const [preset, setPreset] = useState<RangePreset>(initial);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const range = useMemo(() => presetRange(preset, customFrom, customTo), [preset, customFrom, customTo]);
  return { preset, setPreset, customFrom, setCustomFrom, customTo, setCustomTo, range };
}

export function DateRangePicker({
  state,
  presets = ['today', 'yesterday', '7d', '30d', 'month', 'lastMonth', '90d', 'year', 'custom'],
}: {
  state: ReturnType<typeof useDateRange>;
  presets?: RangePreset[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Calendar className="h-4 w-4 text-gray-400 hidden sm:block" />
      <SearchSelect
        value={state.preset}
        onChange={(e) => state.setPreset(e.target.value as RangePreset)}
        className={selectClass}
        aria-label="Date range"
      >
        {presets.map((p) => (
          <option key={p} value={p}>
            {PRESET_LABELS[p]}
          </option>
        ))}
      </SearchSelect>
      {state.preset === 'custom' && (
        <>
          <input type="date" value={state.customFrom} max={pktToday()} onChange={(e) => state.setCustomFrom(e.target.value)} className={selectClass} aria-label="From" />
          <span className="text-gray-400 text-xs">to</span>
          <input type="date" value={state.customTo} max={pktToday()} onChange={(e) => state.setCustomTo(e.target.value)} className={selectClass} aria-label="To" />
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Data loading                                                        */
/* ------------------------------------------------------------------ */

type Params = Record<string, string | number | boolean | undefined | null>;

/**
 * GET a report. Re-fetches when `params` change (by value); a newer request
 * wins over an older one. `enabled=false` waits (e.g. incomplete custom range).
 */
export function useReport<T>(path: string, params: Params, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const seq = useRef(0);
  const key = JSON.stringify(params);

  useEffect(() => {
    if (!enabled) return;
    const id = ++seq.current;
    setLoading(true);
    setError(null);
    storeApi
      .get<T>(path, JSON.parse(key) as Params)
      .then((res) => {
        if (id !== seq.current) return;
        setData(res.data);
        setMeta((res.meta as PageMeta) || null);
      })
      .catch((e) => {
        if (id !== seq.current) return;
        setError(apiErrorMessage(e, 'Could not load the report.'));
      })
      .finally(() => {
        if (id === seq.current) setLoading(false);
      });
  }, [path, key, enabled, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { data, meta, loading, error, reload, setData };
}

export interface FilterOptions {
  categories: string[];
  vendors: { _id: string; name: string; isConsignment: boolean }[];
}

/** Category + vendor names for the filter dropdowns (loaded once per page). */
export function useFilterOptions(enabled = true): FilterOptions {
  const [opts, setOpts] = useState<FilterOptions>({ categories: [], vendors: [] });
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    storeApi
      .get<FilterOptions>('/analytics/filters')
      .then((res) => live && res.data && setOpts(res.data))
      .catch(() => {
        /* dropdowns stay empty; the report still works */
      });
    return () => {
      live = false;
    };
  }, [enabled]);
  return opts;
}

/** Read one query-string value once on mount (avoids useSearchParams + Suspense). */
export function useQueryParam(name: string): string | null {
  const [v, setV] = useState<string | null>(null);
  useEffect(() => {
    setV(new URLSearchParams(window.location.search).get(name));
  }, [name]);
  return v;
}

/** Debounced copy of a value (search boxes). */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/* ------------------------------------------------------------------ */
/* Exports                                                             */
/* ------------------------------------------------------------------ */

const cleanParams = (params: Params) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));

/** Download a CSV from a report export endpoint (same filters as the page). */
export async function downloadCsv(path: string, params: Params, fileName: string): Promise<void> {
  try {
    const res = await axios.get(`${API_URL}${path}`, { params: cleanParams(params), headers: getAuthHeader(), responseType: 'blob' });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) {
    // Error bodies come back as a Blob too: read the JSON message out of it.
    if (axios.isAxiosError(e) && e.response?.data instanceof Blob) {
      try {
        const body = JSON.parse(await e.response.data.text());
        throw new Error(body.message || 'Could not download the file.');
      } catch (inner) {
        if (inner instanceof Error && inner.message) throw inner;
      }
    }
    throw new Error(apiErrorMessage(e, 'Could not download the file.'));
  }
}

export interface PdfTable {
  title?: string;
  head: string[];
  rows: (string | number | null | undefined)[][];
  /** Column widths in mm (default: equal). Numbers are right-aligned. */
  widths?: number[];
}

const pdfText = (v: unknown) =>
  String(v ?? '')
    .replace(/[—–]/g, '-')
    .replace(/[’‘]/g, "'")
    .replace(/[×]/g, 'x')
    .replace(/[^\x20-\x7E]/g, '');

/** Simple PDF: title, subtitle, key/value summary and tables (portrait or landscape). */
export function buildPdf({
  title,
  subtitle,
  summary = [],
  tables = [],
  fileName,
  landscape = false,
}: {
  title: string;
  subtitle?: string;
  summary?: [string, string][];
  tables?: PdfTable[];
  fileName: string;
  landscape?: boolean;
}) {
  const doc = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const margin = 12;
  let y = 14;
  const newPageIfNeeded = (need = 6) => {
    if (y + need > ph - 10) {
      doc.addPage();
      y = 14;
    }
  };
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(pdfText(title), margin, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  if (subtitle) {
    doc.text(pdfText(subtitle), margin, y);
    y += 5;
  }
  doc.text(`Printed ${pdfText(fmtDay(pktToday()))}`, margin, y);
  y += 7;
  doc.setTextColor(0);

  if (summary.length) {
    const colW = (pw - 2 * margin) / 2;
    summary.forEach(([k, v], i) => {
      const x = margin + (i % 2) * colW;
      if (i % 2 === 0) newPageIfNeeded(6);
      doc.setTextColor(107, 114, 128);
      doc.text(pdfText(k), x, y);
      doc.setTextColor(0);
      doc.setFont('helvetica', 'bold');
      doc.text(pdfText(v), x + colW - 4, y, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      if (i % 2 === 1 || i === summary.length - 1) y += 5.5;
    });
    y += 3;
  }

  for (const t of tables) {
    const n = t.head.length;
    const widths = t.widths && t.widths.length === n ? t.widths : Array(n).fill((pw - 2 * margin) / n);
    const scale = (pw - 2 * margin) / widths.reduce((s, w) => s + w, 0);
    const w = widths.map((x) => x * scale);
    const numeric = t.head.map((_, c) => t.rows.length > 0 && t.rows.every((r) => typeof r[c] === 'number' || r[c] === null || r[c] === undefined || r[c] === ''));
    const cellText = (v: unknown, width: number) => {
      let s = pdfText(typeof v === 'number' ? v.toLocaleString('en-PK', { maximumFractionDigits: 2 }) : v);
      while (s.length > 1 && doc.getTextWidth(s) > width - 2) s = s.slice(0, -2) + '.';
      return s;
    };
    const header = () => {
      doc.setFillColor(243, 244, 246);
      doc.rect(margin, y - 4, pw - 2 * margin, 6, 'F');
      doc.setFont('helvetica', 'bold');
      let x = margin;
      t.head.forEach((h, c) => {
        const txt = cellText(h, w[c]);
        if (numeric[c]) doc.text(txt, x + w[c] - 1, y, { align: 'right' });
        else doc.text(txt, x + 1, y);
        x += w[c];
      });
      doc.setFont('helvetica', 'normal');
      y += 5.5;
    };
    newPageIfNeeded(16);
    if (t.title) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(pdfText(t.title), margin, y);
      y += 6;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
    }
    doc.setFontSize(8);
    header();
    if (!t.rows.length) {
      doc.setTextColor(150);
      doc.text('No rows', margin + 1, y);
      doc.setTextColor(0);
      y += 5;
    }
    for (const r of t.rows) {
      if (y + 5 > ph - 10) {
        doc.addPage();
        y = 14;
        header();
      }
      let x = margin;
      r.forEach((v, c) => {
        const txt = cellText(v, w[c]);
        if (numeric[c]) doc.text(txt, x + w[c] - 1, y, { align: 'right' });
        else doc.text(txt, x + 1, y);
        x += w[c];
      });
      y += 4.8;
    }
    doc.setFontSize(9);
    y += 5;
  }
  doc.save(`${fileName}.pdf`);
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

export const fmtNum = (n: number | null | undefined, decimals = 0): string =>
  n === null || n === undefined || Number.isNaN(Number(n))
    ? '—'
    : Number(n).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: decimals });
export const fmtPct = (n: number | null | undefined): string => (n === null || n === undefined ? '—' : `${fmtNum(n, 1)}%`);
/** Rs 1.2k / Rs 3.4M for chart labels. */
export const fmtShortRs = (n: number): string => {
  const a = Math.abs(n);
  if (a >= 1e7) return `Rs ${(n / 1e7).toFixed(1)}Cr`;
  if (a >= 1e5) return `Rs ${(n / 1e5).toFixed(1)}L`;
  if (a >= 1e3) return `Rs ${(n / 1e3).toFixed(1)}k`;
  return `Rs ${Math.round(n)}`;
};

/* ------------------------------------------------------------------ */
/* Layout bits                                                         */
/* ------------------------------------------------------------------ */

export const selectClass =
  'px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-honey-500/30 focus:border-honey-500';

export function PageHeader({
  icon,
  title,
  subtitle,
  actions,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 flex items-center gap-2">
          <span className="text-honey-700 flex-shrink-0">{icon}</span>
          {title}
        </h1>
        {subtitle && <p className="mt-0.5 text-xs sm:text-sm text-gray-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function FilterBar({ children }: { children: React.ReactNode }) {
  return <div className="bg-white rounded-lg border border-gray-200 p-3 flex flex-wrap items-center gap-2 sm:gap-3">{children}</div>;
}

export function SearchBox({ value, onChange, placeholder = 'Search' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative flex-1 min-w-[180px] sm:max-w-xs">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${selectClass} w-full pl-8`} />
    </div>
  );
}

const TONES = {
  default: 'text-gray-900',
  good: 'text-emerald-700',
  bad: 'text-red-700',
  warn: 'text-amber-700',
  info: 'text-blue-700',
};

export function StatCard({ label, value, hint, tone = 'default' }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: keyof typeof TONES }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 min-w-0">
      <div className="text-[10px] sm:text-[11px] font-medium text-gray-500 uppercase tracking-wide truncate">{label}</div>
      <div className={`text-base sm:text-lg font-semibold mt-0.5 truncate ${TONES[tone]}`}>{value}</div>
      {hint && <div className="text-[11px] text-gray-500 mt-0.5 truncate">{hint}</div>}
    </div>
  );
}

export function Card({
  title,
  subtitle,
  actions,
  children,
  className = '',
  bodyClass = '',
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClass?: string;
}) {
  return (
    <section className={`bg-white rounded-lg border border-gray-200 min-w-0 ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2.5 border-b border-gray-100">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-gray-800">{title}</h2>}
            {subtitle && <p className="text-[11px] text-gray-500">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

export function EmptyState({ title, text, icon }: { title: string; text?: string; icon?: React.ReactNode }) {
  return (
    <div className="text-center py-12 px-4">
      <div className="mx-auto mb-3 h-10 w-10 text-gray-300 flex items-center justify-center">{icon || <Inbox className="h-10 w-10" />}</div>
      <p className="text-sm font-medium text-gray-700">{title}</p>
      {text && <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">{text}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="bg-white rounded-lg border border-red-200 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
      <p className="text-sm text-red-700 flex-1">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-700 border border-red-200 rounded-lg hover:bg-red-50">
          <RefreshCw className="h-4 w-4" /> Try again
        </button>
      )}
    </div>
  );
}

export function LoadingBlock({ text = 'Loading report…' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 bg-white rounded-lg border border-gray-200">
      <Loader2 className="h-7 w-7 animate-spin text-honey-700" />
      <p className="text-sm text-gray-500 mt-2">{text}</p>
    </div>
  );
}

const btn = 'inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg disabled:opacity-60 disabled:cursor-not-allowed';

/** CSV + PDF buttons (hidden without export permission) and Refresh. */
export function ReportActions({
  canExport,
  onCsv,
  onPdf,
  onRefresh,
  loading,
  disabled,
}: {
  canExport: boolean;
  onCsv?: () => Promise<void> | void;
  onPdf?: () => void;
  onRefresh?: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const [csvBusy, setCsvBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const lock = useRef(false);
  const runCsv = async () => {
    if (!onCsv || lock.current) return;
    lock.current = true;
    setCsvBusy(true);
    try {
      await onCsv();
    } finally {
      lock.current = false;
      setCsvBusy(false);
    }
  };
  const runPdf = () => {
    if (!onPdf || pdfBusy) return;
    setPdfBusy(true);
    // jsPDF blocks the main thread: let the spinner paint first.
    setTimeout(() => {
      try {
        onPdf();
      } finally {
        setPdfBusy(false);
      }
    }, 30);
  };
  return (
    <>
      {canExport && onCsv && (
        <button type="button" onClick={runCsv} disabled={disabled || csvBusy} className={`${btn} text-gray-700 bg-white border border-gray-300 hover:bg-gray-50`}>
          {csvBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} CSV
        </button>
      )}
      {canExport && onPdf && (
        <button type="button" onClick={runPdf} disabled={disabled || pdfBusy} className={`${btn} text-white bg-emerald-600 hover:bg-emerald-700`}>
          {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} PDF
        </button>
      )}
      {onRefresh && (
        <button type="button" onClick={onRefresh} disabled={loading} aria-busy={loading} className={`${btn} text-gray-700 bg-white border border-gray-300 hover:bg-gray-50`}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="hidden sm:inline">Refresh</span>
        </button>
      )}
    </>
  );
}

/** Small pager for report tables (server pages). */
export function Pager({ meta, onPage }: { meta: PageMeta | null; onPage: (p: number) => void }) {
  if (!meta || meta.pages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-gray-100 text-xs text-gray-600">
      <span>
        Page {meta.page} of {meta.pages} · {fmtNum(meta.total)} rows
      </span>
      <div className="flex gap-1">
        <button type="button" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)} className="px-2.5 py-1 border border-gray-300 rounded-md disabled:opacity-40">
          Previous
        </button>
        <button type="button" disabled={meta.page >= meta.pages} onClick={() => onPage(meta.page + 1)} className="px-2.5 py-1 border border-gray-300 rounded-md disabled:opacity-40">
          Next
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Charts (plain SVG / CSS — no chart library)                         */
/* ------------------------------------------------------------------ */

export const SERIES = ['#2a78d6', '#eb6834'] as const; // blue, orange (validated categorical pair)
// Sequential blue ramp for heatmaps (light = little, dark = a lot).
const RAMP = ['#e8f1fc', '#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281'];

export function rampColor(value: number, max: number): { bg: string; fg: string } {
  if (!value || max <= 0) return { bg: '#f9fafb', fg: '#9ca3af' };
  const i = Math.min(RAMP.length - 1, Math.max(0, Math.round((value / max) * (RAMP.length - 1))));
  return { bg: RAMP[i], fg: i >= 7 ? '#ffffff' : '#1f2937' };
}

function useTip() {
  const [tip, setTip] = useState<{ x: number; y: number; text: React.ReactNode } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const show = (e: React.MouseEvent | React.FocusEvent, text: React.ReactNode) => {
    const box = ref.current?.getBoundingClientRect();
    const target = (e.currentTarget as Element).getBoundingClientRect();
    if (!box) return;
    setTip({ x: target.left - box.left + target.width / 2, y: target.top - box.top, text });
  };
  const node = tip ? (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full -mt-1 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[11px] text-white shadow"
      style={{ left: Math.max(40, tip.x), top: tip.y }}
    >
      {tip.text}
    </div>
  ) : null;
  return { ref, show, hide: () => setTip(null), node };
}

export interface BarDatum {
  label: string;
  values: number[];
  tip?: React.ReactNode;
}

/** Vertical bars (1–2 series side by side) on one shared axis. */
export function BarChart({
  data,
  series,
  format = fmtShortRs,
  height = 180,
  onSelect,
  selected,
}: {
  data: BarDatum[];
  series: string[];
  format?: (n: number) => string;
  height?: number;
  onSelect?: (label: string) => void;
  selected?: string | null;
}) {
  const tip = useTip();
  const max = Math.max(1, ...data.flatMap((d) => d.values.map((v) => Math.max(0, v))));
  const ticks = [0, 0.5, 1].map((f) => f * max);
  if (!data.length) return <EmptyState title="No data for this period" />;
  return (
    <div className="relative" ref={tip.ref}>
      {series.length > 1 && <Legend items={series.map((s, i) => ({ label: s, color: SERIES[i] }))} />}
      <div className="flex gap-2">
        <div className="flex flex-col justify-between text-[10px] text-gray-400 text-right py-0.5" style={{ height }}>
          {[...ticks].reverse().map((t, i) => (
            <span key={i}>{format(t)}</span>
          ))}
        </div>
        <div className="flex-1 min-w-0 overflow-x-auto">
          <div className="relative flex items-end gap-1 border-b border-gray-200" style={{ height, minWidth: data.length * 22 }}>
            {ticks.slice(1).map((t, i) => (
              <div key={i} className="absolute inset-x-0 border-t border-dashed border-gray-100" style={{ bottom: `${(t / max) * 100}%` }} />
            ))}
            {data.map((d) => (
              <button
                key={d.label}
                type="button"
                className={`relative flex-1 h-full flex items-end justify-center gap-[2px] rounded-t ${selected === d.label ? 'bg-honey-50' : 'hover:bg-gray-50'} ${onSelect ? 'cursor-pointer' : 'cursor-default'}`}
                onMouseEnter={(e) => tip.show(e, d.tip || `${d.label}: ${d.values.map(format).join(' / ')}`)}
                onMouseLeave={tip.hide}
                onFocus={(e) => tip.show(e, d.tip || `${d.label}: ${d.values.map(format).join(' / ')}`)}
                onBlur={tip.hide}
                onClick={() => onSelect?.(d.label)}
                aria-label={`${d.label}: ${d.values.map(format).join(' / ')}`}
              >
                {d.values.map((v, i) => (
                  <span
                    key={i}
                    className="block w-full max-w-[18px] rounded-t-[4px]"
                    style={{ height: `${(Math.max(0, v) / max) * 100}%`, background: SERIES[i] || SERIES[0], minHeight: v > 0 ? 2 : 0 }}
                  />
                ))}
              </button>
            ))}
          </div>
          <div className="flex gap-1 mt-1" style={{ minWidth: data.length * 22 }}>
            {data.map((d) => (
              <span key={d.label} className="flex-1 text-center text-[10px] text-gray-500 truncate">
                {d.label}
              </span>
            ))}
          </div>
        </div>
      </div>
      {tip.node}
    </div>
  );
}

/** Lines (1–2 series) with dots on one shared axis, e.g. this year vs last year. */
export function LineChart({
  labels,
  series,
  format = fmtShortRs,
  height = 200,
}: {
  labels: string[];
  series: { name: string; values: (number | null)[] }[];
  format?: (n: number) => string;
  height?: number;
}) {
  const tip = useTip();
  const W = 640;
  const H = height;
  const pad = { l: 58, r: 14, t: 12, b: 24 };
  const max = Math.max(1, ...series.flatMap((s) => s.values.map((v) => v ?? 0)));
  const inner = W - pad.l - pad.r;
  const step = labels.length > 1 ? inner / (labels.length - 1) : inner;
  const x = (i: number) => pad.l + (labels.length <= 1 ? inner / 2 : i * step);
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const every = Math.max(1, Math.ceil(labels.length / 12));
  const tipText = (i: number) => `${labels[i]}: ${series.map((s) => `${s.name} ${s.values[i] === null ? '—' : format(s.values[i] as number)}`).join(' · ')}`;
  return (
    <div className="relative" ref={tip.ref}>
      <Legend items={series.map((s, i) => ({ label: s.name, color: SERIES[i] }))} />
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full h-auto" style={{ minWidth: 520 }} role="img" aria-label={series.map((s) => s.name).join(' vs ')}>
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line x1={pad.l} x2={W - pad.r} y1={y(max * f)} y2={y(max * f)} stroke={f === 0 ? '#d1d5db' : '#f3f4f6'} strokeDasharray={f === 0 ? undefined : '4 4'} />
              <text x={pad.l - 6} y={y(max * f) + 3} textAnchor="end" fontSize={10} fill="#9ca3af">
                {format(max * f)}
              </text>
            </g>
          ))}
          {series.map((s, si) => (
            <polyline
              key={s.name}
              points={s.values.map((v, i) => (v === null ? null : `${x(i)},${y(v)}`)).filter(Boolean).join(' ')}
              fill="none"
              stroke={SERIES[si]}
              strokeWidth={2}
              strokeLinejoin="round"
            />
          ))}
          {series.map((s, si) =>
            s.values.map((v, i) => (v === null ? null : <circle key={`${si}-${i}`} cx={x(i)} cy={y(v)} r={4} fill={SERIES[si]} stroke="#fff" strokeWidth={2} />)),
          )}
          {labels.map((l, i) =>
            i % every === 0 ? (
              <text key={l} x={x(i)} y={H - 6} textAnchor="middle" fontSize={10} fill="#6b7280">
                {l}
              </text>
            ) : null,
          )}
          {labels.map((l, i) => (
            <rect
              key={l}
              x={x(i) - step / 2}
              y={0}
              width={Math.max(step, 12)}
              height={H}
              fill="transparent"
              tabIndex={0}
              onMouseEnter={(e) => tip.show(e, tipText(i))}
              onMouseLeave={tip.hide}
              onFocus={(e) => tip.show(e, tipText(i))}
              onBlur={tip.hide}
              aria-label={tipText(i)}
            />
          ))}
        </svg>
      </div>
      {tip.node}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-3 mb-2">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5 text-[11px] text-gray-600">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

/** Grid of cells shaded by value (one hue). `values[row][col]`. */
export function Heatmap({
  rows,
  cols,
  values,
  format = (n: number) => fmtNum(n),
  cellLabel,
  colEvery = 1,
  minCell = 28,
  rowWidth = 'w-28 sm:w-40',
}: {
  rows: string[];
  cols: string[];
  values: number[][];
  format?: (n: number) => string;
  cellLabel?: (r: number, c: number) => string;
  colEvery?: number;
  minCell?: number;
  rowWidth?: string;
}) {
  const tip = useTip();
  const max = Math.max(0, ...values.flat());
  return (
    <div className="relative" ref={tip.ref}>
      <div className="overflow-x-auto">
        <table className="border-separate" style={{ borderSpacing: 2, minWidth: cols.length * minCell }}>
          <thead>
            <tr>
              <th className={rowWidth} />
              {cols.map((c, i) => (
                <th key={c} className="text-[10px] font-normal text-gray-500 px-0.5 whitespace-nowrap" style={{ minWidth: minCell }}>
                  {i % colEvery === 0 ? c : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={r}>
                <th className={`${rowWidth} text-left text-[11px] font-medium text-gray-700 pr-2 truncate max-w-[10rem]`} title={r}>
                  {r}
                </th>
                {cols.map((c, ci) => {
                  const v = values[ri]?.[ci] || 0;
                  const { bg, fg } = rampColor(v, max);
                  const label = cellLabel ? cellLabel(ri, ci) : `${r} · ${c}: ${format(v)}`;
                  return (
                    <td
                      key={c}
                      tabIndex={0}
                      className="h-7 rounded-[3px] text-center text-[10px] tabular-nums outline-none focus:ring-2 focus:ring-gray-900"
                      style={{ background: bg, color: fg }}
                      onMouseEnter={(e) => tip.show(e, label)}
                      onMouseLeave={tip.hide}
                      onFocus={(e) => tip.show(e, label)}
                      onBlur={tip.hide}
                      aria-label={label}
                    >
                      {v ? format(v) : ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-1.5 mt-2 text-[10px] text-gray-500">
        <span>Less</span>
        {[0.08, 0.3, 0.55, 0.8, 1].map((f) => (
          <span key={f} className="h-2.5 w-5 rounded-sm" style={{ background: rampColor(f * Math.max(1, max), Math.max(1, max)).bg }} />
        ))}
        <span>More</span>
      </div>
      {tip.node}
    </div>
  );
}

/** Progress bar: green ≥ 100%, blue ≥ 60%, amber below; no target = grey. */
export function ProgressBar({ pct, label }: { pct: number | null | undefined; label?: string }) {
  const p = pct === null || pct === undefined ? null : Math.max(0, pct);
  const color = p === null ? 'bg-gray-300' : p >= 100 ? 'bg-emerald-500' : p >= 60 ? 'bg-blue-500' : 'bg-amber-500';
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden" role="progressbar" aria-valuenow={p ?? undefined} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, p ?? 0)}%` }} />
      </div>
      <span className="w-12 text-right text-xs tabular-nums text-gray-700">{p === null ? 'No target' : `${fmtNum(p, 0)}%`}</span>
    </div>
  );
}

/** Tiny bar sparkline (e.g. last 6 months). */
export function Sparkline({ values, title }: { values: number[]; title?: string }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex items-end gap-[2px] h-6 w-16" title={title} aria-label={title}>
      {values.map((v, i) => (
        <span key={i} className="flex-1 rounded-t-[2px]" style={{ height: `${Math.max(v > 0 ? 12 : 4, (v / max) * 100)}%`, background: v > 0 ? SERIES[0] : '#e5e7eb' }} />
      ))}
    </div>
  );
}
