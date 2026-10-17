'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Search, Edit2, Trash2, ChevronLeft, ChevronRight, Loader2, AlertCircle, Building2 } from 'lucide-react';
import { bankService } from './service/bankService';
import type { Bank, RawBank } from './types';
import { useDebounced } from '@/helper/useDebounced';
import { EMPTY_PAGINATION, type Pagination } from '@/helper/pagination';

const banksPerPage = 10;

const BanksPage = () => {
  const router = useRouter();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState<string>('');
  const debouncedSearch = useDebounced(searchTerm, 350);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pagination, setPagination] = useState<Pagination>(EMPTY_PAGINATION);
  const abortRef = useRef<AbortController | null>(null);

  // Delete modal states
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [deletingBank, setDeletingBank] = useState<Bank | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false);

  useEffect(() => { setCurrentPage(1); }, [debouncedSearch, statusFilter]);

  const fetchBanks = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      setLoading(true);
      setError(null);

      const { items, pagination: pag } = await bankService.getBanks({
        page: currentPage,
        limit: banksPerPage,
        search: debouncedSearch.trim() || undefined,
        isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
      }, controller.signal);

      const typed: Bank[] = items.map((b: RawBank) => ({
        _id: String(b._id),
        name: String(b.name ?? ''),
        accountNumber: String(b.accountNumber ?? ''),
        accountTitle: String(b.accountTitle ?? ''),
        branch: String(b.branch ?? ''),
        iban: String(b.iban ?? ''),
        notes: String(b.notes ?? ''),
        isActive: typeof b.isActive === 'boolean' ? b.isActive : true,
        createdAt: String(b.createdAt ?? new Date().toISOString()),
        updatedAt: String(b.updatedAt ?? new Date().toISOString()),
      }));
      setBanks(typed);
      setPagination(pag);
    } catch (e: unknown) {
      if ((e as { name?: string })?.name === 'CanceledError' || (e as { code?: string })?.code === 'ERR_CANCELED') return;
      console.error(e);
      setError('Failed to fetch banks. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchBanks();
    return () => abortRef.current?.abort();
  }, [fetchBanks]);

  // Helpers
  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  // Handlers
  const handleStatusToggle = async (bankId: string, isActive: boolean) => {
    try {
      // Optimistic UI
      setBanks((prev) => prev.map((b) => (b._id === bankId ? { ...b, isActive } : b)));
      await bankService.updateBankStatus(bankId, isActive);
    } catch (err) {
      console.error('Error updating bank status:', err);
      setError('Failed to update bank status');
      // Rollback
      setBanks((prev) => prev.map((b) => (b._id === bankId ? { ...b, isActive: !isActive } : b)));
    }
  };

  const handleEdit = (bank: Bank) => {
    router.push(`/admin/banks/edit/${bank._id}`);
  };

  const handleDeleteClick = (bankId: string) => {
    const bank = banks.find((b) => b._id === bankId);
    if (bank) {
      setDeletingBank(bank);
      setIsDeleteModalOpen(true);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingBank) return;

    setDeleteLoading(true);
    try {
      await bankService.deleteBank(deletingBank._id);
      setIsDeleteModalOpen(false);
      setDeletingBank(null);
      fetchBanks();
    } catch (err) {
      console.error('Error deleting bank:', err);
      setError('Failed to delete bank');
    } finally {
      setDeleteLoading(false);
    }
  };

  const currentBanks = banks;
  const totalPages = Math.max(1, pagination.totalPages || 1);
  const clampedPage = Math.min(currentPage, totalPages);
  const indexOfFirstBank = (clampedPage - 1) * banksPerPage;
  const indexOfLastBank = indexOfFirstBank + banks.length;

  if (loading && banks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#dc2626]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 flex items-center gap-2">
        <AlertCircle className="h-5 w-5" />
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Banks</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your bank accounts</p>
        </div>
        <Link
          href="/admin/banks/create"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#dc2626] text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          <Plus className="h-5 w-5" />
          Add Bank
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search banks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#dc2626] focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#dc2626] focus:border-transparent"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bank
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Account Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Branch
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentBanks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No banks found</p>
                  </td>
                </tr>
              ) : (
                currentBanks.map((bank) => (
                  <tr key={bank._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0 bg-[#dc2626]/10 rounded-full flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-[#dc2626]" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{bank.name}</div>
                          <div className="text-sm text-gray-500">{bank.iban || '-'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{bank.accountNumber}</div>
                      <div className="text-sm text-gray-500">{bank.accountTitle}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-700">
                        {bank.branch || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleStatusToggle(bank._id, !bank.isActive)}
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          bank.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {bank.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(bank.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEdit(bank)}
                        className="text-gray-600 hover:text-[#dc2626] mr-3"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(bank._id)}
                        className="text-gray-600 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Showing {pagination.total === 0 ? 0 : indexOfFirstBank + 1} to{' '}
          {indexOfLastBank} of {pagination.total} banks
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={clampedPage === 1}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm text-gray-600">
            Page {clampedPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={clampedPage === totalPages}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Delete Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setIsDeleteModalOpen(false)} />
          <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Bank</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <strong>{deletingBank?.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeletingBank(null);
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleteLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {deleteLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BanksPage;
