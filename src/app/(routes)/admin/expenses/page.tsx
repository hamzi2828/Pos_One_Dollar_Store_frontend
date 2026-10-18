'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Search, Edit2, Trash2, ChevronLeft, ChevronRight, Loader2, AlertCircle, Receipt } from 'lucide-react';
import { useDebounced } from '@/helper/useDebounced';
import { EMPTY_PAGINATION, type Pagination } from '@/helper/pagination';

// Custom PKR icon component
const PkrIcon = ({ className }: { className?: string }) => (
  <span className={`font-bold ${className}`}>Rs</span>
);
import { expenseService } from './service/expenseService';
import type { Expense, RawExpense, ExpenseCategory, PaymentMethod, ExpenseSummary, ExpenseCategoryItem } from './types';

const expensesPerPage = 10;

const ExpensesPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState<string>(searchParams.get('search') || '');
  const debouncedSearch = useDebounced(searchTerm, 350);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>(
    (searchParams.get('status') as 'all' | 'active' | 'inactive') || 'all'
  );
  const [categoryFilter, setCategoryFilter] = useState<string>(searchParams.get('category') || 'all');
  const [dateRange, setDateRange] = useState<'all' | 'daily' | 'weekly' | 'monthly' | 'custom'>(
    (searchParams.get('dateRange') as 'all' | 'daily' | 'weekly' | 'monthly' | 'custom') || 'monthly'
  );
  const [customStartDate, setCustomStartDate] = useState<string>(searchParams.get('startDate') || '');
  const [customEndDate, setCustomEndDate] = useState<string>(searchParams.get('endDate') || '');

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pagination, setPagination] = useState<Pagination>(EMPTY_PAGINATION);
  const abortRef = useRef<AbortController | null>(null);

  // Delete modal states
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false);
  const deleteLockRef = useRef(false);
  // Per-row status toggle in flight (only that row's pill spins).
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const togglingRef = useRef<string | null>(null);

  // Categories state
  const [categories, setCategories] = useState<ExpenseCategoryItem[]>([]);

  // Sync filters to URL
  useEffect(() => {
    const params = new URLSearchParams();

    if (searchTerm) {
      params.set('search', searchTerm);
    }
    if (statusFilter && statusFilter !== 'all') {
      params.set('status', statusFilter);
    }
    if (categoryFilter && categoryFilter !== 'all') {
      params.set('category', categoryFilter);
    }
    if (dateRange && dateRange !== 'monthly') {
      params.set('dateRange', dateRange);
    }
    if (customStartDate) {
      params.set('startDate', customStartDate);
    }
    if (customEndDate) {
      params.set('endDate', customEndDate);
    }

    const queryString = params.toString();
    const newUrl = queryString ? `/admin/expenses?${queryString}` : '/admin/expenses';

    router.replace(newUrl, { scroll: false });
  }, [searchTerm, statusFilter, categoryFilter, dateRange, customStartDate, customEndDate, router]);

  // Load categories once
  useEffect(() => {
    let cancelled = false;
    expenseService.getCategories()
      .then(data => { if (!cancelled) setCategories(data); })
      .catch(e => console.error('Failed to fetch categories:', e));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { setCurrentPage(1); }, [debouncedSearch, statusFilter, categoryFilter, dateRange, customStartDate, customEndDate]);

  // Server-side date range (monthly/daily/weekly/custom). Returns ISO strings.
  const computeServerDateRange = useCallback((): { startDate?: string; endDate?: string } => {
    const now = new Date();
    const iso = (d: Date) => d.toISOString();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    switch (dateRange) {
      case 'daily':
        return { startDate: iso(todayStart), endDate: iso(now) };
      case 'weekly': {
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        return { startDate: iso(weekStart), endDate: iso(now) };
      }
      case 'monthly': {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return { startDate: iso(monthStart), endDate: iso(now) };
      }
      case 'custom':
        return {
          startDate: customStartDate || undefined,
          endDate: customEndDate || undefined,
        };
      default:
        return {};
    }
  }, [dateRange, customStartDate, customEndDate]);

  const fetchExpenses = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      setLoading(true);
      setError(null);
      const { startDate, endDate } = computeServerDateRange();
      const { items, pagination: pag } = await expenseService.getExpenses({
        page: currentPage,
        limit: expensesPerPage,
        search: debouncedSearch.trim() || undefined,
        isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        startDate,
        endDate,
      }, controller.signal);

      const typed: Expense[] = items.map((e: RawExpense) => ({
        _id: String(e._id),
        title: String(e.title ?? ''),
        amount: Number(e.amount ?? 0),
        category: (e.category ?? 'Other') as ExpenseCategory,
        date: String(e.date ?? new Date().toISOString()),
        paymentMethod: (e.paymentMethod ?? 'Cash') as PaymentMethod,
        reference: String(e.reference ?? ''),
        notes: String(e.notes ?? ''),
        receipt: e.receipt || null,
        isActive: typeof e.isActive === 'boolean' ? e.isActive : true,
        createdAt: String(e.createdAt ?? new Date().toISOString()),
        updatedAt: String(e.updatedAt ?? new Date().toISOString()),
      }));
      setExpenses(typed);
      setPagination(pag);
    } catch (e: unknown) {
      if ((e as { name?: string })?.name === 'CanceledError' || (e as { code?: string })?.code === 'ERR_CANCELED') return;
      console.error(e);
      setError('Failed to fetch expenses. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearch, statusFilter, categoryFilter, computeServerDateRange]);

  // Server-side summary scoped to same date range (isActive only, per backend)
  const fetchSummary = useCallback(async () => {
    try {
      const { startDate, endDate } = computeServerDateRange();
      const data = await expenseService.getExpenseSummary(startDate, endDate);
      setSummary(data);
    } catch (e) {
      console.error('Failed to fetch summary:', e);
    }
  }, [computeServerDateRange]);

  useEffect(() => {
    fetchExpenses();
    return () => abortRef.current?.abort();
  }, [fetchExpenses]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  // Helpers
  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  const formatCurrency = (amount: number) => `Rs ${amount.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Handlers
  const handleStatusToggle = async (expenseId: string, isActive: boolean) => {
    if (togglingRef.current) return;
    togglingRef.current = expenseId;
    setTogglingId(expenseId);
    try {
      // Optimistic UI
      setExpenses((prev) => prev.map((e) => (e._id === expenseId ? { ...e, isActive } : e)));
      await expenseService.updateExpenseStatus(expenseId, isActive);
    } catch (err) {
      console.error('Error updating expense status:', err);
      setError('Failed to update expense status');
      // Rollback
      setExpenses((prev) => prev.map((e) => (e._id === expenseId ? { ...e, isActive: !isActive } : e)));
    } finally {
      togglingRef.current = null;
      setTogglingId(null);
    }
  };

  const handleEdit = (expense: Expense) => {
    router.push(`/admin/expenses/edit/${expense._id}`);
  };

  const handleDeleteClick = (expenseId: string) => {
    const expense = expenses.find((e) => e._id === expenseId);
    if (expense) {
      setDeletingExpense(expense);
      setIsDeleteModalOpen(true);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingExpense || deleteLockRef.current) return;

    deleteLockRef.current = true;
    setDeleteLoading(true);
    try {
      await expenseService.deleteExpense(deletingExpense._id);
      setIsDeleteModalOpen(false);
      setDeletingExpense(null);
      fetchExpenses();
      fetchSummary();
    } catch (err) {
      console.error('Error deleting expense:', err);
      setError('Failed to delete expense');
    } finally {
      deleteLockRef.current = false;
      setDeleteLoading(false);
    }
  };

  // Server already filtered + paginated + summed
  const currentExpenses = expenses;
  const totalPages = Math.max(1, pagination.totalPages || 1);
  const clampedPage = Math.min(currentPage, totalPages);
  const indexOfFirstExpense = (clampedPage - 1) * expensesPerPage;
  const indexOfLastExpense = indexOfFirstExpense + expenses.length;

  const filteredSummary = useMemo(
    () => ({ totalExpenses: summary?.totalExpenses ?? 0, count: summary?.count ?? pagination.total }),
    [summary, pagination.total]
  );

  const categoryTotals = useMemo(() => {
    const byCat = summary?.byCategory || {};
    return Object.entries(byCat).sort(([, a], [, b]) => (b as number) - (a as number));
  }, [summary]);

  if (loading && expenses.length === 0) {
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
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-[#dc2626]/10 rounded-full flex items-center justify-center">
              <PkrIcon className="h-5 w-5 text-[#dc2626]" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Expenses</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(filteredSummary.totalExpenses)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Receipt className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Records</p>
              <p className="text-xl font-bold text-gray-900">{filteredSummary.count}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      {categoryTotals.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Expenses by Category</h3>
          <div className="flex flex-wrap gap-2">
            {categoryTotals.map(([category, amount]) => (
              <div
                key={category}
                className="px-3 py-2 bg-gray-50 rounded-lg border border-gray-100 hover:border-[#dc2626] transition-colors cursor-pointer"
                onClick={() => {
                  setCategoryFilter(categoryFilter === category ? 'all' : category);
                  setCurrentPage(1);
                }}
              >
                <p className="text-xs text-gray-500">{category}</p>
                <p className="text-sm font-bold text-gray-900">{formatCurrency(amount)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="mt-1 text-sm text-gray-500">Track and manage your business expenses</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => {
              setDateRange(e.target.value as 'all' | 'daily' | 'weekly' | 'monthly' | 'custom');
              setCurrentPage(1);
              if (e.target.value !== 'custom') {
                setCustomStartDate('');
                setCustomEndDate('');
              }
            }}
            className="px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#dc2626]"
          >
            <option value="monthly">This Month</option>
            <option value="weekly">This Week</option>
            <option value="daily">Today</option>
            <option value="custom">Custom</option>
            <option value="all">All Time</option>
          </select>
          {dateRange === 'custom' && (
            <>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => { setCustomStartDate(e.target.value); setCurrentPage(1); }}
                className="px-3 py-2 text-sm text-gray-500 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#dc2626]"
              />
              <span className="text-gray-400">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => { setCustomEndDate(e.target.value); setCurrentPage(1); }}
                className="px-3 py-2 text-sm text-gray-500 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#dc2626]"
              />
            </>
          )}
          <Link
            href="/admin/expenses/create"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#dc2626] text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <Plus className="h-5 w-5" />
            Add Expense
          </Link>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search expenses..."
            value={searchTerm}
            onChange={(e) => {
              setCurrentPage(1);
              setSearchTerm(e.target.value);
            }}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#dc2626] focus:border-transparent"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => {
            setCurrentPage(1);
            setCategoryFilter(e.target.value);
          }}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#dc2626] focus:border-transparent"
        >
          <option value="all">All Categories</option>
          {categories.map((cat) => (
            <option key={cat._id} value={cat.name}>{cat.name}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => {
            setCurrentPage(1);
            setStatusFilter(e.target.value as 'all' | 'active' | 'inactive');
          }}
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
                  Expense
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <Receipt className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No expenses found</p>
                  </td>
                </tr>
              ) : (
                currentExpenses.map((expense) => (
                  <tr key={expense._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0 bg-[#dc2626]/10 rounded-full flex items-center justify-center">
                          <Receipt className="h-5 w-5 text-[#dc2626]" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{expense.title}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">{formatCurrency(expense.amount)}</div>
                      {expense.reference && (
                        <div className="text-xs text-gray-500">Ref: {expense.reference}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">
                        {expense.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">{expense.paymentMethod}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(expense.date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleStatusToggle(expense._id, !expense.isActive)}
                        disabled={!!togglingId}
                        aria-busy={togglingId === expense._id}
                        className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full disabled:opacity-60 disabled:cursor-not-allowed ${
                          expense.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {togglingId === expense._id && <Loader2 className="h-3 w-3 animate-spin" />}
                        {togglingId === expense._id ? 'Updating…' : expense.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEdit(expense)}
                        disabled={togglingId === expense._id}
                        className="text-gray-600 hover:text-[#dc2626] mr-3 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(expense._id)}
                        disabled={togglingId === expense._id}
                        className="text-gray-600 hover:text-red-600 disabled:opacity-60 disabled:cursor-not-allowed"
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
          Showing {pagination.total === 0 ? 0 : indexOfFirstExpense + 1} to{' '}
          {indexOfLastExpense} of {pagination.total} expenses
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={loading || clampedPage === 1}
            aria-busy={loading}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm text-gray-600 inline-flex items-center gap-1.5">
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Page {clampedPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={loading || clampedPage === totalPages}
            aria-busy={loading}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Delete Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => { if (!deleteLoading) setIsDeleteModalOpen(false); }} />
          <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Expense</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <strong>{deletingExpense?.title}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeletingExpense(null);
                }}
                disabled={deleteLoading}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleteLoading}
                aria-busy={deleteLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {deleteLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {deleteLoading ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ExpensesPage;
