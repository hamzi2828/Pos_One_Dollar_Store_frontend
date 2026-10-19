'use client';

// Cash closing report: closed till sessions by date / counter / cashier with
// expected vs counted, variance totals and a CSV export (`report_cash_closing`).

import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Download, Loader2, RefreshCw, AlertCircle, Search, Calculator } from 'lucide-react';
import { storeApi, apiErrorMessage, formatRs, formatDate, API_URL, type PageMeta } from '@/lib/storeApi';
import { getAuthHeader } from '@/helper/helper';
import { useAccess } from '@/context/AccessContext';
import { LoadingCard, NoAccessCard, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import ReportsNav from '../components/ReportsNav';
import { formatTime, type TillSession } from '@/components/store/TillStatusBar';
import { SessionDetailModal, StatusBadge, varianceClass, varianceLabel } from '../../till/components/tillUi';
import { SearchSelect } from '@/components/ui/SearchSelect';

interface Summary {
  sessions?: number;
  toVerify?: number;
  verified?: number;
  disputed?: number;
  float?: number;
  cashSales?: number;
  cashReceivedOnCredit?: number;
  cashRefunds?: number;
  expectedCash?: number;
  counted?: number;
  variance?: number;
  shortCount?: number;
  overCount?: number;
  shortTotal?: number;
  lateOpen?: number;
  lateClose?: number;
}

interface CashierRow {
  _id: string;
  cashierName: string;
  sessions: number;
  expectedCash: number;
  counted: number;
  variance: number;
  shortCount: number;
}

type ReportMeta = PageMeta & { summary?: Summary; byCashier?: CashierRow[] };

/** YYYY-MM-DD in the browser's (Pakistan) time. */
const dayString = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function CashClosingReportPage() {
  const { can, loaded } = useAccess();
  const canView = can('report_cash_closing', 'view');
  const canExport = can('report_cash_closing', 'export');
  const canOpenDetail = can('till_verify', 'view');

  const today = new Date();
  const [from, setFrom] = useState(() => dayString(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [to, setTo] = useState(() => dayString(today));
  const [counter, setCounter] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<TillSession[]>([]);
  const [meta, setMeta] = useState<ReportMeta | null>(null);
  const [counters, setCounters] = useState<{ _id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const reqRef = useRef(0);

  useEffect(() => {
    if (!canView) return;
    storeApi
      .get<{ _id: string; name: string }[]>('/counters', { limit: 200 })
      .then((r) => setCounters(r.data || []))
      .catch(() => setCounters([]));
  }, [canView]);

  useEffect(() => {
    const t = window.setTimeout(() => setQuery(search.trim()), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  const params = { from, to, counter, status, search: query };

  const load = useCallback(async () => {
    const id = ++reqRef.current;
    try {
      setLoading(true);
      setError(null);
      const res = await storeApi.get<TillSession[]>('/till-sessions/report', { from, to, counter, status, search: query, page, limit: 50 });
      if (id !== reqRef.current) return;
      setRows(res.data || []);
      setMeta((res.meta as ReportMeta) || null);
    } catch (e) {
      if (id === reqRef.current) setError(apiErrorMessage(e, 'Could not load the report.'));
    } finally {
      if (id === reqRef.current) setLoading(false);
    }
  }, [from, to, counter, status, query, page]);

  useEffect(() => {
    if (canView) load();
  }, [canView, load]);

  const exportCsv = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v));
      const res = await axios.get(`${API_URL}/till-sessions/report/export`, {
        headers: { ...getAuthHeader() },
        params: clean,
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cash-closing-${from || 'all'}-to-${to || 'today'}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      // Error bodies arrive as a Blob here: read the server's message out of it.
      let message = apiErrorMessage(e, 'Could not export.');
      if (axios.isAxiosError(e) && e.response?.data instanceof Blob) {
        try {
          message = JSON.parse(await e.response.data.text())?.message || message;
        } catch {
          /* keep the generic message */
        }
      }
      toast.error(message);
    } finally {
      setExporting(false);
    }
  };

  const setFilter = <T,>(setter: (v: T) => void) => (v: T) => {
    setPage(1);
    setter(v);
  };

  if (!loaded) return <div className="max-w-7xl mx-auto px-4 py-6"><LoadingCard text="Loading…" /></div>;
  if (!canView) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <NoAccessCard />
      </div>
    );
  }

  const s = meta?.summary || {};

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4">
        <ReportsNav />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 flex items-center gap-2">
              <Calculator className="h-6 w-6 text-honey-700" /> Cash Closing
            </h1>
            <p className="mt-0.5 text-xs sm:text-sm text-gray-500">Counted cash vs expected cash for every closed till. The opening float is not sales.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={load} disabled={loading} className={secondaryBtn} aria-label="Refresh">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {canExport && (
              <button type="button" onClick={exportCsv} disabled={exporting} className={primaryBtn}>
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export CSV
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 grid grid-cols-2 md:grid-cols-6 gap-2 sm:gap-3">
          <input type="date" value={from} onChange={(e) => setFilter(setFrom)(e.target.value)} className={inputClass} aria-label="From" />
          <input type="date" value={to} onChange={(e) => setFilter(setTo)(e.target.value)} className={inputClass} aria-label="To" />
          <SearchSelect value={counter} onChange={(e) => setFilter(setCounter)(e.target.value)} className={inputClass} aria-label="Counter">
            <option value="">All counters</option>
            {counters.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </SearchSelect>
          <SearchSelect value={status} onChange={(e) => setFilter(setStatus)(e.target.value)} className={inputClass} aria-label="Status">
            <option value="">All closed</option>
            <option value="closed">To verify</option>
            <option value="verified">Verified</option>
            <option value="disputed">Disputed</option>
          </SearchSelect>
          <div className="relative col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              placeholder="Cashier, counter or till no…"
              className={`${inputClass} pl-9`}
            />
          </div>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-3">
          <Tile label="Closed tills" value={String(s.sessions ?? 0)} sub={`${s.toVerify ?? 0} to verify · ${s.disputed ?? 0} disputed`} />
          <Tile label="Expected cash" value={formatRs(s.expectedCash)} sub={`Sales ${formatRs(s.cashSales)} · credit ${formatRs(s.cashReceivedOnCredit)}`} />
          <Tile label="Counted cash" value={formatRs(s.counted)} sub={`Floats ${formatRs(s.float)} · refunds ${formatRs(s.cashRefunds)}`} />
          <Tile label="Net variance" value={varianceLabel(s.variance ?? 0)} valueClass={varianceClass(s.variance ?? 0)} sub={`Short total ${formatRs(Math.abs(s.shortTotal || 0))}`} />
          <Tile label="Short / over tills" value={`${s.shortCount ?? 0} / ${s.overCount ?? 0}`} sub={`Late open ${s.lateOpen ?? 0} · late close ${s.lateClose ?? 0}`} />
        </div>

        {/* By cashier */}
        {!!meta?.byCashier?.length && (
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Cashier</th>
                  <th className="px-4 py-2 text-right font-semibold">Tills</th>
                  <th className="px-4 py-2 text-right font-semibold">Expected</th>
                  <th className="px-4 py-2 text-right font-semibold">Counted</th>
                  <th className="px-4 py-2 text-right font-semibold">Variance</th>
                  <th className="px-4 py-2 text-right font-semibold">Short tills</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {meta.byCashier.map((c) => (
                  <tr key={c._id}>
                    <td className="px-4 py-2 font-medium text-gray-900">{c.cashierName}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{c.sessions}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatRs(c.expectedCash)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatRs(c.counted)}</td>
                    <td className={`px-4 py-2 text-right font-semibold ${varianceClass(c.variance)}`}>{varianceLabel(c.variance)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{c.shortCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Sessions */}
        {loading && rows.length === 0 ? (
          <LoadingCard text="Loading report…" />
        ) : error ? (
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-red-200 text-center py-10 px-4">
            <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
            <p className="text-sm text-red-700 mb-4">{error}</p>
            <button type="button" onClick={load} className={primaryBtn}>
              Try again
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 text-center py-12 text-sm text-gray-500">No closed tills in this period.</div>
        ) : (
          <div className={`bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 overflow-x-auto ${loading ? 'opacity-60' : ''}`}>
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Till</th>
                  <th className="px-4 py-2 text-left font-semibold">Cashier</th>
                  <th className="px-4 py-2 text-left font-semibold">Opened → closed</th>
                  <th className="px-4 py-2 text-right font-semibold">Float</th>
                  <th className="px-4 py-2 text-right font-semibold">Expected</th>
                  <th className="px-4 py-2 text-right font-semibold">Counted</th>
                  <th className="px-4 py-2 text-right font-semibold">Variance</th>
                  <th className="px-4 py-2 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr
                    key={r._id}
                    onClick={canOpenDetail ? () => setDetailId(r._id) : undefined}
                    className={canOpenDetail ? 'cursor-pointer hover:bg-gray-50' : ''}
                  >
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className="font-medium text-gray-900">{r.sessionNo}</span>
                      <span className="block text-xs text-gray-500">{r.counterName || 'No counter'}</span>
                    </td>
                    <td className="px-4 py-2 text-gray-700 whitespace-nowrap">{r.cashierName}</td>
                    <td className="px-4 py-2 text-xs text-gray-600 whitespace-nowrap">
                      {formatDate(r.openedAt, true)}
                      {r.closedAt ? ` → ${formatTime(r.closedAt)}` : ''}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatRs(r.openingFloat?.total)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.expected ? formatRs(r.expected.expectedCash) : '—'}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.closingCount ? formatRs(r.closingCount.total) : '—'}</td>
                    <td className={`px-4 py-2 text-right font-semibold whitespace-nowrap ${varianceClass(r.variance)}`}>{varianceLabel(r.variance)}</td>
                    <td className="px-4 py-2">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {meta && meta.pages > 1 && (
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 text-xs text-gray-600">
                <span>
                  Page {page} of {meta.pages} · {meta.total} tills
                </span>
                <span className="flex gap-2">
                  <button type="button" onClick={() => setPage((p) => p - 1)} disabled={page <= 1 || loading} className={`${secondaryBtn} !px-3 !py-1`}>
                    Previous
                  </button>
                  <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page >= meta.pages || loading} className={`${secondaryBtn} !px-3 !py-1`}>
                    Next
                  </button>
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {detailId && <SessionDetailModal id={detailId} onClose={() => setDetailId(null)} onChanged={load} />}
    </div>
  );
}

function Tile({ label, value, sub, valueClass }: { label: string; value: string; sub?: string; valueClass?: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <p className="text-[11px] sm:text-xs text-gray-500">{label}</p>
      <p className={`mt-0.5 text-base sm:text-lg font-semibold tabular-nums ${valueClass || 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-[10px] sm:text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}
