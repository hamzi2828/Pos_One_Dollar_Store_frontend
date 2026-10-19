'use client';

// Till & cash closing.
//   "My till"     (`till`):        open with a float, blind close, my history (no expected amounts).
//   "Verify cash" (`till_verify`): closed tills with counted vs expected, variance, bills, verify / dispute.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Banknote, Lock, LockOpen, RefreshCw, Search, ShieldCheck, AlertCircle, Wallet } from 'lucide-react';
import { storeApi, apiErrorMessage, formatRs, formatDate, type PageMeta } from '@/lib/storeApi';
import { useAccess } from '@/context/AccessContext';
import { HelpBox, LoadingCard, NoAccessCard, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import {
  tillApi,
  OpenTillModal,
  CloseTillModal,
  formatTime,
  type MyTill,
  type TillSession,
} from '@/components/store/TillStatusBar';
import { SessionDetailModal, StatusBadge, varianceClass, varianceLabel } from './components/tillUi';
import { SearchSelect } from '@/components/ui/SearchSelect';

type Tab = 'mine' | 'verify';

export default function TillPage() {
  const { can, loaded } = useAccess();
  const canTill = can('till', 'view');
  const canVerify = can('till_verify', 'view');
  const [tab, setTab] = useState<Tab>('mine');
  const [linkedSession, setLinkedSession] = useState<string | null>(null);

  // Notification links: /admin/till?session=<id>
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('session');
    if (id && canVerify) {
      setTab('verify');
      setLinkedSession(id);
    } else if (!canTill && canVerify) setTab('verify');
  }, [canTill, canVerify]);

  if (!loaded) return <div className="max-w-7xl mx-auto px-4 py-6"><LoadingCard text="Loading…" /></div>;
  if (!canTill && !canVerify) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <NoAccessCard />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Till &amp; Cash Closing</h1>
          <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-500">
            Open the till with change money, count the cash at the end of the shift, and the admin verifies it.
          </p>
        </div>

        {canTill && canVerify && (
          <div className="mb-4 inline-flex bg-white border border-gray-200 rounded-lg p-1">
            {(['mine', 'verify'] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`px-3 sm:px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  tab === t ? 'bg-honey-500 text-gray-900' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {t === 'mine' ? 'My till' : 'Verify cash'}
              </button>
            ))}
          </div>
        )}

        {tab === 'mine' && canTill ? <MyTillPanel /> : canVerify ? <VerifyPanel linkedSession={linkedSession} onLinkedDone={() => setLinkedSession(null)} /> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cashier: my till                                                    */
/* ------------------------------------------------------------------ */

function MyTillPanel() {
  const [status, setStatus] = useState<MyTill | null>(null);
  const [history, setHistory] = useState<TillSession[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<'open' | 'close' | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [s, h] = await Promise.all([tillApi.my(), storeApi.get<TillSession[]>('/till-sessions/my/history', { page, limit: 15 })]);
      setStatus(s.data);
      setHistory(h.data || []);
      setMeta(h.meta || null);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load your till.'));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !status) return <LoadingCard text="Loading your till…" />;
  if (error && !status) return <ErrorCard message={error} onRetry={load} />;
  if (!status) return null;
  const s = status.open ? status.session : null;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Current till */}
      <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
        {s ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center justify-center h-11 w-11 rounded-lg bg-green-50 text-green-600 flex-shrink-0">
                <LockOpen className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900">
                  Till open{s.counterName ? ` · ${s.counterName}` : ''}
                  {s.lateOpen && <span className="ml-2 text-xs font-medium text-amber-600">opened late</span>}
                </p>
                <p className="text-xs sm:text-sm text-gray-500">
                  {s.sessionNo} · since {formatTime(s.openedAt)} · float {formatRs(s.openingFloat?.total)}
                </p>
              </div>
            </div>
            {status.canClose && (
              <button type="button" onClick={() => setModal('close')} className={`${primaryBtn} sm:ml-auto`}>
                <Lock className="h-4 w-4" /> Close till &amp; count cash
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center justify-center h-11 w-11 rounded-lg bg-gray-100 text-gray-500 flex-shrink-0">
                <Lock className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900">{status.openElsewhere ? 'Your till is already open' : 'Till closed'}</p>
                <p className="text-xs sm:text-sm text-gray-500">
                  {status.required ? 'You must open your till before you can sell.' : 'Open a till to keep your cash separate from other cashiers.'}
                </p>
              </div>
            </div>
            {status.canOpen && !status.openElsewhere && (
              <button type="button" onClick={() => setModal('open')} className={`${primaryBtn} sm:ml-auto`}>
                <LockOpen className="h-4 w-4" /> Open till
              </button>
            )}
          </div>
        )}
      </div>

      <HelpBox>
        At the end of your shift, count <strong>all</strong> cash in the drawer note by note. You will not see the sales total —
        the admin compares your count with the system and verifies it.
      </HelpBox>

      {/* My history (blind) */}
      <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">My tills</h2>
          <button type="button" onClick={load} disabled={loading} className="text-gray-400 hover:text-gray-600 disabled:opacity-50" aria-label="Refresh">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {history.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-500">No tills yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {history.map((h) => (
              <div key={h._id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-sm">
                <div className="min-w-0 sm:w-56">
                  <p className="font-medium text-gray-900">{h.sessionNo}</p>
                  <p className="text-xs text-gray-500">{h.counterName || 'No counter'}</p>
                </div>
                <div className="text-xs text-gray-600 sm:flex-1">
                  {formatDate(h.openedAt, true)}
                  {h.closedAt ? ` → ${formatTime(h.closedAt)}` : ''}
                </div>
                <div className="text-xs text-gray-600 tabular-nums sm:w-48">
                  Float {formatRs(h.openingFloat?.total)}
                  {h.closingCount ? ` · counted ${formatRs(h.closingCount.total)}` : ''}
                </div>
                <div className="sm:w-48 flex flex-col items-start sm:items-end gap-0.5">
                  <StatusBadge status={h.status} cashierView />
                  {h.verifyNote && <span className="text-[11px] text-gray-500">{h.verifyNote}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
        <Pager meta={meta} page={page} onPage={setPage} />
      </div>

      {modal === 'open' && (
        <OpenTillModal
          status={status}
          onClose={() => setModal(null)}
          onOpened={() => {
            setModal(null);
            load();
          }}
        />
      )}
      {modal === 'close' && s && (
        <CloseTillModal
          session={s}
          denominations={status.denominations}
          onClose={() => setModal(null)}
          onClosed={() => {
            setModal(null);
            load();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Admin: verify cash closings                                         */
/* ------------------------------------------------------------------ */

interface Summary {
  sessions?: number;
  open?: number;
  toVerify?: number;
  disputed?: number;
  variance?: number;
  shortCount?: number;
}

interface CounterOption {
  _id: string;
  name: string;
  code: string;
}

const STATUS_FILTERS = [
  { value: 'closed', label: 'To verify' },
  { value: 'disputed', label: 'Disputed' },
  { value: 'open', label: 'Open now' },
  { value: 'verified', label: 'Verified' },
  { value: '', label: 'All' },
];

function VerifyPanel({ linkedSession, onLinkedDone }: { linkedSession: string | null; onLinkedDone: () => void }) {
  const [rows, setRows] = useState<TillSession[]>([]);
  const [meta, setMeta] = useState<(PageMeta & { summary?: Summary }) | null>(null);
  const [counters, setCounters] = useState<CounterOption[]>([]);
  const [status, setStatus] = useState('closed');
  const [counter, setCounter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const reqRef = useRef(0);

  useEffect(() => {
    if (linkedSession) {
      setDetailId(linkedSession);
      onLinkedDone();
    }
  }, [linkedSession, onLinkedDone]);

  useEffect(() => {
    storeApi
      .get<CounterOption[]>('/counters', { limit: 200 })
      .then((r) => setCounters(r.data || []))
      .catch(() => setCounters([]));
  }, []);

  // Debounce the search box.
  useEffect(() => {
    const t = window.setTimeout(() => setQuery(search.trim()), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    const id = ++reqRef.current;
    try {
      setLoading(true);
      setError(null);
      const res = await storeApi.get<TillSession[]>('/till-sessions', { status, counter, from, to, search: query, page, limit: 25 });
      if (id !== reqRef.current) return; // a newer request is running
      setRows(res.data || []);
      setMeta((res.meta as PageMeta & { summary?: Summary }) || null);
    } catch (e) {
      if (id === reqRef.current) setError(apiErrorMessage(e, 'Could not load tills.'));
    } finally {
      if (id === reqRef.current) setLoading(false);
    }
  }, [status, counter, from, to, query, page]);

  useEffect(() => {
    load();
  }, [load]);

  const resetPage = <T,>(setter: (v: T) => void) => (v: T) => {
    setPage(1);
    setter(v);
  };
  const sum = meta?.summary || {};

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 grid grid-cols-2 md:grid-cols-6 gap-2 sm:gap-3">
        <SearchSelect value={status} onChange={(e) => resetPage(setStatus)(e.target.value)} className={inputClass} aria-label="Status">
          {STATUS_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </SearchSelect>
        <SearchSelect value={counter} onChange={(e) => resetPage(setCounter)(e.target.value)} className={inputClass} aria-label="Counter">
          <option value="">All counters</option>
          {counters.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </SearchSelect>
        <input type="date" value={from} onChange={(e) => resetPage(setFrom)(e.target.value)} className={inputClass} aria-label="From" />
        <input type="date" value={to} onChange={(e) => resetPage(setTo)(e.target.value)} className={inputClass} aria-label="To" />
        <div className="relative col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Cashier, counter or till no…"
            className={`${inputClass} pl-9`}
          />
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <Tile icon={<ShieldCheck className="h-4 w-4 text-amber-600" />} label="To verify" value={String(sum.toVerify ?? 0)} />
        <Tile icon={<AlertCircle className="h-4 w-4 text-red-600" />} label="Disputed" value={String(sum.disputed ?? 0)} />
        <Tile icon={<Banknote className="h-4 w-4 text-gray-600" />} label="Short tills" value={String(sum.shortCount ?? 0)} />
        <Tile
          icon={<Wallet className="h-4 w-4 text-gray-600" />}
          label="Total variance"
          value={varianceLabel(sum.variance ?? 0)}
          valueClass={varianceClass(sum.variance ?? 0)}
        />
      </div>

      {/* List */}
      {loading && rows.length === 0 ? (
        <LoadingCard text="Loading tills…" />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 text-center py-12 px-4">
          <ShieldCheck className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">{status === 'closed' ? 'Nothing to verify. All caught up.' : 'No tills match these filters.'}</p>
        </div>
      ) : (
        <div className={`bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 overflow-hidden ${loading ? 'opacity-60' : ''}`}>
          <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2 bg-gray-50 text-[11px] font-semibold uppercase text-gray-500">
            <span className="col-span-3">Till</span>
            <span className="col-span-3">Opened / closed</span>
            <span className="col-span-2 text-right">Expected</span>
            <span className="col-span-2 text-right">Counted</span>
            <span className="col-span-2 text-right">Variance</span>
          </div>
          <div className="divide-y divide-gray-100">
            {rows.map((r) => (
              <button
                key={r._id}
                type="button"
                onClick={() => setDetailId(r._id)}
                className="w-full text-left grid grid-cols-2 md:grid-cols-12 gap-x-3 gap-y-1 px-4 py-3 hover:bg-gray-50 text-sm"
              >
                <span className="col-span-2 md:col-span-3 min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 truncate">{r.cashierName}</span>
                    <StatusBadge status={r.status} />
                  </span>
                  <span className="block text-xs text-gray-500 truncate">
                    {r.sessionNo} · {r.counterName || 'No counter'}
                  </span>
                </span>
                <span className="col-span-2 md:col-span-3 text-xs text-gray-600">
                  {formatDate(r.openedAt, true)}
                  {r.closedAt ? ` → ${formatTime(r.closedAt)}` : ''}
                  {(r.lateOpen || r.lateClose) && (
                    <span className="block text-amber-600">{[r.lateOpen && 'late open', r.lateClose && 'late close'].filter(Boolean).join(' · ')}</span>
                  )}
                </span>
                <span className="md:col-span-2 md:text-right tabular-nums text-gray-700">
                  <span className="md:hidden text-[11px] text-gray-400 mr-1">Expected</span>
                  {r.expected ? formatRs(r.expected.expectedCash) : '—'}
                </span>
                <span className="md:col-span-2 text-right tabular-nums text-gray-700">
                  <span className="md:hidden text-[11px] text-gray-400 mr-1">Counted</span>
                  {r.closingCount && r.status !== 'open' ? formatRs(r.closingCount.total) : '—'}
                </span>
                <span className={`col-span-2 md:col-span-2 text-right font-semibold ${varianceClass(r.variance)}`}>
                  {r.status === 'open' ? <span className="text-xs font-normal text-gray-400">still open</span> : varianceLabel(r.variance)}
                </span>
              </button>
            ))}
          </div>
          <Pager meta={meta} page={page} onPage={setPage} />
        </div>
      )}

      {detailId && <SessionDetailModal id={detailId} onClose={() => setDetailId(null)} onChanged={load} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Tile({ icon, label, value, valueClass }: { icon: React.ReactNode; label: string; value: string; valueClass?: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-gray-500">
        {icon}
        {label}
      </div>
      <p className={`mt-1 text-base sm:text-lg font-semibold tabular-nums ${valueClass || 'text-gray-900'}`}>{value}</p>
    </div>
  );
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-red-200 text-center py-10 px-4">
      <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
      <p className="text-sm text-red-700 mb-4">{message}</p>
      <button type="button" onClick={onRetry} className={primaryBtn}>
        Try again
      </button>
    </div>
  );
}

function Pager({ meta, page, onPage }: { meta: PageMeta | null; page: number; onPage: (p: number) => void }) {
  if (!meta || meta.pages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 text-xs text-gray-600">
      <span>
        Page {page} of {meta.pages} · {meta.total} tills
      </span>
      <span className="flex gap-2">
        <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} className={`${secondaryBtn} !px-3 !py-1`}>
          Previous
        </button>
        <button type="button" onClick={() => onPage(page + 1)} disabled={page >= meta.pages} className={`${secondaryBtn} !px-3 !py-1`}>
          {page >= meta.pages ? 'Last' : 'Next'}
        </button>
      </span>
    </div>
  );
}

