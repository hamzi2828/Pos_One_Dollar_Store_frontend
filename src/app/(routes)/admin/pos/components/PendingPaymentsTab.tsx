// Pending Payments Tab Component
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { POSOrder, PaymentMethodType } from '../types';
import { getPendingOrders, addPaymentToOrder } from '../services/posOrderService';
import { getCurrencySymbol } from '../utils/currency';
import MoneyInput from '@/components/ui/MoneyInput';
import { Clock, User, CreditCard, Banknote, Building2, X, Loader2, Check, AlertCircle, RefreshCw, ChevronDown, ChevronUp, Receipt, Calendar, MessageSquare, Percent } from 'lucide-react';

interface PendingPaymentsTabProps {
  currency?: string;
  onPaymentComplete?: () => void;
}

export default function PendingPaymentsTab({
  currency = 'PKR',
  onPaymentComplete,
}: PendingPaymentsTabProps) {
  const symbol = getCurrencySymbol(currency);
  const [pendingOrders, setPendingOrders] = useState<POSOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ totalOrders: 0, totalPending: 0, totalPaid: 0 });

  // Payment modal state
  const [selectedOrder, setSelectedOrder] = useState<POSOrder | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('cash');
  const [paymentNote, setPaymentNote] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paymentLock = useRef(false);

  // Manual refresh (keeps the list visible, spins the refresh button)
  const [refreshing, setRefreshing] = useState(false);
  const refreshLock = useRef(false);

  // Track expanded payment history
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  const loadPendingOrders = useCallback(async (opts?: { silent?: boolean }) => {
    try {
      if (!opts?.silent) setLoading(true);
      const response = await getPendingOrders();
      setPendingOrders(response.data || []);
      setSummary(response.summary || { totalOrders: 0, totalPending: 0, totalPaid: 0 });
    } catch (err) {
      console.error('Failed to load pending orders:', err);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  const handleRefresh = async () => {
    if (refreshLock.current) return;
    refreshLock.current = true;
    setRefreshing(true);
    try {
      await loadPendingOrders({ silent: true });
    } finally {
      refreshLock.current = false;
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadPendingOrders();
  }, [loadPendingOrders]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFullDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'cash':
        return <Banknote className="h-3 w-3 text-green-600" />;
      case 'card':
        return <CreditCard className="h-3 w-3 text-blue-600" />;
      case 'bank_transfer':
        return <Building2 className="h-3 w-3 text-purple-600" />;
      default:
        return <Receipt className="h-3 w-3 text-gray-600" />;
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'cash':
        return 'Cash';
      case 'card':
        return 'Card';
      case 'bank_transfer':
        return 'Bank Transfer';
      default:
        return method;
    }
  };

  const toggleOrderExpanded = (orderId: string) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const getOrdinalSuffix = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  const handleAddPayment = async () => {
    if (!selectedOrder || paymentLock.current) return;

    const amount = parseFloat(paymentAmount);
    const discount = parseFloat(discountAmount) || 0;
    const pendingAfterDiscount = (selectedOrder.pendingAmount || 0) - discount;

    if (!amount || amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (discount > (selectedOrder.pendingAmount || 0)) {
      setError(`Discount cannot exceed pending balance (${symbol}${selectedOrder.pendingAmount?.toFixed(2)})`);
      return;
    }

    if (amount > pendingAfterDiscount) {
      setError(`Amount cannot exceed pending balance after discount (${symbol}${pendingAfterDiscount.toFixed(2)})`);
      return;
    }

    paymentLock.current = true;
    setProcessing(true);
    setError(null);

    try {
      await addPaymentToOrder(selectedOrder._id, {
        amount,
        paymentMethod,
        note: paymentNote || undefined,
        discount: discount > 0 ? discount : undefined,
      });

      // Reset and close modal
      setSelectedOrder(null);
      setPaymentAmount('');
      setDiscountAmount('');
      setPaymentNote('');

      // Reload pending orders
      await loadPendingOrders();

      // Notify parent
      onPaymentComplete?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add payment';
      setError(msg);
    } finally {
      paymentLock.current = false;
      setProcessing(false);
    }
  };

  const closeModal = () => {
    if (paymentLock.current) return;
    setSelectedOrder(null);
    setPaymentAmount('');
    setDiscountAmount('');
    setPaymentNote('');
    setError(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-orange-800">Total Pending</h3>
            <p className="text-2xl font-bold text-orange-900">{symbol}{summary.totalPending.toFixed(2)}</p>
            <p className="text-xs text-orange-600 mt-1">{summary.totalOrders} order(s) with pending payment</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            aria-busy={refreshing}
            aria-label={refreshing ? 'Refreshing' : 'Refresh'}
            className="p-2 text-orange-600 hover:bg-orange-100 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            title={refreshing ? 'Refreshing…' : 'Refresh'}
          >
            <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Pending Orders List */}
      {pendingOrders.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Check className="h-12 w-12 mx-auto mb-2 text-green-400" />
          <p>No pending payments</p>
          <p className="text-sm text-gray-400">All orders are fully paid</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingOrders.map((order) => (
            <div
              key={order._id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-gray-900">
                      {order.orderNumber}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      order.paymentStatus === 'partial'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {order.paymentStatus === 'partial' ? 'Partial' : 'Pending'}
                    </span>
                  </div>
                  {order.customer && (
                    <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                      <User className="h-3 w-3" />
                      <span>{order.customer.firstName} {order.customer.lastName}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                    <Clock className="h-3 w-3" />
                    <span>{formatDate(order.createdAt)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500">Total</div>
                  <div className="font-semibold text-gray-900">{symbol}{order.total.toFixed(2)}</div>
                </div>
              </div>

              {/* Payment Progress */}
              <div className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-green-600">Paid: {symbol}{(order.paidAmount || 0).toFixed(2)}</span>
                  <span className="text-red-600">Pending: {symbol}{(order.pendingAmount || 0).toFixed(2)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{ width: `${((order.paidAmount || 0) / order.total) * 100}%` }}
                  />
                </div>
              </div>

              {/* Payment History */}
              {order.paymentHistory && order.paymentHistory.length > 0 && (
                <div className="mb-3 border-t border-gray-100 pt-2">
                  <button
                    onClick={() => toggleOrderExpanded(order._id)}
                    className="w-full flex items-center justify-between text-xs font-medium text-gray-700 hover:text-gray-900 py-1"
                  >
                    <span className="flex items-center gap-1">
                      <Receipt className="h-3 w-3" />
                      Payment History ({order.paymentHistory.length} payment{order.paymentHistory.length > 1 ? 's' : ''})
                    </span>
                    {expandedOrders.has(order._id) ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>

                  {expandedOrders.has(order._id) ? (
                    // Expanded view - show all payments with full details
                    <div className="mt-2 space-y-2">
                      {order.paymentHistory.map((payment, idx) => (
                        <div
                          key={payment._id || idx}
                          className={`p-2 rounded-lg ${
                            idx === 0
                              ? 'bg-blue-50 border border-blue-100'
                              : 'bg-gray-50 border border-gray-100'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-xs font-semibold ${
                              idx === 0 ? 'text-blue-700' : 'text-gray-700'
                            }`}>
                              {idx === 0 ? '1st Payment (Initial)' : `${getOrdinalSuffix(idx + 1)} Payment`}
                            </span>
                            <span className="text-sm font-bold text-green-600">
                              {symbol}{payment.amount.toFixed(2)}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-1 text-xs text-gray-600">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-gray-400" />
                              <span>{formatFullDate(payment.paidAt)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              {getPaymentMethodIcon(payment.paymentMethod)}
                              <span>{getPaymentMethodLabel(payment.paymentMethod)}</span>
                            </div>
                          </div>

                          {payment.receivedBy && (
                            <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                              <User className="h-3 w-3 text-gray-400" />
                              <span>Received by: {payment.receivedBy.firstName} {payment.receivedBy.lastName}</span>
                            </div>
                          )}

                          {payment.note && (
                            <div className="flex items-start gap-1 text-xs text-gray-500 mt-1">
                              <MessageSquare className="h-3 w-3 text-gray-400 mt-0.5" />
                              <span className="italic">&quot;{payment.note}&quot;</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    // Collapsed view - show summary
                    <div className="mt-1 space-y-1">
                      {order.paymentHistory.slice(0, 2).map((payment, idx) => (
                        <div key={payment._id || idx} className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1 text-gray-500">
                            {getPaymentMethodIcon(payment.paymentMethod)}
                            <span>{idx === 0 ? '1st' : `${getOrdinalSuffix(idx + 1)}`}</span>
                            <span className="text-gray-400">•</span>
                            <span>{formatDate(payment.paidAt)}</span>
                          </span>
                          <span className="text-green-600 font-medium">{symbol}{payment.amount.toFixed(2)}</span>
                        </div>
                      ))}
                      {order.paymentHistory.length > 2 && (
                        <div className="text-xs text-gray-400 text-center">
                          +{order.paymentHistory.length - 2} more payment(s)
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Add Payment Button */}
              <button
                onClick={() => {
                  setSelectedOrder(order);
                  setPaymentAmount(order.pendingAmount?.toFixed(2) || '');
                }}
                className="w-full bg-orange-600 text-white py-2 px-3 rounded text-sm font-medium hover:bg-orange-700 transition-colors"
              >
                Add Payment
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Payment Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-xl mx-4">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Add Payment</h2>
                <p className="text-sm text-gray-500">{selectedOrder.orderNumber}</p>
              </div>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={processing}
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <fieldset disabled={processing} className="min-w-0 p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Order Info */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Order Total:</span>
                  <span className="font-semibold">{symbol}{selectedOrder.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Already Paid:</span>
                  <span className="text-green-600">{symbol}{(selectedOrder.paidAmount || 0).toFixed(2)}</span>
                </div>
                {parseFloat(discountAmount) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Discount:</span>
                    <span className="text-purple-600">-{symbol}{parseFloat(discountAmount).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-semibold border-t border-gray-200 mt-2 pt-2">
                  <span className="text-red-600">Remaining:</span>
                  <span className="text-red-600">
                    {symbol}{((selectedOrder.pendingAmount || 0) - (parseFloat(discountAmount) || 0)).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Customer Info */}
              {selectedOrder.customer && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <User className="h-4 w-4" />
                  <span>{selectedOrder.customer.firstName} {selectedOrder.customer.lastName}</span>
                </div>
              )}

              {/* Previous Payments Timeline */}
              {selectedOrder.paymentHistory && selectedOrder.paymentHistory.length > 0 && (
                <div className="border border-gray-200 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                    <Receipt className="h-4 w-4" />
                    Previous Payments
                  </h4>
                  <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-gray-200" />

                    <div className="space-y-2">
                      {selectedOrder.paymentHistory.map((payment, idx) => (
                        <div key={payment._id || idx} className="relative flex gap-3 pl-6">
                          {/* Timeline dot */}
                          <div className={`absolute left-0 w-4 h-4 rounded-full flex items-center justify-center ${
                            idx === 0 ? 'bg-blue-500' : 'bg-green-500'
                          }`}>
                            <div className="w-2 h-2 rounded-full bg-white" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-gray-700">
                                {idx === 0 ? '1st Payment' : `${getOrdinalSuffix(idx + 1)} Payment`}
                              </span>
                              <span className="text-sm font-semibold text-green-600">
                                {symbol}{payment.amount.toFixed(2)}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                              {getPaymentMethodIcon(payment.paymentMethod)}
                              <span>{getPaymentMethodLabel(payment.paymentMethod)}</span>
                              <span className="text-gray-300">•</span>
                              <span>{formatDate(payment.paidAt)}</span>
                            </div>
                            {payment.note && (
                              <div className="text-xs text-gray-400 italic mt-0.5">&quot;{payment.note}&quot;</div>
                            )}
                          </div>
                        </div>
                      ))}

                      {/* New payment indicator */}
                      <div className="relative flex gap-3 pl-6">
                        <div className="absolute left-0 w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center animate-pulse">
                          <div className="w-2 h-2 rounded-full bg-white" />
                        </div>
                        <div className="text-xs font-medium text-orange-600">
                          {getOrdinalSuffix(selectedOrder.paymentHistory.length + 1)} Payment (Adding now...)
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Discount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <span className="flex items-center gap-1">
                    <Percent className="h-4 w-4 text-purple-500" />
                    Discount (Optional)
                  </span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">
                    {symbol}
                  </span>
                  <MoneyInput
                    value={discountAmount}
                    onValue={(v) => {
                      setDiscountAmount(v);
                      // Auto-adjust payment amount when discount changes
                      const discount = parseFloat(v) || 0;
                      const newRemaining = (selectedOrder.pendingAmount || 0) - discount;
                      if (newRemaining >= 0) {
                        setPaymentAmount(newRemaining.toFixed(2));
                      }
                    }}
                    placeholder="0.00"
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Payment Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">
                    {symbol}
                  </span>
                  <MoneyInput
                    value={paymentAmount}
                    onValue={setPaymentAmount}
                    placeholder="0.00"
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
                {/* Quick amounts */}
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const remaining = (selectedOrder.pendingAmount || 0) - (parseFloat(discountAmount) || 0);
                      setPaymentAmount(remaining.toFixed(2));
                    }}
                    className="flex-1 text-xs py-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200"
                  >
                    Full ({symbol}{((selectedOrder.pendingAmount || 0) - (parseFloat(discountAmount) || 0)).toFixed(2)})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const remaining = (selectedOrder.pendingAmount || 0) - (parseFloat(discountAmount) || 0);
                      setPaymentAmount((remaining / 2).toFixed(2));
                    }}
                    className="flex-1 text-xs py-1.5 bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
                  >
                    Half
                  </button>
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`p-3 rounded-lg border-2 transition-colors ${
                      paymentMethod === 'cash'
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-green-300'
                    }`}
                  >
                    <Banknote className="h-5 w-5 mx-auto mb-1 text-gray-600" />
                    <div className="text-xs font-medium">Cash</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`p-3 rounded-lg border-2 transition-colors ${
                      paymentMethod === 'card'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <CreditCard className="h-5 w-5 mx-auto mb-1 text-gray-600" />
                    <div className="text-xs font-medium">Card</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('bank_transfer')}
                    className={`p-3 rounded-lg border-2 transition-colors ${
                      paymentMethod === 'bank_transfer'
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-purple-300'
                    }`}
                  >
                    <Building2 className="h-5 w-5 mx-auto mb-1 text-gray-600" />
                    <div className="text-xs font-medium">Bank</div>
                  </button>
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Note (Optional)
                </label>
                <input
                  type="text"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="Payment note..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-2 rounded-lg">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Confirm Button */}
              <button
                onClick={handleAddPayment}
                disabled={processing || !paymentAmount || parseFloat(paymentAmount) <= 0}
                aria-busy={processing}
                className={`w-full py-3 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed ${
                  paymentAmount && parseFloat(paymentAmount) > 0
                    ? 'bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-60'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {processing ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Recording payment…
                  </span>
                ) : (
                  <span>
                    Record Payment ({symbol}{parseFloat(paymentAmount || '0').toFixed(2)})
                    {parseFloat(discountAmount) > 0 && (
                      <span className="text-orange-200 ml-1">
                        + {symbol}{parseFloat(discountAmount).toFixed(2)} discount
                      </span>
                    )}
                  </span>
                )}
              </button>
            </fieldset>
          </div>
        </div>
      )}
    </div>
  );
}
