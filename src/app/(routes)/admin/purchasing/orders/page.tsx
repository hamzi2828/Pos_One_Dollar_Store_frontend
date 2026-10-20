'use client';

// Purchase trips list: step tabs (Buying, On the way, Unpacking, Done), search, vendor / date filters, "New purchase trip".
// Opened from the demand report as /admin/purchasing/orders?new=1&productIds=a,b
// -> the new trip shows those products as suggested items.
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { AlertCircle, ChevronLeft, ChevronRight, ClipboardList, Lightbulb, Loader2, Plus, Search, X } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage, formatDate, formatRs } from '@/lib/storeApi';
import { ErrorBox, Field, HelpBox, LoadingCard, Modal, NoAccessCard, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { purchasingApi } from '../_shared/purchasingApi';
import { VendorSearch } from '../_shared/Pickers';
import { EmptyState, POStatusBadge, StatTile, Tabs } from '../_shared/ui';
import type { POListMeta, PurchaseOrder, VendorOption } from '../_shared/types';

type Tab = 'active' | 'open' | 'closed' | 'receiving' | 'received' | 'cancelled' | 'all';

export default function PurchaseOrdersPage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-6"><LoadingCard text="Loading purchase trips…" /></div>}>
      <OrdersList />
    </Suspense>
  );
}

function OrdersList() {
  const { can } = useAccess();
  const router = useRouter();
  const params = useSearchParams();
  const canView = can('purchase_orders', 'view');
  const canCreate = can('purchase_orders', 'create');

  const suggestedIds = (params.get('productIds') || '').split(',').map((s) => s.trim()).filter(Boolean);
  const [tab, setTab] = useState<Tab>('active');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [vendor, setVendor] = useState<VendorOption | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<PurchaseOrder[]>([]);
  const [meta, setMeta] = useState<POListMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(params.get('new') === '1');
  const [showFilters, setShowFilters] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [tab, debounced, vendor, from, to]);

  const load = useCallback(async () => {
    const my = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const res = await purchasingApi.list({ status: tab === 'all' ? undefined : tab, search: debounced, vendorId: vendor?._id, from, to, page, limit: 20 });
      if (my !== seq.current) return;
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (my === seq.current) setError(apiErrorMessage(e, 'Could not load purchase trips.'));
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, [tab, debounced, vendor, from, to, page]);

  useEffect(() => {
    if (canView) load();
  }, [load, canView]);

  const counts = meta?.counts || {};
  const tabs = useMemo(
    () =>
      [
        { value: 'active', label: 'Active', count: counts.active },
        { value: 'open', label: 'Buying', count: counts.open },
        { value: 'closed', label: 'On the way', count: counts.closed },
        { value: 'receiving', label: 'Unpacking', count: counts.receiving },
        { value: 'received', label: 'Done', count: counts.received },
        { value: 'cancelled', label: 'Cancelled', count: counts.cancelled },
        { value: 'all', label: 'All', count: counts.all },
      ] as { value: Tab; label: string; count?: number }[],
    [counts.active, counts.open, counts.closed, counts.receiving, counts.received, counts.cancelled, counts.all],
  );

  if (!canView) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <NoAccessCard />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Purchase Trips</h1>
            <p className="mt-0.5 text-xs sm:text-sm text-gray-500">One trip to the market = one purchase trip. Add each vendor&apos;s bill (amount, boxes/packs, paid now), then send it to the warehouse.</p>
          </div>
          {canCreate && (
            <button onClick={() => setShowNew(true)} className={primaryBtn}>
              <Plus className="h-4 w-4" /> New purchase trip
            </button>
          )}
        </div>

        {suggestedIds.length > 0 && canCreate && !showNew && (
          <HelpBox>
            <strong>{suggestedIds.length} products from the demand report</strong> are waiting.{' '}
            <button type="button" className="underline font-semibold" onClick={() => setShowNew(true)}>
              Start a purchase trip
            </button>{' '}
            and they will be shown as suggested items.
          </HelpBox>
        )}

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <StatTile label="Vendor bills" value={formatRs(meta?.totals.goods)} sub={`${meta?.total ?? 0} trips`} />
          <StatTile label="Trip costs" value={formatRs(meta?.totals.charges)} sub="car rent, freight, labour…" />
          <StatTile label="All in" value={formatRs(meta?.totals.grand)} tone="honey" />
        </div>

        <Tabs tabs={tabs} value={tab} onChange={setTab} />

        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search trip no, vendor, bill no…"
                className={`${inputClass} pl-9 pr-8`}
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" aria-label="Clear">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <button type="button" onClick={() => setShowFilters((v) => !v)} className={secondaryBtn}>
              Filters{vendor || from || to ? ' •' : ''}
            </button>
          </div>
          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Vendor">
                <VendorSearch value={vendor} onChange={setVendor} />
              </Field>
              <Field label="From">
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
              </Field>
              <Field label="To">
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
              </Field>
            </div>
          )}
        </div>

        {loading && !rows.length ? (
          <LoadingCard text="Loading purchase trips…" />
        ) : error ? (
          <div className="bg-white rounded-xl shadow-sm border border-red-200 text-center py-10 px-4">
            <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
            <p className="text-sm text-red-700 mb-4">{error}</p>
            <button onClick={load} className={primaryBtn}>Try again</button>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-12 w-12" />}
            title="No purchase trips"
            text={debounced || vendor || from || to ? 'Try a different search or filter.' : 'Start one when you go buying.'}
            action={
              canCreate ? (
                <button onClick={() => setShowNew(true)} className={primaryBtn}>
                  <Plus className="h-4 w-4" /> New purchase trip
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className={`bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 overflow-hidden ${loading ? 'opacity-60' : ''}`}>
            {/* Desktop table */}
            <table className="hidden md:table w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-2.5">Trip</th>
                  <th className="text-left px-4 py-2.5">Vendors</th>
                  <th className="text-right px-4 py-2.5">Boxes/packs</th>
                  <th className="text-right px-4 py-2.5">Bills</th>
                  <th className="text-right px-4 py-2.5">Trip costs</th>
                  <th className="text-right px-4 py-2.5">All in</th>
                  <th className="text-left px-4 py-2.5">Step</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((po) => (
                  <tr key={po._id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/admin/purchasing/orders/${po._id}`)}>
                    <td className="px-4 py-3">
                      <Link href={`/admin/purchasing/orders/${po._id}`} className="font-semibold text-gray-900 hover:text-honey-700" onClick={(e) => e.stopPropagation()}>
                        {po.poNumber}
                      </Link>
                      <p className="text-[11px] text-gray-500">{formatDate(po.createdAt)} · {po.buyerName}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-xs">
                      <p className="truncate">{po.vendors?.length ? po.vendors.join(', ') : <span className="text-gray-400">No bills yet</span>}</p>
                    </td>
                    <td className="px-4 py-3 text-right">{po.totals.cartons}</td>
                    <td className="px-4 py-3 text-right">{formatRs(po.totals.goods)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{formatRs(po.totals.charges)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatRs(po.totals.grand)}</td>
                    <td className="px-4 py-3"><POStatusBadge status={po.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {rows.map((po) => (
                <Link key={po._id} href={`/admin/purchasing/orders/${po._id}`} className="block px-4 py-3 hover:bg-gray-50">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-gray-900">{po.poNumber}</span>
                    <POStatusBadge status={po.status} />
                  </div>
                  <p className="text-xs text-gray-600 truncate">{po.vendors?.length ? po.vendors.join(', ') : 'No bills yet'}</p>
                  <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                    <span>{formatDate(po.createdAt)} · {po.totals.cartons} box{po.totals.cartons === 1 ? '' : 'es'}/pack{po.totals.cartons === 1 ? '' : 's'}</span>
                    <span className="font-semibold text-gray-900">{formatRs(po.totals.grand)}</span>
                  </div>
                </Link>
              ))}
            </div>
            {meta && meta.pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-xs text-gray-600">
                <span>Page {meta.page} of {meta.pages} · {meta.total} trips</span>
                <div className="flex gap-2">
                  <button className={secondaryBtn} disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button className={secondaryBtn} disabled={page >= meta.pages || loading} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showNew && (
        <NewPOModal
          suggestedCount={suggestedIds.length}
          onClose={() => setShowNew(false)}
          onCreated={(po) => {
            toast.success(`${po.poNumber} started`);
            const qs = suggestedIds.length ? `?productIds=${encodeURIComponent(suggestedIds.join(','))}` : '';
            router.push(`/admin/purchasing/orders/${po._id}${qs}`);
          }}
        />
      )}
    </div>
  );
}

function NewPOModal({ suggestedCount, onClose, onCreated }: { suggestedCount: number; onClose: () => void; onCreated: (po: PurchaseOrder) => void }) {
  const [notes, setNotes] = useState('');
  const [expected, setExpected] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      onCreated(await purchasingApi.create({ notes, expectedArrival: expected || undefined, buyerName: buyerName || undefined }));
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not start the purchase trip.'));
      setBusy(false);
    }
  };

  return (
    <Modal
      title="New purchase trip"
      subtitle="Start it when you go to the market; add each vendor’s bill as you buy."
      icon={<ClipboardList className="h-5 w-5" />}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button className={secondaryBtn} onClick={onClose} disabled={busy}>Cancel</button>
          <button className={primaryBtn} onClick={submit} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? 'Starting…' : 'Start trip'}</button>
        </>
      }
    >
      <div className="space-y-4">
        {suggestedCount > 0 && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
            <Lightbulb className="h-4 w-4 flex-shrink-0" />
            <span>{suggestedCount} products from the demand report will be listed as suggested items in this trip.</span>
          </div>
        )}
        <Field label="Buyer" hint="Who is going to buy. Leave empty to use your name.">
          <input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} className={inputClass} placeholder="e.g. Ali (driver)" />
        </Field>
        <Field label="Expected arrival">
          <input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Notes">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} placeholder="e.g. Karachi trip, Jodia Bazaar" />
        </Field>
        <ErrorBox message={error} />
      </div>
    </Modal>
  );
}
