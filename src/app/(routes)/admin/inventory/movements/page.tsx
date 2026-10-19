'use client';

// Stock movement ledger: every stock change (received, put on shelf, sold,
// damaged, shop use, adjustments) with filters and CSV export.

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Download, Loader2, Search, X, History, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import TablePagination from '@/components/admin/TablePagination';
import { LoadingCard, NoAccessCard, inputClass, secondaryBtn } from '@/components/admin/FormBits';
import ProductInsightPanel from '@/components/store/ProductInsightPanel';
import { useAccess } from '@/context/AccessContext';
import { storeApi, apiErrorMessage, formatRs, formatDate, type PageMeta } from '@/lib/storeApi';
import { MOVEMENT_TYPES, downloadCsv, unitTitle, type MovementRow, type MovementSummary } from './_shared/stockOpsApi';
import { ErrorCard, MovementTypeBadge, PageHeader, ProductPicker, StatCard, cardClass, thClass } from './_shared/StockOpsBits';
import { SearchSelect } from '@/components/ui/SearchSelect';

type Filters = {
  search: string;
  type: string;
  direction: string;
  from: string;
  to: string;
  ref: string;
};

const EMPTY: Filters = { search: '', type: '', direction: '', from: '', to: '', ref: '' };

function MovementsInner() {
  const { can } = useAccess();
  const canView = can('stock_movements', 'view');
  const canExport = can('stock_movements', 'export');
  const router = useRouter();
  const params = useSearchParams();

  // Product / user / vendor filters live in the URL (links from other screens).
  const productId = params.get('productId') || '';
  const variantId = params.get('variantId') || '';
  const userId = params.get('user') || '';
  const vendorId = params.get('vendor') || '';
  const [chipNames, setChipNames] = useState<{ product?: string; user?: string; vendor?: string }>({});

  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [debouncedRef, setDebouncedRef] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [rows, setRows] = useState<MovementRow[]>([]);
  const [meta, setMeta] = useState<(PageMeta & { summary?: MovementSummary }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [insight, setInsight] = useState<{ productId: string; variantId: string | null } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(filters.search.trim());
      setDebouncedRef(filters.ref.trim());
    }, 350);
    return () => clearTimeout(t);
  }, [filters.search, filters.ref]);

  const query = useMemo(
    () => ({
      search: debouncedSearch,
      type: filters.type,
      direction: filters.direction,
      from: filters.from,
      to: filters.to,
      ref: debouncedRef,
      productId,
      variantId,
      user: userId,
      vendor: vendorId,
    }),
    [debouncedSearch, debouncedRef, filters.type, filters.direction, filters.from, filters.to, productId, variantId, userId, vendorId]
  );

  useEffect(() => setPage(1), [query, limit]);

  const load = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    setError(null);
    try {
      const res = await storeApi.get<MovementRow[]>('/stock-movements', { ...query, page, limit });
      setRows(res.data || []);
      // The summary comes with page 1 only: keep it while paging.
      const m = (res.meta as PageMeta & { summary?: MovementSummary }) || null;
      setMeta((prev) => (m ? { ...m, summary: m.summary ?? (page > 1 ? prev?.summary : undefined) } : null));
      // Names for the URL filter chips.
      const first = (res.data || [])[0];
      if (first) {
        setChipNames((c) => ({
          product: productId ? c.product || first.productName : undefined,
          user: userId ? c.user || first.userName : undefined,
          vendor: vendorId ? c.vendor || first.vendorName : undefined,
        }));
      }
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load stock movements.'));
    } finally {
      setLoading(false);
    }
  }, [canView, query, page, limit, productId, userId, vendorId]);

  useEffect(() => {
    load();
  }, [load]);

  const setUrlFilter = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const qs = next.toString();
    router.push(qs ? `/admin/inventory/movements?${qs}` : '/admin/inventory/movements', { scroll: false });
  };

  const exportCsv = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await downloadCsv('/stock-movements/export', query, 'stock-movements.csv');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not export'));
    } finally {
      setExporting(false);
    }
  };

  if (!canView) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <NoAccessCard />
      </div>
    );
  }

  const hasFilters = Object.values(filters).some(Boolean) || !!(productId || userId || vendorId);
  const s = meta?.summary;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <PageHeader
          title="Stock Movements"
          subtitle="Every piece in and out: receipts, shelf moves, sales, damages, shop use and adjustments."
          actions={
            canExport && (
              <button type="button" onClick={exportCsv} disabled={exporting} className={secondaryBtn}>
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Export CSV
              </button>
            )
          }
        />

        {/* Filters */}
        <div className={`${cardClass} p-3 sm:p-4 mb-4`}>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
            <div className="relative col-span-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                placeholder="Product, code, note…"
                className={`${inputClass} pl-8`}
              />
            </div>
            <SearchSelect value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))} className={inputClass} aria-label="Type">
              <option value="">All types</option>
              {MOVEMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </SearchSelect>
            <SearchSelect value={filters.direction} onChange={(e) => setFilters((f) => ({ ...f, direction: e.target.value }))} className={inputClass} aria-label="Direction">
              <option value="">In & out</option>
              <option value="in">Stock in</option>
              <option value="out">Stock out</option>
              <option value="move">Moves inside the shop</option>
            </SearchSelect>
            <input type="text" value={filters.ref} onChange={(e) => setFilters((f) => ({ ...f, ref: e.target.value }))} placeholder="Ref no (PO-, SU-, DMG-…)" className={inputClass} />
            <div className="hidden lg:block" />
            <div className="col-span-2 md:col-span-2 flex items-center gap-1">
              <input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} className={`${inputClass} px-2`} aria-label="From date" />
              <span className="text-gray-400 text-xs">to</span>
              <input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} className={`${inputClass} px-2`} aria-label="To date" />
            </div>
            <div className="col-span-2 md:col-span-2">
              <ProductPicker
                placeholder="Filter by product (scan or type)"
                onPick={(u) => {
                  setChipNames((c) => ({ ...c, product: unitTitle(u) }));
                  setUrlFilter({ productId: u.productId, variantId: u.variantId });
                }}
              />
            </div>
          </div>
          {(productId || userId || vendorId || hasFilters) && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {productId && <Chip label={`Product: ${chipNames.product || 'selected'}`} onClear={() => setUrlFilter({ productId: null, variantId: null })} />}
              {userId && <Chip label={`User: ${chipNames.user || 'selected'}`} onClear={() => setUrlFilter({ user: null })} />}
              {vendorId && <Chip label={`Vendor: ${chipNames.vendor || 'selected'}`} onClear={() => setUrlFilter({ vendor: null })} />}
              {hasFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setFilters(EMPTY);
                    router.push('/admin/inventory/movements', { scroll: false });
                  }}
                  className="text-xs font-medium text-honey-700 hover:text-honey-800"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>

        {s && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
            <StatCard label="Pieces in" value={`+${s.piecesIn}`} tone="green" />
            <StatCard label="Pieces out" value={`−${s.piecesOut}`} tone="red" />
            <StatCard label="Moved inside the shop" value={s.piecesMoved} />
            <StatCard label="Value out (at cost)" value={formatRs(s.valueOut)} />
          </div>
        )}

        {loading && rows.length === 0 ? (
          <LoadingCard text="Loading stock movements…" />
        ) : error ? (
          <ErrorCard message={error} onRetry={load} />
        ) : (
          <div className={`${cardClass} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className={thClass}>When</th>
                    <th className={thClass}>Product</th>
                    <th className={thClass}>Type</th>
                    <th className={`${thClass} text-right`}>Qty</th>
                    <th className={`${thClass} text-right`}>Balance</th>
                    <th className={thClass}>From → To</th>
                    <th className={`${thClass} text-right`}>Cost / Price</th>
                    <th className={thClass}>Ref</th>
                    <th className={thClass}>By</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-sm text-gray-500">
                        <History className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                        {hasFilters ? 'No movements match these filters.' : 'No stock movements yet.'}
                      </td>
                    </tr>
                  ) : (
                    rows.map((m) => (
                      <tr key={m._id} className={`hover:bg-gray-50 ${loading ? 'opacity-60' : ''}`}>
                        <td className="px-3 sm:px-4 py-2.5 whitespace-nowrap text-xs text-gray-700">{formatDate(m.occurredAt, true)}</td>
                        <td className="px-3 sm:px-4 py-2.5 text-sm">
                          <button type="button" onClick={() => setInsight({ productId: m.productId, variantId: m.variantId })} className="text-left text-gray-900 hover:text-honey-700 font-medium max-w-[220px] truncate block" title="Product insights">
                            {m.productName || '—'}
                          </button>
                          <div className="text-[11px] text-gray-500 font-mono">{m.code}</div>
                        </td>
                        <td className="px-3 sm:px-4 py-2.5">
                          <MovementTypeBadge type={m.type} label={m.typeLabel} />
                        </td>
                        <td className={`px-3 sm:px-4 py-2.5 text-right text-sm font-semibold whitespace-nowrap ${m.qtyChange > 0 ? 'text-green-700' : m.qtyChange < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                          {m.qtyChange > 0 ? `+${m.qtyChange}` : m.qtyChange < 0 ? m.qtyChange : `↔ ${m.quantity}`}
                        </td>
                        <td className="px-3 sm:px-4 py-2.5 text-right text-sm text-gray-700">{m.balanceAfter ?? '—'}</td>
                        <td className="px-3 sm:px-4 py-2.5 text-xs text-gray-600 whitespace-nowrap">
                          {[m.from, m.to].filter(Boolean).join(' → ') || '—'}
                          {m.shelves.length > 1 && <div className="text-[10px] text-gray-400">{m.shelves.map((x) => `${x.code}×${x.qty}`).join(', ')}</div>}
                        </td>
                        <td className="px-3 sm:px-4 py-2.5 text-right text-xs whitespace-nowrap">
                          <div className="text-gray-800">{m.unitCost !== null ? formatRs(m.unitCost, { decimals: 2 }) : '—'}</div>
                          {m.purchasePrice !== null && <div className="text-[10px] text-gray-500">vendor {formatRs(m.purchasePrice)}</div>}
                          {m.unitPrice !== null && <div className="text-[10px] text-gray-500">sold {formatRs(m.unitPrice)}</div>}
                        </td>
                        <td className="px-3 sm:px-4 py-2.5 text-xs whitespace-nowrap">
                          {m.refNo ? (
                            <button type="button" onClick={() => setFilters((f) => ({ ...f, ref: m.refNo }))} className="font-mono text-gray-800 hover:text-honey-700" title="Show all rows of this document">
                              {m.refNo}
                            </button>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                          {m.vendorName && (
                            <button
                              type="button"
                              onClick={() => {
                                setChipNames((c) => ({ ...c, vendor: m.vendorName }));
                                setUrlFilter({ vendor: m.vendorId });
                              }}
                              className="block text-[10px] text-gray-500 hover:text-honey-700"
                            >
                              {m.vendorName}
                            </button>
                          )}
                          {m.note && <div className="text-[10px] text-gray-400 max-w-[180px] truncate" title={m.note}>{m.note}</div>}
                        </td>
                        <td className="px-3 sm:px-4 py-2.5 text-xs whitespace-nowrap">
                          {m.userName ? (
                            <button
                              type="button"
                              onClick={() => {
                                setChipNames((c) => ({ ...c, user: m.userName }));
                                setUrlFilter({ user: m.userId });
                              }}
                              className="text-gray-700 hover:text-honey-700"
                            >
                              {m.userName}
                            </button>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {meta && (
              <TablePagination page={meta.page} pages={meta.pages} total={meta.total} limit={limit} onPageChange={setPage} onLimitChange={setLimit} pageSizeOptions={[25, 50, 100, 200]} label="movements" loading={loading} />
            )}
          </div>
        )}

        <p className="mt-3 flex items-start gap-1.5 text-[11px] text-gray-500">
          <Info className="h-3.5 w-3.5 flex-shrink-0 mt-px" />
          Cost = landed cost per piece for receipts, average cost for everything else. The ledger is never edited — mistakes are corrected with a new adjustment.
        </p>
      </div>

      <ProductInsightPanel productId={insight?.productId || null} variantId={insight?.variantId || null} open={!!insight} onClose={() => setInsight(null)} />
    </div>
  );
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-honey-50 border border-honey-200 text-xs text-honey-800">
      {label}
      <button type="button" onClick={onClear} className="p-0.5 rounded-full hover:bg-honey-100" aria-label="Remove filter">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

export default function StockMovementsPage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-8"><LoadingCard text="Loading…" /></div>}>
      <MovementsInner />
    </Suspense>
  );
}
