// Vendor Payments Report — every outgoing payment against a vendor invoice.
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Building2, RefreshCw, Loader2, Calendar, Download, Search, AlertCircle, FileText } from 'lucide-react';
import Link from 'next/link';
import jsPDF from 'jspdf';
import ReportsNav from '../components/ReportsNav';
import {
  fetchVendorPayments,
  rangeFromFilter,
  type VendorPaymentsReport,
  type DateFilter,
} from '../services/reportsService';
import { getCurrencySymbol } from '../../pos/utils/currency';
import TablePagination from '@/components/admin/TablePagination';
import { useClientPagination } from '@/helper/useClientPagination';
import { useServerPagination } from '@/helper/useServerPagination';

const CURRENCY = 'PKR';

export default function VendorPaymentsPage() {
  const symbol = getCurrencySymbol(CURRENCY);
  const fmt = (n: number) => `${symbol}${(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  const [filter, setFilter] = useState<DateFilter>('month');
  const [cs, setCs] = useState('');
  const [ce, setCe] = useState('');
  const [search, setSearch] = useState('');
  const [data, setData] = useState<VendorPaymentsReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'payments' | 'outstanding' | 'by-vendor'>('payments');

  const range = useMemo(() => rangeFromFilter(filter, cs, ce), [filter, cs, ce]);
  const paymentsPg = useServerPagination(25);
  const [reloadTick, setReloadTick] = useState(0);
  const load = useCallback(() => setReloadTick((n) => n + 1), []);

  // Debounce the search input so typing doesn't re-hit the API every keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page when filters that change the payments slice change.
  useEffect(() => {
    paymentsPg.resetToFirstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, cs, ce, debouncedSearch]);

  useEffect(() => {
    if (!range) return;
    const ctl = new AbortController();
    setLoading(true);
    fetchVendorPayments(
      range.start,
      range.end,
      {
        page: paymentsPg.page,
        limit: paymentsPg.pageSize,
        search: debouncedSearch || undefined,
      },
      ctl.signal,
    )
      .then(({ data: d, pagination }) => {
        setData(d);
        paymentsPg.setTotal(pagination.total);
      })
      .catch((err) => {
        if ((err as Error).name === 'AbortError') return;
        toast.error(err instanceof Error ? err.message : 'Failed to load vendor payments');
      })
      .finally(() => setLoading(false));
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, debouncedSearch, paymentsPg.page, paymentsPg.pageSize, reloadTick]);

  // Payments already paginated by server. Outstanding + By Vendor come full
  // because they're small aggregates — use client-side pagination for their
  // tabs only.
  const filtered = data?.payments || [];
  const outstandingPg = useClientPagination(data?.outstandingInvoices || [], 25);
  const byVendorPg = useClientPagination(data?.byVendor || [], 25);

  const handleDownloadPdf = () => {
    if (!data) return;
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();
    const margin = 14;
    let y = 14;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Vendor Payments Report', margin, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);
    doc.text(`Period: ${range?.label ?? ''}`, margin, y);
    y += 8;
    doc.setTextColor(0);
    const summary: Array<[string, string]> = [
      ['Total Paid', fmt(data.summary.total)],
      ['Payments', String(data.summary.count)],
      ['Vendors', String(data.summary.uniqueVendors)],
      ['Cash', fmt(data.summary.cashTotal)],
      ['Bank', fmt(data.summary.bankTotal)],
    ];
    summary.forEach(([k, v]) => { doc.text(k, margin, y); doc.text(v, pw - margin, y, { align: 'right' }); y += 6; });
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.text('By vendor', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    data.byVendor.forEach((v) => {
      if (y > 280) { doc.addPage(); y = 14; }
      doc.text(v.vendor, margin, y);
      doc.text(`${v.count} payments`, margin + 80, y);
      doc.text(fmt(v.amount), pw - margin, y, { align: 'right' });
      y += 5;
    });
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.text('Payments', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const headers = ['Date', 'Vendor', 'Invoice #', 'Method', 'Amount', 'Total', 'Paid', 'Pending'];
    const widths = [20, 42, 28, 18, 22, 22, 22, 22];
    doc.setFillColor(243, 244, 246);
    doc.rect(margin, y - 4, pw - 2 * margin, 6, 'F');
    let x = margin;
    headers.forEach((h, i) => { doc.text(h, x, y); x += widths[i]; });
    y += 5;
    filtered.forEach((p) => {
      if (y > 280) { doc.addPage(); y = 14; }
      x = margin;
      const row = [
        new Date(p.date).toLocaleDateString(),
        p.vendorName.substring(0, 24),
        p.invoiceNumber.substring(0, 18),
        p.paymentMethod,
        fmt(p.amount),
        fmt(p.invoiceTotal),
        fmt(Number(p.invoicePaid) || 0),
        (Number(p.invoicePending) || 0) > 0 ? fmt(p.invoicePending) : '—',
      ];
      row.forEach((v, i) => { doc.text(String(v), x, y); x += widths[i]; });
      y += 5;
    });
    doc.save(`Vendor_Payments_${range?.label.replace(/\s|\//g, '_')}.pdf`);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <Building2 className="h-6 w-6 text-[#DC2626]" />
            Vendor Payments
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-gray-500">Outgoing payments against vendor invoices.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleDownloadPdf} disabled={loading || !data} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            <Download className="h-4 w-4" /> PDF
          </button>
          <button onClick={load} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
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
        <div className="relative flex-1 min-w-[200px] max-w-xs ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Vendor, invoice #, reference"
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
            <Stat label="Total Paid" value={fmt(data.summary.total)} accent="text-red-700" />
            <Stat label="Payments" value={data.summary.count.toString()} />
            <Stat label="Vendors" value={data.summary.uniqueVendors.toString()} />
            <Stat label="Cash" value={fmt(data.summary.cashTotal)} />
            <Stat label="Bank" value={fmt(data.summary.bankTotal)} />
          </div>

          {/* Tab bar — switch between Payments / Outstanding / By Vendor. */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-1 border-b border-gray-200 bg-gray-50 p-1">
              <TabBtn
                label="Payments"
                count={data.summary.count}
                active={tab === 'payments'}
                onClick={() => setTab('payments')}
              />
              <TabBtn
                label="Outstanding Invoices"
                count={data.summary.outstanding.count}
                active={tab === 'outstanding'}
                onClick={() => setTab('outstanding')}
                tone={data.summary.outstanding.count > 0 ? 'warn' : 'default'}
              />
              <TabBtn
                label="By Vendor"
                count={data.byVendor.length}
                active={tab === 'by-vendor'}
                onClick={() => setTab('by-vendor')}
              />
            </div>

            <div className="overflow-x-auto">
              {tab === 'payments' && (
                <table className="w-full text-sm">
                  <thead className="bg-white border-b border-gray-200 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Vendor</th>
                      <th className="px-3 py-2 text-left">Invoice #</th>
                      <th className="px-3 py-2 text-left">Method</th>
                      <th className="px-3 py-2 text-left">Reference</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2 text-right">Invoice Total</th>
                      <th className="px-3 py-2 text-right">Paid</th>
                      <th className="px-3 py-2 text-right">Pending</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-3 py-8 text-center">
                          <div className="text-gray-500 text-sm">
                            No vendor payments were recorded in this period.
                          </div>
                          {data.outstandingInvoices.length > 0 && (
                            <div className="text-xs text-gray-400 mt-1">
                              {data.outstandingInvoices.length} outstanding invoice
                              {data.outstandingInvoices.length === 1 ? '' : 's'} on file — switch to the Outstanding tab, or record payments under{' '}
                              <Link href="/admin/procurement" className="text-blue-600 hover:underline">
                                Procurement
                              </Link>
                              .
                            </div>
                          )}
                        </td>
                      </tr>
                    ) : (
                      filtered.map((p) => {
                        const pending = Number(p.invoicePending) || 0;
                        const paid = Number(p.invoicePaid) || 0;
                        return (
                          <tr key={p._id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{new Date(p.date).toLocaleDateString()}</td>
                            <td className="px-3 py-2 font-medium">{p.vendorName}</td>
                            <td className="px-3 py-2 text-gray-600">{p.invoiceNumber}</td>
                            <td className="px-3 py-2 capitalize">{p.paymentMethod}</td>
                            <td className="px-3 py-2 text-gray-500">{p.reference || '—'}</td>
                            <td className="px-3 py-2 text-right font-semibold text-red-700">{fmt(p.amount)}</td>
                            <td className="px-3 py-2 text-right text-gray-700">{fmt(p.invoiceTotal)}</td>
                            <td className="px-3 py-2 text-right text-emerald-700">{fmt(paid)}</td>
                            <td className={`px-3 py-2 text-right font-semibold ${pending > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                              {pending > 0 ? fmt(pending) : '—'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              )}
              {tab === 'payments' && (
                <TablePagination
                  page={paymentsPg.page}
                  pages={paymentsPg.pages}
                  total={paymentsPg.total}
                  limit={paymentsPg.pageSize}
                  onPageChange={paymentsPg.setPage}
                  onLimitChange={paymentsPg.setPageSize}
                  label="payments"
                />
              )}

              {tab === 'outstanding' && (
                <table className="w-full text-sm">
                  <thead className="bg-white border-b border-gray-200 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Invoice #</th>
                      <th className="px-3 py-2 text-left">Vendor</th>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Due</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-right">Total</th>
                      <th className="px-3 py-2 text-right">Paid</th>
                      <th className="px-3 py-2 text-right">Pending</th>
                      <th className="px-3 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.outstandingInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-3 py-12 text-center text-gray-400">
                          All vendor invoices are paid in full. Nice work.
                        </td>
                      </tr>
                    ) : (
                      outstandingPg.paged.map((inv) => {
                        const overdue = inv.dueDate && new Date(inv.dueDate) < new Date();
                        return (
                          <tr key={inv._id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium">{inv.invoiceNumber}</td>
                            <td className="px-3 py-2">{inv.vendorName}</td>
                            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                              {new Date(inv.purchaseDate).toLocaleDateString()}
                            </td>
                            <td className={`px-3 py-2 whitespace-nowrap ${overdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                              {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '—'}
                              {overdue && <span className="ml-1 text-[10px] uppercase">overdue</span>}
                            </td>
                            <td className="px-3 py-2 capitalize">{inv.paymentStatus}</td>
                            <td className="px-3 py-2 text-right">{fmt(inv.total)}</td>
                            <td className="px-3 py-2 text-right text-emerald-700">{fmt(inv.paidAmount)}</td>
                            <td className="px-3 py-2 text-right font-semibold text-orange-600">{fmt(inv.pendingAmount)}</td>
                            <td className="px-3 py-2 text-right">
                              <Link
                                href={`/admin/procurement?invoice=${inv._id}`}
                                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
                                title="Open invoice in procurement"
                              >
                                <FileText className="h-4 w-4" />
                              </Link>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              )}
              {tab === 'outstanding' && (
                <TablePagination
                  page={outstandingPg.page}
                  pages={outstandingPg.pages}
                  total={outstandingPg.total}
                  limit={outstandingPg.pageSize}
                  onPageChange={outstandingPg.setPage}
                  onLimitChange={outstandingPg.setPageSize}
                  label="invoices"
                />
              )}

              {tab === 'by-vendor' && (
                <table className="w-full text-sm">
                  <thead className="bg-white border-b border-gray-200 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Vendor</th>
                      <th className="px-3 py-2 text-right">Invoices</th>
                      <th className="px-3 py-2 text-right">Invoice Total</th>
                      <th className="px-3 py-2 text-right">Paid Total</th>
                      <th className="px-3 py-2 text-right">Pending Total</th>
                      <th className="px-3 py-2 text-right border-l border-gray-200">Payments (window)</th>
                      <th className="px-3 py-2 text-right">Amount (window)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.byVendor.length === 0 ? (
                      <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">No vendors on file</td></tr>
                    ) : (
                      byVendorPg.paged.map((v) => (
                        <tr key={v.vendor} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium">{v.vendor}</td>
                          <td className="px-3 py-2 text-right">{v.invoiceCount}</td>
                          <td className="px-3 py-2 text-right text-gray-900">{fmt(v.invoiceTotal)}</td>
                          <td className="px-3 py-2 text-right text-emerald-700 font-medium">{fmt(v.invoicePaid)}</td>
                          <td className={`px-3 py-2 text-right font-semibold ${v.invoicePending > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                            {v.invoicePending > 0 ? fmt(v.invoicePending) : '—'}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-500 border-l border-gray-200">{v.count}</td>
                          <td className="px-3 py-2 text-right font-semibold text-red-700">
                            {v.amount > 0 ? fmt(v.amount) : <span className="text-gray-300">—</span>}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
              {tab === 'by-vendor' && (
                <TablePagination
                  page={byVendorPg.page}
                  pages={byVendorPg.pages}
                  total={byVendorPg.total}
                  limit={byVendorPg.pageSize}
                  onPageChange={byVendorPg.setPage}
                  onLimitChange={byVendorPg.setPageSize}
                  label="vendors"
                />
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function TabBtn({
  label,
  count,
  active,
  onClick,
  tone = 'default',
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  tone?: 'default' | 'warn';
}) {
  const pillColor = active
    ? 'bg-white/20 text-white'
    : tone === 'warn' && count > 0
    ? 'bg-orange-100 text-orange-700'
    : 'bg-gray-200 text-gray-700';
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
        active ? 'bg-[#DC2626] text-white shadow-sm' : 'text-gray-600 hover:bg-white hover:text-gray-900'
      }`}
    >
      {tone === 'warn' && count > 0 && <AlertCircle className={`h-4 w-4 ${active ? 'text-white' : 'text-orange-600'}`} />}
      {label}
      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${pillColor}`}>
        {count}
      </span>
    </button>
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
