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
  Pencil,
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
import { paymentMethodLabel } from '../../pos/utils/paymentMethods';
import TablePagination from '@/components/admin/TablePagination';
import { useServerPagination } from '@/helper/useServerPagination';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { useAccess } from '@/context/AccessContext';
import EditBillModal, { type EditableBill } from './EditBillModal';

const CURRENCY = 'PKR';

/** Profit as % of the sale ("25.3%"); '' when there is no sale. */
const pct = (profit: number, total: number) => (total > 0 ? `${((profit / total) * 100).toFixed(1)}%` : '');

/** Pieces on a bill (server itemCount; older API: sum of item quantities). */
const itemsOf = (o: { itemCount?: number; items?: unknown[] }) =>
  o.itemCount ?? (o.items || []).reduce<number>((n, it) => n + (Number((it as { quantity?: number })?.quantity) || 0), 0);

export default function SalesReportPage() {
  const symbol = getCurrencySymbol(CURRENCY);
  const [filter, setFilter] = useState<DateFilter>('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [data, setData] = useState<SalesSummaryReport | null>(null);
  const [loading, setLoading] = useState(false);
  const { can } = useAccess();
  const canEditBill = can('pos_orders', 'edit');
  const [editBill, setEditBill] = useState<EditableBill | null>(null);

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
      ['Total Profit', `${fmt(s.totalProfit)} (${pct(s.totalProfit, s.totalSales) || '0%'})`],
      ['Paid', fmt(s.totalPaid)],
      ['Pending', fmt(s.totalPending)],
      ['Cash', fmt(s.cashSales)],
      ['Card', fmt(s.cardSales)],
      ['Bank (UBL)', fmt(s.bankSales)],
      ['JazzCash', fmt(s.jazzcash || 0)],
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
    const header = ['Order #', 'Date', 'Customer', 'Method', 'Status', 'Items', 'Cost', 'Total', 'Profit'];
    const widths = [30, 20, 32, 16, 16, 12, 20, 20, 26];
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
        paymentMethodLabel(o.paymentMethod),
        o.paymentStatus,
        String(itemsOf(o)),
        o.costPrice > 0 ? fmt(o.costPrice) : '—',
        fmt(o.total),
        o.costPrice > 0 ? `${fmt(o.profit)} ${pct(o.profit, o.total)}` : '—',
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
            <TrendingUp className="h-6 w-6 text-honey-700" />
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
        <SearchSelect
          value={filter}
          onChange={(e) => setFilter(e.target.value as DateFilter)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg"
        >
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="custom">Custom</option>
        </SearchSelect>
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
              value={`${fmt(data.summary.totalProfit)}${pct(data.summary.totalProfit, data.summary.totalSales) ? ` · ${pct(data.summary.totalProfit, data.summary.totalSales)}` : ''}`}
              accent={data.summary.totalProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}
            />
            <Stat label="Paid" value={fmt(data.summary.totalPaid)} />
            <Stat label="Pending" value={fmt(data.summary.totalPending)} />
            <Stat label="Avg Order" value={fmt(data.summary.avgOrderValue)} />
            <Stat label="Items Sold" value={data.summary.itemsSold.toString()} />
          </div>

          {/* How the sales were paid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Cash', value: data.summary.cashSales, cls: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
              { label: 'Card (POS machine)', value: data.summary.cardSales, cls: 'border-sky-200 bg-sky-50 text-sky-800' },
              { label: 'Bank (UBL)', value: data.summary.bankSales, cls: 'border-violet-200 bg-violet-50 text-violet-800' },
              { label: 'JazzCash', value: data.summary.jazzcash || 0, cls: 'border-rose-200 bg-rose-50 text-rose-800' },
            ].map((m) => (
              <div key={m.label} className={`rounded-lg border p-3 ${m.cls}`}>
                <div className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{m.label}</div>
                <div className="mt-0.5 text-lg font-bold tabular-nums">{fmt(m.value)}</div>
                <div className="text-[11px] opacity-75">{pct(m.value, data.summary.totalSales) || '0%'} of sales</div>
              </div>
            ))}
          </div>

          {/* The same totals, counter by counter */}
          {(data.summary.byCounter?.length ?? 0) > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-200 text-sm font-semibold text-gray-900">By counter</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-[11px] uppercase text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Counter</th>
                      <th className="px-3 py-2 text-right">Orders</th>
                      <th className="px-3 py-2 text-right">Total sales</th>
                      <th className="px-3 py-2 text-right">Cash</th>
                      <th className="px-3 py-2 text-right">Card</th>
                      <th className="px-3 py-2 text-right">Bank (UBL)</th>
                      <th className="px-3 py-2 text-right">JazzCash</th>
                      <th className="px-3 py-2 text-right">Pending</th>
                      <th className="px-3 py-2 text-right">Items</th>
                      <th className="px-3 py-2 text-right">Cost</th>
                      <th className="px-3 py-2 text-right">Profit · %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.summary.byCounter!.map((c) => (
                      <tr key={c.name}>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                              c.name === 'No counter' ? 'bg-gray-100 text-gray-700' : /2/.test(c.name) ? 'bg-violet-100 text-violet-800' : 'bg-sky-100 text-sky-800'
                            }`}
                          >
                            {c.name}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{c.orders}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold">
                          {fmt(c.sales)}
                          <span className="block text-[10px] font-normal text-gray-500">{pct(c.sales, data.summary.totalSales) || '0%'}</span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-emerald-800">{fmt(c.cash)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-sky-800">{fmt(c.card)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-violet-800">{fmt(c.bank)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-rose-800">{fmt(c.jazzcash || 0)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt(c.pending)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{c.items}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-600">{fmt(c.cost)}</td>
                        <td className={`px-3 py-2 text-right tabular-nums ${c.profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                          {fmt(c.profit)} <span className="text-[10px] text-gray-500">{pct(c.profit, c.sales)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

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
                    <th className="px-3 py-2 text-right">Items</th>
                    <th className="px-3 py-2 text-right">Cost Price</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2 text-right">Profit · %</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-3 py-8 text-center text-gray-400">
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
                          <td className="px-3 py-2 font-medium">
                            {o.orderNumber}
                            {o.counterName && (
                              <span
                                className={`ml-1.5 inline-block rounded px-1.5 py-0.5 align-middle text-[10px] font-semibold ${
                                  /2/.test(o.counterName) ? 'bg-violet-100 text-violet-800' : 'bg-sky-100 text-sky-800'
                                }`}
                              >
                                {o.counterName}
                              </span>
                            )}
                            <span className="block text-[11px] font-normal text-gray-500">
                              {new Date(o.createdAt).toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Karachi' })}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                            {new Date(o.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-3 py-2">{name}</td>
                          <td className="px-3 py-2">
                            {paymentMethodLabel(String(methodLabel))}
                          </td>
                          <td className="px-3 py-2 capitalize">{o.paymentStatus}</td>
                          <td className="px-3 py-2 text-right">{itemsOf(o)}</td>
                          <td className="px-3 py-2 text-right text-gray-600">
                            {o.costPrice > 0 ? fmt(o.costPrice) : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold">{fmt(o.total)}</td>
                          <td className={`px-3 py-2 text-right font-semibold ${profitPositive ? 'text-emerald-700' : 'text-red-600'}`}>
                            {o.costPrice > 0 ? (
                              <>
                                {fmt(o.profit)}
                                <span className="ml-1.5 text-xs font-medium opacity-80">{pct(o.profit, o.total)}</span>
                              </>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            {canEditBill && (
                              <button
                                type="button"
                                onClick={() => setEditBill(o)}
                                className="mr-2 inline-flex items-center gap-1 text-gray-600 hover:text-gray-900"
                                title="Edit, discount or refund"
                                aria-label="Edit bill"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            )}
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
      {editBill && <EditBillModal bill={editBill} onClose={() => setEditBill(null)} onSaved={load} />}
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
