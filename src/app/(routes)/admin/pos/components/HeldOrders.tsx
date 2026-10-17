// Held Orders Component
'use client';

import { useState } from 'react';
import { HeldCart } from '../types';
import { Archive, Trash2, Clock, Eye, X, User, Phone, Car, Package, Wrench, Tag } from 'lucide-react';
import { getCurrencySymbol } from '../utils/currency';

interface HeldOrdersProps {
  heldCarts: HeldCart[];
  onRetrieve: (cartId: string) => void;
  onDelete: (cartId: string) => void;
  currency?: string;
}

export default function HeldOrders({
  heldCarts,
  onRetrieve,
  onDelete,
  currency = 'PKR',
}: HeldOrdersProps) {
  const symbol = getCurrencySymbol(currency);
  const [viewing, setViewing] = useState<HeldCart | null>(null);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const formatDateTime = (dateString: string) =>
    new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  if (heldCarts.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Archive className="h-12 w-12 mx-auto mb-2 text-gray-400" />
        <p>No held orders</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {heldCarts.map((held) => (
          <div
            key={held.id}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="font-semibold text-gray-900">
                  {held.customerName || 'Walk-in Customer'}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                  <Clock className="h-3 w-3" />
                  <span>{formatTime(held.heldAt)}</span>
                  <span>•</span>
                  <span>{held.cart.items.length} item(s)</span>
                  {held.heldBy && (
                    <>
                      <span>•</span>
                      <span className="truncate">by {held.heldBy}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-gray-900">
                  {symbol}
                  {held.cart.total.toFixed(2)}
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setViewing(held)}
                className="flex items-center justify-center gap-1.5 bg-gray-100 text-gray-700 py-2 px-3 rounded text-sm font-medium hover:bg-gray-200 transition-colors"
                title="View held order details"
              >
                <Eye className="h-4 w-4" />
                View
              </button>
              <button
                onClick={() => onRetrieve(held.id)}
                className="flex-1 bg-[#DC2626] text-white py-2 px-3 rounded text-sm font-medium hover:bg-[#B91C1C] transition-colors"
              >
                Retrieve
              </button>
              <button
                onClick={() => onDelete(held.id)}
                className="bg-red-100 text-red-600 py-2 px-3 rounded hover:bg-red-200 transition-colors"
                title="Delete held order"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {viewing && (
        <HeldOrderModal
          held={viewing}
          symbol={symbol}
          formatDateTime={formatDateTime}
          onClose={() => setViewing(null)}
          onRetrieve={(id) => {
            setViewing(null);
            onRetrieve(id);
          }}
          onDelete={(id) => {
            setViewing(null);
            onDelete(id);
          }}
        />
      )}
    </>
  );
}

interface HeldOrderModalProps {
  held: HeldCart;
  symbol: string;
  formatDateTime: (d: string) => string;
  onClose: () => void;
  onRetrieve: (id: string) => void;
  onDelete: (id: string) => void;
}

function HeldOrderModal({ held, symbol, formatDateTime, onClose, onRetrieve, onDelete }: HeldOrderModalProps) {
  const cart = held.cart;
  const customer = cart.customer;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Archive className="h-5 w-5 text-[#DC2626]" />
              Held Order Details
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Held on {formatDateTime(held.heldAt)}
              {held.heldBy && ` by ${held.heldBy}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-md"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Customer */}
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Customer
            </div>
            {customer ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm text-gray-900">
                  <User className="h-4 w-4 text-gray-400" />
                  <span className="font-medium">
                    {customer.firstName} {customer.lastName}
                  </span>
                  {customer.customerType && (
                    <span className="text-xs bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded">
                      {customer.customerType}
                    </span>
                  )}
                </div>
                {customer.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="h-4 w-4 text-gray-400" />
                    {customer.phone}
                  </div>
                )}
                {customer.carDetails && Array.isArray(customer.carDetails) && customer.carDetails.length > 0 && (
                  <div className="flex items-start gap-2 text-sm text-gray-600">
                    <Car className="h-4 w-4 text-gray-400 mt-0.5" />
                    <div className="flex flex-wrap gap-1">
                      {customer.carDetails.map((c, i) => (
                        <span key={i} className="text-xs bg-white border border-gray-200 px-2 py-0.5 rounded">
                          {[c.brand, c.model, c.numberPlate].filter(Boolean).join(' ') || '—'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-gray-500 italic">Walk-in customer (no details)</div>
            )}
          </div>

          {/* Items */}
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Items ({cart.items.length})
            </div>
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden">
              {cart.items.map((item) => {
                const name = item.isLabour
                  ? item.labourDescription || 'Labour'
                  : item.isOutsource
                  ? item.outsourceDescription || 'Outsource'
                  : item.product?.name || 'Product';
                const Icon = item.isLabour ? Wrench : item.isOutsource ? Tag : Package;

                return (
                  <div key={item.id} className="flex items-start gap-3 p-3 bg-white">
                    <div
                      className={`h-8 w-8 rounded flex items-center justify-center flex-shrink-0 ${
                        item.isLabour
                          ? 'bg-orange-100 text-orange-600'
                          : item.isOutsource
                          ? 'bg-purple-100 text-purple-600'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-900 truncate">{name}</div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                        <span>
                          {item.quantity} × {symbol}
                          {item.unitPrice.toFixed(2)}
                        </span>
                        {(item.color || item.size) && (
                          <span>• {[item.color, item.size].filter(Boolean).join(' / ')}</span>
                        )}
                        {item.isOutsource && item.costPrice !== undefined && (
                          <span>• Cost {symbol}{item.costPrice.toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-gray-900 flex-shrink-0">
                      {symbol}
                      {item.subtotal.toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Totals */}
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>
                {symbol}
                {cart.subtotal.toFixed(2)}
              </span>
            </div>
            {cart.appliedTaxes && cart.appliedTaxes.length > 0 ? (
              cart.appliedTaxes.map((t, i) => (
                <div key={i} className="flex justify-between text-gray-600">
                  <span>
                    {t.name} ({t.rate}%)
                  </span>
                  <span>
                    {symbol}
                    {t.amount.toFixed(2)}
                  </span>
                </div>
              ))
            ) : cart.tax > 0 ? (
              <div className="flex justify-between text-gray-600">
                <span>Tax</span>
                <span>
                  {symbol}
                  {cart.tax.toFixed(2)}
                </span>
              </div>
            ) : null}
            {cart.discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>
                  Discount{cart.discountReason ? ` — ${cart.discountReason}` : ''}
                </span>
                <span>
                  -{symbol}
                  {cart.discount.toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-200">
              <span>Total</span>
              <span>
                {symbol}
                {cart.total.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex gap-2 p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <button
            onClick={() => onDelete(held.id)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
          <button
            onClick={onClose}
            className="ml-auto px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
          <button
            onClick={() => onRetrieve(held.id)}
            className="px-4 py-2 text-sm font-medium text-white bg-[#DC2626] rounded hover:bg-[#B91C1C] transition-colors"
          >
            Retrieve to Cart
          </button>
        </div>
      </div>
    </div>
  );
}
