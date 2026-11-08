'use client';

// Purchasing log — every change anyone made in Purchasing & Vendors
// (trips, receive goods, vendors, payments, consignment, returns, sticker prints).
// URL ?purchaseOrder= / ?grn= / ?vendor= shows the whole history of that one trip / GRN / vendor.
import { Suspense, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Calendar, ChevronDown, ChevronRight, Loader2, RefreshCw, ScrollText, Search, X } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { storeApi, apiErrorMessage, type ApiResponse } from '@/lib/storeApi';
import TablePagination from '@/components/admin/TablePagination';
import { useServerPagination } from '@/helper/useServerPagination';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { LoadingCard, Modal, NoAccessCard, Toggle, secondaryBtn } from '@/components/admin/FormBits';

// ---------- types (match GET /api/purchasing-log) ----------

type Area = 'trips' | 'receiving' | 'vendors' | 'payments' | 'consignment' | 'returns' | 'labels';

interface LogRefs {
  purchaseOrder?: string;
  poNumber?: string;
  grn?: string;
  grnNumber?: string;
  bill?: string;
  billNo?: string;
  vendor?: string;
  vendorName?: string;
  product?: string;
  productName?: string;
  entryNo?: string | number;
  charge?: string;
  chargeType?: string;
  payment?: string;
  paymentNo?: string;
  vendorReturn?: string;
  returnNo?: string;
  consignment?: string;
  consignmentNo?: string;
  settlement?: string;
  settlementNo?: string;
  ledgerEntry?: string;
}

interface LogChange {
  field: string;
  from: unknown;
  to: unknown;
}

interface LogRow {
  _id: string;
  at: string;
  user: string | null;
  userName?: string;
  roleName?: string;
  area: Area | string;
  action: string;
  summary: string;
  refs?: LogRefs;
  changes?: LogChange[];
  ok: boolean;
  statusCode?: number;
  error?: string | null;
  method?: string;
  path?: string;
  ip?: string;
  device?: string;
  request?: unknown;
}

type ListResponse = ApiResponse<LogRow[]> & {
  pagination?: { page: number; limit: number; total: number; totalPages: number };
  users?: { _id: string; name: string }[];
};

// ---------- helpers ----------

const TZ = 'Asia/Karachi';

/** Shop day (Pakistan) n days ago, YYYY-MM-DD. */
const pkDay = (daysAgo = 0) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(Date.now() - daysAgo * 86400000));

const pkDate = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso));

const pkTime = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).format(
    new Date(iso),
  );

const AREAS: { key: Area | ''; label: string; cls: string }[] = [
  { key: '', label: 'All', cls: '' },
  { key: 'trips', label: 'Trips', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  { key: 'receiving', label: 'Receive Goods', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { key: 'vendors', label: 'Vendors', cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  { key: 'payments', label: 'Payments', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  { key: 'consignment', label: 'Consignment', cls: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { key: 'returns', label: 'Returns', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  { key: 'labels', label: 'Labels', cls: 'bg-gray-100 text-gray-700 border-gray-200' },
];

function AreaBadge({ area }: { area: string }) {
  const a = AREAS.find((x) => x.key === area);
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium whitespace-nowrap ${
        a?.cls || 'bg-gray-100 text-gray-700 border-gray-200'
      }`}
    >
      {a?.label || area || '—'}
    </span>
  );
}

function StatusBadge({ row }: { row: LogRow }) {
  return row.ok ? (
    <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-50 text-green-700 border border-green-200">OK</span>
  ) : (
    <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-50 text-red-700 border border-red-200 whitespace-nowrap">
      Failed{row.statusCode ? ` ${row.statusCode}` : ''}
    </span>
  );
}

/** Before/after value as plain text. */
const showValue = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return v.toLocaleString('en-PK', { maximumFractionDigits: 2 });
  if (typeof v === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v) && !Number.isNaN(new Date(v).getTime())) {
      return `${pkDate(v)}, ${pkTime(v)}`;
    }
    return v;
  }
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
};

/** "receiving.entry_add" -> "receiving · entry add" */
const actionLabel = (a: string) => (a || '').replace(/[._]+/g, ' ').trim();

type Range = 'today' | 'yesterday' | 'week' | 'custom' | 'all';
type Scope = { key: 'purchaseOrder' | 'grn' | 'vendor'; id: string } | null;

const inputCls =
  'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-honey-500 focus:border-honey-500';

export default function PurchasingLogPage() {
  return (
    <Suspense fallback={<LoadingCard text="Loading…" />}>
      <PurchasingLog />
    </Suspense>
  );
}

function PurchasingLog() {
  const { can, loaded } = useAccess();
  const canView = can('purchasing_log', 'view');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // One trip / GRN / vendor from the URL.
  const scope: Scope = searchParams.get('purchaseOrder')
    ? { key: 'purchaseOrder', id: searchParams.get('purchaseOrder') as string }
    : searchParams.get('grn')
      ? { key: 'grn', id: searchParams.get('grn') as string }
      : searchParams.get('vendor')
        ? { key: 'vendor', id: searchParams.get('vendor') as string }
        : null;
  const scopeKey = scope ? `${scope.key}:${scope.id}` : '';

  // With a trip / GRN / vendor: whole history. Otherwise: today.
  const [range, setRange] = useState<Range>(() => (scope ? 'all' : 'today'));
  const [startDate, setStartDate] = useState(() => (scope ? '' : pkDay()));
  const [endDate, setEndDate] = useState(() => (scope ? '' : pkDay()));
  const [user, setUser] = useState('');
  const [users, setUsers] = useState<{ _id: string; name: string }[]>([]);
  const [area, setArea] = useState<Area | ''>('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [onlyFailed, setOnlyFailed] = useState(false);

  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [scopeLabel, setScopeLabel] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const pg = useServerPagination(50);

  const pickRange = (r: Range) => {
    setRange(r);
    if (r === 'today') {
      setStartDate(pkDay());
      setEndDate(pkDay());
    } else if (r === 'yesterday') {
      setStartDate(pkDay(1));
      setEndDate(pkDay(1));
    } else if (r === 'week') {
      setStartDate(pkDay(6));
      setEndDate(pkDay());
    } else if (r === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  // Trip / GRN / vendor changed in the URL: show its whole history (or back to today when removed).
  useEffect(() => {
    setScopeLabel('');
    pickRange(scopeKey ? 'all' : 'today');
  }, [scopeKey]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    pg.resetToFirstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, user, area, debouncedSearch, onlyFailed, scopeKey]);

  useEffect(() => {
    if (!canView) return;
    let stop = false;
    setLoading(true);
    setError(null);
    storeApi
      .get<LogRow[]>('/purchasing-log', {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        user: user || undefined,
        area: area || undefined,
        search: debouncedSearch || undefined,
        ok: onlyFailed ? 'false' : undefined,
        [scope?.key || '_']: scope?.id || undefined,
        page: pg.page,
        limit: pg.pageSize,
      })
      .then((raw) => {
        if (stop) return;
        const res = raw as ListResponse;
        const list = Array.isArray(res.data) ? res.data : [];
        setRows(list);
        pg.setTotal(res.pagination?.total ?? list.length);
        if (Array.isArray(res.users)) setUsers(res.users);
        // Chip label from the first row's refs.
        if (scope && list[0]?.refs) {
          const r = list[0].refs;
          const label =
            scope.key === 'purchaseOrder' ? r.poNumber && `Trip ${r.poNumber}` : scope.key === 'grn' ? r.grnNumber || (r.poNumber && `GRN of ${r.poNumber}`) : r.vendorName && `Vendor ${r.vendorName}`;
          if (label) setScopeLabel(label);
        }
      })
      .catch((err) => !stop && setError(apiErrorMessage(err, 'Could not load the purchasing log')))
      .finally(() => !stop && setLoading(false));
    return () => {
      stop = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, startDate, endDate, user, area, debouncedSearch, onlyFailed, scopeKey, pg.page, pg.pageSize, reloadTick]);

  const clearScope = () => {
    const p = new URLSearchParams(searchParams.toString());
    p.delete('purchaseOrder');
    p.delete('grn');
    p.delete('vendor');
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  if (!loaded) return <LoadingCard text="Loading…" />;
  if (!canView) return <NoAccessCard />;

  const defaultRange: Range = scope ? 'all' : 'today';
  const filtersOn = search || user || area || onlyFailed || range !== defaultRange;
  const fallbackLabel = scope?.key === 'purchaseOrder' ? 'This trip' : scope?.key === 'grn' ? 'This GRN' : 'This vendor';

  return (
    <div className="space-y-3 sm:space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <ScrollText className="h-6 w-6 text-honey-700" />
            Purchasing log
          </h1>
          <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-500">
            Who did what in trips, receive goods, vendors, payments, consignment, returns and sticker prints.
          </p>
        </div>
        <button onClick={() => setReloadTick((n) => n + 1)} disabled={loading} className={`${secondaryBtn} self-start sm:self-auto`}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Area tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {AREAS.map((a) => (
          <button
            key={a.key || 'all'}
            onClick={() => setArea(a.key)}
            className={`px-3 py-1.5 text-sm rounded-full border whitespace-nowrap transition-colors ${
              area === a.key ? 'bg-honey-500 border-honey-500 text-gray-900 font-semibold' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 space-y-3">
        {scope && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-gray-500">Showing only:</span>
            <span className="inline-flex items-center gap-1.5 pl-3 pr-1 py-1 rounded-full bg-honey-50 border border-honey-200 text-gray-900">
              {scopeLabel || fallbackLabel}
              <button onClick={clearScope} className="p-0.5 rounded-full hover:bg-honey-100" aria-label="Remove filter">
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="PO / GRN / vendor / product…"
              className={`${inputCls} pl-9`}
            />
          </div>
          <SearchSelect value={range} onChange={(e) => pickRange(e.target.value as Range)} aria-label="Date" className={inputCls}>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="week">Last 7 days</option>
            <option value="custom">Custom dates</option>
            <option value="all">All dates</option>
          </SearchSelect>
          <SearchSelect value={user} onChange={(e) => setUser(e.target.value)} aria-label="User" className={inputCls}>
            <option value="">All users</option>
            {users.map((u) => (
              <option key={u._id} value={u._id}>
                {u.name}
              </option>
            ))}
          </SearchSelect>
          <div className="flex items-center gap-3 justify-between">
            <Toggle checked={onlyFailed} onChange={setOnlyFailed} label="Only failed" />
            {filtersOn && (
              <button
                onClick={() => {
                  setSearch('');
                  setUser('');
                  setArea('');
                  setOnlyFailed(false);
                  pickRange(defaultRange);
                }}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100"
              >
                <X className="h-4 w-4" /> Reset
              </button>
            )}
          </div>
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
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading && rows.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-400 text-sm">Loading log…</div>
        ) : error ? (
          <div className="px-4 py-12 text-center text-red-600 text-sm">{error}</div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <ScrollText className="h-10 w-10 text-gray-300 mx-auto mb-2" />
            <div className="text-gray-500 text-sm">Nothing found for these filters</div>
          </div>
        ) : (
          <>
            {/* Phone: cards */}
            <div className={`sm:hidden divide-y divide-gray-100 ${loading ? 'opacity-60' : ''}`}>
              {rows.map((r) => (
                <button key={r._id} onClick={() => setOpenId(r._id)} className="w-full text-left px-3 py-3 hover:bg-gray-50">
                  <div className="flex items-center justify-between gap-2">
                    <AreaBadge area={r.area} />
                    <StatusBadge row={r} />
                  </div>
                  <div className="mt-1.5 text-sm text-gray-900">{r.summary || actionLabel(r.action)}</div>
                  <div className="mt-1 text-[11px] text-gray-500">
                    {pkDate(r.at)} · {pkTime(r.at)} · {r.userName || '—'}
                    {r.roleName ? ` (${r.roleName})` : ''}
                  </div>
                </button>
              ))}
            </div>

            {/* Tablet / desktop: table */}
            <div className={`hidden sm:block overflow-x-auto ${loading ? 'opacity-60' : ''}`}>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3 font-medium">Time</th>
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Area</th>
                    <th className="px-4 py-3 font-medium">Summary</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((r) => (
                    <tr key={r._id} className="cursor-pointer hover:bg-gray-50" onClick={() => setOpenId(r._id)}>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-gray-900 tabular-nums">{pkTime(r.at)}</span>
                        <span className="block text-[11px] text-gray-400">{pkDate(r.at)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gray-800">{r.userName || '—'}</span>
                        {r.roleName && <span className="block text-[11px] text-gray-400">{r.roleName}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <AreaBadge area={r.area} />
                      </td>
                      <td className="px-4 py-3 text-gray-800 min-w-[16rem]">
                        {r.summary || actionLabel(r.action)}
                        {!!r.changes?.length && (
                          <span className="ml-1.5 text-[11px] text-gray-400">
                            ({r.changes.length} change{r.changes.length === 1 ? '' : 's'})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge row={r} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <TablePagination
          page={pg.page}
          pages={pg.pages}
          total={pg.total}
          limit={pg.pageSize}
          onPageChange={pg.setPage}
          onLimitChange={pg.setPageSize}
          pageSizeOptions={[25, 50, 100, 200]}
          label="entries"
          loading={loading}
        />
      </div>

      {openId && <LogDetail id={openId} preview={rows.find((r) => r._id === openId)} onClose={() => setOpenId(null)} />}
    </div>
  );
}

// ---------- detail ----------

function LogDetail({ id, preview, onClose }: { id: string; preview?: LogRow; onClose: () => void }) {
  const [row, setRow] = useState<LogRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    let stop = false;
    storeApi
      .get<LogRow>(`/purchasing-log/${id}`)
      .then((res) => !stop && setRow(res.data))
      .catch((err) => !stop && setError(apiErrorMessage(err, 'Could not load this entry')));
    return () => {
      stop = true;
    };
  }, [id]);

  // Show the list row at once; the full row (with request) fills in.
  const r = row || preview;

  return (
    <Modal title={r?.summary || 'Log entry'} subtitle={r ? `${pkDate(r.at)} · ${pkTime(r.at)}` : undefined} icon={<ScrollText className="h-5 w-5" />} onClose={onClose} wide>
      {!r ? (
        error ? (
          <div className="text-sm text-red-600">{error}</div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        )
      ) : (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <AreaBadge area={r.area} />
            <StatusBadge row={r} />
            <span className="text-xs text-gray-400">{actionLabel(r.action)}</span>
          </div>

          {!r.ok && r.error && (
            <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{r.error}</div>
          )}

          {/* Who / when */}
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            <Info label="User">
              {r.userName || '—'}
              {r.roleName && <span className="text-gray-400"> · {r.roleName}</span>}
            </Info>
            <Info label="Time">
              {pkDate(r.at)}, {pkTime(r.at)}
            </Info>
            <Info label="IP">{r.ip || '—'}</Info>
            <Info label="Device">{r.device || '—'}</Info>
          </dl>

          <RefsBlock refs={r.refs} />

          {/* Changes */}
          {!!r.changes?.length && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Changes</h3>
              <div className="border border-gray-200 rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs text-gray-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">Field</th>
                      <th className="px-3 py-2 font-medium">Before → After</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {r.changes.map((c, i) => (
                      <tr key={`${c.field}-${i}`}>
                        <td className="px-3 py-2 text-gray-700 whitespace-nowrap align-top">{c.field}</td>
                        <td className="px-3 py-2">
                          <span className="inline-flex flex-wrap items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-700 line-through break-all">{showValue(c.from)}</span>
                            <span className="text-gray-400">→</span>
                            <span className="px-1.5 py-0.5 rounded bg-green-50 text-green-800 font-medium break-all">{showValue(c.to)}</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tech details */}
          <div className="text-xs text-gray-500">
            <span className="font-mono">
              {r.method || '—'} {r.path || ''}
            </span>
            {r.statusCode ? <span> · status {r.statusCode}</span> : null}
          </div>

          <div>
            <button onClick={() => setShowRaw((v) => !v)} className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900">
              {showRaw ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              Raw request
            </button>
            {showRaw &&
              (row ? (
                <pre className="mt-1.5 max-h-72 overflow-auto rounded-lg bg-gray-900 text-gray-100 text-[11px] p-3 whitespace-pre-wrap break-all">
                  {row.request == null ? 'No request body' : JSON.stringify(row.request, null, 2)}
                </pre>
              ) : (
                <div className="mt-1.5 text-xs text-gray-400">{error || 'Loading…'}</div>
              ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="text-gray-800 break-words">{children}</dd>
    </div>
  );
}

function RefsBlock({ refs }: { refs?: LogRefs }) {
  if (!refs) return null;
  const linkCls = 'text-honey-700 underline hover:text-honey-800';
  const items: { label: string; node: ReactNode }[] = [];

  if (refs.purchaseOrder || refs.poNumber)
    items.push({
      label: 'Trip',
      node: refs.purchaseOrder ? (
        <Link href={`/admin/purchasing/orders/${refs.purchaseOrder}`} className={linkCls}>
          {refs.poNumber || 'Open trip'}
        </Link>
      ) : (
        refs.poNumber
      ),
    });
  if (refs.grn || refs.grnNumber)
    items.push({
      label: 'GRN',
      node: refs.grn ? (
        <Link href={`/admin/purchasing/receiving/${refs.grn}`} className={linkCls}>
          {refs.grnNumber || 'Open GRN'}
        </Link>
      ) : (
        refs.grnNumber
      ),
    });
  if (refs.vendor || refs.vendorName)
    items.push({
      label: 'Vendor',
      node: refs.vendor ? (
        <Link href={`/admin/vendors/${refs.vendor}`} className={linkCls}>
          {refs.vendorName || 'Open vendor'}
        </Link>
      ) : (
        refs.vendorName
      ),
    });
  const plain: [string, unknown][] = [
    ['Bill no', refs.billNo],
    ['Product', refs.productName],
    ['Entry #', refs.entryNo],
    ['Charge', refs.chargeType],
    ['Payment no', refs.paymentNo],
    ['Return no', refs.returnNo],
    ['Consignment no', refs.consignmentNo],
    ['Settlement no', refs.settlementNo],
  ];
  for (const [label, v] of plain) if (v !== undefined && v !== null && v !== '') items.push({ label, node: String(v) });

  if (!items.length) return null;
  return (
    <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 p-3 rounded-lg bg-gray-50 border border-gray-100">
      {items.map((it) => (
        <Info key={it.label} label={it.label}>
          {it.node}
        </Info>
      ))}
    </dl>
  );
}
