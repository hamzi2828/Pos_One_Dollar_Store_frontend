// POS Orders — all counter sales with filters, summary, and detail view.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import MoneyInput from '@/components/ui/MoneyInput';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  Receipt,
  Search,
  RefreshCw,
  Calendar,
  Filter,
  Eye,
  FileText,
  Trash2,
  DollarSign,
  Loader2,
  Banknote,
  CreditCard,
  Building2,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ShoppingBag,
  TrendingUp,
  X,
  Gift,
  Undo2,
  Percent,
} from 'lucide-react';
import { POSOrder, PaymentMethodType } from '../pos/types';
import { getPOSOrders, deletePOSOrder, addPaymentToOrder, refundPOSOrder } from '../pos/services/posOrderService';
import WhatsAppBadge from '../pos/components/WhatsAppBadge';
import { useAccess } from '@/context/AccessContext';
import { getCurrencySymbol } from '../pos/utils/currency';
import { orderItemName } from '../pos/utils/receipt';
import TablePagination from '@/components/admin/TablePagination';
import { useServerPagination } from '@/helper/useServerPagination';
import { SearchSelect } from '@/components/ui/SearchSelect';

type StatusFilter = 'all' | 'completed' | 'pending' | 'refunded' | 'cancelled';
type PaymentFilter = 'all' | 'cash' | 'card' | 'bank_transfer';

/** Today in shop time (Pakistan), YYYY-MM-DD. */
const pkToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date());

export default function POSOrdersPage() {
  const currency = 'PKR';
  const symbol = getCurrencySymbol(currency);
  const { can } = useAccess();
  const perms = {
    seeCost: can('dashboard', 'view'),
    pay: can(['pos', 'pos_orders'], 'edit'),
    refund: can('pos_orders', 'edit'),
    remove: can('pos_orders', 'delete'),
  };
  const [refunding, setRefunding] = useState<POSOrder | null>(null);

  const [orders, setOrders] = useState<POSOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [payment, setPayment] = useState<PaymentFilter>('all');
  // Date: Today (default) / Custom (from - to) / All dates
  const [range, setRange] = useState<'today' | 'custom' | 'all'>('today');
  const [startDate, setStartDate] = useState<string>(() => pkToday());
  const [endDate, setEndDate] = useState<string>(() => pkToday());
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
  const [viewing, setViewing] = useState<POSOrder | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const deleteLock = useRef(false);
  const [paying, setPaying] = useState<POSOrder | null>(null);

  const pg = useServerPagination(25);
  const [reloadTick, setReloadTick] = useState(0);
  const loadOrders = useCallback(() => setReloadTick((n) => n + 1), []);

  // Debounce search — every keystroke shouldn't hit the API.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Filter changes reset to page 1.
  useEffect(() => {
    pg.resetToFirstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, payment, status, debouncedSearch]);

  // Server returns pagination + summary; summary reflects full filtered set.
  const [summary, setSummary] = useState({ count: 0, total: 0, paid: 0, pending: 0, discount: 0, cogs: undefined as number | undefined });

  useEffect(() => {
    const ctl = new AbortController();
    setLoading(true);
    getPOSOrders(
      undefined,
      pg.pageSize,
      startDate || undefined,
      endDate || undefined,
      payment === 'all' ? undefined : payment,
      status === 'all' ? undefined : status,
      pg.page,
      debouncedSearch || undefined,
      ctl.signal,
    )
      .then((resp) => {
        setOrders(resp.orders);
        pg.setTotal(resp.total);
        if (resp.summary) {
          const sum = resp.summary as typeof resp.summary & { totalDiscount?: number; totalCogs?: number };
          setSummary({
            count: sum.totalOrders,
            total: sum.totalSales,
            paid: sum.totalPaid,
            pending: sum.totalPending,
            discount: sum.totalDiscount || 0,
            cogs: sum.totalCogs,
          });
        }
      })
      .catch((err) => {
        if ((err as Error).name === 'AbortError') return;
        console.error(err);
        toast.error('Failed to load POS orders');
      })
      .finally(() => setLoading(false));
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, payment, status, debouncedSearch, pg.page, pg.pageSize, reloadTick]);

  // Server already applied all filters + pagination.
  const filtered = orders;

  const resetFilters = () => {
    setSearch('');
    setStatus('all');
    setPayment('all');
    setRange('today');
    setStartDate(pkToday());
    setEndDate(pkToday());
  };

  const handleDelete = async (id: string) => {
    if (deleteLock.current) return;
    if (!confirm('Delete this POS order? This action can be reversed only manually from DB.')) return;
    deleteLock.current = true;
    try {
      setDeletingId(id);
      await deletePOSOrder(id);
      setOrders((prev) => prev.filter((o) => o._id !== id));
      toast.success('Order deleted');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete order');
    } finally {
      deleteLock.current = false;
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-3 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <Receipt className="h-6 w-6 text-honey-700" />
            POS Orders
          </h1>
          <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-500">
            All point-of-sale transactions. Use filters to narrow results.
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={loadOrders}
            disabled={loading}
            aria-busy={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <Link
            href="/admin/pos"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-900 bg-honey-500 rounded-lg hover:bg-honey-600"
          >
            <ShoppingBag className="h-4 w-4" />
            Open POS
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-3">
        <SummaryCard
          icon={<ShoppingBag className="h-5 w-5" />}
          label="Orders"
          value={summary.count.toString()}
          accent="bg-blue-50 text-blue-600"
        />
        <SummaryCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Total Sales"
          value={`${symbol}${summary.total.toFixed(2)}`}
          accent="bg-emerald-50 text-emerald-600"
        />
        <SummaryCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Paid"
          value={`${symbol}${summary.paid.toFixed(2)}`}
          accent="bg-green-50 text-green-600"
        />
        <SummaryCard
          icon={<AlertCircle className="h-5 w-5" />}
          label="Pending"
          value={`${symbol}${summary.pending.toFixed(2)}`}
          accent="bg-orange-50 text-orange-600"
        />
        <SummaryCard
          icon={<Percent className="h-5 w-5" />}
          label="Discounts given"
          value={`${symbol}${summary.discount.toFixed(2)}`}
          accent="bg-lime-50 text-lime-700"
        />
        {perms.seeCost && summary.cogs !== undefined && (
          <SummaryCard
            icon={<DollarSign className="h-5 w-5" />}
            label="Cost of sales"
            value={`${symbol}${summary.cogs.toFixed(2)}`}
            accent="bg-slate-100 text-slate-700"
          />
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          <Filter className="h-3.5 w-3.5" /> Filters
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by order #, customer name, phone..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-honey-500 focus:border-honey-500"
            />
          </div>

          <SearchSelect
            value={range}
            onChange={(e) => pickRange(e.target.value as 'today' | 'custom' | 'all')}
            aria-label="Date"
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-honey-500 focus:border-honey-500"
          >
            <option value="today">Today</option>
            <option value="custom">Custom dates</option>
            <option value="all">All dates</option>
          </SearchSelect>

          {range === 'custom' && (
            <>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-honey-500 focus:border-honey-500"
            />
          </div>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-honey-500 focus:border-honey-500"
            />
          </div>

            </>
          )}

          <SearchSelect
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-honey-500 focus:border-honey-500"
          >
            <option value="all">All statuses</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="refunded">Refunded</option>
            <option value="cancelled">Cancelled</option>
          </SearchSelect>

          <SearchSelect
            value={payment}
            onChange={(e) => setPayment(e.target.value as PaymentFilter)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-honey-500 focus:border-honey-500"
          >
            <option value="all">All payments</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="bank_transfer">Bank Transfer</option>
          </SearchSelect>

          {(search || status !== 'all' || payment !== 'all' || range !== 'today') && (
            <button
              onClick={resetFilters}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Orders table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3 font-medium">Order #</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Items</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                    Loading orders...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <Receipt className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                    <div className="text-gray-500 text-sm">No POS orders match these filters</div>
                  </td>
                </tr>
              ) : (
                filtered.map((o) => (
                  <OrderRow
                    key={o._id}
                    order={o}
                    symbol={symbol}
                    perms={perms}
                    onView={() => setViewing(o)}
                    onDelete={() => handleDelete(o._id)}
                    onPay={() => setPaying(o)}
                    onRefund={() => setRefunding(o)}
                    deleting={deletingId === o._id}
                    anyDeleting={!!deletingId}
                  />
                ))
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
          label="orders"
        />
      </div>

      {viewing && (
        <OrderDetailModal order={viewing} symbol={symbol} seeCost={perms.seeCost} onClose={() => setViewing(null)} />
      )}
      {refunding && (
        <RefundModal
          order={refunding}
          symbol={symbol}
          onClose={() => setRefunding(null)}
          onDone={(updated) => {
            setRefunding(null);
            setOrders((prev) => prev.map((o) => (o._id === updated._id ? { ...o, ...updated } : o)));
            toast.success('Order refunded — stock is back');
          }}
        />
      )}
      {paying && (
        <AddPaymentModal
          order={paying}
          symbol={symbol}
          onClose={() => setPaying(null)}
          onSuccess={(updated) => {
            setPaying(null);
            setOrders((prev) => prev.map((o) => (o._id === updated._id ? updated : o)));
            toast.success('Payment recorded');
          }}
        />
      )}
    </div>
  );
}

// ---------- Small components ----------

function SummaryCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 flex items-center gap-3">
      <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${accent}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</div>
        <div className="text-sm sm:text-lg font-semibold text-gray-900 truncate">{value}</div>
      </div>
    </div>
  );
}

function PaymentBadge({ method }: { method: string }) {
  const map: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
    cash: { icon: <Banknote className="h-3 w-3" />, label: 'Cash', className: 'bg-green-50 text-green-700 border-green-200' },
    card: { icon: <CreditCard className="h-3 w-3" />, label: 'Card', className: 'bg-blue-50 text-blue-700 border-blue-200' },
    bank_transfer: { icon: <Building2 className="h-3 w-3" />, label: 'Bank', className: 'bg-purple-50 text-purple-700 border-purple-200' },
    split: { icon: <Receipt className="h-3 w-3" />, label: 'Split', className: 'bg-gray-50 text-gray-700 border-gray-200' },
  };
  const m = map[method] || map.split;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${m.className}`}>
      {m.icon}
      {m.label}
    </span>
  );
}

function StatusBadge({ paymentStatus, orderStatus }: { paymentStatus?: string; orderStatus?: string }) {
  const s = paymentStatus || orderStatus || 'completed';
  if (s === 'completed' || s === 'full') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-medium">
        <CheckCircle2 className="h-3 w-3" /> Paid
      </span>
    );
  }
  if (s === 'partial') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border bg-yellow-50 text-yellow-700 border-yellow-200 text-xs font-medium">
        <Clock className="h-3 w-3" /> Partial
      </span>
    );
  }
  if (s === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border bg-orange-50 text-orange-700 border-orange-200 text-xs font-medium">
        <AlertCircle className="h-3 w-3" /> Pending
      </span>
    );
  }
  if (s === 'refunded') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border bg-red-50 text-red-700 border-red-200 text-xs font-medium">
        <XCircle className="h-3 w-3" /> Refunded
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border bg-gray-50 text-gray-700 border-gray-200 text-xs font-medium capitalize">
      {s}
    </span>
  );
}

type RowPerms = { seeCost: boolean; pay: boolean; refund: boolean; remove: boolean };

function OrderRow({
  order,
  symbol,
  perms,
  onView,
  onDelete,
  onPay,
  onRefund,
  deleting,
  anyDeleting,
}: {
  order: POSOrder;
  symbol: string;
  perms: RowPerms;
  onView: () => void;
  onDelete: () => void;
  onPay: () => void;
  onRefund: () => void;
  deleting: boolean;
  anyDeleting: boolean;
}) {
  const canRefund = perms.refund && !['refunded', 'cancelled'].includes(order.orderStatus) && order.paymentStatus !== 'refunded';
  const hasOpenBalance =
    (order.paymentStatus === 'partial' || order.paymentStatus === 'pending') &&
    (order.pendingAmount || 0) > 0;
  const customerName =
    order.customerInfo?.name ||
    (order.customer ? `${order.customer.firstName} ${order.customer.lastName ?? ''}`.trim() : 'Walk-in');
  const phone = order.customerInfo?.phone || order.customer?.phone || '';

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3">
        <div className="font-medium text-gray-900">{order.orderNumber}</div>
        {order.offline?.clientId && (
          <span
            className="inline-flex mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800"
            title={order.offline.number ? `Sold offline, slip ${order.offline.number}` : 'Sold offline'}
          >
            Offline sale{order.offline.number ? ` · ${order.offline.number}` : ''}
          </span>
        )}
        {order.cashier && (
          <div className="text-[11px] text-gray-400">
            by {order.cashier.firstName} {order.cashier.lastName}
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="text-gray-900 truncate max-w-[180px]">{customerName}</div>
        {phone && <div className="text-[11px] text-gray-400">{phone}</div>}
      </td>
      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
        {new Date(order.createdAt).toLocaleDateString()}
        <div className="text-[11px] text-gray-400">
          {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </td>
      <td className="px-4 py-3 text-gray-600">
        {order.items?.length ?? 0}
        {order.items?.some((i) => i.isGift) && (
          <span className="ml-1 inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-pink-50 text-pink-700 text-[10px] font-medium" title="Has gift lines">
            <Gift className="h-2.5 w-2.5" /> gift
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <PaymentBadge method={order.paymentMethod} />
      </td>
      <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">
        {symbol}
        {order.total.toFixed(2)}
        {order.pendingAmount && order.pendingAmount > 0 ? (
          <div className="text-[11px] text-orange-600 font-medium">
            {symbol}{order.pendingAmount.toFixed(2)} pending
          </div>
        ) : null}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col items-start gap-1">
          <StatusBadge paymentStatus={order.paymentStatus} orderStatus={order.orderStatus} />
          <WhatsAppBadge status={order.whatsappStatus} compact />
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={onView}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
            title="View details"
          >
            <Eye className="h-4 w-4" />
          </button>
          <Link
            href={`/admin/pos/invoice/${order._id}`}
            target="_blank"
            className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded"
            title="Open invoice"
          >
            <FileText className="h-4 w-4" />
          </Link>
          {hasOpenBalance && perms.pay && (
            <button
              onClick={onPay}
              disabled={deleting}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded disabled:opacity-60 disabled:cursor-not-allowed"
              title={`Record payment (${symbol}${(order.pendingAmount || 0).toFixed(2)} pending)`}
            >
              <DollarSign className="h-3.5 w-3.5" />
              Pay
            </button>
          )}
          {canRefund && (
            <button
              onClick={onRefund}
              disabled={deleting || (typeof navigator !== 'undefined' && navigator.onLine === false)}
              className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded disabled:opacity-60 disabled:cursor-not-allowed"
              title={typeof navigator !== 'undefined' && navigator.onLine === false ? 'Refunds need internet' : 'Refund (stock goes back)'}
              aria-label="Refund order"
            >
              <Undo2 className="h-4 w-4" />
            </button>
          )}
          {perms.remove && (
            <button
              onClick={onDelete}
              disabled={anyDeleting}
              aria-busy={deleting}
              aria-label={deleting ? 'Deleting order' : 'Delete order'}
              className="p-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-60 disabled:cursor-not-allowed"
              title={deleting ? 'Deleting…' : 'Delete order'}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function OrderDetailModal({
  order,
  symbol,
  seeCost,
  onClose,
}: {
  order: POSOrder;
  symbol: string;
  seeCost: boolean;
  onClose: () => void;
}) {
  const discounts = (order.appliedDiscounts || []).filter((d) => d.amount > 0);
  const customerName =
    order.customerInfo?.name ||
    (order.customer ? `${order.customer.firstName} ${order.customer.lastName ?? ''}`.trim() : 'Walk-in');
  const phone = order.customerInfo?.phone || order.customer?.phone || '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Receipt className="h-5 w-5 text-honey-700" /> {order.orderNumber}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {new Date(order.createdAt).toLocaleString()}
              {order.cashier && ` • by ${order.cashier.firstName} ${order.cashier.lastName}`}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50 rounded-lg p-3 border border-gray-100">
            <Field label="Customer" value={customerName} />
            <Field label="Phone" value={phone || '—'} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <WhatsAppBadge status={order.whatsappStatus} orderId={order._id} />
          </div>

          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Items ({order.items.length})
            </div>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="text-left px-3 py-2">Item</th>
                    <th className="text-center px-3 py-2">Qty</th>
                    <th className="text-right px-3 py-2">Price</th>
                    <th className="text-right px-3 py-2">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {order.items.map((item, i) => {
                    const name = orderItemName(item);
                    return (
                      <tr key={i}>
                        <td className="px-3 py-2">
                          <div className="font-medium text-gray-900">{name}</div>
                          {(item.color || item.size) && (
                            <div className="text-xs text-gray-500">
                              {[item.color, item.size].filter(Boolean).join(' / ')}
                            </div>
                          )}
                          {item.sku && (
                            <div className="text-[11px] text-gray-400">SKU: {item.sku}</div>
                          )}
                          {item.isGift && (
                            <div className="text-[11px] text-pink-700 inline-flex items-center gap-1">
                              <Gift className="h-3 w-3" /> Gift{item.giftReason ? `: ${item.giftReason}` : ''}
                            </div>
                          )}
                          {seeCost && item.costPrice !== undefined && (
                            <div className="text-[11px] text-gray-400">Cost {symbol}{Number(item.costPrice).toFixed(2)} each</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">{item.quantity}</td>
                        <td className="px-3 py-2 text-right">
                          {item.isGift ? '—' : `${symbol}${item.price.toFixed(2)}`}
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          {item.isGift ? (
                            <span className="text-pink-700">FREE — gift</span>
                          ) : (
                            <>
                              {symbol}
                              {(item.price * item.quantity - (item.discount || 0)).toFixed(2)}
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>{symbol}{order.subtotal.toFixed(2)}</span>
            </div>
            {order.appliedTaxes && order.appliedTaxes.length > 0 ? (
              order.appliedTaxes.map((t, i) => (
                <div key={i} className="flex justify-between text-gray-600">
                  <span>{t.name} ({t.rate}%)</span>
                  <span>{symbol}{t.amount.toFixed(2)}</span>
                </div>
              ))
            ) : order.tax > 0 ? (
              <div className="flex justify-between text-gray-600">
                <span>Tax</span>
                <span>{symbol}{order.tax.toFixed(2)}</span>
              </div>
            ) : null}
            {discounts.length > 0 ? (
              discounts.map((d, i) => (
                <div key={i} className="flex justify-between gap-2 text-green-600">
                  <span className="truncate">{d.name}</span>
                  <span className="whitespace-nowrap">-{symbol}{d.amount.toFixed(2)}</span>
                </div>
              ))
            ) : order.discount > 0 ? (
              <div className="flex justify-between text-green-600">
                <span>Discount</span>
                <span>-{symbol}{order.discount.toFixed(2)}</span>
              </div>
            ) : null}
            <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-200">
              <span>Total</span>
              <span>{symbol}{order.total.toFixed(2)}</span>
            </div>
            {seeCost && order.cogs !== undefined && (
              <div className="pt-2 border-t border-dashed border-gray-300 grid grid-cols-2 gap-x-4 text-xs">
                <div className="flex justify-between"><span className="text-gray-500">Cost of sales</span><span className="font-semibold">{symbol}{(order.cogs || 0).toFixed(2)}</span></div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Profit</span>
                  <span className={`font-semibold ${(order.profit || 0) < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{symbol}{(order.profit || 0).toFixed(2)}</span>
                </div>
                {(order.giftCost || 0) > 0 && (
                  <div className="flex justify-between col-span-2"><span className="text-gray-500">of which gifts</span><span className="font-semibold text-pink-700">{symbol}{(order.giftCost || 0).toFixed(2)}</span></div>
                )}
              </div>
            )}
            {(order.paymentStatus === 'partial' || order.paymentStatus === 'pending') && (
              <div className="pt-2 border-t border-dashed border-gray-300">
                <div className="grid grid-cols-2 text-xs">
                  <div className="flex justify-between"><span className="text-gray-500">Paid</span><span className="text-green-600 font-semibold">{symbol}{(order.paidAmount || 0).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Pending</span><span className="text-orange-600 font-semibold">{symbol}{(order.pendingAmount || 0).toFixed(2)}</span></div>
                </div>
              </div>
            )}
          </div>

          {order.paymentHistory && order.paymentHistory.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Payment History
              </div>
              <div className="space-y-2">
                {order.paymentHistory.map((p, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 bg-white border border-gray-200 rounded-lg text-sm">
                    <div>
                      <div className="font-medium text-gray-900 capitalize">
                        {p.paymentMethod.replace('_', ' ')}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {new Date(p.paidAt).toLocaleString()}
                        {p.note && ` • ${p.note}`}
                      </div>
                    </div>
                    <div className="text-green-600 font-semibold">
                      {symbol}{p.amount.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <Link
            href={`/admin/pos/invoice/${order._id}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-700 bg-white border border-blue-200 rounded hover:bg-blue-50"
          >
            <FileText className="h-4 w-4" /> Open Invoice
          </Link>
          <button
            onClick={onClose}
            className="ml-auto px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-sm text-gray-900 truncate">{value}</div>
    </div>
  );
}

function AddPaymentModal({
  order,
  symbol,
  onClose,
  onSuccess,
}: {
  order: POSOrder;
  symbol: string;
  onClose: () => void;
  onSuccess: (updated: POSOrder) => void;
}) {
  const pending = order.pendingAmount || 0;
  const [amount, setAmount] = useState<string>(pending.toFixed(2));
  const [method, setMethod] = useState<'cash' | 'card' | 'bank_transfer'>('cash');
  const [note, setNote] = useState('');
  const [discount, setDiscount] = useState('');
  const [processing, setProcessing] = useState(false);
  const submitLock = useRef(false);

  const fmt = (n: number) => `${symbol}${(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  const amt = parseFloat(amount) || 0;
  const disc = parseFloat(discount) || 0;
  const remainingAfter = Math.max(0, pending - disc - amt);

  const customerName =
    order.customerInfo?.name ||
    (order.customer ? `${order.customer.firstName ?? ''} ${order.customer.lastName ?? ''}`.trim() : 'Walk-in');

  const submit = async () => {
    if (submitLock.current) return;
    if (amt <= 0) return toast.error('Enter a payment amount greater than 0');
    if (amt > pending - disc + 0.01) return toast.error('Amount exceeds pending balance');
    submitLock.current = true;
    try {
      setProcessing(true);
      const updated = await addPaymentToOrder(order._id, {
        amount: amt,
        paymentMethod: method as PaymentMethodType,
        note: note.trim() || undefined,
        discount: disc > 0 ? disc : undefined,
      });
      onSuccess(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      submitLock.current = false;
      setProcessing(false);
    }
  };

  const handleClose = () => {
    if (!submitLock.current) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-600" /> Record Payment
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {order.orderNumber} · {customerName}
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={processing}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <fieldset disabled={processing} className="min-w-0 p-4 space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center bg-gray-50 rounded-lg p-3 border border-gray-100">
            <div>
              <div className="text-[10px] text-gray-500 uppercase">Total</div>
              <div className="text-sm font-semibold">{fmt(order.total)}</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500 uppercase">Paid</div>
              <div className="text-sm font-semibold text-emerald-700">{fmt(order.paidAmount || 0)}</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500 uppercase">Pending</div>
              <div className="text-sm font-semibold text-orange-600">{fmt(pending)}</div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Amount Received <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <MoneyInput
                value={amount}
                onValue={setAmount}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                disabled={processing}
              />
              <button
                type="button"
                onClick={() => setAmount((Math.max(0, pending - disc)).toFixed(2))}
                className="px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100"
                disabled={processing}
              >
                Full
              </button>
              <button
                type="button"
                onClick={() => setAmount((Math.max(0, pending - disc) / 2).toFixed(2))}
                className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100"
                disabled={processing}
              >
                Half
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Payment Method</label>
            <div className="grid grid-cols-3 gap-2">
              <MethodOption
                label="Cash"
                icon={<Banknote className="h-4 w-4" />}
                active={method === 'cash'}
                onClick={() => setMethod('cash')}
              />
              <MethodOption
                label="Card"
                icon={<CreditCard className="h-4 w-4" />}
                active={method === 'card'}
                onClick={() => setMethod('card')}
              />
              <MethodOption
                label="Bank"
                icon={<Building2 className="h-4 w-4" />}
                active={method === 'bank_transfer'}
                onClick={() => setMethod('bank_transfer')}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Discount <span className="text-gray-400 text-[10px]">(optional)</span>
              </label>
              <MoneyInput
                value={discount}
                onValue={setDiscount}
                placeholder="0.00"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                disabled={processing}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Note <span className="text-gray-400 text-[10px]">(optional)</span>
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Reference or memo"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                disabled={processing}
              />
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-gray-300 p-2.5 bg-gray-50 text-xs text-gray-600 flex items-center justify-between">
            <span>After this payment</span>
            <span className={`font-semibold ${remainingAfter === 0 ? 'text-emerald-700' : 'text-orange-600'}`}>
              {remainingAfter === 0 ? 'Fully paid' : `${fmt(remainingAfter)} still pending`}
            </span>
          </div>
        </fieldset>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <button
            onClick={handleClose}
            disabled={processing}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={processing || amt <= 0}
            aria-busy={processing}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Recording…
              </>
            ) : (
              <>
                <DollarSign className="h-4 w-4" /> Record Payment
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function RefundModal({
  order,
  symbol,
  onClose,
  onDone,
}: {
  order: POSOrder;
  symbol: string;
  onClose: () => void;
  onDone: (updated: POSOrder) => void;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const submit = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      onDone(await refundPOSOrder(order._id, reason.trim() || undefined));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not refund');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => !busy && onClose()}>
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Undo2 className="h-5 w-5 text-amber-600" /> Refund {order.orderNumber}
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {symbol}
            {order.total.toFixed(2)} · every piece goes back into stock (shown in the stock ledger).
          </p>
        </div>
        <div className="p-4">
          <label className="block text-xs font-medium text-gray-700 mb-1">Reason (optional)</label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={busy}
            placeholder="e.g. customer changed mind, broken item"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <button onClick={onClose} disabled={busy} className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-60">
            Cancel
          </button>
          <button onClick={submit} disabled={busy} aria-busy={busy} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded hover:bg-amber-700 disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
            {busy ? 'Refunding…' : 'Refund order'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MethodOption({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex flex-col items-center justify-center gap-1 py-2 rounded border transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
        active
          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
      }`}
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}
