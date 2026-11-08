// POS activity log: API calls + the pieces shown on the Logs page and the
// "Log" window on POS Orders (status badge, event timeline, modal).
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { Loader2, ScrollText, X } from 'lucide-react';
import { storeApi, apiErrorMessage, formatRs } from '@/lib/storeApi';

export type CartStatus = 'open' | 'completed' | 'held' | 'cleared' | 'failed';

export interface ActivityEvent {
  at: string;
  type: string;
  label: string;
  data?: Record<string, unknown>;
}

export interface ActivityCart {
  _id: string;
  cartId: string;
  userName?: string;
  counterName?: string;
  deviceName?: string;
  status: CartStatus;
  lastStep?: string;
  startedAt: string;
  lastAt?: string;
  itemCount?: number;
  total?: number;
  orderNumber?: string;
  order?: string | { _id: string } | null;
  eventCount?: number;
}

export interface ActivityDetail extends ActivityCart {
  events: ActivityEvent[];
}

export interface ActivityList {
  data: ActivityCart[];
  total: number;
  summary: { total: number; completed: number; notCompleted: number };
}

export async function listActivity(params: Record<string, string | number | undefined>): Promise<ActivityList> {
  const res = (await storeApi.get<ActivityCart[]>('/pos/activity', params)) as unknown as {
    data?: ActivityCart[];
    pagination?: { total?: number };
    meta?: { total?: number };
    summary?: { total: number; completed: number; notCompleted: number };
  };
  const data = Array.isArray(res.data) ? res.data : [];
  const total = res.pagination?.total ?? res.meta?.total ?? data.length;
  return { data, total, summary: res.summary || { total, completed: 0, notCompleted: 0 } };
}

export async function getActivity(cartId: string): Promise<ActivityDetail> {
  const res = await storeApi.get<ActivityDetail>(`/pos/activity/${encodeURIComponent(cartId)}`);
  return res.data;
}

/** null = no log for this bill (404). */
export async function getActivityByOrder(orderId: string): Promise<ActivityDetail | null> {
  try {
    const res = await storeApi.get<ActivityDetail>(`/pos/activity/by-order/${encodeURIComponent(orderId)}`);
    return res.data || null;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) return null;
    throw err;
  }
}

export const orderIdOf = (o: ActivityCart['order']): string | null => (!o ? null : typeof o === 'string' ? o : o._id || null);

export const timeOf = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

export function CartStatusBadge({ cart }: { cart: ActivityCart }) {
  if (cart.status === 'completed') {
    const id = orderIdOf(cart.order);
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        <span className="px-2 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-medium">Completed</span>
        {cart.orderNumber &&
          (id ? (
            <Link
              href={`/admin/pos/invoice/${id}`}
              target="_blank"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-blue-600 hover:underline"
            >
              {cart.orderNumber}
            </Link>
          ) : (
            <span className="text-xs text-gray-600">{cart.orderNumber}</span>
          ))}
      </span>
    );
  }
  const word: Record<string, string> = { held: 'Held', cleared: 'Cleared', failed: 'Failed', open: 'Not completed' };
  const color =
    cart.status === 'failed' || cart.status === 'cleared'
      ? 'bg-red-50 text-red-700 border-red-200'
      : cart.status === 'held'
        ? 'bg-blue-50 text-blue-700 border-blue-200'
        : 'bg-amber-50 text-amber-800 border-amber-200';
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <span className={`px-2 py-0.5 rounded border text-xs font-medium ${color}`}>{word[cart.status] || cart.status}</span>
      {cart.lastStep && <span className="text-[11px] text-gray-500">Stopped at: {cart.lastStep}</span>}
    </span>
  );
}

const eventColor = (type: string) => {
  if (type === 'scan' || type === 'add') return 'bg-blue-500';
  if (type === 'remove' || type === 'clear' || type === 'failed' || type === 'scan_not_found') return 'bg-red-500';
  if (type.startsWith('pay_')) return 'bg-honey-500';
  if (type === 'completed' || type === 'offline_saved') return 'bg-emerald-500';
  return 'bg-gray-400';
};

const textColor = (type: string) => {
  if (type === 'remove' || type === 'clear' || type === 'failed' || type === 'scan_not_found') return 'text-red-700';
  if (type === 'completed' || type === 'offline_saved') return 'text-emerald-700 font-medium';
  return 'text-gray-800';
};

export function ActivityTimeline({ events }: { events: ActivityEvent[] }) {
  if (!events.length) return <div className="text-sm text-gray-500 py-4 text-center">No events</div>;
  return (
    <ol className="relative border-l border-gray-200 ml-2 space-y-2">
      {events.map((e, i) => (
        <li key={i} className="ml-4">
          <span className={`absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full ${eventColor(e.type)}`} />
          <div className="flex items-baseline gap-2 text-sm">
            <span className="font-mono text-[11px] text-gray-400 whitespace-nowrap">{timeOf(e.at)}</span>
            <span className={textColor(e.type)}>{e.label}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Header line of one cart: cashier, counter, pieces, total. */
export function CartSummary({ cart }: { cart: ActivityCart }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
      <CartStatusBadge cart={cart} />
      <span>{cart.userName || '—'}</span>
      {(cart.counterName || cart.deviceName) && <span>{cart.counterName || cart.deviceName}</span>}
      <span>{cart.itemCount ?? 0} pcs</span>
      <span className="font-medium text-gray-800">{formatRs(cart.total)}</span>
    </div>
  );
}

/** Window with the timeline of one bill (orderId) or one cart (cartId). */
export function ActivityLogModal({
  orderId,
  cartId,
  title,
  onClose,
}: {
  orderId?: string;
  cartId?: string;
  title?: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<ActivityDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    setLoading(true);
    setError(null);
    const req = orderId ? getActivityByOrder(orderId) : cartId ? getActivity(cartId) : Promise.resolve(null);
    req
      .then((d) => !stop && setDetail(d))
      .catch((err) => !stop && setError(apiErrorMessage(err)))
      .finally(() => !stop && setLoading(false));
    return () => {
      stop = true;
    };
  }, [orderId, cartId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-honey-700" /> {title || 'POS log'}
          </h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading log…
            </div>
          ) : error ? (
            <div className="text-sm text-red-600 py-6 text-center">{error}</div>
          ) : !detail ? (
            <div className="text-sm text-gray-500 py-8 text-center">No log for this bill (sold before logging started).</div>
          ) : (
            <>
              <CartSummary cart={detail} />
              <div className="text-[11px] text-gray-400">
                Started {new Date(detail.startedAt).toLocaleString()} · {detail.events?.length ?? 0} events
              </div>
              <ActivityTimeline events={detail.events || []} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
