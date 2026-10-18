'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeftRight, ArrowRight, Plus, Search, X, AlertCircle, Eye } from 'lucide-react';
import TablePagination from '@/components/admin/TablePagination';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage } from '@/helper/access';
import { HelpBox, LoadingCard, NoAccessCard, inputClass, primaryBtn } from '@/components/admin/FormBits';
import { branchService, type Branch } from '../branches/services/branchService';
import { transferService, type StockTransfer } from './services/transferService';
import { TransferDetailModal, TransferStatusBadge, byName, formatDateTime } from './components/TransferBits';

export default function StockTransfersPage() {
  const { can, isSuperAdmin, branch: ownBranch } = useAccess();
  const canView = can('stock_transfers', 'view');
  const canCreate = can('stock_transfers', 'create');

  const [rows, setRows] = useState<StockTransfer[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [detail, setDetail] = useState<StockTransfer | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debounced, status, from, to, startDate, endDate, limit]);

  useEffect(() => {
    if (!canView) return;
    branchService
      .list()
      .then(setBranches)
      .catch(() => setBranches([]));
  }, [canView]);

  const load = useCallback(async () => {
    if (!canView) return;
    try {
      setLoading(true);
      setError(null);
      const res = await transferService.list({ search: debounced, status, from, to, startDate, endDate, page, limit });
      setRows(res.items);
      setPagination(res.pagination);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load stock transfers.'));
    } finally {
      setLoading(false);
    }
  }, [canView, debounced, status, from, to, startDate, endDate, page, limit]);

  useEffect(() => {
    load();
  }, [load]);

  if (!canView) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <NoAccessCard />
      </div>
    );
  }

  const thClass = 'px-3 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-xs font-medium tracking-wider text-left text-gray-500 uppercase';
  const hasFilters = !!(search || status || from || to || startDate || endDate);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Stock Transfers</h1>
            <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-500">
              {isSuperAdmin ? 'Move stock between your branches.' : `Stock sent from or received by ${ownBranch?.name || 'your branch'}.`}
            </p>
          </div>
          {canCreate && (
            <Link href="/admin/stock-transfers/new" className={primaryBtn}>
              <Plus className="h-4 w-4" />
              <span>New Transfer</span>
            </Link>
          )}
        </div>

        <div className="mb-4 sm:mb-6">
          <HelpBox>
            The stock moves <strong>straight away</strong> when you save a transfer. If you made a mistake, make a new
            transfer the other way round.
          </HelpBox>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
            <div className="relative col-span-2 md:col-span-3 lg:col-span-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Transfer no, product or note..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`${inputClass} pl-8 pr-8`}
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <select value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} aria-label="From branch">
              <option value="">From: any branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  From: {b.name}
                </option>
              ))}
            </select>
            <select value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} aria-label="To branch">
              <option value="">To: any branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  To: {b.name}
                </option>
              ))}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass} aria-label="Status">
              <option value="">Any status</option>
              <option value="completed">Completed</option>
              <option value="partial">Partly done</option>
              <option value="failed">Failed</option>
            </select>
            <div className="col-span-2 md:col-span-3 lg:col-span-1 flex items-center gap-1">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={`${inputClass} px-2`} aria-label="From date" />
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={`${inputClass} px-2`} aria-label="To date" />
            </div>
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStatus('');
                setFrom('');
                setTo('');
                setStartDate('');
                setEndDate('');
              }}
              className="mt-2 text-xs font-medium text-honey-700 hover:text-honey-800"
            >
              Clear filters
            </button>
          )}
        </div>

        {loading && rows.length === 0 ? (
          <LoadingCard text="Loading stock transfers…" />
        ) : error ? (
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-red-200 text-center py-10 px-4">
            <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
            <p className="text-sm text-red-700 mb-4">{error}</p>
            <button onClick={load} className={primaryBtn}>
              Try again
            </button>
          </div>
        ) : (
          <div className="overflow-hidden bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className={thClass}>Transfer</th>
                    <th className={thClass}>From → To</th>
                    <th className={thClass}>Items</th>
                    <th className={thClass}>Status</th>
                    <th className={thClass}>By</th>
                    <th className={`${thClass} text-right`}></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">
                        <ArrowLeftRight className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                        {hasFilters ? 'No transfers match these filters.' : 'No stock transfers yet.'}
                      </td>
                    </tr>
                  ) : (
                    rows.map((t) => {
                      const pieces = t.totalQuantity ?? t.items.reduce((s, i) => s + (i.status === 'failed' ? 0 : i.quantity), 0);
                      return (
                        <tr key={t._id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setDetail(t)}>
                          <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                            <div className="text-sm font-semibold text-gray-900 font-mono">{t.transferNo}</div>
                            <div className="text-xs text-gray-500">{formatDateTime(t.createdAt)}</div>
                          </td>
                          <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="font-medium">{t.fromBranch?.name || '—'}</span>
                              <ArrowRight className="h-3.5 w-3.5 text-honey-500" />
                              <span className="font-medium">{t.toBranch?.name || '—'}</span>
                            </span>
                          </td>
                          <td className="px-3 sm:px-4 py-3 text-sm text-gray-700">
                            <div className="whitespace-nowrap">
                              {t.items.length} product{t.items.length === 1 ? '' : 's'} · {pieces} pcs
                            </div>
                            <div className="text-xs text-gray-500 truncate max-w-[260px]">
                              {t.items
                                .slice(0, 2)
                                .map((i) => i.productName + (i.variantLabel ? ` (${i.variantLabel})` : ''))
                                .join(', ')}
                              {t.items.length > 2 ? ` +${t.items.length - 2} more` : ''}
                            </div>
                          </td>
                          <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                            <TransferStatusBadge status={t.status} />
                          </td>
                          <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-xs text-gray-600">{byName(t)}</td>
                          <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetail(t);
                              }}
                              className="p-1.5 rounded-md text-gray-400 hover:text-honey-600 hover:bg-honey-50"
                              title="See details"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <TablePagination
              page={pagination.page}
              pages={Math.max(1, pagination.totalPages)}
              total={pagination.total}
              limit={limit}
              onPageChange={setPage}
              onLimitChange={setLimit}
              label="transfers"
              loading={loading}
            />
          </div>
        )}
      </div>

      {detail && <TransferDetailModal transfer={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

