'use client';

// Asset register: what the shop owns, per category, with value after depreciation.
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertCircle, ChevronLeft, ChevronRight, Download, FolderTree, Landmark, Loader2, Plus, Search, X } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage, formatDate, formatRs, type PageMeta } from '@/lib/storeApi';
import { HelpBox, LoadingCard, NoAccessCard, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import AssetFormModal from './components/AssetFormModal';
import AssetDetailModal from './components/AssetDetailModal';
import CategoriesModal from './components/CategoriesModal';
import { STATUS_LABEL, STATUS_STYLE, assetApi, type Asset, type AssetCategory, type AssetSummary } from './services/assetApi';

type StatusFilter = 'in_use' | '' | 'active' | 'maintenance' | 'sold' | 'disposed';

export default function AssetsPage() {
  const { can } = useAccess();
  const canView = can('assets', 'view');
  const canCreate = can('assets', 'create');
  const canExport = can('assets', 'export');
  const canManageCats = can('assets', 'edit') || canCreate;

  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [summary, setSummary] = useState<AssetSummary | null>(null);
  const [rows, setRows] = useState<Asset[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<StatusFilter>('in_use');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);

  const [form, setForm] = useState<{ open: boolean; asset: Asset | null }>({ open: false, asset: null });
  const [detail, setDetail] = useState<Asset | null>(null);
  const [catsOpen, setCatsOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [debounced, status, category]);

  const filters = { search: debounced, status, category };

  const loadOverview = useCallback(async () => {
    const [cats, sum] = await Promise.all([assetApi.categories(), assetApi.summary()]);
    setCategories(cats);
    setSummary(sum);
  }, []);

  const loadList = useCallback(async () => {
    const id = ++reqId.current;
    try {
      setLoading(true);
      setError(null);
      const res = await assetApi.list({ search: debounced, status, category, page, limit: 25, sort: '-purchaseDate' });
      if (id !== reqId.current) return;
      setRows(res.data);
      setMeta(res.meta || null);
    } catch (e) {
      if (id === reqId.current) setError(apiErrorMessage(e, 'Could not load assets.'));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [debounced, status, category, page]);

  useEffect(() => {
    if (!canView) return;
    loadOverview().catch((e) => setError(apiErrorMessage(e, 'Could not load the asset summary.')));
  }, [canView, loadOverview]);
  useEffect(() => {
    if (canView) loadList();
  }, [canView, loadList]);

  const refreshAll = async () => {
    await Promise.all([loadOverview().catch(() => {}), loadList()]);
  };

  const exportCsv = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await assetApi.exportCsv(filters);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Export failed.'));
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

  const groups = summary?.categories || [];
  const catName = (id: string) => categories.find((c) => c._id === id)?.name || '';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Assets</h1>
            <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-500">
              Everything the shop owns — racks, counters, computers, AC, generator…
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canManageCats && (
              <button type="button" onClick={() => setCatsOpen(true)} className={secondaryBtn}>
                <FolderTree className="h-4 w-4" /> Categories
              </button>
            )}
            {canExport && (
              <button type="button" onClick={exportCsv} disabled={exporting} aria-busy={exporting} className={secondaryBtn}>
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} CSV
              </button>
            )}
            {canCreate && (
              <button type="button" onClick={() => setForm({ open: true, asset: null })} disabled={!categories.length} className={primaryBtn}>
                <Plus className="h-4 w-4" /> Add asset
              </button>
            )}
          </div>
        </div>

        {/* Summary cards (click = filter) */}
        {summary ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 mb-4">
            <SummaryCard
              active={!category}
              onClick={() => setCategory('')}
              title="All assets"
              count={summary.totals.count}
              cost={summary.totals.cost}
              value={summary.totals.currentValue}
              highlight
            />
            {groups.map((g) => (
              <SummaryCard
                key={g.categoryId || 'none'}
                active={!!g.categoryId && category === g.categoryId}
                onClick={() => setCategory(g.categoryId || 'none')}
                title={g.name}
                count={g.count}
                cost={g.cost}
                value={g.currentValue}
              />
            ))}
          </div>
        ) : (
          <div className="h-24 mb-4 rounded-xl bg-white border border-gray-200 animate-pulse" />
        )}
        {summary && summary.soldOrDisposed.count > 0 && (
          <p className="text-xs text-gray-500 mb-3">
            Not counted above: {summary.soldOrDisposed.count} sold / disposed asset(s) that cost {formatRs(summary.soldOrDisposed.cost)} (received {formatRs(summary.soldOrDisposed.received)}).
          </p>
        )}

        {/* Category tabs + filters */}
        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 mb-4">
          <div className="flex gap-1 overflow-x-auto px-2 pt-2 border-b border-gray-100">
            {[{ _id: '', name: 'All' }, ...categories.filter((c) => c.isActive || c._id === category)].map((c) => (
              <button
                key={c._id || 'all'}
                type="button"
                onClick={() => setCategory(c._id)}
                className={`px-3 py-2 text-xs sm:text-sm whitespace-nowrap border-b-2 -mb-px ${
                  category === c._id ? 'border-honey-500 text-honey-700 font-semibold' : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
          <div className="p-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="relative sm:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, code, serial, location, vendor or invoice…" className={`${inputClass} pl-9 pr-8`} />
              {search && (
                <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" aria-label="Clear search">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className={inputClass} aria-label="Status">
              <option value="in_use">In use + maintenance</option>
              <option value="">All statuses</option>
              <option value="active">In use</option>
              <option value="maintenance">Maintenance</option>
              <option value="sold">Sold</option>
              <option value="disposed">Disposed</option>
            </select>
          </div>
        </div>

        {loading && !rows.length ? (
          <LoadingCard text="Loading assets…" />
        ) : error ? (
          <div className="bg-white rounded-xl shadow-sm border border-red-200 text-center py-10 px-4">
            <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
            <p className="text-sm text-red-700 mb-4">{error}</p>
            <button onClick={refreshAll} className={primaryBtn}>
              Try again
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 text-center py-12 px-4">
            <Landmark className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-medium text-gray-900 mb-1">No assets {category ? `in ${catName(category) || 'this category'}` : 'yet'}</h3>
            <p className="text-sm text-gray-500">{debounced || status !== 'in_use' ? 'Try a different search or status.' : canCreate ? 'Click "Add asset" to record racks, counters, computers and more.' : ''}</p>
          </div>
        ) : (
          <div className={`space-y-3 ${loading ? 'opacity-60 pointer-events-none' : ''}`} aria-busy={loading}>
            <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="text-left font-medium px-4 py-2.5">Asset</th>
                    <th className="text-left font-medium px-4 py-2.5">Category</th>
                    <th className="text-left font-medium px-4 py-2.5">In the care of</th>
                    <th className="text-right font-medium px-4 py-2.5">Qty</th>
                    <th className="text-right font-medium px-4 py-2.5">Cost</th>
                    <th className="text-right font-medium px-4 py-2.5">Value today</th>
                    <th className="text-left font-medium px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((a) => (
                    <tr key={a._id} onClick={() => setDetail(a)} className="hover:bg-honey-50/40 cursor-pointer">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-gray-900">{a.name}</p>
                        <p className="text-xs text-gray-500">
                          <span className="font-mono">{a.assetCode || '—'}</span>
                          {a.location ? ` · ${a.location}` : ''}
                          {` · ${formatDate(a.purchaseDate)}`}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 text-gray-700">{a.category?.name || 'Uncategorised'}</td>
                      <td className="px-4 py-2.5 text-gray-700">{a.assignedTo ? `${a.assignedTo.firstName} ${a.assignedTo.lastName || ''}`.trim() : '—'}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{a.quantity}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{formatRs(a.totalCost)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatRs(a.currentValue)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 text-[11px] font-medium rounded-full ${STATUS_STYLE[a.status]}`}>{STATUS_LABEL[a.status]}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden space-y-2">
              {rows.map((a) => (
                <button key={a._id} type="button" onClick={() => setDetail(a)} className="w-full text-left bg-white rounded-lg border border-gray-200 p-3 shadow-sm active:bg-gray-50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {a.name}
                        {a.quantity > 1 ? ` × ${a.quantity}` : ''}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        <span className="font-mono">{a.assetCode}</span> · {a.category?.name || 'Uncategorised'}
                        {a.location ? ` · ${a.location}` : ''}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 text-[11px] font-medium rounded-full whitespace-nowrap ${STATUS_STYLE[a.status]}`}>{STATUS_LABEL[a.status]}</span>
                  </div>
                  <div className="mt-2 flex justify-between text-xs">
                    <span className="text-gray-500">Cost {formatRs(a.totalCost)}</span>
                    <span className="font-medium text-gray-900">Now {formatRs(a.currentValue)}</span>
                  </div>
                </button>
              ))}
            </div>

            {meta && (
              <div className="flex items-center justify-between gap-2 px-1">
                <p className="text-xs text-gray-500">
                  {meta.total} asset{meta.total === 1 ? '' : 's'}
                  {meta.pages > 1 ? ` · page ${meta.page} of ${meta.pages}` : ''}
                </p>
                {meta.pages > 1 && (
                  <div className="flex gap-1">
                    <button type="button" onClick={() => setPage(page - 1)} disabled={loading || page <= 1} className="p-1.5 rounded-md border border-gray-300 bg-white disabled:opacity-40" aria-label="Previous page">
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => setPage(page + 1)} disabled={loading || page >= meta.pages} className="p-1.5 rounded-md border border-gray-300 bg-white disabled:opacity-40" aria-label="Next page">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-6">
          <HelpBox>
            <strong>How value is worked out:</strong> straight-line depreciation by full months. Example: a rack bought for Rs 120,000 with a
            10-year life loses Rs 1,000 a month. Each category has a default life you can change; an asset can override it.
          </HelpBox>
        </div>
      </div>

      {form.open && (
        <AssetFormModal
          asset={form.asset}
          categories={categories}
          defaultCategoryId={category && category !== 'none' ? category : undefined}
          onClose={() => setForm({ open: false, asset: null })}
          onSaved={(a) => {
            setForm({ open: false, asset: null });
            if (detail) setDetail(a);
            refreshAll();
          }}
        />
      )}
      {detail && !form.open && (
        <AssetDetailModal
          asset={detail}
          onClose={() => setDetail(null)}
          onChanged={(a) => {
            setDetail(a);
            refreshAll();
          }}
          onEdit={(a) => setForm({ open: true, asset: a })}
          onDeleted={() => {
            setDetail(null);
            refreshAll();
          }}
        />
      )}
      {catsOpen && <CategoriesModal categories={categories} onClose={() => setCatsOpen(false)} onChanged={() => loadOverview().then(loadList)} />}
    </div>
  );
}

function SummaryCard({
  title,
  count,
  cost,
  value,
  active,
  highlight,
  onClick,
}: {
  title: string;
  count: number;
  cost: number;
  value: number;
  active: boolean;
  highlight?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-lg sm:rounded-xl border p-3 transition-all ${
        active ? 'border-honey-500 ring-2 ring-honey-500/20 bg-white' : highlight ? 'border-honey-200 bg-honey-50 hover:border-honey-400' : 'border-gray-200 bg-white hover:border-honey-300'
      }`}
    >
      <p className="text-xs font-medium text-gray-600 truncate">{title}</p>
      <p className="mt-1 text-base sm:text-lg font-semibold text-gray-900 tabular-nums">{formatRs(value)}</p>
      <p className="text-[11px] text-gray-500 tabular-nums">
        {count} item{count === 1 ? '' : 's'} · cost {formatRs(cost)}
      </p>
    </button>
  );
}
