// Payments tab — every recorded payment against any purchase invoice,
// flattened into a single chronological list.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Search, Calendar, Banknote, CreditCard, Building2, FileText, Receipt } from 'lucide-react';
import { procurementService } from '../services/procurementService';
import TablePagination from '@/components/admin/TablePagination';
import { useServerPagination } from '@/helper/useServerPagination';

type PaymentMethod = 'cash' | 'bank' | 'card' | 'cheque' | 'other';

interface Tx {
  paymentId: string;
  purchaseId: string;
  invoiceNumber: string;
  vendorName: string;
  invoiceTotal: number;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentDate: string;
  reference: string;
  notes: string;
}

type MethodFilter = 'all' | PaymentMethod;

const methodLabel: Record<PaymentMethod, string> = {
  cash: 'Cash',
  bank: 'Bank',
  card: 'Card',
  cheque: 'Cheque',
  other: 'Other',
};

export default function TransactionsTab() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Tx[]>([]);
  const [summary, setSummary] = useState({ count: 0, total: 0, cash: 0, bank: 0, other: 0 });
  const pg = useServerPagination(25);
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState<MethodFilter>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Debounced search so typing doesn't fire a request per keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Any filter change resets to page 1.
  useEffect(() => {
    pg.resetToFirstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, method, startDate, endDate]);

  useEffect(() => {
    setLoading(true);
    // procurementService.listTransactions already accepts params; pass through.
    procurementService
      .listTransactions({
        search: debouncedSearch || undefined,
        paymentMethod: method !== 'all' ? method : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page: pg.page,
        limit: pg.pageSize,
      })
      .then((resp) => {
        setRows(resp.data);
        setSummary(resp.summary);
        if ((resp as { pagination?: { total?: number } }).pagination?.total !== undefined) {
          pg.setTotal((resp as { pagination: { total: number } }).pagination.total);
        } else {
          pg.setTotal(resp.data.length);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, method, startDate, endDate, pg.page, pg.pageSize]);

  const fmt = (n: number) => `₨${(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Vendor name or invoice #"
            className="w-full pl-8 pr-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#DC2626]"
          />
        </div>
        <Calendar className="h-4 w-4 text-gray-500" />
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg"
        />
        <span className="text-gray-400 text-sm">to</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg"
        />
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as MethodFilter)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg"
        >
          <option value="all">All methods</option>
          <option value="cash">Cash</option>
          <option value="bank">Bank</option>
          <option value="card">Card</option>
          <option value="cheque">Cheque</option>
          <option value="other">Other</option>
        </select>
        {(search || method !== 'all' || startDate || endDate) && (
          <button
            onClick={() => {
              setSearch('');
              setMethod('all');
              setStartDate('');
              setEndDate('');
            }}
            className="px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Reset
          </button>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <Stat label="Payments" value={summary.count.toString()} />
        <Stat label="Total" value={fmt(summary.total)} accent="text-red-700" />
        <Stat label="Cash" value={fmt(summary.cash)} />
        <Stat label="Bank / Card / Cheque" value={fmt(summary.bank)} />
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Invoice #</th>
                <th className="px-3 py-2 text-left">Vendor</th>
                <th className="px-3 py-2 text-left">Method</th>
                <th className="px-3 py-2 text-left">Reference</th>
                <th className="px-3 py-2 text-left">Notes</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-right">Invoice Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-12 text-center">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400 mx-auto" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-12 text-center text-gray-400">
                    <Receipt className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    No payments match these filters
                  </td>
                </tr>
              ) : (
                rows.map((t) => (
                  <tr key={t.paymentId} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                      {new Date(t.paymentDate).toLocaleDateString()}
                      <div className="text-[10px] text-gray-400">
                        {new Date(t.paymentDate).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </td>
                    <td className="px-3 py-2 font-medium text-gray-900">
                      <span className="inline-flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5 text-gray-400" />
                        {t.invoiceNumber}
                      </span>
                    </td>
                    <td className="px-3 py-2">{t.vendorName}</td>
                    <td className="px-3 py-2"><MethodBadge method={t.paymentMethod} /></td>
                    <td className="px-3 py-2 text-gray-600">{t.reference || '—'}</td>
                    <td className="px-3 py-2 text-gray-500 truncate max-w-[220px]" title={t.notes}>
                      {t.notes || '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-red-700">
                      {fmt(t.amount)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-500 text-xs">
                      {fmt(t.invoiceTotal)}
                    </td>
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
          label="payments"
          loading={loading}
        />
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-2.5">
      <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">{label}</div>
      <div className={`text-sm sm:text-base font-semibold mt-0.5 truncate ${accent || 'text-gray-900'}`}>
        {value}
      </div>
    </div>
  );
}

function MethodBadge({ method }: { method: PaymentMethod }) {
  const config: Record<PaymentMethod, { icon: React.ReactNode; className: string }> = {
    cash: { icon: <Banknote className="h-3 w-3" />, className: 'bg-green-50 text-green-700 border-green-200' },
    bank: { icon: <Building2 className="h-3 w-3" />, className: 'bg-purple-50 text-purple-700 border-purple-200' },
    card: { icon: <CreditCard className="h-3 w-3" />, className: 'bg-blue-50 text-blue-700 border-blue-200' },
    cheque: { icon: <FileText className="h-3 w-3" />, className: 'bg-amber-50 text-amber-700 border-amber-200' },
    other: { icon: <Receipt className="h-3 w-3" />, className: 'bg-gray-50 text-gray-700 border-gray-200' },
  };
  const c = config[method];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${c.className}`}>
      {c.icon}
      {methodLabel[method]}
    </span>
  );
}
