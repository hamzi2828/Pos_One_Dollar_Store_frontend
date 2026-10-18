'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { X, Loader2, ShoppingBag, Package, AlertCircle, ExternalLink } from 'lucide-react';
import { getPOSOrders } from '../../pos/services/posOrderService';
import type { POSOrder } from '../../pos/types';
import { useCurrency } from '@/context/CurrencyContext';

interface UserOrdersModalProps {
  userId: string;
  userName: string;
  userEmail: string;
  onClose: () => void;
}

const statusStyles: Record<string, string> = {
  completed: 'bg-green-50 text-green-700 border-green-200',
  full: 'bg-green-50 text-green-700 border-green-200',
  partial: 'bg-orange-50 text-orange-700 border-orange-200',
  pending: 'bg-blue-50 text-blue-700 border-blue-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
  refunded: 'bg-gray-50 text-gray-700 border-gray-200',
};

const statusStyle = (status?: string) =>
  statusStyles[status || ''] || 'bg-gray-50 text-gray-700 border-gray-200';

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

export default function UserOrdersModal({ userId, userName, userEmail, onClose }: UserOrdersModalProps) {
  const { formatPrice } = useCurrency();
  const [orders, setOrders] = useState<POSOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await getPOSOrders(undefined, 200, undefined, undefined, undefined, undefined, undefined, userEmail);
        const all: POSOrder[] = Array.isArray(res?.orders) ? res.orders : [];
        const mine = all.filter((o) => o.customer?._id === userId || o.customer?.email === userEmail);
        if (!cancelled) setOrders(mine);
      } catch (e) {
        console.error('Failed to load user orders:', e);
        if (!cancelled) setError('Could not load order history.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, userEmail]);

  const totalSpent = useMemo(
    () => orders.filter((o) => o.orderStatus !== 'cancelled' && o.orderStatus !== 'refunded')
                .reduce((sum, o) => sum + (o.total || 0), 0),
    [orders]
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-3xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-honey-500 flex items-center justify-center flex-shrink-0 shadow-sm shadow-honey-500/30">
              <ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5 text-gray-900" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-semibold text-gray-900 truncate">Order History</h2>
              <p className="text-xs text-gray-500 truncate">{userName} — {userEmail}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Summary strip */}
        {!loading && !error && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 px-4 sm:px-6 py-3 bg-gray-50 border-b border-gray-200">
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Orders</p>
              <p className="text-base sm:text-lg font-bold text-gray-900">{orders.length}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Total Spent</p>
              <p className="text-base sm:text-lg font-bold text-honey-700">{formatPrice(totalSpent)}</p>
            </div>
            <div className="text-center col-span-2 sm:col-span-1">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Completed</p>
              <p className="text-base sm:text-lg font-bold text-green-600">
                {orders.filter((o) => o.orderStatus === 'completed').length}
              </p>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-7 w-7 animate-spin text-honey-700" />
              <p className="text-sm text-gray-500">Loading order history...</p>
            </div>
          ) : error ? (
            <div className="m-4 sm:m-6 rounded-lg bg-red-50 border border-red-200 p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-red-800">{error}</h3>
                <p className="mt-1 text-xs text-red-600">Try again later or check the backend logs.</p>
              </div>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12 px-4">
              <Package className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <h3 className="text-sm font-medium text-gray-900 mb-1">No orders yet</h3>
              <p className="text-xs text-gray-500">This customer hasn&apos;t placed any orders.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {orders.map((order) => (
                <li key={order._id} className="px-4 sm:px-6 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900">#{order.orderNumber}</span>
                        <span
                          className={`px-2 py-0.5 text-[10px] font-medium rounded-full border ${statusStyle(order.paymentStatus || order.orderStatus)}`}
                        >
                          {order.paymentStatus || order.orderStatus}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatDate(order.createdAt)} · {order.items?.length || 0} item{order.items?.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-gray-900">{formatPrice(order.total)}</p>
                      <Link
                        href={`/admin/pos/invoice/${order._id}`}
                        onClick={onClose}
                        className="inline-flex items-center gap-1 text-[11px] text-honey-700 hover:text-honey-700 font-medium mt-0.5"
                      >
                        View <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
