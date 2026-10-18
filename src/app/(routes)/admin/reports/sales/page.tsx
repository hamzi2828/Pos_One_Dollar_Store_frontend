// Sales report — transaction-level listing of POS counter sales.
'use client';

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  TrendingUp,
  RefreshCw,
  Loader2,
  Calendar,
  Download,
  Eye,
  Store,
} from 'lucide-react';
import jsPDF from 'jspdf';
import ReportsNav from '../components/ReportsNav';
import { usePdfExport } from '../components/usePdfExport';
import {
  fetchSalesSummary,
  rangeFromFilter,
  type SalesSummaryReport,
  type DateFilter,
} from '../services/reportsService';
import { getCurrencySymbol } from '../../pos/utils/currency';
import TablePagination from '@/components/admin/TablePagination';
import { useServerPagination } from '@/helper/useServerPagination';

const CURRENCY = 'PKR';

export default function SalesReportPage() {
  const symbol = getCurrencySymbol(CURRENCY);
  const [filter, setFilter] = useState<DateFilter>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [data, setData] = useState<SalesSummaryReport | null>(null);
  const [loading, setLoading] = useState(false);

  const range = useMemo(() => rangeFromFilter(filter, customStart, customEnd), [filter, customStart, customEnd]);
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
  }, [filter, customStart, customEnd]);

  useEffect(() => {
    if (!range) return;
    const ctl = new AbortController();
    inFlightRef.current += 1;
    setLoading(true);
    fetchSalesSummary(
      range.start,
      range.end,
      { page: pg.page, limit: pg.pageSize, source: 'pos' },
      ctl.signal,
    )
      .then(({ data: d, pagination }) => {
        setData(d);
        pg.setTotal(pagination.total);
      })
      .catch((err) => {
        if ((err as Error).name === 'AbortError') return;
        toast.error(err instanceof Error ? err.message : 'Failed to load sales report');
      })
      .finally(() => {
        inFlightRef.current -= 1;
        if (inFlightRef.current === 0) setLoading(false);
      });
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, pg.page, pg.pageSize, reloadTick]);

  const fmt = (n: number) => `${symbol}${(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  // Server already applied the POS filter + pagination.
  const filteredOrders = data?.orders || [];

  const handleDownloadPdf = () => {
    if (!data) return;
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();
    const margin = 14;
    let y = 14;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('POS Sales Report', margin, y);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);
    y += 6;
    doc.text(`Period: ${range?.label ?? ''}`, margin, y);
    y += 8;
    doc.setTextColor(0);
    doc.setFontSize(10);
    const s = data.summary;
    const rows = [
      ['Total Orders', String(s.totalOrders)],
      ['POS Orders', `${s.posOrders} · ${fmt(s.posSales)}`],
      ['Total Sales', fmt(s.totalSales)],
      ['Total Cost', fmt(s.totalCost)],
      ['Total Profit', fmt(s.totalProfit)],
      ['Paid', fmt(s.totalPaid)],
      ['Pending', fmt(s.totalPending)],
      ['Cash', fmt(s.cashSales)],
      ['Card', fmt(s.cardSales)],
      ['Bank', fmt(s.bankSales)],
      ['Avg Order', fmt(s.avgOrderValue)],
      ['Items Sold', String(s.itemsSold)],
    ];
    rows.forEach(([k, v]) => {
      doc.text(k, margin, y);
      doc.text(v, pw - margin, y, { align: 'right' });
      y += 6;
    });
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.text('Orders', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const header = ['Src', 'Order #', 'Date', 'Customer', 'Method', 'Status', 'Cost', 'Total', 'Profit'];
    const widths = [12, 24, 20, 36, 18, 18, 20, 22, 22];
    let x = margin;
    doc.setFillColor(243, 244, 246);
    doc.rect(margin, y - 4, pw - 2 * margin, 6, 'F');
    header.forEach((h, i) => {
      doc.text(h, x, y);
      x += widths[i];
    });
    y += 4;
    data.orders.forEach((o) => {
      if (y > 280) {
        doc.addPage();
        y = 14;
      }
      x = margin;
      const name = o.customerInfo?.name || (o.customer ? `${o.customer.firstName ?? ''} ${o.customer.lastName ?? ''}`.trim() : 'Walk-in');
      const row = [
        o.orderNumber,
        new Date(o.createdAt).toLocaleDateString(),
        name.substring(0, 20),
        String(o.paymentMethod),
        o.paymentStatus,
        o.costPrice > 0 ? fmt(o.costPrice) : '—',
        fmt(o.total),
        o.costPrice > 0 ? fmt(o.profit) : '—',
      ];
      row.forEach((v, i) => {
        doc.text(String(v), x, y);
        x += widths[i];
      });
      y += 5;
    });
    doc.save(`POS_Sales_${range?.label.replace(/\s|\//g, '_')}.pdf`);
  };
  const pdfExport = usePdfExport(handleDownloadPdf);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-[#DC2626]" />
            POS Sales Report
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-gray-500">Counter-level transaction summary.</p>
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
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as DateFilter)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg"
        >
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="custom">Custom</option>
        </select>
        {filter === 'custom' && (
          <>
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg" />
            <span className="text-gray-400">to</span>
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg" />
          </>
        )}
        <span className="ml-auto text-sm text-gray-500">
          {range?.label ?? 'Pick a range'}
        </span>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center h-64 bg-white rounded-lg border border-gray-200">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : data ? (
        <>
          {/* Primary summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Orders" value={data.summary.totalOrders.toString()} />
            <Stat label="Total Sales" value={fmt(data.summary.totalSales)} />
            <Stat label="Total Cost" value={fmt(data.summary.totalCost)} />
            <Stat
              label="Total Profit"
              value={fmt(data.summary.totalProfit)}
              accent={data.summary.totalProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}
            />
            <Stat label="Paid" value={fmt(data.summary.totalPaid)} />
            <Stat label="Pending" value={fmt(data.summary.totalPending)} />
            <Stat label="Avg Order" value={fmt(data.summary.avgOrderValue)} />
            <Stat label="Items Sold" value={data.summary.itemsSold.toString()} />
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white border-b border-gray-200 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Order #</th>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Customer</th>
                    <th className="px-3 py-2 text-left">Method</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-right">Cost Price</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2 text-right">Profit</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-3 py-8 text-center text-gray-400">
                        No sales match these filters
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((o) => {
                      const name =
                        o.customerInfo?.name ||
                        (o.customer
                          ? `${o.customer.firstName ?? ''} ${o.customer.lastName ?? ''}`.trim()
                          : 'Walk-in');
                      const profitPositive = o.profit >= 0;
                      const methodLabel = o.paymentMethod;
                      const viewHref = `/admin/pos/invoice/${o._id}`;
                      return (
                        <tr key={`${o.source}-${o._id}`} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium">{o.orderNumber}</td>
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                            {new Date(o.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-3 py-2">{name}</td>
                          <td className="px-3 py-2 capitalize">
                            {String(methodLabel).replace('_', ' ')}
                          </td>
                          <td className="px-3 py-2 capitalize">{o.paymentStatus}</td>
                          <td className="px-3 py-2 text-right text-gray-600">
                            {o.costPrice > 0 ? fmt(o.costPrice) : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold">{fmt(o.total)}</td>
                          <td className={`px-3 py-2 text-right font-semibold ${profitPositive ? 'text-emerald-700' : 'text-red-600'}`}>
                            {o.costPrice > 0 ? fmt(o.profit) : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Link
                              href={viewHref}
                              target="_blank"
                              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })
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
              label="sales"
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
