// POS Invoice Page
'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { jsPDF } from 'jspdf';
import toast from 'react-hot-toast';
import { POSOrder } from '../../types';
import { getPOSOrderById, getSettings } from '../../services/posOrderService';
import { getCurrencySymbol } from '../../utils/currency';
import { ArrowLeft, Download, Banknote, CreditCard, Building2, CheckCircle2, Clock, AlertCircle, Loader2 } from 'lucide-react';

export default function InvoicePage() {
  const params = useParams();
  const orderId = params.id as string;

  const [order, setOrder] = useState<POSOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string>('MIRPUR MOBILE & STATIONERY');

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [orderData, settingsData] = await Promise.all([
          getPOSOrderById(orderId),
          getSettings()
        ]);
        setOrder(orderData);
        if (settingsData?.storeName) {
          setStoreName(settingsData.storeName);
        }
        // Set document title to order number for PDF filename
        if (orderData?.orderNumber) {
          document.title = orderData.orderNumber;
        }
      } catch (err) {
        setError('Failed to load order');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (orderId) {
      loadData();
    }
  }, [orderId]);

  const currency = 'PKR';
  const symbol = getCurrencySymbol(currency);

  const [downloading, setDownloading] = useState(false);
  const downloadLock = useRef(false);

  const handleDownload = () => {
    if (!order || downloadLock.current) return;
    downloadLock.current = true;
    setDownloading(true);
    // jsPDF blocks the main thread — yield briefly so the spinner paints first.
    setTimeout(() => {
      try {
        generateInvoicePdf(order, storeName, symbol);
      } catch (err) {
        console.error('PDF generation failed:', err);
        toast.error('Failed to generate PDF');
      } finally {
        downloadLock.current = false;
        setDownloading(false);
      }
    }, 50);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading invoice...</div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500">{error || 'Order not found'}</div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatPaymentDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'cash':
        return <Banknote className="h-4 w-4 text-green-600" />;
      case 'card':
        return <CreditCard className="h-4 w-4 text-blue-600" />;
      case 'bank_transfer':
        return <Building2 className="h-4 w-4 text-purple-600" />;
      default:
        return null;
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

  const getOrdinalSuffix = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      {/* Print Controls - Hidden when printing */}
      <div className="max-w-3xl mx-auto mb-4 px-4 print:hidden">
        <div className="flex justify-between items-center">
          <button
            onClick={() => window.close()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Close
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            aria-busy={downloading}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {downloading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Download
              </>
            )}
          </button>
        </div>
      </div>

      {/* Invoice */}
      <div className="max-w-3xl mx-auto bg-white shadow-lg rounded-lg overflow-hidden print:shadow-none print:rounded-none">
        {/* Header */}
        <div className="bg-gray-900 text-white p-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold">INVOICE</h1>
              <p className="text-gray-300 mt-1">#{order.orderNumber}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold">{storeName}</p>
              <p className="text-sm text-gray-300">Point of Sale</p>
            </div>
          </div>
        </div>

        {/* Customer Info Section */}
        <div className="p-6 border-b bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-[#DC2626] rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">
                  {(order.customerInfo?.name || order.customer?.firstName || 'W').charAt(0)}
                </span>
              </div>
              <div>
                <h3 className="text-xs font-medium text-gray-500 uppercase">Customer</h3>
                <p className="text-gray-900 font-semibold">
                  {order.customerInfo?.name ||
                   (order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : 'Walk-in Customer')}
                </p>
              </div>
            </div>
            <div>
              <h3 className="text-xs font-medium text-gray-500 uppercase">Mobile</h3>
              <p className="text-gray-900 font-semibold">
                {order.customerInfo?.phone || order.customer?.phone || '-'}
              </p>
            </div>
          </div>
        </div>

        {/* Order Info */}
        <div className="p-6 border-b">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Date</h3>
              <p className="text-gray-900">{formatDate(order.createdAt)}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Payment Method</h3>
              <p className="text-gray-900 capitalize">{order.paymentMethod}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Status</h3>
              <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                order.orderStatus === 'completed'
                  ? 'bg-green-100 text-green-800'
                  : order.orderStatus === 'refunded'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {order.orderStatus.toUpperCase()}
              </span>
            </div>
            {order.customer?.email && !order.customer.email.includes('@walkincustomer.local') && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Email</h3>
                <p className="text-gray-900">{order.customer.email}</p>
              </div>
            )}
          </div>
        </div>

        {/* Items */}
        <div className="p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Order Items</h3>
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 text-sm font-medium text-gray-500">Item</th>
                <th className="text-center py-2 text-sm font-medium text-gray-500">Qty</th>
                <th className="text-right py-2 text-sm font-medium text-gray-500">Price</th>
                <th className="text-right py-2 text-sm font-medium text-gray-500">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, index) => (
                <tr key={index} className="border-b">
                  <td className="py-3">
                    <div className="font-medium text-gray-900">
                      {item.isLabour
                        ? item.labourDescription || 'Custom'
                        : item.isOutsource
                        ? item.outsourceDescription || 'Custom Item'
                        : typeof item.product === 'object' ? item.product?.name : 'Product'}
                    </div>
                    {(item.color || item.size) && (
                      <div className="text-sm text-gray-500">
                        {[item.color, item.size].filter(Boolean).join(' / ')}
                      </div>
                    )}
                    {item.sku && !item.isLabour && !item.isOutsource && (
                      <div className="text-xs text-gray-400">SKU: {item.sku}</div>
                    )}
                  </td>
                  <td className="py-3 text-center text-gray-900">{item.quantity}</td>
                  <td className="py-3 text-right text-gray-900">{symbol}{item.price.toFixed(2)}</td>
                  <td className="py-3 text-right text-gray-900">
                    {symbol}{(item.price * item.quantity - (item.discount || 0)).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="p-6 bg-gray-50">
          <div className="space-y-2">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>{symbol}{order.subtotal.toFixed(2)}</span>
            </div>
            {/* Tax Display - Show breakdown if multiple taxes applied */}
            {order.appliedTaxes && order.appliedTaxes.length > 0 ? (
              <>
                {order.appliedTaxes.length === 1 ? (
                  // Single tax - show name and rate
                  <div className="flex justify-between text-gray-600">
                    <span>{order.appliedTaxes[0].name} ({order.appliedTaxes[0].rate}%)</span>
                    <span>{symbol}{order.appliedTaxes[0].amount.toFixed(2)}</span>
                  </div>
                ) : (
                  // Multiple taxes - show each
                  <>
                    <div className="flex justify-between text-gray-600">
                      <span>Taxes</span>
                      <span>{symbol}{order.tax.toFixed(2)}</span>
                    </div>
                    <div className="pl-4 space-y-1 border-l-2 border-gray-200 ml-2">
                      {order.appliedTaxes.map((appliedTax, index) => (
                        <div key={index} className="flex justify-between text-sm text-gray-500">
                          <span>{appliedTax.name} ({appliedTax.rate}%)</span>
                          <span>{symbol}{appliedTax.amount.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              // Fallback for legacy orders without appliedTaxes
              <div className="flex justify-between text-gray-600">
                <span>Tax</span>
                <span>{symbol}{order.tax.toFixed(2)}</span>
              </div>
            )}
            {order.discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span>
                <span>-{symbol}{order.discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t">
              <span>Total</span>
              <span>{symbol}{order.total.toFixed(2)}</span>
            </div>
            {order.paymentMethod === 'cash' && order.cashAmount && (
              <>
                <div className="flex justify-between text-gray-600">
                  <span>Cash Received</span>
                  <span>{symbol}{order.cashAmount.toFixed(2)}</span>
                </div>
                {order.changeGiven !== undefined && (
                  <div className="flex justify-between text-gray-600">
                    <span>Change</span>
                    <span>{symbol}{order.changeGiven.toFixed(2)}</span>
                  </div>
                )}
              </>
            )}

            {/* Payment Status for Partial Payments */}
            {(order.paymentStatus === 'partial' || order.paymentStatus === 'pending') && (
              <div className="mt-4 pt-3 border-t border-dashed border-gray-300">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-gray-700 font-medium">
                    {order.paymentStatus === 'partial' ? (
                      <Clock className="h-4 w-4 text-yellow-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                    Payment Status
                  </span>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    order.paymentStatus === 'partial'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {order.paymentStatus === 'partial' ? 'PARTIALLY PAID' : 'PENDING'}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Paid:</span>
                    <span className="text-green-600 font-medium">{symbol}{(order.paidAmount || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Pending:</span>
                    <span className="text-red-600 font-medium">{symbol}{(order.pendingAmount || 0).toFixed(2)}</span>
                  </div>
                </div>
                {/* Progress Bar */}
                <div className="mt-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all"
                      style={{ width: `${((order.paidAmount || 0) / order.total) * 100}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 text-right mt-1">
                    {(((order.paidAmount || 0) / order.total) * 100).toFixed(0)}% paid
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Payment History */}
        {order.paymentHistory && order.paymentHistory.length > 0 && (
          <div className="p-6 border-t">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Payment History
            </h3>
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-3 top-3 bottom-3 w-0.5 bg-gray-200" />

              <div className="space-y-4">
                {order.paymentHistory.map((payment, idx) => (
                  <div key={payment._id || idx} className="relative flex gap-4 pl-8">
                    {/* Timeline dot */}
                    <div className={`absolute left-0 w-6 h-6 rounded-full flex items-center justify-center ${
                      idx === 0 ? 'bg-blue-500' : 'bg-green-500'
                    } text-white text-xs font-bold`}>
                      {idx + 1}
                    </div>

                    <div className="flex-1 bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`font-semibold ${
                              idx === 0 ? 'text-blue-700' : 'text-gray-700'
                            }`}>
                              {idx === 0 ? '1st Payment (Initial)' : `${getOrdinalSuffix(idx + 1)} Payment`}
                            </span>
                            <span className="flex items-center gap-1 text-sm text-gray-500 bg-white px-2 py-0.5 rounded border">
                              {getPaymentMethodIcon(payment.paymentMethod)}
                              {getPaymentMethodLabel(payment.paymentMethod)}
                            </span>
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            {formatPaymentDate(payment.paidAt)}
                          </div>
                          {payment.receivedBy && (
                            <div className="text-xs text-gray-400 mt-1">
                              Received by: {payment.receivedBy.firstName} {payment.receivedBy.lastName}
                            </div>
                          )}
                          {payment.note && (
                            <div className="text-sm text-gray-500 mt-2 italic bg-white px-2 py-1 rounded border-l-2 border-gray-300">
                              &quot;{payment.note}&quot;
                            </div>
                          )}
                          {payment.paymentStatus && (
                            <div className="mt-2">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                payment.paymentStatus === 'full' ? 'bg-green-100 text-green-800' :
                                payment.paymentStatus === 'completed' ? 'bg-blue-100 text-blue-800' :
                                payment.paymentStatus === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {payment.paymentStatus === 'full' ? 'Paid in Full' :
                                 payment.paymentStatus === 'completed' ? 'Completed' :
                                 payment.paymentStatus === 'partial' ? 'Partial' :
                                 payment.paymentStatus.charAt(0).toUpperCase() + payment.paymentStatus.slice(1)}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-green-600">
                            {symbol}{payment.amount.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Show remaining if partial */}
                {order.paymentStatus === 'partial' && order.pendingAmount && order.pendingAmount > 0 && (
                  <div className="relative flex gap-4 pl-8">
                    <div className="absolute left-0 w-6 h-6 rounded-full flex items-center justify-center bg-orange-500 text-white text-xs font-bold animate-pulse">
                      ?
                    </div>
                    <div className="flex-1 bg-orange-50 rounded-lg p-3 border border-orange-200 border-dashed">
                      <div className="flex items-center justify-between">
                        <span className="text-orange-700 font-medium">
                          Next Payment Pending
                        </span>
                        <span className="text-lg font-bold text-orange-600">
                          {symbol}{order.pendingAmount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-6 text-center text-sm text-gray-500 border-t">
          <p>Thank you for your purchase!</p>
          {order.cashier && (
            <p className="mt-1">
              Served by: {order.cashier.firstName} {order.cashier.lastName}
            </p>
          )}
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          .print\\:rounded-none {
            border-radius: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}

// ------------------------------------------------------------
// Inline PDF generation using jsPDF (no jspdf-autotable dep)
// Manually renders a simple but complete invoice PDF.
// ------------------------------------------------------------
function generateInvoicePdf(order: POSOrder, storeName: string, symbol: string) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  let y = margin;

  const writeLine = (text: string, x: number, yy: number, opts?: { bold?: boolean; size?: number; align?: 'left' | 'center' | 'right' }) => {
    doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal');
    doc.setFontSize(opts?.size ?? 10);
    doc.text(text, x, yy, { align: opts?.align || 'left' });
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // Header bar
  doc.setFillColor(17, 24, 39); // gray-900
  doc.rect(0, 0, pageWidth, 80, 'F');
  doc.setTextColor(255, 255, 255);
  writeLine('INVOICE', margin, 40, { bold: true, size: 20 });
  writeLine(`#${order.orderNumber}`, margin, 60, { size: 10 });
  writeLine(storeName, pageWidth - margin, 40, { bold: true, size: 12, align: 'right' });
  writeLine('Point of Sale', pageWidth - margin, 58, { size: 9, align: 'right' });

  doc.setTextColor(17, 24, 39);
  y = 110;

  // Customer info
  const customerName = order.customerInfo?.name ||
    (order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : 'Walk-in Customer');
  const phone = order.customerInfo?.phone || order.customer?.phone || '-';

  writeLine('CUSTOMER', margin, y, { bold: true, size: 9 });
  writeLine('MOBILE', margin + 180, y, { bold: true, size: 9 });
  y += 14;
  writeLine(customerName, margin, y, { size: 10 });
  writeLine(phone, margin + 180, y, { size: 10 });
  y += 20;

  doc.setDrawColor(229, 231, 235);
  doc.line(margin, y, pageWidth - margin, y);
  y += 14;

  // Order info
  writeLine('Date:', margin, y, { bold: true, size: 9 });
  writeLine(new Date(order.createdAt).toLocaleString('en-US'), margin + 50, y, { size: 10 });
  writeLine('Payment:', margin + 300, y, { bold: true, size: 9 });
  writeLine(order.paymentMethod.replace('_', ' ').toUpperCase(), margin + 355, y, { size: 10 });
  y += 14;
  writeLine('Status:', margin, y, { bold: true, size: 9 });
  writeLine(order.orderStatus.toUpperCase(), margin + 50, y, { size: 10 });
  writeLine('Payment Status:', margin + 300, y, { bold: true, size: 9 });
  writeLine((order.paymentStatus || '-').toUpperCase(), margin + 395, y, { size: 10 });
  y += 20;

  doc.line(margin, y, pageWidth - margin, y);
  y += 14;

  // Items table - manually drawn
  writeLine('Order Items', margin, y, { bold: true, size: 11 });
  y += 14;

  // Column positions
  const colItem = margin;
  const colQty = margin + 280;
  const colPrice = margin + 340;
  const colTotal = pageWidth - margin;

  // Table header
  doc.setFillColor(243, 244, 246);
  doc.rect(margin, y - 10, pageWidth - 2 * margin, 18, 'F');
  writeLine('Item', colItem + 4, y, { bold: true, size: 9 });
  writeLine('Qty', colQty, y, { bold: true, size: 9, align: 'center' });
  writeLine('Price', colPrice, y, { bold: true, size: 9, align: 'right' });
  writeLine('Total', colTotal, y, { bold: true, size: 9, align: 'right' });
  y += 14;

  // Items
  for (const item of order.items) {
    ensureSpace(24);
    const name = item.isLabour
      ? item.labourDescription || 'Custom'
      : item.isOutsource
      ? item.outsourceDescription || 'Custom Item'
      : typeof item.product === 'object' && item.product ? item.product.name : 'Product';

    const wrappedName = doc.splitTextToSize(name, 260) as string[];
    let lineY = y;
    for (const ln of wrappedName) {
      writeLine(ln, colItem + 4, lineY, { size: 10 });
      lineY += 12;
    }
    writeLine(String(item.quantity), colQty, y, { size: 10, align: 'center' });
    writeLine(`${symbol}${item.price.toFixed(2)}`, colPrice, y, { size: 10, align: 'right' });
    const lineTotal = item.price * item.quantity - (item.discount || 0);
    writeLine(`${symbol}${lineTotal.toFixed(2)}`, colTotal, y, { size: 10, align: 'right' });
    y = Math.max(y + 14, lineY);

    // Optional variant info
    if (item.color || item.size) {
      const meta = [item.color, item.size].filter(Boolean).join(' / ');
      doc.setTextColor(107, 114, 128);
      writeLine(meta, colItem + 8, y, { size: 8 });
      doc.setTextColor(17, 24, 39);
      y += 10;
    }

    doc.setDrawColor(243, 244, 246);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
  }

  y += 10;
  ensureSpace(120);

  // Totals
  const totalsX = pageWidth - margin - 200;
  const valueX = pageWidth - margin;

  writeLine('Subtotal:', totalsX, y, { size: 10 });
  writeLine(`${symbol}${order.subtotal.toFixed(2)}`, valueX, y, { size: 10, align: 'right' });
  y += 14;

  if (order.appliedTaxes && order.appliedTaxes.length > 0) {
    for (const t of order.appliedTaxes) {
      writeLine(`${t.name} (${t.rate}%):`, totalsX, y, { size: 10 });
      writeLine(`${symbol}${t.amount.toFixed(2)}`, valueX, y, { size: 10, align: 'right' });
      y += 14;
    }
  } else {
    writeLine('Tax:', totalsX, y, { size: 10 });
    writeLine(`${symbol}${order.tax.toFixed(2)}`, valueX, y, { size: 10, align: 'right' });
    y += 14;
  }

  if (order.discount > 0) {
    doc.setTextColor(22, 163, 74);
    writeLine('Discount:', totalsX, y, { size: 10 });
    writeLine(`-${symbol}${order.discount.toFixed(2)}`, valueX, y, { size: 10, align: 'right' });
    doc.setTextColor(17, 24, 39);
    y += 14;
  }

  doc.setDrawColor(17, 24, 39);
  doc.line(totalsX, y, valueX, y);
  y += 14;
  writeLine('TOTAL:', totalsX, y, { bold: true, size: 12 });
  writeLine(`${symbol}${order.total.toFixed(2)}`, valueX, y, { bold: true, size: 12, align: 'right' });
  y += 22;

  if ((order.paidAmount ?? 0) > 0 || (order.pendingAmount ?? 0) > 0) {
    writeLine('Paid:', totalsX, y, { size: 10 });
    writeLine(`${symbol}${(order.paidAmount || 0).toFixed(2)}`, valueX, y, { size: 10, align: 'right' });
    y += 14;
    writeLine('Pending:', totalsX, y, { size: 10 });
    writeLine(`${symbol}${(order.pendingAmount || 0).toFixed(2)}`, valueX, y, { size: 10, align: 'right' });
    y += 14;
  }

  // Payment history
  if (order.paymentHistory && order.paymentHistory.length > 0) {
    y += 10;
    ensureSpace(40 + order.paymentHistory.length * 20);
    writeLine('Payment History', margin, y, { bold: true, size: 11 });
    y += 14;
    doc.setDrawColor(229, 231, 235);
    doc.line(margin, y - 4, pageWidth - margin, y - 4);
    for (let i = 0; i < order.paymentHistory.length; i++) {
      const p = order.paymentHistory[i];
      ensureSpace(20);
      const label = i === 0 ? '1st Payment' : `#${i + 1} Payment`;
      const method = p.paymentMethod.replace('_', ' ');
      const when = new Date(p.paidAt).toLocaleString('en-US');
      writeLine(`${label} (${method}) - ${when}`, margin, y, { size: 9 });
      writeLine(`${symbol}${p.amount.toFixed(2)}`, valueX, y, { size: 10, align: 'right' });
      y += 14;
      if (p.note) {
        doc.setTextColor(107, 114, 128);
        writeLine(`Note: ${p.note}`, margin + 10, y, { size: 8 });
        doc.setTextColor(17, 24, 39);
        y += 10;
      }
    }
  }

  // Footer
  y = pageHeight - margin - 20;
  doc.setDrawColor(229, 231, 235);
  doc.line(margin, y, pageWidth - margin, y);
  y += 14;
  doc.setTextColor(107, 114, 128);
  writeLine('Thank you for your purchase!', pageWidth / 2, y, { size: 9, align: 'center' });
  if (order.cashier) {
    y += 10;
    writeLine(`Served by: ${order.cashier.firstName} ${order.cashier.lastName}`, pageWidth / 2, y, { size: 8, align: 'center' });
  }

  doc.save(`${order.orderNumber}.pdf`);
}
