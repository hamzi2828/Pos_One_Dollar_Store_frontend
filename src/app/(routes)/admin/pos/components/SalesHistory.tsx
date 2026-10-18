// Sales History Component
'use client';

import { useRef, useState } from 'react';
import { POSOrder } from '../types';
import { Receipt, Clock, Eye, Image as ImageIcon, Printer, Loader2 } from 'lucide-react';
import { getCurrencySymbol } from '../utils/currency';
import { printReceipt } from '../utils/receipt';
import WhatsAppBadge from './WhatsAppBadge';

interface SalesHistoryProps {
  orders: POSOrder[];
  onViewReceipt?: (order: POSOrder) => void;
  showDate?: boolean;
  storeName?: string;
  currency?: string;
}

export default function SalesHistory({ orders, onViewReceipt, showDate = false, storeName = 'DOLLAR & Co', currency = 'PKR' }: SalesHistoryProps) {
  const symbol = getCurrencySymbol(currency);
  // Brief lock while the print dialog spins up, so a double click doesn't queue two prints.
  const [printingId, setPrintingId] = useState<string | null>(null);
  const printLock = useRef(false);
  if (orders.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Receipt className="h-12 w-12 mx-auto mb-2 text-gray-400" />
        <p>{showDate ? 'No sales found' : 'No sales today'}</p>
      </div>
    );
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    if (showDate) {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Print thermal receipt (utils/receipt.ts: discounts + gift lines included)
  const printThermalReceipt = (order: POSOrder) => {
    if (printLock.current) return;
    printLock.current = true;
    setPrintingId(order._id);
    setTimeout(() => {
      printLock.current = false;
      setPrintingId(null);
    }, 1500);
    printReceipt(order, storeName, symbol);
  };

  const getPaymentBadge = (method: string) => {
    const badges: Record<string, string> = {
      cash: 'bg-green-100 text-green-800',
      card: 'bg-blue-100 text-blue-800',
      split: 'bg-purple-100 text-purple-800',
      bank_transfer: 'bg-purple-100 text-purple-800',
    };
    return badges[method] || 'bg-gray-100 text-gray-800';
  };

  const formatPaymentMethod = (method: string) => {
    if (method === 'bank_transfer') return 'BANK';
    return method.toUpperCase();
  };

  return (
    <div className="space-y-3">
      {orders.map((order) => (
        <div
          key={order._id}
          className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="font-semibold text-gray-900">
                Order #{order.orderNumber}
              </div>
              <div className="text-xs text-blue-600 font-medium">
                Invoice: {order.orderNumber}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                <Clock className="h-3 w-3" />
                <span>{formatTime(order.createdAt)}</span>
                {order.customer && (
                  <>
                    <span>•</span>
                    <span>
                      {order.customer.firstName} {order.customer.lastName}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="font-bold text-gray-900">
                {symbol}{order.total.toFixed(2)}
              </div>
              <span
                className={`inline-block px-2 py-0.5 rounded text-xs font-medium mt-1 ${getPaymentBadge(
                  order.paymentMethod
                )}`}
              >
                {formatPaymentMethod(order.paymentMethod)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex flex-wrap items-center gap-1.5 text-sm text-gray-600">
              <span>{order.items.length} item(s)</span>
              {order.items.some((i) => i.isGift) && (
                <span className="px-1.5 py-0.5 rounded bg-pink-50 text-pink-700 text-[11px] font-medium">Gift</span>
              )}
              {order.discount > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-green-50 text-green-700 text-[11px] font-medium">
                  −{symbol}{order.discount.toFixed(0)}
                </span>
              )}
              <WhatsAppBadge status={order.whatsappStatus} compact />
            </div>
            <div className="flex items-center gap-1">
              {order.paymentMethod === 'bank_transfer' && order.bankTransferScreenshot && (
                <button
                  onClick={() => window.open(order.bankTransferScreenshot, '_blank')}
                  className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                  title="View Bank Transfer Screenshot"
                >
                  <ImageIcon className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => printThermalReceipt(order)}
                disabled={!!printingId}
                aria-busy={printingId === order._id}
                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                title={printingId === order._id ? 'Printing…' : 'Print Receipt'}
              >
                {printingId === order._id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="h-4 w-4" />
                )}
              </button>
              <button
                onClick={() => window.open(`/admin/pos/invoice/${order._id}`, '_blank')}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="View Invoice"
              >
                <Eye className="h-4 w-4" />
              </button>
            </div>
          </div>

          {onViewReceipt && (
            <button
              onClick={() => onViewReceipt(order)}
              className="mt-3 w-full bg-gray-100 text-gray-700 py-2 px-3 rounded text-sm font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
            >
              <Receipt className="h-4 w-4" />
              View Receipt
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
