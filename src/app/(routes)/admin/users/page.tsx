'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Users, Search, X, Trash2, Shield, UserCheck, UserX, Loader2, AlertCircle,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronUp, ChevronDown,
  Eye, History, ArrowUpDown,
} from 'lucide-react';
import { userService } from './service/userService';
import type { User, UserRole, RawUser } from './types';
import UserActivityModal from './components/UserActivityModal';
import UserOrdersModal from './components/UserOrdersModal';
import { getPOSOrders } from '../pos/services/posOrderService';
import type { POSOrder } from '../pos/types';

interface UserOrderStats { count: number; total: number; }

type SortKey = 'name' | 'status' | 'orders' | 'spent' | 'lastLogin' | 'createdAt';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const STATS_CACHE_KEY = 'admin_users_orderStats_v1';
const STATS_CACHE_TTL_MS = 60_000; // 60s — fresh enough for an admin view, fast on revisit
const PREFS_KEY = 'admin_users_prefs_v1';

interface CachedStats { ts: number; map: Record<string, UserOrderStats>; }

interface Prefs { pageSize: number; sortKey: SortKey; sortDir: SortDir; }
const DEFAULT_PREFS: Prefs = { pageSize: 25, sortKey: 'createdAt', sortDir: 'desc' };

function loadPrefs(): Prefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PREFS, ...parsed };
  } catch { return DEFAULT_PREFS; }
}

function savePrefs(p: Prefs) {
  try { window.localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch {}
}

// Lightweight debounced value hook — keeps filtering off the keystroke path.
function useDebouncedValue<T>(value: T, delay = 200): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

const formatLastLogin = (iso?: string | null): string => {
  if (!iso) return 'Never';
  const last = new Date(iso).getTime();
  if (Number.isNaN(last)) return 'Invalid';
  const diff = Date.now() - last;
  const mins = Math.floor(diff / 60_000);
  const hrs = Math.floor(diff / 3_600_000);
  const days = Math.floor(hrs / 24);
  if (hrs < 1) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
};

// Build the visible page-number window with leading/trailing ellipsis.
function buildPageWindow(current: number, total: number, span = 1): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | 'ellipsis')[] = [1];
  const start = Math.max(2, current - span);
  const end = Math.min(total - 1, current + span);
  if (start > 2) out.push('ellipsis');
  for (let i = start; i <= end; i++) out.push(i);
  if (end < total - 1) out.push('ellipsis');
  out.push(total);
  return out;
}

// Sortable header cell. Toggles direction when re-clicked.
const SortHeader: React.FC<{
  label: string;
  field: SortKey;
  current: SortKey;
  dir: SortDir;
  onSort: (field: SortKey) => void;
  align?: 'left' | 'right';
  className?: string;
}> = ({ label, field, current, dir, onSort, align = 'left', className = '' }) => {
  const active = current === field;
  return (
    <th className={`px-4 py-3 font-medium text-gray-600 text-xs ${align === 'right' ? 'text-right' : 'text-left'} ${className}`}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`inline-flex items-center gap-1 hover:text-gray-900 transition-colors ${active ? 'text-gray-900' : ''} ${align === 'right' ? 'flex-row-reverse' : ''}`}
        aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <span>{label}</span>
        {active
          ? (dir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)
          : <ArrowUpDown className="h-3 w-3 opacity-40" />}
      </button>
    </th>
  );
};

const UsersPage = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderStats, setOrderStats] = useState<Record<string, UserOrderStats>>({});
  const [statsRefreshing, setStatsRefreshing] = useState(false);

  // Filters / search
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 200);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Sort + pagination prefs (persisted)
  const initialPrefs = useRef<Prefs>(loadPrefs());
  const [sortKey, setSortKey] = useState<SortKey>(initialPrefs.current.sortKey);
  const [sortDir, setSortDir] = useState<SortDir>(initialPrefs.current.sortDir);
  const [pageSize, setPageSize] = useState<number>(initialPrefs.current.pageSize);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => { savePrefs({ sortKey, sortDir, pageSize }); }, [sortKey, sortDir, pageSize]);

  // Modals
  const [activityUserId, setActivityUserId] = useState<string | null>(null);
  const [activityUserName, setActivityUserName] = useState('');
  const [ordersUser, setOrdersUser] = useState<{ id: string; name: string; email: string } | null>(null);

  // ---- Fetch users ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await userService.getUsers();
        const typed: User[] = (Array.isArray(data) ? data : []).map((u: RawUser) => {
          const first = typeof u.firstName === 'string' ? u.firstName : '';
          const last = typeof u.lastName === 'string' ? u.lastName : '';
          const derivedName = `${first} ${last}`.trim();
          const name = String((u.name ?? derivedName) || '').trim();
          let lastLogin: string | null = null;
          if (u.lastLogin) {
            const d = u.lastLogin instanceof Date ? u.lastLogin : new Date(u.lastLogin);
            lastLogin = isNaN(d.getTime()) ? null : d.toISOString();
          }
          return {
            _id: String(u._id),
            name,
            email: String(u.email ?? ''),
            role: (u.role as UserRole) ?? 'user',
            isActive: typeof u.isActive === 'boolean' ? u.isActive : true,
            lastLogin,
            createdAt: String(u.createdAt ?? new Date().toISOString()),
            updatedAt: String(u.updatedAt ?? new Date().toISOString()),
          };
        });
        if (!cancelled) setUsers(typed);
      } catch (e) {
        console.error(e);
        if (!cancelled) setError('Failed to fetch users. Please try again later.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ---- Fetch order stats with sessionStorage cache (stale-while-revalidate) ----
  const fetchOrderStats = useCallback(async (silent = false) => {
    if (!silent) setStatsRefreshing(true);
    try {
      const PAGE = 200;
      const first = await getPOSOrders(undefined, PAGE, undefined, undefined, undefined, undefined, 1);
      const collected: POSOrder[] = [...(first.orders || [])];
      const totalPages = first.pages ?? 1;
      if (totalPages > 1) {
        const rest = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, i) =>
            getPOSOrders(undefined, PAGE, undefined, undefined, undefined, undefined, i + 2))
        );
        rest.forEach((r) => collected.push(...(r.orders || [])));
      }
      const map: Record<string, UserOrderStats> = {};
      for (const o of collected) {
        const uid = o.customer?._id;
        if (!uid) continue;
        const c = map[uid] || { count: 0, total: 0 };
        c.count += 1;
        if (o.orderStatus !== 'cancelled' && o.orderStatus !== 'refunded') {
          c.total += Number(o.total) || 0;
        }
        map[uid] = c;
      }
      setOrderStats(map);
      try {
        const payload: CachedStats = { ts: Date.now(), map };
        sessionStorage.setItem(STATS_CACHE_KEY, JSON.stringify(payload));
      } catch {}
    } catch (e) {
      console.error('Failed to load order stats:', e);
    } finally {
      setStatsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // Hydrate from cache instantly so the columns aren't blank.
    let cachedFresh = false;
    try {
      const raw = sessionStorage.getItem(STATS_CACHE_KEY);
      if (raw) {
        const parsed: CachedStats = JSON.parse(raw);
        if (parsed?.map) {
          setOrderStats(parsed.map);
          cachedFresh = Date.now() - (parsed.ts || 0) < STATS_CACHE_TTL_MS;
        }
      }
    } catch {}
    // Refresh in background unless cache is fresh.
    if (!cachedFresh) fetchOrderStats(false);
  }, [fetchOrderStats]);

  // ---- Indexes for O(1) lookups ----
  const userIndex = useMemo(() => {
    const m = new Map<string, User>();
    users.forEach((u) => m.set(u._id, u));
    return m;
  }, [users]);

  // ---- Derived: filter -> sort. Memoized on real deps only. ----
  const filteredSorted = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    const filtered = users.filter((u) => {
      if (term) {
        const name = u.name?.toLowerCase() || '';
        const email = u.email?.toLowerCase() || '';
        if (!name.includes(term) && !email.includes(term)) return false;
      }
      if (statusFilter !== 'all') {
        const wantActive = statusFilter === 'active';
        if (u.isActive !== wantActive) return false;
      }
      return true;
    });

    const dir = sortDir === 'asc' ? 1 : -1;
    const cmp = (a: User, b: User): number => {
      switch (sortKey) {
        case 'name':
          return (a.name || '').localeCompare(b.name || '') * dir;
        case 'status':
          return ((a.isActive ? 1 : 0) - (b.isActive ? 1 : 0)) * dir;
        case 'orders':
          return ((orderStats[a._id]?.count ?? 0) - (orderStats[b._id]?.count ?? 0)) * dir;
        case 'spent':
          return ((orderStats[a._id]?.total ?? 0) - (orderStats[b._id]?.total ?? 0)) * dir;
        case 'lastLogin': {
          const av = a.lastLogin ? new Date(a.lastLogin).getTime() : 0;
          const bv = b.lastLogin ? new Date(b.lastLogin).getTime() : 0;
          return (av - bv) * dir;
        }
        case 'createdAt':
        default: {
          const av = new Date(a.createdAt).getTime();
          const bv = new Date(b.createdAt).getTime();
          return (av - bv) * dir;
        }
      }
    };
    return [...filtered].sort(cmp);
  }, [users, debouncedSearch, statusFilter, sortKey, sortDir, orderStats]);

  // ---- Pagination ----
  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / pageSize));
  const clampedPage = Math.min(currentPage, totalPages);
  const firstIdx = (clampedPage - 1) * pageSize;
  const lastIdx = Math.min(firstIdx + pageSize, filteredSorted.length);
  const currentRows = useMemo(
    () => filteredSorted.slice(firstIdx, lastIdx),
    [filteredSorted, firstIdx, lastIdx]
  );

  // Reset page when filter inputs / sort / pageSize change so we don't land on an empty page.
  useEffect(() => { setCurrentPage(1); }, [debouncedSearch, statusFilter, sortKey, sortDir, pageSize]);
  // Clamp if currentPage drifts past totalPages after data shrinks.
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [totalPages, currentPage]);

  const pageWindow = useMemo(() => buildPageWindow(clampedPage, totalPages, 1), [clampedPage, totalPages]);

  // ---- Mutations ----
  const handleSort = (field: SortKey) => {
    if (field === sortKey) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(field); setSortDir(field === 'createdAt' || field === 'orders' || field === 'spent' || field === 'lastLogin' ? 'desc' : 'asc'); }
  };

  // Per-row lock: only the row being saved spins, and its buttons can't be
  // clicked again until the request settles.
  const rowLockRef = useRef<Set<string>>(new Set());
  const [rowBusy, setRowBusy] = useState<{ id: string; kind: 'status' | 'delete' } | null>(null);

  const handleStatusUpdate = async (userId: string, isActive: boolean) => {
    if (rowLockRef.current.has(userId)) return;
    rowLockRef.current.add(userId);
    setRowBusy({ id: userId, kind: 'status' });
    const prev = userIndex.get(userId)?.isActive;
    setUsers((all) => all.map((u) => (u._id === userId ? { ...u, isActive } : u)));
    try {
      await userService.updateUserStatus(userId, isActive);
    } catch (err) {
      console.error('Error updating user status:', err);
      setError('Failed to update user status');
      if (prev !== undefined) {
        setUsers((all) => all.map((u) => (u._id === userId ? { ...u, isActive: prev } : u)));
      }
    } finally {
      rowLockRef.current.delete(userId);
      setRowBusy((b) => (b?.id === userId ? null : b));
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (rowLockRef.current.has(userId)) return;
    if (typeof window !== 'undefined' && window.confirm('Are you sure you want to delete this user?')) {
      if (rowLockRef.current.has(userId)) return;
      rowLockRef.current.add(userId);
      setRowBusy({ id: userId, kind: 'delete' });
      const prev = users;
      setUsers((all) => all.filter((u) => u._id !== userId));
      try {
        await userService.deleteUser(userId);
      } catch (err) {
        console.error('Error deleting user:', err);
        setError('Failed to delete user');
        setUsers(prev);
      } finally {
        rowLockRef.current.delete(userId);
        setRowBusy((b) => (b?.id === userId ? null : b));
      }
    }
  };

  // ---- Stats counts (cheap; users fits in memory) ----
  const counts = useMemo(() => ({
    total: users.length,
    active: users.filter((u) => u.isActive).length,
    inactive: users.filter((u) => !u.isActive).length,
    admins: users.filter((u) => u.role === 'admin').length,
  }), [users]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-honey-700" />
              <p className="text-sm text-gray-500">Loading users...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="rounded-lg sm:rounded-xl bg-red-50 border border-red-200 p-3 sm:p-4 md:p-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
              <div>
                <h3 className="text-sm font-medium text-red-800">Error loading users</h3>
                <p className="mt-1 text-sm text-red-600">{error}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Header */}
        <div className="mb-4 sm:mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Customers</h1>
              <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-500">
                Customer and staff accounts, with their POS order history
                {statsRefreshing && (
                  <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-gray-400">
                    <Loader2 className="h-3 w-3 animate-spin" /> refreshing stats…
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 sm:gap-3 mb-4 sm:mb-6">
          <StatTile icon={<Users className="h-3 w-3 sm:h-4 sm:w-4 text-gray-600" />} bg="bg-gray-100" value={counts.total} label="Total" />
          <StatTile icon={<UserCheck className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />} bg="bg-green-50" value={counts.active} label="Active" />
          <StatTile icon={<Shield className="h-3 w-3 sm:h-4 sm:w-4 text-purple-600" />} bg="bg-purple-50" value={counts.admins} label="Admins" />
          <StatTile icon={<UserX className="h-3 w-3 sm:h-4 sm:w-4 text-gray-600" />} bg="bg-gray-100" value={counts.inactive} label="Inactive" />
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200">
          <div className="p-3 sm:p-6">
            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
              {/* Search (debounced) */}
              <div className="relative sm:col-span-2">
                <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full pl-8 sm:pl-10 pr-8 sm:pr-10 py-2 sm:py-2.5 text-xs sm:text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-honey-500/30 focus:border-honey-500 transition-all duration-200 placeholder:text-gray-400"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => setSearchInput('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-honey-500/30 focus:border-honey-500 transition-all duration-200"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {/* Customers Table */}
            {currentRows.length > 0 ? (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                {/* Mobile list */}
                <div className="sm:hidden divide-y divide-gray-100">
                  {currentRows.map((user) => {
                    const stats = orderStats[user._id];
                    return (
                      <div key={user._id} className="p-3 flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-gray-900 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-semibold text-white">{user.name?.charAt(0)?.toUpperCase() || 'U'}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{user.name || 'Unknown'}</p>
                          <p className="text-xs text-gray-500 truncate">{user.email}</p>
                          <p className="text-[10px] text-gray-600 mt-0.5">
                            <span className="font-semibold text-honey-700">{stats?.count ?? 0}</span> orders ·
                            <span className="font-semibold text-gray-900"> {formatCurrency(stats?.total ?? 0)}</span>
                          </p>
                        </div>
                        <button
                          onClick={() => handleStatusUpdate(user._id, !user.isActive)}
                          disabled={rowBusy?.id === user._id}
                          aria-busy={rowBusy?.id === user._id && rowBusy.kind === 'status'}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full flex-shrink-0 disabled:opacity-60 disabled:cursor-not-allowed ${
                            user.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {rowBusy?.id === user._id && rowBusy.kind === 'status' && <Loader2 className="h-3 w-3 animate-spin" />}
                          {user.isActive ? 'Active' : 'Inactive'}
                        </button>
                        <button onClick={() => { setActivityUserId(user._id); setActivityUserName(user.name || 'Unknown'); }} className="p-1 text-gray-400 hover:text-blue-500 flex-shrink-0" title="Activity log">
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setOrdersUser({ id: user._id, name: user.name || 'Unknown', email: user.email })} className="p-1 text-gray-400 hover:text-honey-700 flex-shrink-0" title="Order history">
                          <History className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user._id)}
                          disabled={rowBusy?.id === user._id}
                          aria-busy={rowBusy?.id === user._id && rowBusy.kind === 'delete'}
                          className="p-1 text-gray-400 hover:text-red-500 flex-shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
                          title="Delete customer"
                        >
                          {rowBusy?.id === user._id && rowBusy.kind === 'delete'
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop table */}
                <table className="hidden sm:table w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <SortHeader label="Customer"   field="name"       current={sortKey} dir={sortDir} onSort={handleSort} />
                      <SortHeader label="Status"     field="status"     current={sortKey} dir={sortDir} onSort={handleSort} />
                      <SortHeader label="Orders"     field="orders"     current={sortKey} dir={sortDir} onSort={handleSort} align="right" className="hidden md:table-cell" />
                      <SortHeader label="Spent"      field="spent"      current={sortKey} dir={sortDir} onSort={handleSort} align="right" className="hidden md:table-cell" />
                      <SortHeader label="Last Login" field="lastLogin"  current={sortKey} dir={sortDir} onSort={handleSort} className="hidden lg:table-cell" />
                      <SortHeader label="Joined"     field="createdAt"  current={sortKey} dir={sortDir} onSort={handleSort} className="hidden lg:table-cell" />
                      <th className="px-4 py-3 font-medium text-gray-600 text-xs w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {currentRows.map((user) => {
                      const stats = orderStats[user._id];
                      return (
                        <tr key={user._id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-gray-900 flex items-center justify-center flex-shrink-0">
                                <span className="text-sm font-semibold text-white">{user.name?.charAt(0)?.toUpperCase() || 'U'}</span>
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-gray-900 truncate">{user.name || 'Unknown'}</p>
                                <p className="text-xs text-gray-500 truncate">{user.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleStatusUpdate(user._id, !user.isActive)}
                              disabled={rowBusy?.id === user._id}
                              aria-busy={rowBusy?.id === user._id && rowBusy.kind === 'status'}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                                user.isActive
                                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                              }`}
                            >
                              {rowBusy?.id === user._id && rowBusy.kind === 'status' && <Loader2 className="h-3 w-3 animate-spin" />}
                              {user.isActive ? 'Active' : 'Inactive'}
                            </button>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell text-right">
                            <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 text-xs font-semibold text-honey-700 bg-honey-50 border border-honey-500/20 rounded-full">
                              {stats?.count ?? 0}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell text-right text-xs font-semibold text-gray-900 tabular-nums">
                            {formatCurrency(stats?.total ?? 0)}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 hidden lg:table-cell">{formatLastLogin(user.lastLogin)}</td>
                          <td className="px-4 py-3 text-xs text-gray-500 hidden lg:table-cell">{formatDate(user.createdAt)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-0.5">
                              <ActionTip label="Activity log">
                                <button
                                  onClick={() => { setActivityUserId(user._id); setActivityUserName(user.name || 'Unknown'); }}
                                  className="p-1.5 rounded-md text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                                  aria-label="View activity log"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                              </ActionTip>
                              <ActionTip label="Order history">
                                <button
                                  onClick={() => setOrdersUser({ id: user._id, name: user.name || 'Unknown', email: user.email })}
                                  className="p-1.5 rounded-md text-gray-400 hover:text-honey-700 hover:bg-honey-50 transition-colors"
                                  aria-label="View order history"
                                >
                                  <History className="h-4 w-4" />
                                </button>
                              </ActionTip>
                              <ActionTip label="Delete customer">
                                <button
                                  onClick={() => handleDeleteUser(user._id)}
                                  disabled={rowBusy?.id === user._id}
                                  aria-busy={rowBusy?.id === user._id && rowBusy.kind === 'delete'}
                                  className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                  aria-label="Delete customer"
                                >
                                  {rowBusy?.id === user._id && rowBusy.kind === 'delete'
                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                    : <Trash2 className="h-4 w-4" />}
                                </button>
                              </ActionTip>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 sm:py-10 md:py-12">
                <Users className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 text-gray-300 mx-auto mb-3 sm:mb-4" />
                <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-1.5 sm:mb-2">No customers found</h3>
                <p className="text-sm text-gray-500">Try adjusting your search or filters.</p>
              </div>
            )}

            {/* Pagination */}
            {filteredSorted.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 sm:pt-6 border-t border-gray-200 mt-4 sm:mt-6">
                {/* Range + page-size selector */}
                <div className="flex items-center gap-3 text-xs sm:text-sm text-gray-600">
                  <span>
                    Showing <span className="font-semibold text-gray-900">{firstIdx + 1}</span>–
                    <span className="font-semibold text-gray-900">{lastIdx}</span> of
                    <span className="font-semibold text-gray-900"> {filteredSorted.length}</span>
                  </span>
                  <span className="hidden sm:inline-flex items-center gap-1.5">
                    <label htmlFor="pageSize" className="text-gray-500">Rows:</label>
                    <select
                      id="pageSize"
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value))}
                      className="px-2 py-1 text-xs border border-gray-300 rounded-md bg-white focus:ring-1 focus:ring-honey-500/30 focus:border-honey-500"
                    >
                      {PAGE_SIZE_OPTIONS.map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </span>
                </div>

                {/* Page nav */}
                <div className="flex items-center gap-1">
                  <PageBtn onClick={() => setCurrentPage(1)} disabled={clampedPage === 1} title="First">
                    <ChevronsLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </PageBtn>
                  <PageBtn onClick={() => setCurrentPage(Math.max(clampedPage - 1, 1))} disabled={clampedPage === 1} title="Previous">
                    <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </PageBtn>

                  <span className="sm:hidden px-2 py-1 text-xs text-gray-600">
                    {clampedPage}/{totalPages}
                  </span>

                  <div className="hidden sm:flex items-center gap-1">
                    {pageWindow.map((p, i) =>
                      p === 'ellipsis' ? (
                        <span key={`e-${i}`} className="px-2 text-gray-400 select-none">…</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setCurrentPage(p)}
                          className={`min-w-[36px] px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                            clampedPage === p
                              ? 'bg-honey-500 text-gray-900 font-semibold shadow-md'
                              : 'text-gray-600 hover:bg-honey-50 hover:text-honey-700'
                          }`}
                          aria-current={clampedPage === p ? 'page' : undefined}
                        >
                          {p}
                        </button>
                      )
                    )}
                  </div>

                  <PageBtn onClick={() => setCurrentPage(Math.min(clampedPage + 1, totalPages))} disabled={clampedPage === totalPages} title="Next">
                    <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </PageBtn>
                  <PageBtn onClick={() => setCurrentPage(totalPages)} disabled={clampedPage === totalPages} title="Last">
                    <ChevronsRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </PageBtn>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Activity Log Modal */}
      {activityUserId && (
        <UserActivityModal
          userId={activityUserId}
          userName={activityUserName}
          onClose={() => setActivityUserId(null)}
        />
      )}

      {/* Order History Modal */}
      {ordersUser && (
        <UserOrdersModal
          userId={ordersUser.id}
          userName={ordersUser.name}
          userEmail={ordersUser.email}
          onClose={() => setOrdersUser(null)}
        />
      )}
    </div>
  );
};

const StatTile: React.FC<{ icon: React.ReactNode; bg: string; value: number; label: string }> = ({ icon, bg, value, label }) => (
  <div className="bg-white rounded-lg border border-gray-200 p-1.5 sm:p-3">
    <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2">
      <div className={`p-1 sm:p-1.5 rounded-md ${bg}`}>{icon}</div>
      <div className="text-center sm:text-left">
        <p className="text-sm sm:text-lg font-semibold text-gray-900 tabular-nums">{value}</p>
        <p className="text-[8px] sm:text-[10px] text-gray-500">{label}</p>
      </div>
    </div>
  </div>
);

const ActionTip: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="relative group/tip">
    {children}
    <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-gray-900 text-white text-[10px] font-medium whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity z-10 shadow-lg">
      {label}
    </span>
  </div>
);

const PageBtn: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}> = ({ onClick, disabled, title, children }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    aria-label={title}
    className="p-1.5 sm:p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-honey-50 hover:text-honey-700 hover:border-honey-300 disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-gray-600 disabled:hover:border-gray-300 disabled:cursor-not-allowed transition-all duration-200"
  >
    {children}
  </button>
);

export default UsersPage;
