'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FiMenu, FiX, FiLogOut } from 'react-icons/fi';
import { useCurrency } from '@/context/CurrencyContext';
import { clearAllAuth, getCurrentUser } from '@/helper/helper';
import { useAccess } from '@/context/AccessContext';
import { describeAccess } from '@/helper/access';
import { storeApi, formatDate } from '@/lib/storeApi';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';

interface AdminHeaderProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

/* ------------------------------------------------------------------ */
/* Notification bell (Cash & Notifications module)                     */
/* ------------------------------------------------------------------ */

interface BellNotice {
  _id: string;
  title: string;
  message?: string;
  level: 'info' | 'warning' | 'critical';
  link?: string;
  createdAt: string;
  read: boolean;
}

const POLL_MS = 60 * 1000;
const LEVEL_DOT: Record<BellNotice['level'], string> = {
  info: 'bg-blue-500',
  warning: 'bg-amber-500',
  critical: 'bg-red-600',
};

function NotificationBell() {
  const router = useRouter();
  const { can } = useAccess();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<BellNotice[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const failuresRef = useRef(0);

  // Light poll: unread count only, only while the tab is visible; stops after
  // repeated failures (e.g. older backend without /api/notifications).
  const poll = useCallback(async () => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    if (failuresRef.current >= 3) return;
    try {
      const res = await storeApi.get<{ count: number }>('/notifications/unread-count');
      setCount(res.data?.count || 0);
      failuresRef.current = 0;
    } catch {
      failuresRef.current += 1;
    }
  }, []);

  useEffect(() => {
    poll();
    const timer = window.setInterval(poll, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') poll();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [poll]);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await storeApi.get<BellNotice[]>('/notifications', { limit: 8 });
      setItems(res.data || []);
      const unread = Number(res.meta?.unread);
      if (Number.isFinite(unread)) setCount(unread);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) loadList();
  };

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openItem = async (n: BellNotice) => {
    setOpen(false);
    if (!n.read) {
      setItems((list) => list.map((x) => (x._id === n._id ? { ...x, read: true } : x)));
      setCount((c) => Math.max(0, c - 1));
      storeApi.post(`/notifications/${n._id}/read`).catch(() => undefined);
    }
    if (n.link) router.push(n.link);
  };

  const markAll = async () => {
    if (markingAll) return;
    setMarkingAll(true);
    try {
      await storeApi.post('/notifications/read-all');
      setItems((list) => list.map((x) => ({ ...x, read: true })));
      setCount(0);
    } catch {
      /* keep as is */
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={toggle}
        className="relative p-1.5 sm:p-2 text-gray-500 rounded-md hover:bg-gray-100 hover:text-gray-700 transition-colors"
        aria-label={count ? `Notifications, ${count} unread` : 'Notifications'}
        aria-expanded={open}
      >
        <Bell className="w-5 h-5" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-honey-500 text-gray-900 text-[10px] font-bold leading-none">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[min(92vw,22rem)] bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-900">Notifications</span>
            <button
              type="button"
              onClick={markAll}
              disabled={markingAll || count === 0}
              className="inline-flex items-center gap-1 text-xs font-medium text-honey-700 hover:underline disabled:opacity-40 disabled:no-underline"
            >
              {markingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
              Mark all read
            </button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="py-8 text-center">
                <Loader2 className="h-5 w-5 text-honey-700 animate-spin mx-auto" />
              </div>
            ) : items.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">No notifications</p>
            ) : (
              items.map((n) => (
                <button
                  key={n._id}
                  type="button"
                  onClick={() => openItem(n)}
                  className={`w-full text-left flex gap-2.5 px-4 py-2.5 border-b border-gray-50 hover:bg-gray-50 ${n.read ? '' : 'bg-honey-50/40'}`}
                >
                  <span className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${n.read ? 'bg-gray-300' : LEVEL_DOT[n.level] || 'bg-blue-500'}`} />
                  <span className="min-w-0">
                    <span className={`block text-sm truncate ${n.read ? 'text-gray-700' : 'font-semibold text-gray-900'}`}>{n.title}</span>
                    {n.message && <span className="block text-xs text-gray-500 line-clamp-2">{n.message}</span>}
                    <span className="block text-[11px] text-gray-400 mt-0.5">{formatDate(n.createdAt, true)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
          {can('notifications', 'view') && (
            <Link
              href="/admin/notifications"
              onClick={() => setOpen(false)}
              className="block text-center text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 py-2.5"
            >
              See all notifications
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminHeader({ isSidebarOpen, onToggleSidebar }: AdminHeaderProps) {
  const { currency } = useCurrency();
  const router = useRouter();
  const { access } = useAccess();

  const tokenUser = getCurrentUser();
  const firstName = access?.user?.firstName || tokenUser?.firstName || '';
  const lastName = access?.user?.lastName || tokenUser?.lastName || '';
  const displayName = `${firstName} ${lastName}`.trim() || 'Admin';
  const subtitle = describeAccess(access);

  // Sign out navigates away (router.replace), which can take a moment:
  // lock the button and show a spinner until the page goes.
  const [signingOut, setSigningOut] = useState(false);
  const navLockRef = useRef(false);

  const handleLogout = () => {
    if (navLockRef.current) return;
    navLockRef.current = true;
    setSigningOut(true);
    clearAllAuth();
    router.replace('/authentication');
  };

  return (
    <header className="flex items-center justify-between h-12 sm:h-14 md:h-16 px-3 sm:px-4 bg-white border-b border-gray-200 lg:px-6">
      <button
        onClick={onToggleSidebar}
        className="p-1.5 sm:p-2 text-gray-500 rounded-md lg:hidden focus:outline-none focus:ring-2 focus:ring-inset focus:ring-honey-500"
        aria-label={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
      >
        {isSidebarOpen ? (
          <FiX className="w-5 h-5 sm:w-6 sm:h-6" />
        ) : (
          <FiMenu className="w-5 h-5 sm:w-6 sm:h-6" />
        )}
      </button>

      <div className="flex items-center gap-2 sm:gap-3 md:gap-4 ml-auto">
        {access && <NotificationBell />}

        <Link
          href="/admin/settings"
          className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-honey-50 border border-honey-500/30 rounded-md sm:rounded-lg hover:bg-honey-100 hover:border-honey-500/50 transition-all duration-200"
          title="Click to change currency"
        >
          <span className="flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 bg-honey-500 rounded-full text-gray-900 text-xs sm:text-sm font-bold">
            {currency.symbol}
          </span>
          <span className="text-xs sm:text-sm font-medium text-gray-700">{currency.code}</span>
        </Link>

        <div className="flex items-center gap-2" title={`${displayName} — ${subtitle}`}>
          <div
            className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 bg-honey-500 rounded-full flex-shrink-0 text-gray-900 text-xs sm:text-sm font-bold"
            aria-label={displayName}
          >
            {(firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || 'A'}
          </div>
          <div className="hidden md:block leading-tight min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate max-w-[160px]">{displayName}</p>
            <p className="text-[11px] text-gray-500 truncate max-w-[180px]">{subtitle}</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          disabled={signingOut}
          aria-busy={signingOut}
          className="flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 text-gray-500 rounded-md sm:rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          title="Sign out"
          aria-label="Sign out"
        >
          {signingOut ? (
            <Loader2 className="w-4 h-4 sm:w-[18px] sm:h-[18px] animate-spin" />
          ) : (
            <FiLogOut className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
          )}
          <span className="hidden sm:inline text-xs sm:text-sm font-medium">{signingOut ? 'Signing out…' : 'Sign out'}</span>
        </button>
      </div>
    </header>
  );
}
