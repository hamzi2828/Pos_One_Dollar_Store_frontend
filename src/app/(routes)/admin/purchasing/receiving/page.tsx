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
              // Money: what was bought vs what is entered (tags printed). Less = red, more = orange, equal = green.
              const total = Math.round(g.billTotal || 0);
              const done = Math.round(g.enteredValue || 0);
              const gap = done - total;
              const articles = g.enteredArticles || 0;
              const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
              const tone = !done ? 'text-gray-500' : gap < 0 ? 'text-red-600' : gap > 0 ? 'text-orange-600' : 'text-green-600';
              const bar = gap === 0 && done > 0 ? 'bg-green-500' : gap > 0 ? 'bg-orange-500' : 'bg-honey-500';
              const gapLine = !done
                ? 'Nothing entered yet'
                : `${gap === 0 ? 'Matches the bill' : `${formatRs(Math.abs(gap))} ${gap > 0 ? 'over' : 'short'}`} · total ${articles.toLocaleString()} article${articles === 1 ? '' : 's'}`;
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
                  <div className="mt-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className={`text-sm font-semibold tabular-nums ${tone}`}>
                        {formatRs(done)} / {formatRs(total)}
                      </p>
                      {articles > 0 && (
                        <p className="text-xs text-gray-600 tabular-nums whitespace-nowrap">
                          Avg <span className="font-semibold text-gray-900">{formatRs(Math.round(done / articles))}</span>/article
                        </p>
                      )}
                    </div>
                    <p className={`text-xs ${tone}`}>{gapLine}</p>
                    <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className={`h-full ${bar}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mt-1 flex flex-wrap justify-between gap-x-3 text-[11px] text-gray-500">
                      <span>
                        {g.status === 'completed' ? `Done ${formatDate(g.completedAt || g.createdAt)}` : `Sent ${formatDate(g.createdAt)}`}
                        {g.totals?.claimed ? ` · ${formatRs(g.totals.claimed)} claimed back` : ''}
                      </span>
                      {g.builty?.builtyNo && <span>Builty {g.builty.builtyNo}</span>}
                    </div>
                  </div>
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
