// POS Logs — every cart started on the POS screen, with what was scanned /
// clicked and whether it became a sale. Click a row to see its timeline.
'use client';

import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Calendar, ChevronDown, ChevronRight, Loader2, RefreshCw, ScrollText, Search, X } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { storeApi, apiErrorMessage, formatRs } from '@/lib/storeApi';
import TablePagination from '@/components/admin/TablePagination';
import { useServerPagination } from '@/helper/useServerPagination';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { LoadingCard, NoAccessCard } from '@/components/admin/FormBits';
import {
  ActivityTimeline,
  CartStatusBadge,
  getActivity,
  listActivity,
  timeOf,
  type ActivityCart,
  type ActivityDetail,
} from './activityView';

type StatusFilter = 'all' | 'completed' | 'not_completed' | 'held' | 'cleared' | 'failed';

/** Today in shop time (Pakistan), YYYY-MM-DD. */
const pkToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date());

const inputCls =
  'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-honey-500 focus:border-honey-500';

export default function POSLogsPage() {
  const { can, loaded } = useAccess();
  const canView = can('pos_orders', 'view');

  const [range, setRange] = useState<'today' | 'custom' | 'all'>('today');
  const [startDate, setStartDate] = useState(() => pkToday());
  const [endDate, setEndDate] = useState(() => pkToday());
  const [status, setStatus] = useState<StatusFilter>('all');
  const [counter, setCounter] = useState('');
  const [counters, setCounters] = useState<{ _id: string; name: string }[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [rows, setRows] = useState<ActivityCart[]>([]);
  const [summary, setSummary] = useState({ total: 0, completed: 0, notCompleted: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const pg = useServerPagination(25);

  // Open row -> its events (loaded once).
  const [openId, setOpenId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, ActivityDetail | 'loading' | 'error'>>({});

  const pickRange = (r: 'today' | 'custom' | 'all') => {
    setRange(r);
    if (r === 'today') {
      setStartDate(pkToday());
      setEndDate(pkToday());
    } else if (r === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Counter list for the filter (hidden when it cannot be loaded).
  useEffect(() => {
    if (!canView) return;
    storeApi
      .get<{ _id: string; name: string }[]>('/counters', { limit: 200 })
      .then((r) => setCounters(Array.isArray(r.data) ? r.data : []))
      .catch(() => setCounters([]));
  }, [canView]);

  useEffect(() => {
    pg.resetToFirstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, status, counter, debouncedSearch]);

  useEffect(() => {
    if (!canView) return;
    let stop = false;
    setLoading(true);
    setError(null);
    listActivity({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      status: status === 'all' ? undefined : status,
      counter: counter || undefined,
      orderNumber: debouncedSearch || undefined,
      page: pg.page,
      limit: pg.pageSize,
    })
      .then((res) => {
        if (stop) return;
        setRows(res.data);
        setSummary(res.summary);
        pg.setTotal(res.total);
      })
      .catch((err) => !stop && setError(apiErrorMessage(err, 'Could not load the logs')))
      .finally(() => !stop && setLoading(false));
    return () => {
      stop = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, startDate, endDate, status, counter, debouncedSearch, pg.page, pg.pageSize, reloadTick]);

  const toggle = (cart: ActivityCart) => {
    const id = cart.cartId;
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    const have = details[id];
    if (have && have !== 'error') return;
    setDetails((d) => ({ ...d, [id]: 'loading' }));
    getActivity(id)
      .then((detail) => setDetails((d) => ({ ...d, [id]: detail })))
      .catch(() => setDetails((d) => ({ ...d, [id]: 'error' })));
  };

  const refresh = () => {
    setDetails({});
    setReloadTick((n) => n + 1);
  };

  if (!loaded) return <LoadingCard text="Loading…" />;
  if (!canView) return <NoAccessCard />;

  const filtersOn = search || status !== 'all' || counter || range !== 'today';

  return (
    <div className="space-y-3 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <ScrollText className="h-6 w-6 text-honey-700" />
            POS Logs
          </h1>
          <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-500">
            Every bill started on the POS: what was scanned and clicked, and how far it got.
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link
            href="/admin/pos-orders"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            POS Orders
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Bill number…"
              className={`${inputCls} pl-9`}
            />
          </div>
          <SearchSelect value={range} onChange={(e) => pickRange(e.target.value as 'today' | 'custom' | 'all')} aria-label="Date" className={inputCls}>
            <option value="today">Today</option>
            <option value="custom">Custom dates</option>
            <option value="all">All dates</option>
          </SearchSelect>
          {range === 'custom' && (
            <>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={`${inputCls} pl-9`} />
              </div>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={`${inputCls} pl-9`} />
              </div>
            </>
          )}
          <SearchSelect value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} aria-label="Status" className={inputCls}>
            <option value="all">All</option>
            <option value="completed">Completed</option>
            <option value="not_completed">Not completed</option>
            <option value="held">Held</option>
            <option value="cleared">Cleared</option>
            <option value="failed">Failed</option>
          </SearchSelect>
          {counters.length > 0 && (
            <SearchSelect value={counter} onChange={(e) => setCounter(e.target.value)} aria-label="Counter" className={inputCls}>
              <option value="">All counters</option>
              {counters.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </SearchSelect>
          )}
          {filtersOn && (
            <button
              onClick={() => {
                setSearch('');
                setStatus('all');
                setCounter('');
                pickRange('today');
              }}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100"
            >
              <X className="h-4 w-4" /> Reset
            </button>
          )}
        </div>
      </div>

      <div className="text-sm text-gray-600">
        <strong className="text-gray-900">{summary.total}</strong> carts · <span className="text-emerald-700">{summary.completed} completed</span> ·{' '}
        <span className="text-amber-700">{summary.notCompleted} not completed</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3 font-medium">Started</th>
                <th className="px-4 py-3 font-medium">Cashier</th>
                <th className="px-4 py-3 font-medium">Counter</th>
                <th className="px-4 py-3 font-medium text-right">Items</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Events</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    Loading logs...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-red-600">
                    {error}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <ScrollText className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                    <div className="text-gray-500 text-sm">No logs for these filters</div>
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const open = openId === r.cartId;
                  const detail = details[r.cartId];
                  return (
                    <Fragment key={r._id || r.cartId}>
                      <tr className={`cursor-pointer hover:bg-gray-50 ${open ? 'bg-gray-50' : ''}`} onClick={() => toggle(r)}>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            {open ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                            <span>
                              <span className="text-gray-900">{timeOf(r.startedAt)}</span>
                              <span className="block text-[11px] text-gray-400">{new Date(r.startedAt).toLocaleDateString('en-GB')}</span>
                            </span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{r.userName || '—'}</td>
                        <td className="px-4 py-3 text-gray-700">{r.counterName || r.deviceName || '—'}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{r.itemCount ?? 0}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">{formatRs(r.total)}</td>
                        <td className="px-4 py-3">
                          <CartStatusBadge cart={r} />
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">{r.eventCount ?? '—'}</td>
                      </tr>
                      {open && (
                        <tr className="bg-gray-50/60">
                          <td colSpan={7} className="px-6 py-3">
                            {detail === 'loading' || !detail ? (
                              <div className="flex items-center gap-2 text-sm text-gray-500">
                                <Loader2 className="h-4 w-4 animate-spin" /> Loading events…
                              </div>
                            ) : detail === 'error' ? (
                              <div className="text-sm text-red-600">Could not load the events. Click the row again to retry.</div>
                            ) : (
                              <ActivityTimeline events={detail.events || []} />
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={pg.page}
          pages={pg.pages}
          total={pg.total}
          limit={pg.pageSize}
          onPageChange={pg.setPage}
          onLimitChange={pg.setPageSize}
          label="carts"
        />
      </div>
    </div>
  );
}
