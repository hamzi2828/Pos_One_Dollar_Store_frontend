// Sales History Component
'use client';

import { POSOrder } from '../types';
import { Receipt, Clock, Eye, Image as ImageIcon, Printer } from 'lucide-react';
import { getCurrencySymbol } from '../utils/currency';

interface SalesHistoryProps {
  orders: POSOrder[];
  onViewReceipt?: (order: POSOrder) => void;
  showDate?: boolean;
  storeName?: string;
  currency?: string;
}

export default function SalesHistory({ orders, onViewReceipt, showDate = false, storeName = 'HAMZA MOBILE & COMMUNICATION', currency = 'PKR' }: SalesHistoryProps) {
  const symbol = getCurrencySymbol(currency);
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

  // Print thermal receipt
  const printThermalReceipt = (order: POSOrder) => {
    const receiptDate = new Date(order.createdAt);
    const formattedDate = receiptDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const formattedTime = receiptDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const paymentMethodLabel = order.paymentMethod === 'bank_transfer' ? 'Bank Transfer' :
      order.paymentMethod.charAt(0).toUpperCase() + order.paymentMethod.slice(1);

    const receiptHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${order.orderNumber}</title>
        <style>
          @page {
            size: 72mm auto;
            margin: 0;
          }
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          html, body {
            width: 72mm;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: 'Courier New', monospace;
            font-size: 11px;
            width: 72mm;
            padding: 3mm;
            background: white;
          }
          .header {
            text-align: center;
            margin-bottom: 8px;
            border-bottom: 1px dashed #000;
            padding-bottom: 8px;
          }
          .store-name {
            font-size: 14px;
            font-weight: bold;
          }
          .order-info {
            margin: 8px 0;
            border-bottom: 1px dashed #000;
            padding-bottom: 8px;
          }
          .row {
            display: flex;
            justify-content: space-between;
            margin: 2px 0;
          }
          .items {
            margin: 8px 0;
            border-bottom: 1px dashed #000;
            padding-bottom: 8px;
          }
          .item {
            margin: 4px 0;
          }
          .item-name {
            font-weight: bold;
          }
          .item-details {
            display: flex;
            justify-content: space-between;
            padding-left: 8px;
          }
          .totals {
            margin: 8px 0;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            margin: 2px 0;
          }
          .grand-total {
            font-size: 13px;
            font-weight: bold;
            border-top: 1px solid #000;
            padding-top: 4px;
            margin-top: 4px;
          }
          .payment-info {
            margin: 8px 0;
            border-top: 1px dashed #000;
            padding-top: 8px;
          }
          .footer {
            text-align: center;
            margin-top: 10px;
            border-top: 1px dashed #000;
            padding-top: 8px;
          }
          @media print {
            html, body {
              width: 72mm;
            }
            @page {
              size: 72mm auto;
              margin: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="store-name">${storeName}</div>
          <div style="font-size: 10px; margin-top: 4px;">${order.orderNumber}</div>
          <div>Thank you for your purchase!</div>
        </div>

        <div class="order-info">
          <div class="row">
            <span>Order #:</span>
            <span>${order.orderNumber}</span>
          </div>
          <div class="row">
            <span>Date:</span>
            <span>${formattedDate}</span>
          </div>
          <div class="row">
            <span>Time:</span>
            <span>${formattedTime}</span>
          </div>
          ${order.customer ? `
          <div class="row">
            <span>Customer:</span>
            <span>${order.customer.firstName} ${order.customer.lastName}</span>
          </div>
          ` : ''}
          ${order.cashier ? `
          <div class="row">
            <span>Cashier:</span>
            <span>${order.cashier.firstName}</span>
          </div>
          ` : ''}
        </div>

        <div class="items">
          ${order.items.map(item => {
            const productName = typeof item.product === 'object' && item.product ? item.product.name : (item.labourDescription || item.outsourceDescription || 'Product');
            return `
            <div class="item">
              <div class="item-name">${productName}</div>
              ${item.size || item.color ? `<div style="font-size: 10px; color: #666;">${item.size || ''} ${item.color || ''}</div>` : ''}
              <div class="item-details">
                <span>${item.quantity} x ${symbol}${item.price.toFixed(2)}</span>
                <span>${symbol}${(item.quantity * item.price).toFixed(2)}</span>
              </div>
            </div>
            `;
          }).join('')}
        </div>

        <div class="totals">
          <div class="total-row">
            <span>Subtotal:</span>
            <span>${symbol}${order.subtotal.toFixed(2)}</span>
          </div>
          <div class="total-row">
            <span>Tax:</span>
            <span>${symbol}${order.tax.toFixed(2)}</span>
          </div>
          ${order.discount > 0 ? `
          <div class="total-row">
            <span>Discount:</span>
            <span>-${symbol}${order.discount.toFixed(2)}</span>
          </div>
          ` : ''}
          <div class="total-row grand-total">
            <span>TOTAL:</span>
            <span>${symbol}${order.total.toFixed(2)}</span>
          </div>
        </div>

        <div class="payment-info">
          <div class="row">
            <span>Payment:</span>
            <span>${paymentMethodLabel}</span>
          </div>
          ${order.cashAmount ? `
          <div class="row">
            <span>Cash:</span>
            <span>${symbol}${order.cashAmount.toFixed(2)}</span>
          </div>
          ` : ''}
          ${order.changeGiven ? `
          <div class="row">
            <span>Change:</span>
            <span>${symbol}${order.changeGiven.toFixed(2)}</span>
          </div>
          ` : ''}
        </div>

        <div class="footer">
          <div>Thank you!</div>
          <div>Please come again</div>
        </div>

        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() {
              window.close();
            };
            setTimeout(function() {
              window.close();
            }, 1000);
          }
        </script>
      </body>
      </html>
    `;

    // Use hidden iframe for silent printing
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.top = '-10000px';
    iframe.style.left = '-10000px';
    iframe.style.width = '80mm';
    iframe.style.height = '0';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(receiptHTML);
      iframeDoc.close();

      iframe.onload = () => {
        iframe.contentWindow?.print();
        // Remove iframe after printing
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      };
    }
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
            <div className="text-sm text-gray-600">
              {order.items.length} item(s)
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
                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                title="Print Receipt"
              >
                <Printer className="h-4 w-4" />
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
