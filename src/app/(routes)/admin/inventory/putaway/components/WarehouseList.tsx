'use client';

// Items still in the warehouse (shop stock − pieces on shelves), with "Put on shelf".

import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Loader2, Package, PackageCheck, PackagePlus, Search, Star, X } from 'lucide-react';
import TablePagination from '@/components/admin/TablePagination';
import { inputClass, primaryBtn } from '@/components/admin/FormBits';
import { apiErrorMessage, formatDate, formatRs } from '@/lib/storeApi';
import { racksApi, daysText, unitKey, type WarehouseItem, type WarehouseMeta } from '../../racks/services/racksApi';

const SORTS = [
  { key: 'oldest', label: 'Waiting longest' },
  { key: 'newest', label: 'Newest arrivals' },
  { key: 'qty', label: 'Most pieces' },
  { key: 'name', label: 'Name A–Z' },
];

export default function WarehouseList({
  canPut,
  refreshKey,
  onPut,
  onMeta,
}: {
  canPut: boolean;
  /** change to reload (after a put-away elsewhere on the page) */
  refreshKey: number;
  onPut: (item: WarehouseItem) => void;
  onMeta?: (meta: WarehouseMeta | null) => void;
}) {
  const [items, setItems] = useState<WarehouseItem[]>([]);
  const [meta, setMeta] = useState<WarehouseMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('oldest');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  // Debounce typing.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await racksApi.warehouse({ search, sort, page, limit });
      setItems(res.data || []);
      setMeta(res.meta || null);
      onMeta?.(res.meta || null);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load the warehouse list.'));
    } finally {
      setLoading(false);
    }
  }, [search, sort, page, limit, onMeta]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  return (
    <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200">
      <div className="p-3 sm:p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, barcode or category…"
            className={`${inputClass} pl-9 pr-8`}
          />
          {searchInput && (
            <button type="button" onClick={() => setSearchInput('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" aria-label="Clear search">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            setPage(1);
          }}
          className={`${inputClass} sm:w-48`}
          aria-label="Sort"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {loading && !items.length ? (
        <div className="py-14 text-center">
          <Loader2 className="h-7 w-7 text-honey-700 mx-auto animate-spin mb-2" />
          <p className="text-sm text-gray-500">Loading the warehouse…</p>
        </div>
      ) : error ? (
        <div className="py-10 text-center px-4">
          <AlertCircle className="h-9 w-9 text-red-400 mx-auto mb-2" />
          <p className="text-sm text-red-700 mb-3">{error}</p>
          <button type="button" onClick={load} className={primaryBtn}>
            Try again
          </button>
        </div>
      ) : !items.length ? (
        <div className="py-12 text-center px-4">
          <PackageCheck className="h-10 w-10 text-emerald-400 mx-auto mb-2" />
          <h3 className="text-base font-medium text-gray-900">{search ? 'Nothing matches' : 'The warehouse is empty'}</h3>
          <p className="text-sm text-gray-500">{search ? 'Try a different search.' : 'Everything is on a shelf.'}</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className={`hidden md:block overflow-x-auto ${loading ? 'opacity-60' : ''}`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="px-4 py-2 font-medium">Item</th>
                  <th className="px-3 py-2 font-medium">Received</th>
                  <th className="px-3 py-2 font-medium">On shelves</th>
                  <th className="px-3 py-2 font-medium text-right">In warehouse</th>
                  {canPut && <th className="px-4 py-2" />}
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={unitKey(it)} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="px-4 py-2.5">
                      <ItemCell item={it} />
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">
                      {it.lastReceivedAt ? (
                        <>
                          {formatDate(it.lastReceivedAt)}
                          <span className="block text-[11px] text-gray-400">{daysText(it.daysSinceReceived)} ago</span>
                        </>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <ShelfChips item={it} />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="text-base font-semibold tabular-nums text-gray-900">{it.warehouse}</span>
                      <span className="block text-[11px] text-gray-400 tabular-nums">of {it.total}</span>
                    </td>
                    {canPut && (
                      <td className="px-4 py-2.5 text-right">
                        <button type="button" onClick={() => onPut(it)} className={`${primaryBtn} !px-3 !py-1.5 text-xs whitespace-nowrap`}>
                          <PackagePlus className="h-3.5 w-3.5" /> Send to shop
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className={`md:hidden divide-y divide-gray-100 ${loading ? 'opacity-60' : ''}`}>
            {items.map((it) => (
              <li key={unitKey(it)} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <ItemCell item={it} />
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-semibold tabular-nums text-gray-900 leading-none">{it.warehouse}</p>
                    <p className="text-[10px] text-gray-400">in warehouse</p>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <ShelfChips item={it} />
                    {it.lastReceivedAt && <p className="text-[11px] text-gray-400 mt-1">Received {formatDate(it.lastReceivedAt)}</p>}
                  </div>
                  {canPut && (
                    <button type="button" onClick={() => onPut(it)} className={`${primaryBtn} !px-3 !py-1.5 text-xs flex-shrink-0`}>
                      <PackagePlus className="h-3.5 w-3.5" /> Send to shop
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {meta && (
            <TablePagination
              page={meta.page}
              pages={meta.pages}
              total={meta.total}
              limit={meta.limit}
              onPageChange={setPage}
              onLimitChange={(l) => {
                setLimit(l);
                setPage(1);
              }}
              label="items"
              loading={loading}
            />
          )}
        </>
      )}
    </div>
  );
}

function ItemCell({ item }: { item: WarehouseItem }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      {item.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.thumbnailUrl} alt="" className="h-9 w-9 rounded object-cover bg-gray-100 flex-shrink-0" />
      ) : (
        <div className="h-9 w-9 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
          <Package className="h-4 w-4 text-gray-300" />
        </div>
      )}
      <div className="min-w-0">
        <p className="font-medium text-gray-900 leading-tight truncate">
          {item.name}
          {item.variantLabel && <span className="text-gray-500 font-normal"> · {item.variantLabel}</span>}
        </p>
        <p className="text-[11px] text-gray-500 truncate">
          {item.code && <span className="font-mono">{item.code}</span>}
          {item.category && <span> · {item.category}</span>}
          {item.price !== null && <span> · {formatRs(item.price)}</span>}
        </p>
      </div>
    </div>
  );
}

function ShelfChips({ item }: { item: WarehouseItem }) {
  if (!item.shelves.length) return <span className="text-[11px] text-gray-400">not on a shelf yet</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {item.shelves.map((s) => (
        <span
          key={s.shelfId}
          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[11px] font-mono rounded border ${
            s.isHome ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-gray-50 border-gray-200 text-gray-700'
          }`}
          title={s.isHome ? 'Home shelf' : undefined}
        >
          {s.isHome && <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-500" />}
          {s.code}
          {s.qty > 0 && <span className="text-gray-500">·{s.qty}</span>}
        </span>
      ))}
    </span>
  );
}
