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

type ReportRow = TillSession & { discountTotal?: number; discountBills?: number };

/** Cashier vs system per till: cash (after the day's expenses), POS machine, bank; overall over / short. */
function figures(r: ReportRow) {
  const e = r.expected;
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const sysCash = e ? r2(e.cashSales + e.cashReceivedOnCredit - e.cashRefunds - (e.expenses || 0)) : null;
  const sysCard = e?.card ?? null;
  const sysBank = e?.bankTransfer ?? null;
  const cash = r.dayCash ? r.dayCash.total : null;
  const card = r.cardTotal ?? null;
  const bank = r.bankTransferTotal ?? null;
  // Over / short: the cash result (till + cash) + card and bank differences.
  let over: number | null = r.variance ?? null;
  if (over != null && card != null && sysCard != null) over += card - sysCard;
  if (over != null && bank != null && sysBank != null) over += bank - sysBank;
  return { cash, sysCash, card, sysCard, bank, sysBank, expenses: e?.expenses || 0, discounts: r.discountTotal || 0, over: over == null ? null : r2(over) };
}

function Pair({ got, should }: { got: number | null; should: number | null }) {
  return (
    <>
      <span className="block font-medium text-gray-900">{got != null ? formatRs(got) : '—'}</span>
      {should != null && <span className="block text-[10px] text-gray-500">sales {formatRs(should)}</span>}
    </>
  );
}

/** Shop day of a till: its closing time less 6 h, so a till closed after midnight counts for the day before. */
const shopDay = (r: ReportRow) => {
  const at = r.closedAt || r.openedAt;
  return at ? dayString(new Date(new Date(at).getTime() - 6 * 3600 * 1000)) : '';
};

type Fig = ReturnType<typeof figures>;
type FigKey = 'cash' | 'sysCash' | 'card' | 'sysCard' | 'bank' | 'sysBank' | 'expenses' | 'discounts' | 'over';
const addFig = (all: Fig[], k: FigKey) => all.reduce((t, f) => t + ((f[k] as number | null) || 0), 0);

/** Every day with all its counters added together (owner, 2026-11-09). */
function byDay(rows: ReportRow[]) {
  const map = new Map<string, ReportRow[]>();
  for (const r of rows) {
    const d = shopDay(r);
    map.set(d, [...(map.get(d) || []), r]);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([day, list]) => ({
      day,
      tills: list.length,
      counters: [...new Set(list.map((r) => r.counterName || 'No counter'))].sort(),
      figs: list.map(figures),
    }));
}

/** "2026-11-08" -> "Sun, 8 Nov 2026". */
const dayLabel = (d: string) =>
  d ? new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '—';

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
  const [rows, setRows] = useState<ReportRow[]>([]);
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
      const res = await storeApi.get<ReportRow[]>('/till-sessions/report', { from, to, counter, status, search: query, page, limit: 50 });
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

        {/* By day: both counters together */}
        {rows.length > 0 &&
          (() => {
            const days = byDay(rows);
            const allFigs = days.flatMap((d) => d.figs);
            const th = 'px-4 py-2 text-right font-semibold';
            const td = 'px-4 py-2 text-right tabular-nums whitespace-nowrap';
            return (
              <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
                <div className="px-4 py-2.5 border-b border-gray-100">
                  <h2 className="text-sm font-semibold text-gray-900">By day — all counters together</h2>
                  <p className="text-[11px] text-gray-500">A till closed after midnight (up to 6 am) counts for the day before.</p>
                </div>
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-[11px] uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold">Day</th>
                      <th className="px-4 py-2 text-left font-semibold">Counters</th>
                      <th className={th}>Cash</th>
                      <th className={th}>POS</th>
                      <th className={th}>Bank</th>
                      <th className={th}>Expenses</th>
                      <th className={th}>Discounts</th>
                      <th className={th}>Over / short</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {days.map((d) => (
                      <tr key={d.day}>
                        <td className="px-4 py-2 font-medium text-gray-900 whitespace-nowrap">{dayLabel(d.day)}</td>
                        <td className="px-4 py-2 text-xs text-gray-600 whitespace-nowrap">
                          {d.counters.join(' + ')}
                          <span className="block text-[10px] text-gray-400">
                            {d.tills} till{d.tills === 1 ? '' : 's'}
                          </span>
                        </td>
                        <td className={td}>
                          <Pair got={addFig(d.figs, 'cash')} should={addFig(d.figs, 'sysCash')} />
                        </td>
                        <td className={td}>
                          <Pair got={addFig(d.figs, 'card')} should={addFig(d.figs, 'sysCard')} />
                        </td>
                        <td className={td}>
                          <Pair got={addFig(d.figs, 'bank')} should={addFig(d.figs, 'sysBank')} />
                        </td>
                        <td className={`${td} text-gray-700`}>{addFig(d.figs, 'expenses') ? formatRs(addFig(d.figs, 'expenses')) : '—'}</td>
                        <td className={`${td} text-rose-700`}>{addFig(d.figs, 'discounts') ? formatRs(addFig(d.figs, 'discounts')) : '—'}</td>
                        <td className={`${td} font-semibold ${varianceClass(addFig(d.figs, 'over'))}`}>{varianceLabel(addFig(d.figs, 'over'))}</td>
                      </tr>
                    ))}
                  </tbody>
                  {days.length > 1 && (
                    <tfoot className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                      <tr>
                        <td className="px-4 py-2" colSpan={2}>
                          Total ({days.length} days)
                        </td>
                        <td className={td}>
                          <Pair got={addFig(allFigs, 'cash')} should={addFig(allFigs, 'sysCash')} />
                        </td>
                        <td className={td}>
                          <Pair got={addFig(allFigs, 'card')} should={addFig(allFigs, 'sysCard')} />
                        </td>
                        <td className={td}>
                          <Pair got={addFig(allFigs, 'bank')} should={addFig(allFigs, 'sysBank')} />
                        </td>
                        <td className={td}>{formatRs(addFig(allFigs, 'expenses'))}</td>
                        <td className={`${td} text-rose-700`}>{formatRs(addFig(allFigs, 'discounts'))}</td>
                        <td className={`${td} ${varianceClass(addFig(allFigs, 'over'))}`}>{varianceLabel(addFig(allFigs, 'over'))}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            );
          })()}

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
                  <th className="px-4 py-2 text-right font-semibold">Cash</th>
                  <th className="px-4 py-2 text-right font-semibold">POS</th>
                  <th className="px-4 py-2 text-right font-semibold">Bank</th>
                  <th className="px-4 py-2 text-right font-semibold">Expenses</th>
                  <th className="px-4 py-2 text-right font-semibold">Discounts</th>
                  <th className="px-4 py-2 text-right font-semibold">Over / short</th>
                  <th className="px-4 py-2 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr
                    key={r._id}
                    onClick={canOpenDetail ? () => window.open(`/admin/till/${r._id}`, '_blank', 'noopener') : undefined}
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
                    {(() => {
                      const f = figures(r);
                      return (
                        <>
                          <td className="px-4 py-2 text-right tabular-nums whitespace-nowrap">
                            <Pair got={f.cash} should={f.sysCash} />
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums whitespace-nowrap">
                            <Pair got={f.card} should={f.sysCard} />
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums whitespace-nowrap">
                            <Pair got={f.bank} should={f.sysBank} />
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums whitespace-nowrap text-gray-700">{f.expenses ? formatRs(f.expenses) : '—'}</td>
                          <td className="px-4 py-2 text-right tabular-nums whitespace-nowrap text-rose-700">
                            {f.discounts ? formatRs(f.discounts) : '—'}
                            {r.discountBills ? <span className="block text-[10px] text-gray-500">{r.discountBills} bills</span> : null}
                          </td>
                          <td className={`px-4 py-2 text-right font-semibold whitespace-nowrap ${varianceClass(f.over)}`}>{varianceLabel(f.over)}</td>
                        </>
                      );
                    })()}
                    <td className="px-4 py-2">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
              {rows.length > 1 &&
                (() => {
                  const all = rows.map(figures);
                  const add = (k: FigKey) => addFig(all, k);
                  return (
                    <tfoot className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                      <tr>
                        <td className="px-4 py-2" colSpan={3}>
                          Total ({rows.length} tills)
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          <Pair got={add('cash')} should={add('sysCash')} />
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          <Pair got={add('card')} should={add('sysCard')} />
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          <Pair got={add('bank')} should={add('sysBank')} />
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">{formatRs(add('expenses'))}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-rose-700">{formatRs(add('discounts'))}</td>
                        <td className={`px-4 py-2 text-right whitespace-nowrap ${varianceClass(add('over'))}`}>{varianceLabel(add('over'))}</td>
                        <td />
                      </tr>
                    </tfoot>
                  );
                })()}
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
