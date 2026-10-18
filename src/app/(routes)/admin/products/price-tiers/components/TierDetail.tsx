'use client';

// One tier: its products with average landed cost and margin (worst first),
// filter by margin flag, add products, remove selected.
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Search, PackagePlus, Loader2, Pencil, Trash2, Info, AlertTriangle, CheckSquare, Square, X } from 'lucide-react';
import { apiErrorMessage, formatRs, type PageMeta } from '@/lib/storeApi';
import { ErrorBox, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import TablePagination from '@/components/admin/TablePagination';
import ProductInsightPanel from '@/components/store/ProductInsightPanel';
import { FLAG_STYLE, MarginFlag, PriceTier, TierDetail as TierDetailData, tierApi } from './tierApi';
import AssignProductsModal from './AssignProductsModal';

interface Props {
  tier: PriceTier;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDeleted: () => void;
  /** Product count changed (assign / remove). */
  onChanged: () => void;
}

export default function TierDetail({ tier, canEdit, canDelete, onEdit, onDeleted, onChanged }: Props) {
  const [data, setData] = useState<TierDetailData | null>(null);
  const [meta, setMeta] = useState<PageMeta>({ page: 1, limit: 50, total: 0, pages: 1 });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [flag, setFlag] = useState<'' | MarginFlag>('');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);
  const [busy, setBusy] = useState<'remove' | 'delete' | null>(null);
  const [insightId, setInsightId] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const lock = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [tier._id, flag, debounced, limit]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    tierApi
      .detail(tier._id, { search: debounced, flag, page, limit })
      .then((res) => {
        if (cancelled) return;
        setData(res.data);
        if (res.meta) setMeta(res.meta);
        setError(null);
      })
      .catch((e) => !cancelled && setError(apiErrorMessage(e, 'Could not load the tier')))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [tier._id, tier.price, debounced, flag, page, limit, reload]);

  const refresh = () => {
    setSelected(new Set());
    setReload((n) => n + 1);
    onChanged();
  };

  const products = data?.products || [];
  const allShown = products.length > 0 && products.every((p) => selected.has(p._id));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      products.forEach((p) => (allShown ? next.delete(p._id) : next.add(p._id)));
      return next;
    });

  const removeSelected = async () => {
    if (lock.current || !selected.size) return;
    if (!confirm(`Remove ${selected.size} product(s) from ${tier.name}? Their price stays as it is.`)) return;
    lock.current = true;
    setBusy('remove');
    try {
      const res = await tierApi.unassign([...selected], tier._id);
      toast.success(res.message || 'Removed');
      refresh();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      lock.current = false;
      setBusy(null);
    }
  };

  const deleteTier = async () => {
    if (lock.current) return;
    if (!confirm(`Delete ${tier.name}? Its ${data?.summary.productCount ?? tier.productCount ?? 0} product(s) keep their price but leave the tier.`)) return;
    lock.current = true;
    setBusy('delete');
    try {
      await tierApi.remove(tier._id);
      toast.success('Tier deleted');
      onDeleted();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      lock.current = false;
      setBusy(null);
    }
  };

  const s = data?.summary;
  const chip = (key: '' | MarginFlag, label: string, count: number | undefined, cls: string) => (
    <button
      key={key || 'all'}
      type="button"
      onClick={() => setFlag(flag === key ? '' : key)}
      className={`px-2.5 py-1 rounded-full border text-xs font-medium ${flag === key ? 'ring-2 ring-offset-1 ring-honey-400' : ''} ${cls}`}
    >
      {label} {count ?? 0}
    </button>
  );

  return (
    <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200">
      <div className="p-3 sm:p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="h-10 w-10 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: tier.color }}>
            {Math.round(tier.price)}
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900 truncate">
              {tier.name} · {formatRs(tier.price)}
              {!tier.isActive && <span className="ml-2 text-xs font-medium text-gray-400">(off)</span>}
            </h2>
            <p className="text-xs text-gray-500">
              {s ? `${s.productCount} product(s)` : '…'}
              {s?.avgMarginPct !== null && s?.avgMarginPct !== undefined ? ` · average margin ${s.avgMarginPct}%` : ''}
              {s ? ` · low below ${s.lowMarginPct}%` : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          {canEdit && (
            <button className={primaryBtn} onClick={() => setAssigning(true)} disabled={!tier.isActive} title={tier.isActive ? '' : 'Switch the tier on first'}>
              <PackagePlus className="h-4 w-4" /> Add products
            </button>
          )}
          {canEdit && (
            <button className={secondaryBtn} onClick={onEdit}>
              <Pencil className="h-4 w-4" /> Edit
            </button>
          )}
          {canDelete && (
            <button className={secondaryBtn} onClick={deleteTier} disabled={!!busy}>
              {busy === 'delete' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-red-500" />}
            </button>
          )}
        </div>
      </div>

      <div className="p-3 sm:p-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {chip('negative', 'Loss', s?.negative, FLAG_STYLE.negative.className)}
          {chip('low', 'Low', s?.low, FLAG_STYLE.low.className)}
          {chip('ok', 'OK', s?.ok, FLAG_STYLE.ok.className)}
          {chip('no_cost', 'No cost', s?.noCost, FLAG_STYLE.no_cost.className)}
          {flag && (
            <button type="button" onClick={() => setFlag('')} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800">
              <X className="h-3 w-3" /> all
            </button>
          )}
        </div>
        <div className="relative md:ml-auto md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input className={`${inputClass} pl-9`} placeholder="Search in this tier…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {(s?.negative || 0) > 0 && !flag && (
        <div className="mx-3 sm:mx-4 mt-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {s?.negative} product(s) cost more than {formatRs(tier.price)} to land — every sale loses money. Move them to a higher tier.
        </div>
      )}
      {error && (
        <div className="p-3">
          <ErrorBox message={error} />
        </div>
      )}

      {canEdit && selected.size > 0 && (
        <div className="mx-3 sm:mx-4 mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-honey-50 border border-honey-200 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <button className={`${secondaryBtn} !py-1 ml-auto text-xs`} onClick={removeSelected} disabled={!!busy}>
            {busy === 'remove' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Remove from tier
          </button>
        </div>
      )}

      <div className="overflow-x-auto mt-2">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              {canEdit && (
                <th className="px-3 py-2 w-8">
                  <button type="button" onClick={toggleAll} aria-label="Select all shown" disabled={!products.length}>
                    {allShown ? <CheckSquare className="h-4 w-4 text-honey-700" /> : <Square className="h-4 w-4" />}
                  </button>
                </th>
              )}
              <th className="px-3 py-2 text-left">Product</th>
              <th className="px-3 py-2 text-right">Stock</th>
              <th className="px-3 py-2 text-right">Sale price</th>
              <th className="px-3 py-2 text-right">Avg landed cost</th>
              <th className="px-3 py-2 text-right">Margin</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className={`divide-y divide-gray-100 ${loading ? 'opacity-60' : ''}`}>
            {products.map((p) => (
              <tr key={p._id} className={selected.has(p._id) ? 'bg-honey-50/50' : 'hover:bg-gray-50'}>
                {canEdit && (
                  <td className="px-3 py-2">
                    <button type="button" onClick={() => toggle(p._id)} aria-label="Select">
                      {selected.has(p._id) ? <CheckSquare className="h-4 w-4 text-honey-700" /> : <Square className="h-4 w-4 text-gray-300" />}
                    </button>
                  </td>
                )}
                <td className="px-3 py-2 min-w-[180px]">
                  <div className="font-medium text-gray-900">{p.name}</div>
                  <div className="text-[11px] text-gray-500">
                    {p.category}
                    {p.shortCode ? ` · #${p.shortCode}` : ''}
                    {p.variantCount ? ` · ${p.variantCount} variants` : ''}
                  </div>
                </td>
                <td className="px-3 py-2 text-right">{p.stock}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {formatRs(p.price)}
                  {!p.priceMatchesTier && <div className="text-[10px] text-amber-600">not the tier price</div>}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{p.cost === null ? '—' : formatRs(p.cost, { decimals: 2 })}</td>
                <td className={`px-3 py-2 text-right whitespace-nowrap font-medium ${p.margin !== null && p.margin < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {p.margin === null ? '—' : (
                    <>
                      {formatRs(p.margin, { decimals: 2 })}
                      <div className="text-[11px] font-normal text-gray-500">{p.marginPct}%</div>
                    </>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded border text-[11px] font-medium whitespace-nowrap ${FLAG_STYLE[p.flag].className}`}>{FLAG_STYLE[p.flag].label}</span>
                </td>
                <td className="px-3 py-2 text-right">
                  <button type="button" onClick={() => setInsightId(p._id)} className="p-1.5 text-gray-400 hover:text-blue-600" title="Price history, vendors" aria-label="Product history">
                    <Info className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {!loading && products.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-sm text-gray-500">
                  {flag || debounced ? 'No products match.' : 'No products on this tier yet.'}
                </td>
              </tr>
            )}
            {loading && products.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center">
                  <Loader2 className="h-5 w-5 animate-spin text-honey-700 inline" />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <TablePagination page={page} pages={meta.pages} total={meta.total} limit={limit} onPageChange={setPage} onLimitChange={setLimit} label="products" loading={loading} />

      {assigning && (
        <AssignProductsModal
          tier={tier}
          onClose={() => setAssigning(false)}
          onDone={() => {
            setAssigning(false);
            refresh();
          }}
        />
      )}
      <ProductInsightPanel productId={insightId} open={!!insightId} onClose={() => setInsightId(null)} />
    </div>
  );
}
