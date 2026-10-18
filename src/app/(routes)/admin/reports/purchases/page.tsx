// Purchases report — vendor invoices and outgoing payments.
'use client';

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { Package, RefreshCw, Loader2, Calendar } from 'lucide-react';
import ReportsNav from '../components/ReportsNav';
import {
  fetchPurchasesSummary,
  rangeFromFilter,
  type PurchasesSummaryReport,
  type DateFilter,
} from '../services/reportsService';
import { getCurrencySymbol } from '../../pos/utils/currency';
import TablePagination from '@/components/admin/TablePagination';
import { useServerPagination } from '@/helper/useServerPagination';

const CURRENCY = 'PKR';

export default function PurchasesReportPage() {
  const symbol = getCurrencySymbol(CURRENCY);
  const [filter, setFilter] = useState<DateFilter>('month');
  const [cs, setCs] = useState('');
  const [ce, setCe] = useState('');
  const [data, setData] = useState<PurchasesSummaryReport | null>(null);
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

  useEffect(() => {
    pg.resetToFirstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, cs, ce]);

  useEffect(() => {
    if (!range) return;
    const ctl = new AbortController();
    inFlightRef.current += 1;
    setLoading(true);
    fetchPurchasesSummary(
      range.start,
      range.end,
      { page: pg.page, limit: pg.pageSize },
      ctl.signal,
    )
      .then(({ data: d, pagination }) => {
        setData(d);
        pg.setTotal(pagination.total);
      })
      .catch((err) => {
        if ((err as Error).name === 'AbortError') return;
        toast.error(err instanceof Error ? err.message : 'Failed to load purchases');
      })
      .finally(() => {
        inFlightRef.current -= 1;
        if (inFlightRef.current === 0) setLoading(false);
      });
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, pg.page, pg.pageSize, reloadTick]);

  const fmt = (n: number) => `${symbol}${(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <Package className="h-6 w-6 text-[#DC2626]" />
            Purchases Report
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-gray-500">Vendor invoices and payment flow.</p>
        </div>
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
        <span className="ml-auto text-sm text-gray-500">{range?.label ?? 'Pick a range'}</span>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center h-64 bg-white rounded-lg border border-gray-200">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Invoices" value={data.summary.totalPurchases.toString()} />
            <Stat label="Total Amount" value={fmt(data.summary.totalAmount)} />
            <Stat label="Paid" value={fmt(data.summary.totalPaid)} />
            <Stat label="Pending" value={fmt(data.summary.totalPending)} />
            <Stat label="Cash Out" value={fmt(data.summary.cashPaid)} />
            <Stat label="Bank Out" value={fmt(data.summary.bankPaid)} />
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Invoice #</th>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Vendor</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2 text-right">Paid</th>
                    <th className="px-3 py-2 text-right">Pending</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.purchases.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-gray-400">No purchases in this period</td>
                    </tr>
                  ) : (
                    (data.purchases || []).map((p) => (
                      <tr key={p._id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium">{p.invoiceNumber}</td>
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{new Date(p.purchaseDate).toLocaleDateString()}</td>
                        <td className="px-3 py-2">{p.vendorName || '—'}</td>
                        <td className="px-3 py-2 capitalize">{p.paymentStatus}</td>
                        <td className="px-3 py-2 text-right">{fmt(p.total)}</td>
                        <td className="px-3 py-2 text-right text-emerald-700">{fmt(p.paidAmount)}</td>
                        <td className="px-3 py-2 text-right text-orange-600">{fmt(p.pendingAmount)}</td>
                      </tr>
                    ))
                  )}
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
              label="purchases"
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-base font-semibold text-gray-900 mt-0.5 truncate">{value}</div>
    </div>
  );
}
