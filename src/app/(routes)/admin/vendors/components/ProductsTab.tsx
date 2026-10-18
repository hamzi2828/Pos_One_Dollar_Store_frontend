'use client';

// What we bought from this vendor: per product qty, first / last / min / max
// vendor price, last landed cost and current stock.

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Package, Search, TrendingDown, TrendingUp, Undo2 } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage } from '@/helper/access';
import { formatRs, formatDate } from '@/lib/storeApi';
import { useDebounced } from '@/helper/useDebounced';
import TablePagination from '@/components/admin/TablePagination';
import { inputClass, LoadingCard } from '@/components/admin/FormBits';
import { vendorApi, type BoughtProduct } from '../services/vendorApi';
import { EmptyCard, ErrorCard, cardClass, tdClass, thClass } from './ui';

export default function ProductsTab({ vendorId }: { vendorId: string }) {
  const { can } = useAccess();
  const [rows, setRows] = useState<BoughtProduct[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 50, total: 0, pages: 1 });
  const [summary, setSummary] = useState<{ products: number; pieces: number; value: number } | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const debounced = useDebounced(search.trim(), 300);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await vendorApi.products(vendorId, { search: debounced, page, limit: 50 });
      setRows(res.data);
      setMeta(res.meta);
      setSummary(res.meta.summary || null);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load products.'));
    } finally {
      setLoading(false);
    }
  }, [vendorId, debounced, page]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => setPage(1), [debounced]);

  return (
    <div className="space-y-3">
      <div className={`${cardClass} p-3 flex flex-col sm:flex-row sm:items-center gap-2`}>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product…" className={`${inputClass} pl-9`} />
        </div>
        {summary && (
          <p className="text-xs text-gray-500 whitespace-nowrap">
            {summary.products} products · {summary.pieces.toLocaleString()} pcs · {formatRs(summary.value)} bought
          </p>
        )}
      </div>
      {loading && !rows.length ? (
        <LoadingCard text="Loading products…" />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : rows.length === 0 ? (
        <EmptyCard icon={<Package className="h-10 w-10" />} title="Nothing bought yet" text="Products appear here after goods from this vendor are received." />
      ) : (
        <div className={`${cardClass} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className={thClass}>Product</th>
                  <th className={`${thClass} text-right`}>Qty in</th>
                  <th className={`${thClass} text-right`}>First price</th>
                  <th className={`${thClass} text-right`}>Last price</th>
                  <th className={`${thClass} text-right hidden md:table-cell`}>Min – Max</th>
                  <th className={`${thClass} text-right hidden lg:table-cell`}>Landed cost</th>
                  <th className={`${thClass} text-right hidden md:table-cell`}>In stock</th>
                  <th className={thClass}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => {
                  const up = r.firstPrice !== null && r.lastPrice !== null && r.lastPrice > r.firstPrice;
                  const down = r.firstPrice !== null && r.lastPrice !== null && r.lastPrice < r.firstPrice;
                  return (
                    <tr key={`${r.product}-${r.variantId || ''}`} className="hover:bg-gray-50">
                      <td className={tdClass}>
                        <p className="font-medium text-gray-900">
                          {r.productName}
                          {r.isDeleted && <span className="ml-1 text-[10px] text-red-500">(deleted)</span>}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {[r.code, r.category, r.salePrice !== null ? `sells ${formatRs(r.salePrice)}` : ''].filter(Boolean).join(' · ')}
                        </p>
                      </td>
                      <td className={`${tdClass} text-right tabular-nums whitespace-nowrap`}>
                        {r.qtyIn}
                        {r.qtyReturned > 0 && <span className="block text-[10px] text-orange-600">−{r.qtyReturned} returned</span>}
                      </td>
                      <td className={`${tdClass} text-right whitespace-nowrap`}>
                        {r.firstPrice !== null ? formatRs(r.firstPrice) : '—'}
                        <span className="block text-[10px] text-gray-400">{formatDate(r.firstDate)}</span>
                      </td>
                      <td className={`${tdClass} text-right whitespace-nowrap`}>
                        <span className={`inline-flex items-center gap-0.5 ${up ? 'text-rose-600' : down ? 'text-emerald-600' : ''}`}>
                          {up && <TrendingUp className="h-3 w-3" />}
                          {down && <TrendingDown className="h-3 w-3" />}
                          {r.lastPrice !== null ? formatRs(r.lastPrice) : '—'}
                        </span>
                        <span className="block text-[10px] text-gray-400">
                          {formatDate(r.lastDate)} · {r.lastQty} pcs
                        </span>
                      </td>
                      <td className={`${tdClass} text-right whitespace-nowrap hidden md:table-cell text-xs`}>
                        {r.minPrice !== null ? `${formatRs(r.minPrice)} – ${formatRs(r.maxPrice)}` : '—'}
                      </td>
                      <td className={`${tdClass} text-right whitespace-nowrap hidden lg:table-cell`}>{r.lastLandedCost !== null ? formatRs(r.lastLandedCost) : '—'}</td>
                      <td className={`${tdClass} text-right tabular-nums hidden md:table-cell`}>{r.currentStock ?? '—'}</td>
                      <td className={`${tdClass} text-right`}>
                        {can('vendor_returns', 'create') && !r.isConsignment && !r.isDeleted && (r.currentStock ?? 0) > 0 && (
                          <Link
                            href={`/admin/vendors/returns?new=1&vendorId=${vendorId}&productId=${r.product}${r.variantId ? `&variantId=${encodeURIComponent(r.variantId)}` : ''}`}
                            className="inline-flex p-1.5 rounded-md text-gray-400 hover:text-orange-600 hover:bg-orange-50"
                            title="Return to vendor"
                          >
                            <Undo2 className="h-4 w-4" />
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <TablePagination page={meta.page} pages={meta.pages} total={meta.total} limit={meta.limit} onPageChange={setPage} label="products" loading={loading} />
        </div>
      )}
    </div>
  );
}
