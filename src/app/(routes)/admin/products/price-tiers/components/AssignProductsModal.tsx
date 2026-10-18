'use client';

// Pick products (search + multi-select) and put them on a tier. Shows the
// margin each would make at the tier price, so a loss is seen before saving.
import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Search, Loader2, PackagePlus, CheckSquare, Square } from 'lucide-react';
import { apiErrorMessage, formatRs } from '@/lib/storeApi';
import { Modal, ErrorBox, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { Candidate, FLAG_STYLE, PriceTier, tierApi } from './tierApi';

const PAGE = 25;

export default function AssignProductsModal({ tier, onClose, onDone }: { tier: PriceTier; onClose: () => void; onDone: () => void }) {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [rows, setRows] = useState<Candidate[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Map<string, Candidate>>(new Map());
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [debounced]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    tierApi
      .candidates({ search: debounced, tierId: tier._id, notInTier: true, page, limit: PAGE })
      .then((res) => {
        if (cancelled) return;
        setRows((prev) => (page === 1 ? res.data : [...prev, ...res.data]));
        setTotal(res.meta?.total || 0);
        setError(null);
      })
      .catch((e) => !cancelled && setError(apiErrorMessage(e, 'Could not load products')))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [debounced, page, tier._id]);

  const toggle = (c: Candidate) =>
    setPicked((prev) => {
      const next = new Map(prev);
      if (next.has(c._id)) next.delete(c._id);
      else next.set(c._id, c);
      return next;
    });
  const allShown = rows.length > 0 && rows.every((r) => picked.has(r._id));
  const toggleAll = () =>
    setPicked((prev) => {
      const next = new Map(prev);
      rows.forEach((r) => (allShown ? next.delete(r._id) : next.set(r._id, r)));
      return next;
    });

  const pickedList = useMemo(() => [...picked.values()], [picked]);
  const losses = pickedList.filter((c) => c.atTier?.flag === 'negative').length;
  const moving = pickedList.filter((c) => c.priceTier).length;

  const save = async () => {
    if (lock.current || !picked.size) return;
    if (losses > 0 && !confirm(`${losses} product(s) cost more than ${formatRs(tier.price)} — they will sell at a loss. Continue?`)) return;
    lock.current = true;
    setSaving(true);
    try {
      const res = await tierApi.assign(tier._id, [...picked.keys()]);
      toast.success(res.message || 'Products assigned');
      onDone();
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not assign the products'));
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Add products to ${tier.name}`}
      subtitle={`They will sell at ${formatRs(tier.price)} (every variant)`}
      icon={<PackagePlus className="h-5 w-5" />}
      onClose={onClose}
      busy={saving}
      wide
      footer={
        <>
          <span className="mr-auto text-xs text-gray-500">
            {picked.size} picked{moving ? ` · ${moving} move from another tier` : ''}
            {losses ? <span className="text-red-600"> · {losses} at a loss</span> : null}
          </span>
          <button className={secondaryBtn} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className={primaryBtn} onClick={save} disabled={saving || !picked.size} aria-busy={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Saving…' : `Assign ${picked.size || ''}`}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input className={`${inputClass} pl-9`} placeholder="Search by name, category, short code, barcode…" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
        </div>
        <ErrorBox message={error} />
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs text-gray-500">
            <button type="button" onClick={toggleAll} className="inline-flex items-center gap-1.5 font-medium text-gray-700" disabled={!rows.length}>
              {allShown ? <CheckSquare className="h-4 w-4 text-honey-700" /> : <Square className="h-4 w-4" />}
              Select shown
            </button>
            <span className="ml-auto">{total} product(s)</span>
          </div>
          <ul className="divide-y divide-gray-100 max-h-[50vh] overflow-y-auto">
            {rows.map((c) => {
              const on = picked.has(c._id);
              const flag = c.atTier ? FLAG_STYLE[c.atTier.flag] : null;
              return (
                <li key={c._id}>
                  <button type="button" onClick={() => toggle(c)} className={`w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-gray-50 ${on ? 'bg-honey-50/60' : ''}`}>
                    {on ? <CheckSquare className="h-4 w-4 text-honey-700 flex-shrink-0" /> : <Square className="h-4 w-4 text-gray-300 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{c.name}</div>
                      <div className="text-[11px] text-gray-500 flex flex-wrap gap-x-2">
                        <span>{c.category}</span>
                        {c.shortCode && <span>#{c.shortCode}</span>}
                        {c.variantCount > 0 && <span>{c.variantCount} variants</span>}
                        <span>stock {c.stock}</span>
                        {c.priceTier && (
                          <span className="inline-flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.priceTier.color }} />
                            now in {c.priceTier.name}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-xs whitespace-nowrap">
                      <div className="text-gray-500">
                        {formatRs(c.price)} → <b className="text-gray-900">{formatRs(tier.price)}</b>
                      </div>
                      <div className="text-gray-400">cost {c.cost === null ? '—' : formatRs(c.cost)}</div>
                    </div>
                    {flag && (
                      <span className={`hidden sm:inline px-1.5 py-0.5 rounded border text-[10px] font-medium ${flag.className}`}>
                        {c.atTier?.marginPct === null || c.atTier?.marginPct === undefined ? flag.label : `${c.atTier.marginPct}%`}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
            {!loading && rows.length === 0 && <li className="px-3 py-8 text-center text-sm text-gray-500">No products found</li>}
          </ul>
          {(loading || rows.length < total) && (
            <div className="p-2 border-t border-gray-100 text-center">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-gray-400 inline" />
              ) : (
                <button type="button" className="text-xs font-medium text-honey-700 hover:underline" onClick={() => setPage((p) => p + 1)}>
                  Load more
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
