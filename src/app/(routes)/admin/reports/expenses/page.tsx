// Expense Report — every operational expense for the window with category
// and payment-method breakdowns.
'use client';

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { Receipt, RefreshCw, Loader2, Calendar, Download, Search } from 'lucide-react';
import jsPDF from 'jspdf';
import ReportsNav from '../components/ReportsNav';
import { usePdfExport } from '../components/usePdfExport';
import {
  fetchExpenseReport,
  rangeFromFilter,
  type ExpenseReport,
  type DateFilter,
} from '../services/reportsService';
import { getCurrencySymbol } from '../../pos/utils/currency';
import TablePagination from '@/components/admin/TablePagination';
import { useServerPagination } from '@/helper/useServerPagination';

const CURRENCY = 'PKR';

export default function ExpenseReportPage() {
  const symbol = getCurrencySymbol(CURRENCY);
  const fmt = (n: number) => `${symbol}${(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  const [filter, setFilter] = useState<DateFilter>('month');
  const [cs, setCs] = useState('');
  const [ce, setCe] = useState('');
  const [category, setCategory] = useState('all');
  const [method, setMethod] = useState('all');
  const [search, setSearch] = useState('');
  const [data, setData] = useState<ExpenseReport | null>(null);
  const [loading, setLoading] = useState(false);

  const range = useMemo(() => rangeFromFilter(filter, cs, ce), [filter, cs, ce]);
  const pg = useServerPagination(25);
  const [reloadTick, setReloadTick] = useState(0);
  const load = useCallback(() => setReloadTick((n) => n + 1), []);
  // Counts in-flight fetches so Refresh can't be re-fired while one is running.
  const inFlightRef = useRef(0);
  const handleRefresh = () => {
    if (inFlightRef.current > 0) return;
    load();
  };

  // Reset to page 1 any time filters change (keeps the hook filter-agnostic).
  useEffect(() => {
    pg.resetToFirstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, cs, ce, category, method, search]);

  // Debounce search input so every keystroke doesn't fire a request.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Main loader. AbortController cancels in-flight requests on filter change
  // so stale responses can't overwrite a fresher one.
  useEffect(() => {
    if (!range) return;
    const ctl = new AbortController();
    inFlightRef.current += 1;
    setLoading(true);
    fetchExpenseReport(
      range.start,
      range.end,
      {
        category: category === 'all' ? undefined : category,
        method: method === 'all' ? undefined : method,
        page: pg.page,
        limit: pg.pageSize,
        search: debouncedSearch || undefined,
      },
      ctl.signal,
    )
      .then(({ data: d, pagination }) => {
        setData(d);
        pg.setTotal(pagination.total);
      })
      .catch((err) => {
        if ((err as Error).name === 'AbortError') return;
        toast.error(err instanceof Error ? err.message : 'Failed to load expenses');
      })
      .finally(() => {
        inFlightRef.current -= 1;
        if (inFlightRef.current === 0) setLoading(false);
      });
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, category, method, debouncedSearch, pg.page, pg.pageSize, reloadTick]);

  // Expenses already come pre-filtered from the server.
  const filtered = data?.expenses || [];
  const categoryOptions = Array.from(new Set(filtered.map((e) => e.category).filter(Boolean))).sort();

  const handleDownloadPdf = () => {
    if (!data) return;
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();
    const margin = 14;
    let y = 14;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Expense Report', margin, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);
    doc.text(`Period: ${range?.label ?? ''}`, margin, y);
    y += 8;
    doc.setTextColor(0);
    const summary: Array<[string, string]> = [
      ['Total', fmt(data.summary.total)],
      ['Entries', String(data.summary.count)],
      ['Cash', fmt(data.summary.cashTotal)],
      ['Bank', fmt(data.summary.bankTotal)],
      ['Avg', fmt(data.summary.avgExpense)],
    ];
    summary.forEach(([k, v]) => { doc.text(k, margin, y); doc.text(v, pw - margin, y, { align: 'right' }); y += 6; });
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.text('By category', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    data.byCategory.forEach((c) => {
      if (y > 280) { doc.addPage(); y = 14; }
      doc.text(c.category, margin, y);
      doc.text(fmt(c.amount), pw - margin, y, { align: 'right' });
      y += 5;
    });
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.text('Entries', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const headers = ['Date', 'Title', 'Category', 'Method', 'Amount'];
    const widths = [22, 60, 40, 30, 30];
    doc.setFillColor(243, 244, 246);
    doc.rect(margin, y - 4, pw - 2 * margin, 6, 'F');
    let x = margin;
    headers.forEach((h, i) => { doc.text(h, x, y); x += widths[i]; });
    y += 5;
    filtered.forEach((e) => {
      if (y > 280) { doc.addPage(); y = 14; }
      x = margin;
      const row = [
        new Date(e.date).toLocaleDateString(),
        e.title.substring(0, 36),
        (e.category || '').substring(0, 22),
        e.paymentMethod,
        fmt(e.amount),
      ];
      row.forEach((v, i) => { doc.text(String(v), x, y); x += widths[i]; });
      y += 5;
    });
    doc.save(`Expense_Report_${range?.label.replace(/\s|\//g, '_')}.pdf`);
  };
  const pdfExport = usePdfExport(handleDownloadPdf);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <Receipt className="h-6 w-6 text-[#DC2626]" />
            Expense Report
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-gray-500">
            Operational expenses with category and payment-method breakdowns.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={pdfExport.run}
            disabled={loading || !data || pdfExport.exporting}
            aria-busy={pdfExport.exporting}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {pdfExport.exporting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
            ) : (
              <><Download className="h-4 w-4" /> PDF</>
            )}
          </button>
          <button
            onClick={handleRefresh}
            disabled={loading}
            aria-busy={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Loading…</>
            ) : (
              <><RefreshCw className="h-4 w-4" /> Refresh</>
            )}
          </button>
        </div>
      </div>

      <ReportsNav />

      <div className="bg-white rounded-lg border border-gray-200 p-3 flex flex-wrap items-center gap-3">
        <Calendar className="h-4 w-4 text-gray-500" />
        <select value={filter} onChange={(e) => setFilter(e.target.value as DateFilter)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg">
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="custom">Custom</option>
        </select>
        {filter === 'custom' && (
          <>
            <input type="date" value={cs} onChange={(e) => setCs(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg" />
            <span className="text-gray-400">to</span>
            <input type="date" value={ce} onChange={(e) => setCe(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg" />
          </>
        )}
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg">
          <option value="all">All categories</option>
          {categoryOptions.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={method} onChange={(e) => setMethod(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg">
          <option value="all">All methods</option>
          <option value="Cash">Cash</option>
          <option value="Bank Transfer">Bank Transfer</option>
          <option value="Credit Card">Credit Card</option>
          <option value="Debit Card">Debit Card</option>
          <option value="Check">Check</option>
          <option value="Other">Other</option>
        </select>
        <div className="relative flex-1 min-w-[200px] max-w-xs ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Title, reference, category"
            className="w-full pl-8 pr-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#DC2626]"
          />
        </div>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center h-64 bg-white rounded-lg border border-gray-200">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Stat label="Total" value={fmt(data.summary.total)} accent="text-red-700" />
            <Stat label="Entries" value={data.summary.count.toString()} />
            <Stat label="Cash" value={fmt(data.summary.cashTotal)} />
            <Stat label="Bank" value={fmt(data.summary.bankTotal)} />
            <Stat label="Avg Expense" value={fmt(data.summary.avgExpense)} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <BreakdownCard title="By Category" rows={data.byCategory.map((b) => ({ label: b.category, value: fmt(b.amount) }))} />
            <BreakdownCard title="By Payment Method" rows={data.byMethod.map((b) => ({ label: b.method, value: fmt(b.amount) }))} />
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Title</th>
                    <th className="px-3 py-2 text-left">Category</th>
                    <th className="px-3 py-2 text-left">Method</th>
                    <th className="px-3 py-2 text-left">Reference</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">No expenses match these filters</td></tr>
                  ) : filtered.map((e) => (
                    <tr key={e._id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{new Date(e.date).toLocaleDateString()}</td>
                      <td className="px-3 py-2 font-medium">{e.title}</td>
                      <td className="px-3 py-2">{e.category}</td>
                      <td className="px-3 py-2">{e.paymentMethod}</td>
                      <td className="px-3 py-2 text-gray-500">{e.reference || '—'}</td>
                      <td className="px-3 py-2 text-right font-semibold text-red-700">{fmt(e.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePagination
              page={pg.page}
              pages={pg.pages}
              total={pg.total}
              limit={pg.pageSize}
              onPageChange={pg.setPage}
              onLimitChange={pg.setPageSize}
              loading={loading}
              label="expenses"
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">{label}</div>
      <div className={`text-base font-semibold mt-0.5 truncate ${accent || 'text-gray-900'}`}>{value}</div>
    </div>
  );
}

function BreakdownCard({ title, rows }: { title: string; rows: Array<{ label: string; value: string }> }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-3 py-2 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {title}
      </div>
      <div className="divide-y divide-gray-100 max-h-60 overflow-y-auto">
        {rows.length === 0 ? (
          <div className="p-3 text-sm text-gray-400 text-center">No data</div>
        ) : rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between px-3 py-2 text-sm">
            <span className="text-gray-700">{r.label || 'Uncategorized'}</span>
            <span className="font-semibold text-gray-900">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
