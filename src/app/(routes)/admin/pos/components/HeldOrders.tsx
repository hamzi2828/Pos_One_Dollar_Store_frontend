// Held Orders Component
'use client';

import { useState } from 'react';
import { HeldCart } from '../types';
import { Archive, Trash2, Clock, Eye, X, User, Phone, Package, Loader2 } from 'lucide-react';
import { getCurrencySymbol } from '../utils/currency';

interface HeldOrdersProps {
  heldCarts: HeldCart[];
  onRetrieve: (cartId: string) => void;
  onDelete: (cartId: string) => void;
  currency?: string;
  /** Set by the page while a retrieve/delete request is in flight. */
  busy?: HeldBusy | null;
}

type HeldBusy = { id: string; action: 'retrieve' | 'delete' };

export default function HeldOrders({
  heldCarts,
  onRetrieve,
  onDelete,
  currency = 'PKR',
  busy = null,
}: HeldOrdersProps) {
  const symbol = getCurrencySymbol(currency);
  const [viewingId, setViewingId] = useState<string | null>(null);
  // Derived from the live list, so a deleted order doesn't linger in the modal.
  const viewing = viewingId ? heldCarts.find((h) => h.id === viewingId) ?? null : null;

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
        {heldCarts.map((held) => {
          const retrievingThis = busy?.id === held.id && busy.action === 'retrieve';
          const deletingThis = busy?.id === held.id && busy.action === 'delete';
          return (
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
                onClick={() => setViewingId(held.id)}
                className="flex items-center justify-center gap-1.5 bg-gray-100 text-gray-700 py-2 px-3 rounded text-sm font-medium hover:bg-gray-200 transition-colors"
                title="View held order details"
              >
                <Eye className="h-4 w-4" />
                View
              </button>
              <button
                onClick={() => onRetrieve(held.id)}
                disabled={!!busy}
                aria-busy={retrievingThis}
                className="flex-1 flex items-center justify-center gap-2 bg-honey-500 text-gray-900 py-2 px-3 rounded text-sm font-medium hover:bg-honey-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {retrievingThis ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Retrieving…
                  </>
                ) : (
                  'Retrieve'
                )}
              </button>
              <button
                onClick={() => onDelete(held.id)}
                disabled={!!busy}
                aria-busy={deletingThis}
                aria-label={deletingThis ? 'Deleting held order' : 'Delete held order'}
                className="bg-red-100 text-red-600 py-2 px-3 rounded hover:bg-red-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                title="Delete held order"
              >
                {deletingThis ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
          );
        })}
      </div>

      {viewing && (
        <HeldOrderModal
          held={viewing}
          symbol={symbol}
          formatDateTime={formatDateTime}
          busy={busy}
          onClose={() => setViewingId(null)}
          onRetrieve={onRetrieve}
          onDelete={onDelete}
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
  busy: HeldBusy | null;
}

function HeldOrderModal({ held, symbol, formatDateTime, onClose, onRetrieve, onDelete, busy }: HeldOrderModalProps) {
  const cart = held.cart;
  const customer = cart.customer;
  const isBusy = !!busy;
  const retrieving = busy?.id === held.id && busy.action === 'retrieve';
  const deleting = busy?.id === held.id && busy.action === 'delete';
  const handleClose = () => {
    if (!isBusy) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Archive className="h-5 w-5 text-honey-700" />
              Held Order Details
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Held on {formatDateTime(held.heldAt)}
              {held.heldBy && ` by ${held.heldBy}`}
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={isBusy}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-md disabled:opacity-60 disabled:cursor-not-allowed"
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
                const name = item.product?.name || 'Product';
                return (
                  <div key={item.id} className="flex items-start gap-3 p-3 bg-white">
                    <div className="h-8 w-8 rounded flex items-center justify-center flex-shrink-0 bg-gray-100 text-gray-600">
                      <Package className="h-4 w-4" />
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
            disabled={isBusy}
            aria-busy={deleting}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded hover:bg-red-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {deleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Delete
              </>
            )}
          </button>
          <button
            onClick={handleClose}
            disabled={isBusy}
            className="ml-auto px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Close
          </button>
          <button
            onClick={() => onRetrieve(held.id)}
            disabled={isBusy}
            aria-busy={retrieving}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-900 bg-honey-500 rounded hover:bg-honey-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {retrieving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Retrieving…
              </>
            ) : (
              'Retrieve to Cart'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
