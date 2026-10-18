'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Search, Edit3, Trash2, Power, Loader2, Users } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { procurementService, type Vendor, type Pagination as PaginationType } from '../services/procurementService';
import Pagination from './Pagination';
import VendorModal from './VendorModal';

// Debounce — so a burst of keystrokes only hits the backend once.
function useDebouncedValue<T>(value: T, delay: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

export default function VendorsTab() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationType>({ page: 1, limit: 20, total: 0, pages: 1 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  // Synchronous locks so a fast double-click can't fire a second request
  // before React has re-rendered the disabled button.
  const deletingRef = useRef<string | null>(null);
  const togglingRef = useRef<string | null>(null);

  const debouncedSearch = useDebouncedValue(search, 300);

  const fetchList = useCallback(async (page: number, limit: number) => {
    setLoading(true);
    try {
      const res = await procurementService.listVendors({
        page, limit, search: debouncedSearch, status: statusFilter,
      });
      setVendors(res.data);
      setPagination(res.pagination);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load vendors');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    // Reset to page 1 whenever filters change.
    fetchList(1, pagination.limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, statusFilter]);

  const handleDelete = async (id: string) => {
    if (deletingRef.current) return;
    if (!window.confirm('Soft-delete this vendor?')) return;
    if (deletingRef.current) return;
    deletingRef.current = id;
    setDeletingId(id);
    try {
      await procurementService.deleteVendor(id);
      toast.success('Vendor deleted');
      fetchList(pagination.page, pagination.limit);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      deletingRef.current = null;
      setDeletingId(null);
    }
  };

  const handleToggleStatus = async (id: string) => {
    if (togglingRef.current) return;
    togglingRef.current = id;
    setTogglingId(id);
    try {
      const v = await procurementService.toggleVendorStatus(id);
      setVendors((prev) => prev.map((x) => x._id === v._id ? { ...x, isActive: v.isActive } : x));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      togglingRef.current = null;
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendors by name, email, phone, category..."
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-honey-400 bg-white"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-honey-400 bg-white"
        >
          <option value="">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button
          onClick={() => { setEditing(null); setModalOpen(true); }}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-honey-500 text-white text-sm font-semibold rounded-lg hover:bg-honey-600"
        >
          <Plus className="w-4 h-4" /> Add Vendor
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2.5">Vendor</th>
                <th className="text-left px-3 py-2.5 hidden md:table-cell">Category</th>
                <th className="text-left px-3 py-2.5 hidden lg:table-cell">Contact</th>
                <th className="text-right px-3 py-2.5">Purchases</th>
                <th className="text-right px-3 py-2.5">Pending</th>
                <th className="text-center px-3 py-2.5">Status</th>
                <th className="text-right px-3 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-10"><Loader2 className="w-5 h-5 animate-spin text-gray-400 mx-auto" /></td></tr>
              ) : vendors.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10">
                  <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No vendors found</p>
                </td></tr>
              ) : (
                vendors.map((v) => (
                  <tr key={v._id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <div className="font-semibold text-gray-900">{v.name}</div>
                      <div className="text-xs text-gray-500">{v.contactPerson || '—'}</div>
                    </td>
                    <td className="px-3 py-2 hidden md:table-cell text-gray-600">{v.category || '—'}</td>
                    <td className="px-3 py-2 hidden lg:table-cell text-xs text-gray-600">
                      {v.email && <div>{v.email}</div>}
                      {v.phone && <div>{v.phone}</div>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <div className="text-gray-900 font-semibold">{(v.totalPurchases ?? 0).toFixed(2)}</div>
                      <div className="text-[10px] text-gray-400">{v.purchaseCount ?? 0} order{(v.purchaseCount ?? 0) === 1 ? '' : 's'}</div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">
                      <span className={v.totalPending ? 'text-honey-600' : 'text-gray-400'}>
                        {(v.totalPending ?? 0).toFixed(2)}
                      </span>
                      {(v.overdueCount ?? 0) > 0 && (
                        <div className="text-[10px] text-red-600">{v.overdueCount} overdue</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => handleToggleStatus(v._id)}
                        disabled={!!togglingId || deletingId === v._id}
                        aria-busy={togglingId === v._id}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold disabled:opacity-60 disabled:cursor-not-allowed ${
                          v.isActive ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {togglingId === v._id ? (
                          <><Loader2 className="w-2.5 h-2.5 animate-spin" />Updating…</>
                        ) : (
                          <><Power className="w-2.5 h-2.5" />{v.isActive ? 'Active' : 'Inactive'}</>
                        )}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => { setEditing(v); setModalOpen(true); }}
                          disabled={deletingId === v._id}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                          title="Edit vendor"
                        >
                          <Edit3 className="w-4 h-4" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(v._id)}
                          disabled={!!deletingId || togglingId === v._id}
                          aria-busy={deletingId === v._id}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 hover:text-red-900 hover:bg-red-50 rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                          title="Delete vendor"
                        >
                          {deletingId === v._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          <span>{deletingId === v._id ? 'Deleting…' : 'Delete'}</span>
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
          disabled={loading}
        />
      </div>

      <VendorModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => fetchList(pagination.page, pagination.limit)}
        vendor={editing}
      />
    </div>
  );
}
