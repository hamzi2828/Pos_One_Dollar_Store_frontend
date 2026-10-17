'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Search, Edit3, Trash2, Loader2, FileText, DollarSign, Eye } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  procurementService,
  type Purchase,
  type Vendor,
  type Pagination as PaginationType,
} from '../services/procurementService';
import Pagination from './Pagination';
import PurchaseModal from './PurchaseModal';
import PaymentModal from './PaymentModal';
import PurchaseDetailModal from './PurchaseDetailModal';

function useDebouncedValue<T>(value: T, delay: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

const STATUS_STYLES: Record<Purchase['paymentStatus'], string> = {
  pending: 'bg-gray-100 text-gray-600',
  partial: 'bg-amber-50 text-amber-700',
  paid: 'bg-emerald-50 text-emerald-700',
  overdue: 'bg-red-50 text-red-700',
};

export default function PurchasesTab() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationType>({ page: 1, limit: 20, total: 0, pages: 1 });
  const [totals, setTotals] = useState({ amount: 0, paid: 0, pending: 0 });

  const [search, setSearch] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Purchase | null>(null);
  const [paymentFor, setPaymentFor] = useState<Purchase | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(search, 300);

  const fetchList = useCallback(async (page: number, limit: number) => {
    setLoading(true);
    try {
      const res = await procurementService.listPurchases({
        page, limit,
        search: debouncedSearch,
        vendorId, status, dateFrom, dateTo,
      });
      setPurchases(res.data);
      setPagination(res.pagination);
      setTotals(res.totals);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load purchases');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, vendorId, status, dateFrom, dateTo]);

  // Fetch all vendors for the filter dropdown + new-purchase form.
  useEffect(() => {
    procurementService.listVendors({ limit: 100, status: 'active' })
      .then((res) => setVendors(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchList(1, pagination.limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, vendorId, status, dateFrom, dateTo]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this purchase? (soft delete)')) return;
    setDeletingId(id);
    try {
      await procurementService.deletePurchase(id);
      toast.success('Purchase deleted');
      fetchList(pagination.page, pagination.limit);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-3">
      {/* Page totals */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 text-xs">
        <StatCard label="Page Total" value={totals.amount} />
        <StatCard label="Paid" value={totals.paid} tone="emerald" />
        <StatCard label="Pending" value={totals.pending} tone="honey" />
      </div>

      {/* Toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
        <div className="relative md:col-span-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice, vendor, notes..."
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-honey-400 bg-white"
          />
        </div>
        <select
          value={vendorId}
          onChange={(e) => setVendorId(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-honey-400 bg-white"
        >
          <option value="">All vendors</option>
          {vendors.map((v) => <option key={v._id} value={v._id}>{v.name}</option>)}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-honey-400 bg-white"
        >
          <option value="">All status</option>
          <option value="pending">Pending</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-honey-400 bg-white"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-honey-400 bg-white"
        />
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => { setEditing(null); setModalOpen(true); }}
          disabled={vendors.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-honey-500 text-white text-sm font-semibold rounded-lg hover:bg-honey-600 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> New Purchase
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2.5">Invoice</th>
                <th className="text-left px-3 py-2.5">Vendor</th>
                <th className="text-left px-3 py-2.5 hidden md:table-cell">Date</th>
                <th className="text-right px-3 py-2.5">Total</th>
                <th className="text-right px-3 py-2.5 hidden sm:table-cell">Paid</th>
                <th className="text-right px-3 py-2.5">Pending</th>
                <th className="text-center px-3 py-2.5">Status</th>
                <th className="text-right px-3 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={8} className="text-center py-10"><Loader2 className="w-5 h-5 animate-spin text-gray-400 mx-auto" /></td></tr>
              ) : purchases.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10">
                  <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No purchases found</p>
                </td></tr>
              ) : (
                purchases.map((p) => (
                  <tr key={p._id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs font-semibold text-gray-900">{p.invoiceNumber}</td>
                    <td className="px-3 py-2 text-gray-700">{p.vendorName}</td>
                    <td className="px-3 py-2 hidden md:table-cell text-gray-500 text-xs">
                      {new Date(p.purchaseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{p.total.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums hidden sm:table-cell text-emerald-600">{p.paidAmount.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-honey-600">{p.pendingAmount.toFixed(2)}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${STATUS_STYLES[p.paymentStatus]}`}>
                        {p.paymentStatus}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => setDetailId(p._id)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                          title="View purchase"
                        >
                          <Eye className="w-4 h-4" />
                          <span>View</span>
                        </button>
                        {p.paymentStatus !== 'paid' && (
                          <button
                            onClick={() => setPaymentFor(p)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded transition-colors"
                            title="Record a payment"
                          >
                            <DollarSign className="w-4 h-4" />
                            <span>Pay</span>
                          </button>
                        )}
                        <button
                          onClick={() => { setEditing(p); setModalOpen(true); }}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                          title="Edit purchase"
                        >
                          <Edit3 className="w-4 h-4" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(p._id)}
                          disabled={deletingId === p._id}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 hover:text-red-900 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                          title="Delete purchase"
                        >
                          {deletingId === p._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={pagination.page}
          pages={pagination.pages}
          total={pagination.total}
          limit={pagination.limit}
          onPageChange={(p) => fetchList(p, pagination.limit)}
          onLimitChange={(l) => fetchList(1, l)}
        />
      </div>

      <PurchaseModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => fetchList(pagination.page, pagination.limit)}
        purchase={editing}
        vendors={vendors}
      />
      <PaymentModal
        open={!!paymentFor}
        onClose={() => setPaymentFor(null)}
        onSaved={() => fetchList(pagination.page, pagination.limit)}
        purchase={paymentFor}
      />
      <PurchaseDetailModal
        open={!!detailId}
        purchaseId={detailId}
        onClose={() => setDetailId(null)}
        onChange={() => fetchList(pagination.page, pagination.limit)}
      />
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: 'emerald' | 'honey' }) {
  const toneCls = tone === 'emerald' ? 'text-emerald-600' : tone === 'honey' ? 'text-honey-600' : 'text-gray-900';
  return (
    <div className="bg-white rounded-lg border border-gray-200 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">{label}</p>
      <p className={`text-base font-bold tabular-nums ${toneCls}`}>{value.toFixed(2)}</p>
    </div>
  );
}
