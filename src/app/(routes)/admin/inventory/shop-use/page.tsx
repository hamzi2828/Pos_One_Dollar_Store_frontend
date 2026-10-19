'use client';

// Shop use: items the shop takes from its own stock (cleaning items, bags...).
// Each record takes the stock out and posts an expense; void puts it back.

import { useCallback, useEffect, useState } from 'react';
import { Ban, Eye, Plus, Search, ShoppingBasket } from 'lucide-react';
import toast from 'react-hot-toast';
import TablePagination from '@/components/admin/TablePagination';
import { ErrorBox, Field, LoadingCard, Modal, NoAccessCard, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { useAccess } from '@/context/AccessContext';
import { storeApi, apiErrorMessage, formatRs, formatDate, type PageMeta } from '@/lib/storeApi';
import { type ShopUseRecord } from '../movements/_shared/stockOpsApi';
import { ErrorCard, PageHeader, StatCard, StatusPill, cardClass, thClass } from '../movements/_shared/StockOpsBits';
import TakeForShopUseModal from './components/TakeForShopUseModal';
import { SearchSelect } from '@/components/ui/SearchSelect';

export default function ShopUsePage() {
  const { can } = useAccess();
  const canView = can('shop_use', 'view');
  const canCreate = can('shop_use', 'create');
  const canVoid = can('shop_use', 'delete');

  const [rows, setRows] = useState<ShopUseRecord[]>([]);
  const [meta, setMeta] = useState<(PageMeta & { totalCost?: number; totalQty?: number }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [showNew, setShowNew] = useState(false);
  const [detail, setDetail] = useState<ShopUseRecord | null>(null);
  const [voiding, setVoiding] = useState<ShopUseRecord | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [debounced, status, from, to, limit]);

  const load = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    setError(null);
    try {
      const res = await storeApi.get<ShopUseRecord[]>('/shop-use', { search: debounced, status, from, to, page, limit });
      setRows(res.data || []);
      setMeta((res.meta as PageMeta & { totalCost?: number; totalQty?: number }) || null);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load shop use records.'));
    } finally {
      setLoading(false);
    }
  }, [canView, debounced, status, from, to, page, limit]);

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

  const hasFilters = !!(search || status || from || to);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <PageHeader
          title="Shop Use"
          subtitle="Items taken from our own stock for the shop. Each one is posted to expenses at cost."
          actions={
            canCreate && (
              <button type="button" onClick={() => setShowNew(true)} className={primaryBtn}>
                <Plus className="h-4 w-4" />
                Take for shop use
              </button>
            )
          }
        />

        <div className={`${cardClass} p-3 sm:p-4 mb-4`}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
            <div className="relative col-span-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="SU number, item, purpose, name…" className={`${inputClass} pl-8`} />
            </div>
            <SearchSelect value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass} aria-label="Status">
              <option value="">Active & voided</option>
              <option value="active">Active</option>
              <option value="voided">Voided</option>
            </SearchSelect>
            <div className="col-span-2 md:col-span-1 flex items-center gap-1">
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputClass} px-2`} aria-label="From date" />
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`${inputClass} px-2`} aria-label="To date" />
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
              }}
              className="mt-2 text-xs font-medium text-honey-700 hover:text-honey-800"
            >
              Clear filters
            </button>
          )}
        </div>

        {meta && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mb-4">
            <StatCard label="Records" value={meta.total} />
            <StatCard label="Pieces taken (active)" value={meta.totalQty ?? 0} />
            <StatCard label="Expensed at cost" value={formatRs(meta.totalCost ?? 0, { decimals: 2 })} tone="red" />
          </div>
        )}

        {loading && !rows.length ? (
          <LoadingCard text="Loading shop use…" />
        ) : error ? (
          <ErrorCard message={error} onRetry={load} />
        ) : (
          <div className={`${cardClass} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className={thClass}>Record</th>
                    <th className={thClass}>Items</th>
                    <th className={thClass}>Purpose</th>
                    <th className={`${thClass} text-right`}>Cost</th>
                    <th className={thClass}>Status</th>
                    <th className={`${thClass} text-right`}></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-500">
                        <ShoppingBasket className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                        {hasFilters ? 'Nothing matches these filters.' : 'Nothing taken for shop use yet.'}
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={r._id} className={`hover:bg-gray-50 cursor-pointer ${r.status === 'voided' ? 'text-gray-400' : ''}`} onClick={() => setDetail(r)}>
                        <td className="px-3 sm:px-4 py-2.5 whitespace-nowrap">
                          <div className="text-sm font-semibold font-mono">{r.shopUseNo}</div>
                          <div className="text-xs text-gray-500">{formatDate(r.date, true)}</div>
                        </td>
                        <td className="px-3 sm:px-4 py-2.5 text-sm">
                          <div className="whitespace-nowrap">
                            {r.lines.length} item{r.lines.length === 1 ? '' : 's'} · {r.totalQty} pcs
                          </div>
                          <div className="text-xs text-gray-500 truncate max-w-[260px]">
                            {r.lines
                              .slice(0, 2)
                              .map((l) => `${l.qty} × ${l.productName}`)
                              .join(', ')}
                            {r.lines.length > 2 ? ` +${r.lines.length - 2} more` : ''}
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 py-2.5 text-sm">
                          <div className="max-w-[240px] truncate">{r.purpose}</div>
                          <div className="text-xs text-gray-500">{r.takenByName || r.takenByUserName || r.createdByName}</div>
                        </td>
                        <td className="px-3 sm:px-4 py-2.5 text-right text-sm font-semibold whitespace-nowrap">{formatRs(r.totalCost, { decimals: 2 })}</td>
                        <td className="px-3 sm:px-4 py-2.5">
                          <StatusPill status={r.status} />
                        </td>
                        <td className="px-3 sm:px-4 py-2.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <button type="button" onClick={() => setDetail(r)} className="p-1.5 rounded-md text-gray-400 hover:text-honey-700 hover:bg-honey-50" title="Details">
                            <Eye className="h-4 w-4" />
                          </button>
                          {canVoid && r.status === 'active' && (
                            <button type="button" onClick={() => setVoiding(r)} className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50" title="Void — put stock back">
                              <Ban className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {meta && <TablePagination page={meta.page} pages={meta.pages} total={meta.total} limit={limit} onPageChange={setPage} onLimitChange={setLimit} label="records" loading={loading} />}
          </div>
        )}
      </div>

      {showNew && (
        <TakeForShopUseModal
          onClose={() => setShowNew(false)}
          onSaved={() => {
            setShowNew(false);
            load();
          }}
        />
      )}
      {detail && <DetailModal record={detail} onClose={() => setDetail(null)} />}
      {voiding && (
        <VoidModal
          record={voiding}
          onClose={() => setVoiding(null)}
          onDone={() => {
            setVoiding(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function DetailModal({ record, onClose }: { record: ShopUseRecord; onClose: () => void }) {
  return (
    <Modal title={record.shopUseNo} subtitle={formatDate(record.date, true)} icon={<ShoppingBasket className="h-5 w-5" />} onClose={onClose} wide>
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={record.status} />
          <span className="text-gray-700">{record.purpose}</span>
        </div>
        <div className="text-xs text-gray-500">
          Taken by {record.takenByName || record.takenByUserName || '—'} · saved by {record.createdByName || '—'}
          {record.status === 'voided' && ` · voided by ${record.voidedByName || '—'} ${record.voidedAt ? formatDate(record.voidedAt, true) : ''}${record.voidReason ? ` (${record.voidReason})` : ''}`}
        </div>
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Item</th>
                <th className="px-3 py-2 text-right font-medium">Qty</th>
                <th className="px-3 py-2 text-right font-medium">Cost / pc</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {record.lines.map((l) => (
                <tr key={l._id}>
                  <td className="px-3 py-2">
                    {l.productName}
                    {l.variantLabel ? ` (${l.variantLabel})` : ''}
                    <div className="text-[11px] text-gray-500 font-mono">{l.code}</div>
                  </td>
                  <td className="px-3 py-2 text-right">{l.qty}</td>
                  <td className="px-3 py-2 text-right">{formatRs(l.unitCost, { decimals: 2 })}</td>
                  <td className="px-3 py-2 text-right font-medium">{formatRs(l.total, { decimals: 2 })}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-semibold">
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right">{record.totalQty}</td>
                <td />
                <td className="px-3 py-2 text-right">{formatRs(record.totalCost, { decimals: 2 })}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="text-xs text-gray-500">{record.status === 'active' ? 'Posted to expenses as “Shop Use (from stock)”.' : 'The expense was removed and the stock put back.'}</p>
      </div>
    </Modal>
  );
}

function VoidModal({ record, onClose, onDone }: { record: ShopUseRecord; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await storeApi.post(`/shop-use/${record._id}/void`, { reason: reason.trim() });
      toast.success(res.message || 'Voided');
      onDone();
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not void'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      title={`Void ${record.shopUseNo}?`}
      subtitle={`${record.totalQty} pcs · ${formatRs(record.totalCost, { decimals: 2 })}`}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className={secondaryBtn}>
            Keep it
          </button>
          <button type="button" onClick={submit} disabled={saving} className={primaryBtn}>
            {saving ? 'Voiding…' : 'Void & put stock back'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-gray-700">The pieces go back into stock (warehouse) and the expense is removed.</p>
        <Field label="Reason">
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className={inputClass} placeholder="e.g. Entered by mistake" />
        </Field>
        <ErrorBox message={error} />
      </div>
    </Modal>
  );
}
