// Receivables — every POS order that hasn't been paid in full.
// Shows open balances, lets cashier jump into the POS Pending Payments flow
// to record a payment.
'use client';

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  AlertCircle,
  Clock,
  RefreshCw,
  Loader2,
  Search,
  Download,
  Eye,
  Wallet,
  User,
} from 'lucide-react';
import jsPDF from 'jspdf';
import ReportsNav from '../components/ReportsNav';
import { usePdfExport } from '../components/usePdfExport';
import { getPendingOrders } from '../../pos/services/posOrderService';
import type { POSOrder } from '../../pos/types';
import { getCurrencySymbol } from '../../pos/utils/currency';
import TablePagination from '@/components/admin/TablePagination';
import { useClientPagination } from '@/helper/useClientPagination';

type TabType = 'all' | 'pending' | 'partial';
const CURRENCY = 'PKR';

export default function ReceivablesPage() {
  const symbol = getCurrencySymbol(CURRENCY);
  const fmt = (n: number) =>
    `${symbol}${(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<POSOrder[]>([]);
  const [summary, setSummary] = useState<{
    totalOrders: number;
    totalPending: number;
    totalPaid: number;
    totalAmount: number;
  }>({ totalOrders: 0, totalPending: 0, totalPaid: 0, totalAmount: 0 });
  const [tab, setTab] = useState<TabType>('all');
  const [search, setSearch] = useState('');

  // Counts in-flight fetches so Refresh can't be re-fired while one is running.
  const inFlightRef = useRef(0);
  const load = useCallback(async () => {
    try {
      inFlightRef.current += 1;
      setLoading(true);
      const resp = await getPendingOrders();
      setOrders(resp.data || []);
      setSummary(
        resp.summary || { totalOrders: 0, totalPending: 0, totalPaid: 0, totalAmount: 0 },
      );
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Failed to load receivables');
    } finally {
      inFlightRef.current -= 1;
      if (inFlightRef.current === 0) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  const handleRefresh = () => {
    if (inFlightRef.current > 0) return;
    load();
  };

  const filtered = useMemo(() => {
    let list = orders;
    if (tab !== 'all') list = list.filter((o) => o.paymentStatus === tab);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((o) => {
        const name =
          o.customerInfo?.name ||
          (o.customer ? `${o.customer.firstName} ${o.customer.lastName ?? ''}` : '');
        const phone = o.customerInfo?.phone || o.customer?.phone || '';
        return (
          o.orderNumber.toLowerCase().includes(q) ||
          name.toLowerCase().includes(q) ||
          phone.toLowerCase().includes(q)
        );
      });
    }
    return list;
  }, [orders, tab, search]);
  const pg = useClientPagination(filtered, 25);

  const handleDownloadPdf = () => {
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();
    const margin = 14;
    let y = 14;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Receivables Report', margin, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);
    doc.text(`Generated ${new Date().toLocaleDateString()}`, margin, y);
    y += 8;

    doc.setTextColor(0);
    doc.setFontSize(10);
    const rows = [
      ['Open invoices', String(summary.totalOrders)],
      ['Total pending', fmt(summary.totalPending)],
      ['Total paid (partials)', fmt(summary.totalPaid)],
      ['Gross amount', fmt(summary.totalAmount)],
    ];
    rows.forEach(([k, v]) => {
      doc.text(k, margin, y);
      doc.text(v, pw - margin, y, { align: 'right' });
      y += 6;
    });
    y += 4;

    doc.setFont('helvetica', 'bold');
    doc.text('Open invoices', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const widths = [30, 55, 24, 22, 22, 25];
    const header = ['Order #', 'Customer', 'Status', 'Total', 'Paid', 'Pending'];
    doc.setFillColor(243, 244, 246);
    doc.rect(margin, y - 4, pw - 2 * margin, 6, 'F');
    let x = margin;
    header.forEach((h, i) => {
      doc.text(h, x, y);
      x += widths[i];
    });
    y += 5;

    filtered.forEach((o) => {
      if (y > 280) {
        doc.addPage();
        y = 14;
      }
      x = margin;
      const name =
        o.customerInfo?.name ||
        (o.customer ? `${o.customer.firstName ?? ''} ${o.customer.lastName ?? ''}`.trim() : 'Walk-in');
      const row = [
        o.orderNumber,
        name.substring(0, 28),
        o.paymentStatus,
        fmt(o.total),
        fmt(o.paidAmount || 0),
        fmt(o.pendingAmount || 0),
      ];
      row.forEach((v, i) => {
        doc.text(String(v), x, y);
        x += widths[i];
      });
      y += 5;
    });

    doc.save(`Receivables_${new Date().toISOString().split('T')[0]}.pdf`);
  };
  const pdfExport = usePdfExport(handleDownloadPdf);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <AlertCircle className="h-6 w-6 text-[#DC2626]" />
            Receivables
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-gray-500">
            Open POS invoices — pending and partially paid orders.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={pdfExport.run}
            disabled={loading || pdfExport.exporting}
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Open Invoices" value={summary.totalOrders.toString()} accent="bg-blue-50 text-blue-700" icon={<AlertCircle className="h-5 w-5" />} />
        <Stat label="Total Pending" value={fmt(summary.totalPending)} accent="bg-orange-50 text-orange-700" icon={<Clock className="h-5 w-5" />} />
        <Stat label="Paid (partials)" value={fmt(summary.totalPaid)} accent="bg-emerald-50 text-emerald-700" icon={<Wallet className="h-5 w-5" />} />
        <Stat label="Gross Open" value={fmt(summary.totalAmount)} accent="bg-gray-50 text-gray-700" icon={<User className="h-5 w-5" />} />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-3 flex flex-wrap items-center gap-2">
        <TabBtn label="All" active={tab === 'all'} onClick={() => setTab('all')} count={orders.length} />
        <TabBtn label="Pending" active={tab === 'pending'} onClick={() => setTab('pending')} count={orders.filter((o) => o.paymentStatus === 'pending').length} />
        <TabBtn label="Partial" active={tab === 'partial'} onClick={() => setTab('partial')} count={orders.filter((o) => o.paymentStatus === 'partial').length} />
        <div className="relative flex-1 min-w-[200px] max-w-xs ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Order #, name, phone"
            className="w-full pl-8 pr-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#DC2626]"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">Order #</th>
                <th className="px-3 py-2 text-left">Customer</th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-right">Paid</th>
                <th className="px-3 py-2 text-right">Pending</th>
                <th className="px-3 py-2 text-left w-[30%]">Progress</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-3 py-12 text-center">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400 mx-auto" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-12 text-center text-gray-400">
                    No receivables match these filters
                  </td>
                </tr>
              ) : (
                pg.paged.map((o) => {
                  const name =
                    o.customerInfo?.name ||
                    (o.customer ? `${o.customer.firstName ?? ''} ${o.customer.lastName ?? ''}`.trim() : 'Walk-in');
                  const phone = o.customerInfo?.phone || o.customer?.phone || '';
                  const pct = o.total > 0 ? Math.min(100, ((o.paidAmount || 0) / o.total) * 100) : 0;

                  return (
                    <tr key={o._id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-900">{o.orderNumber}</td>
                      <td className="px-3 py-2">
                        <div className="text-gray-900">{name}</div>
                        {phone && <div className="text-[11px] text-gray-400">{phone}</div>}
                      </td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                        {new Date(o.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={o.paymentStatus} />
                      </td>
                      <td className="px-3 py-2 text-right">{fmt(o.total)}</td>
                      <td className="px-3 py-2 text-right text-emerald-700">
                        {fmt(o.paidAmount || 0)}
                      </td>
                      <td className="px-3 py-2 text-right text-orange-600 font-semibold">
                        {fmt(o.pendingAmount || 0)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-emerald-500 h-2 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-gray-500 text-right mt-0.5">
                          {pct.toFixed(0)}% paid
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/admin/pos/invoice/${o._id}`}
                            target="_blank"
                            className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded"
                            title="Open invoice"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          <Link
                            href={`/admin/pos?tab=pending`}
                            className="px-2 py-1 text-xs font-medium text-white bg-[#DC2626] rounded hover:bg-[#B91C1C]"
                            title="Record payment in POS"
                          >
                            Pay
                          </Link>
                        </div>
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
          label="receivables"
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-3">
      <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${accent}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">{label}</div>
        <div className="text-base font-semibold text-gray-900 truncate">{value}</div>
      </div>
    </div>
  );
}

function TabBtn({ label, active, onClick, count }: { label: string; active: boolean; onClick: () => void; count: number }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
        active ? 'bg-[#DC2626] text-white' : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {label}
      <span
        className={`text-[10px] px-1.5 py-0.5 rounded ${
          active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function StatusBadge({ status }: { status?: string }) {
  if (status === 'partial') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border bg-yellow-50 text-yellow-700 border-yellow-200 text-xs font-medium">
        <Clock className="h-3 w-3" /> Partial
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border bg-orange-50 text-orange-700 border-orange-200 text-xs font-medium">
      <AlertCircle className="h-3 w-3" /> Pending
    </span>
  );
}
