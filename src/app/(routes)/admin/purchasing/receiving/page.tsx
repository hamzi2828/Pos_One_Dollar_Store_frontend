'use client';

// Receive Goods: trips that reached the warehouse. Waiting ones first:
// Check boxes -> Unpacking -> Done.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ChevronLeft, ChevronRight, PackageCheck, Search, X } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage, formatDate, formatRs } from '@/lib/storeApi';
import { HelpBox, LoadingCard, NoAccessCard, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { purchasingApi } from '../_shared/purchasingApi';
import { ReceiverRule } from '../_shared/ReceiverRule';
import { EmptyState, GRNStatusBadge, Tabs } from '../_shared/ui';
import type { GRNListRow, POListMeta } from '../_shared/types';

type Tab = 'open' | 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'all';

export default function ReceivingQueuePage() {
  const { can } = useAccess();
  const canView = can('goods_receiving', 'view');
  const [tab, setTab] = useState<Tab>('open');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<GRNListRow[]>([]);
  const [meta, setMeta] = useState<POListMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [tab, debounced]);

  const load = useCallback(async () => {
    const my = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const res = await purchasingApi.grnList({ status: tab === 'all' ? undefined : tab, search: debounced, page, limit: 20 });
      if (my !== seq.current) return;
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (my === seq.current) setError(apiErrorMessage(e, 'Could not load the list.'));
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, [tab, debounced, page]);

  useEffect(() => {
    if (canView) load();
  }, [load, canView]);

  const c = meta?.counts || {};
  const tabs = useMemo(
    () =>
      [
        { value: 'open', label: 'To do', count: c.open },
        { value: 'pending', label: 'Check boxes/packs', count: c.pending },
        { value: 'in_progress', label: 'Unpacking', count: c.in_progress },
        { value: 'completed', label: 'Done', count: c.completed },
        { value: 'cancelled', label: 'Cancelled', count: c.cancelled },
        { value: 'all', label: 'All' },
      ] as { value: Tab; label: string; count?: number }[],
    [c.open, c.pending, c.in_progress, c.completed, c.cancelled],
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
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Receive Goods</h1>
          <p className="mt-0.5 text-xs sm:text-sm text-gray-500">1. Check all boxes/packs came · 2. Unpack and enter the goods (tags print as you go) · 3. Finish.</p>
        </div>
        <HelpBox>
          A trip shows up here when the buyer presses <strong>Send to warehouse</strong>. Goods go into the <strong>warehouse</strong> as soon as you enter them — put them on a shelf now or later from <Link href="/admin/inventory/putaway" className="underline">Warehouse → Shop</Link>.
        </HelpBox>

        <ReceiverRule />

        <Tabs tabs={tabs} value={tab} onChange={setTab} />

        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search trip no, vendor or builty no…" className={`${inputClass} pl-9 pr-8`} />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" aria-label="Clear">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {loading && !rows.length ? (
          <LoadingCard text="Loading…" />
        ) : error ? (
          <div className="bg-white rounded-xl shadow-sm border border-red-200 text-center py-10 px-4">
            <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
            <p className="text-sm text-red-700 mb-4">{error}</p>
            <button onClick={load} className={primaryBtn}>Try again</button>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<PackageCheck className="h-12 w-12" />}
            title={tab === 'open' ? 'Nothing to receive' : 'Nothing here'}
            text={debounced ? 'Try a different search.' : 'Trips sent to the warehouse show up here.'}
          />
        ) : (
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 ${loading ? 'opacity-60' : ''}`}>
            {rows.map((g) => {
              // New flow: goods entered while unpacking (no typed list needed).
              const simple = (g.entryCount ?? 0) > 0 || (!!g.boxesCheckedAt && !g.receivedPieces);
              const entered = g.enteredPieces ?? g.receivedPieces;
              const pct = g.expectedPieces ? Math.min(100, Math.round((entered / g.expectedPieces) * 100)) : g.status === 'in_progress' && entered ? 50 : 0;
              return (
                <Link
                  key={g._id}
                  href={`/admin/purchasing/receiving/${g._id}?status=receive`}
                  className={`block bg-white rounded-xl shadow-sm border p-4 hover:shadow-md transition-shadow ${g.status === 'pending' ? 'border-amber-200' : 'border-gray-200'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-gray-900">{g.poNumber || g.grnNumber}</span>
                    <GRNStatusBadge status={g.status} />
                  </div>
                  <p className="text-xs text-gray-600 truncate mt-0.5">{g.vendors.join(', ') || '—'}</p>
                  <div className="mt-2 flex flex-wrap justify-between gap-x-3 text-[11px] text-gray-500">
                    <span>
                      {g.status === 'pending'
                        ? `${g.expectedCartons} box${g.expectedCartons === 1 ? '' : 'es'}/pack${g.expectedCartons === 1 ? '' : 's'} to check`
                        : `${g.cartonsReceived || 0} of ${g.expectedCartons} boxes/packs came`}
                    </span>
                    {g.builty?.builtyNo && <span>Builty {g.builty.builtyNo}</span>}
                  </div>
                  {g.status !== 'pending' && (
                    <div className="mt-2">
                      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div className={`h-full ${g.status === 'completed' ? 'bg-green-500' : 'bg-honey-500'}`} style={{ width: `${g.status === 'completed' ? 100 : pct}%` }} />
                      </div>
                      <div className="mt-1 flex justify-between gap-2 text-[11px] text-gray-500">
                        <span>
                          {g.status === 'completed'
                            ? `${g.totals?.accepted ?? entered} pcs into the warehouse${g.totals?.claimed ? ` · ${formatRs(g.totals.claimed)} claimed back` : ''}`
                            : simple
                              ? `${entered} pcs entered${g.entryCount ? ` · ${g.entryCount} entries` : ''}${g.expectedPieces ? ` (typed: ${g.expectedPieces})` : ''}`
                              : `${g.receivedPieces} / ${g.expectedPieces} pcs`}
                        </span>
                        <span>{formatDate(g.completedAt || g.createdAt)}</span>
                      </div>
                    </div>
                  )}
                  {g.status === 'pending' && <p className="mt-1 text-[11px] text-gray-500">Sent {formatDate(g.createdAt)}</p>}
                  {(g.receiverName || g.buyerName) && (
                    <p className="mt-1 text-[11px] text-gray-400">
                      Bought by {g.buyerName || '—'}
                      {g.receiverName && ` · received by ${g.receiverName}`}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        )}
        {meta && meta.pages > 1 && (
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>Page {meta.page} of {meta.pages}</span>
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
    </div>
  );
}
