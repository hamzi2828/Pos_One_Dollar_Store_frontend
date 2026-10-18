'use client';

// All in-app notifications for the logged-in user (the header bell shows the latest).

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Bell, CheckCheck, Check, AlertTriangle, Info, AlertOctagon, Loader2, RefreshCw, AlertCircle, ExternalLink } from 'lucide-react';
import { storeApi, apiErrorMessage, formatDate, type PageMeta } from '@/lib/storeApi';
import { useAccess } from '@/context/AccessContext';
import { LoadingCard, NoAccessCard, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';

interface Notice {
  _id: string;
  type: string;
  title: string;
  message?: string;
  level: 'info' | 'warning' | 'critical';
  link?: string;
  createdAt: string;
  read: boolean;
}

const LEVEL_ICON = {
  info: <Info className="h-4 w-4 text-blue-600" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-600" />,
  critical: <AlertOctagon className="h-4 w-4 text-red-600" />,
};
const LEVEL_BG = { info: 'bg-blue-50', warning: 'bg-amber-50', critical: 'bg-red-50' };

export default function NotificationsPage() {
  const { can, loaded } = useAccess();
  const canView = can('notifications', 'view');
  const [rows, setRows] = useState<Notice[]>([]);
  const [meta, setMeta] = useState<(PageMeta & { unread?: number }) | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [level, setLevel] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const lockRef = useRef(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await storeApi.get<Notice[]>('/notifications', { page, limit: 25, unread: unreadOnly ? 1 : undefined, level });
      setRows(res.data || []);
      setMeta((res.meta as PageMeta & { unread?: number }) || null);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load notifications.'));
    } finally {
      setLoading(false);
    }
  }, [page, unreadOnly, level]);

  useEffect(() => {
    if (canView) load();
  }, [canView, load]);

  const markRead = async (n: Notice) => {
    if (lockRef.current || n.read) return;
    lockRef.current = true;
    setBusyId(n._id);
    try {
      await storeApi.post(`/notifications/${n._id}/read`);
      setRows((list) => (unreadOnly ? list.filter((x) => x._id !== n._id) : list.map((x) => (x._id === n._id ? { ...x, read: true } : x))));
      setMeta((m) => (m ? { ...m, unread: Math.max(0, (m.unread || 1) - 1) } : m));
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not mark as read.'));
    } finally {
      lockRef.current = false;
      setBusyId(null);
    }
  };

  const markAll = async () => {
    if (markingAll) return;
    setMarkingAll(true);
    try {
      await storeApi.post('/notifications/read-all');
      toast.success('All marked as read');
      setPage(1);
      await load();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not mark all as read.'));
    } finally {
      setMarkingAll(false);
    }
  };

  if (!loaded) return <div className="max-w-5xl mx-auto px-4 py-6"><LoadingCard text="Loading…" /></div>;
  if (!canView) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <NoAccessCard text="Use the bell at the top to see your notifications." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Notifications</h1>
            <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-500">
              {meta?.unread ? `${meta.unread} unread` : 'You are all caught up.'} Kept for 90 days.
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={load} disabled={loading} className={secondaryBtn} aria-label="Refresh">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button type="button" onClick={markAll} disabled={markingAll || !meta?.unread} className={primaryBtn}>
              {markingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />} Mark all read
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          {[
            { v: false, label: 'All' },
            { v: true, label: 'Unread' },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => {
                setPage(1);
                setUnreadOnly(o.v);
              }}
              className={`px-3 py-1.5 text-sm rounded-full border ${unreadOnly === o.v ? 'bg-honey-500 text-gray-900 border-honey-500' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
            >
              {o.label}
            </button>
          ))}
          <select
            value={level}
            onChange={(e) => {
              setPage(1);
              setLevel(e.target.value);
            }}
            className="ml-auto px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-full"
            aria-label="Level"
          >
            <option value="">All levels</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
        </div>

        {loading && rows.length === 0 ? (
          <LoadingCard text="Loading notifications…" />
        ) : error ? (
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-red-200 text-center py-10 px-4">
            <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
            <p className="text-sm text-red-700 mb-4">{error}</p>
            <button type="button" onClick={load} className={primaryBtn}>
              Try again
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 text-center py-14">
            <Bell className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">{unreadOnly ? 'No unread notifications.' : 'No notifications yet.'}</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100 overflow-hidden">
            {rows.map((n) => (
              <div key={n._id} className={`flex gap-3 px-4 py-3 ${n.read ? '' : 'bg-honey-50/30'}`}>
                <div className={`flex items-center justify-center h-8 w-8 rounded-full flex-shrink-0 ${LEVEL_BG[n.level] || 'bg-gray-50'}`}>
                  {LEVEL_ICON[n.level] || LEVEL_ICON.info}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${n.read ? 'text-gray-700' : 'font-semibold text-gray-900'}`}>{n.title}</p>
                  {n.message && <p className="text-xs sm:text-sm text-gray-600 mt-0.5 break-words">{n.message}</p>}
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-gray-400">
                    <span>{formatDate(n.createdAt, true)}</span>
                    {n.link && (
                      <Link href={n.link} onClick={() => markRead(n)} className="inline-flex items-center gap-1 text-honey-700 font-medium hover:underline">
                        Open <ExternalLink className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </div>
                {!n.read && (
                  <button
                    type="button"
                    onClick={() => markRead(n)}
                    disabled={busyId === n._id}
                    className="self-start p-1.5 rounded-md text-gray-400 hover:text-green-600 hover:bg-green-50 disabled:opacity-50"
                    title="Mark as read"
                    aria-label="Mark as read"
                  >
                    {busyId === n._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {meta && meta.pages > 1 && (
          <div className="mt-3 flex items-center justify-between text-xs text-gray-600">
            <span>
              Page {page} of {meta.pages}
            </span>
            <span className="flex gap-2">
              <button type="button" onClick={() => setPage((p) => p - 1)} disabled={page <= 1 || loading} className={`${secondaryBtn} !px-3 !py-1`}>
                Previous
              </button>
              <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page >= meta.pages || loading} className={`${secondaryBtn} !px-3 !py-1`}>
                Next
              </button>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
