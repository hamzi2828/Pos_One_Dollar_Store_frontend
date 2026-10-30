// Cart Panel Component — current bill. Every amount on it comes from the
// server quote (POST /api/pos/quote), so what the cashier sees is exactly
// what the sale will charge: rule discounts, manual discount, tax, total.
'use client';

import { useState } from 'react';
import { CartItem as CartItemType, CartQuote, ManualDiscount, POSCart, POSCustomer, POSTax } from '../types';
import CartItem from './CartItem';
import { ShoppingCart, Trash2, Archive, ChevronDown, Check, Receipt, Percent, X, Loader2, Sparkles, Gift, AlertCircle, Lock } from 'lucide-react';
import { getCurrencySymbol } from '../utils/currency';
import type { QuoteError } from '../hooks/useCartQuote';
import { SearchSelect } from '@/components/ui/SearchSelect';
import MoneyInput from '@/components/ui/MoneyInput';

interface CartPanelProps {
  cart: POSCart;
  quote: CartQuote | null;
  quoteLoading?: boolean;
  quoteError?: QuoteError | null;
  /** The quote on screen belongs to the cart as it is now. */
  quoteReady?: boolean;
  customer?: POSCustomer | null;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onUpdateUnitPrice?: (itemId: string, newPrice: number, minPrice: number) => void;
  canGoBelowList?: boolean;
  onToggleGift?: (itemId: string, isGift: boolean, reason?: string) => void;
  onShowInsight?: (item: CartItemType) => void;
  onClearCart: () => void;
  onHoldCart: () => void;
  onCheckout: () => void;
  onSelectCustomer: () => void;
  currency?: string;
  availableTaxes?: POSTax[];
  selectedTaxIds?: string[];
  onTaxSelectionChange?: (taxIds: string[]) => void;
  onApplyDiscount?: (discount: ManualDiscount | null) => void;
  /** Hold Order is saving. */
  holding?: boolean;
  /** Payment window is open / payment is going through. */
  paying?: boolean;
  /** Why "Process Payment" is locked (e.g. till not open). */
  blockedReason?: string | null;
  /** Why "Hold Order" is off (e.g. needs internet). */
  holdDisabledReason?: string | null;
}

export default function CartPanel({
  cart,
  quote,
  quoteLoading = false,
  quoteError = null,
  quoteReady = false,
  customer,
  onUpdateQuantity,
  onRemoveItem,
  onUpdateUnitPrice,
  canGoBelowList = false,
  onToggleGift,
  onShowInsight,
  onClearCart,
  onHoldCart,
  onCheckout,
  onSelectCustomer,
  currency = 'PKR',
  availableTaxes = [],
  selectedTaxIds = [],
  onTaxSelectionChange,
  onApplyDiscount,
  holding = false,
  paying = false,
  blockedReason = null,
  holdDisabledReason = null,
}: CartPanelProps) {
  const busy = holding || paying;
  const symbol = getCurrencySymbol(currency);
  const money = (n: number | undefined) => `${symbol}${(Number(n) || 0).toFixed(2)}`;
  const isEmpty = cart.items.length === 0;
  const [showTaxDropdown, setShowTaxDropdown] = useState(false);
  const [showDiscountInput, setShowDiscountInput] = useState(false);
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [discountValue, setDiscountValue] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [discountError, setDiscountError] = useState<string | null>(null);

  const limits = quote?.limits;
  const subtotal = quote?.subtotal ?? cart.subtotal;
  const ruleDiscount = quote?.ruleDiscount ?? 0;
  const manual = cart.manualDiscount && cart.manualDiscount.value > 0 ? cart.manualDiscount : null;

  const handleTaxToggle = (taxId: string) => {
    if (!onTaxSelectionChange) return;
    onTaxSelectionChange(selectedTaxIds.includes(taxId) ? selectedTaxIds.filter((id) => id !== taxId) : [...selectedTaxIds, taxId]);
  };
  const selectedTaxNames = availableTaxes.filter((t) => selectedTaxIds.includes(t.taxId)).map((t) => t.name).join(', ');

  const applyDiscount = () => {
    if (!onApplyDiscount) return;
    const value = parseFloat(discountValue) || 0;
    if (value <= 0) return setDiscountError('Enter a discount');
    if (discountType === 'percentage' && value > 100) return setDiscountError('At most 100%');
    // Same limit the server checks (it has the final word).
    const base = Math.max(0, subtotal - ruleDiscount);
    const amount = Math.min(base, discountType === 'percentage' ? (base * value) / 100 : value);
    if (limits && !limits.unlimitedManualDiscount && amount > limits.maxManualDiscount + 0.001) {
      return setDiscountError(`Max ${money(limits.maxManualDiscount)} (${limits.maxManualDiscountPct}% of the bill). Ask a manager for more.`);
    }
    onApplyDiscount({ type: discountType, value, reason: discountReason.trim() });
    setDiscountError(null);
    setShowDiscountInput(false);
  };

  const removeManual = () => {
    onApplyDiscount?.(null);
    setDiscountValue('');
    setDiscountReason('');
  };

  const lineFor = (index: number) => (quote && quote.lines[index] && quote.lines.length === cart.items.length ? quote.lines[index] : null);
  const canPay = !busy && quoteReady && !blockedReason;
  const payHint = blockedReason
    ? blockedReason
    : quoteError
    ? quoteError.message
    : !quoteReady
    ? 'Updating prices…'
    : null;

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      {/* Header */}
      <div className="p-3 sm:p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Current Order
            {!isEmpty && <span className="text-xs font-medium text-gray-500">({quote?.itemCount ?? cart.items.reduce((s, i) => s + i.quantity, 0)} pcs)</span>}
          </h2>
          {!isEmpty && (
            <button onClick={onClearCart} disabled={busy} className="text-red-500 hover:text-red-700 p-1 disabled:opacity-40 disabled:cursor-not-allowed" title="Clear cart">
              <Trash2 className="h-5 w-5" />
            </button>
          )}
        </div>

        <button onClick={onSelectCustomer} className="w-full text-left px-3 py-2 border border-gray-300 rounded-lg hover:border-honey-500 transition-colors">
          <div className="text-xs text-gray-500 mb-0.5">Customer</div>
          <div className="text-sm font-medium text-gray-900">{customer ? `${customer.firstName} ${customer.lastName}` : 'Walk-in Customer (Guest)'}</div>
          {customer?.phone && <div className="text-xs text-gray-500 mt-0.5">{customer.phone}</div>}
        </button>
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-2">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <ShoppingCart className="h-16 w-16 mb-4" />
            <p className="text-center">Cart is empty</p>
            <p className="text-sm text-center mt-2">Scan a barcode or search to add items</p>
          </div>
        ) : (
          <div>
            {cart.items.map((item, index) => (
              <CartItem
                key={item.id}
                item={item}
                line={lineFor(index)}
                onUpdateQuantity={onUpdateQuantity}
                onRemove={onRemoveItem}
                onUpdateUnitPrice={item.isGift ? undefined : onUpdateUnitPrice}
                canGoBelowList={canGoBelowList}
                onToggleGift={onToggleGift}
                onShowInsight={onShowInsight}
                currency={currency}
                disabled={busy}
              />
            ))}
          </div>
        )}
      </div>

      {/* Summary */}
      {!isEmpty && (
        <div className="border-t border-gray-200 p-3 sm:p-4 space-y-3">
          {/* Spend-more hint */}
          {quote?.nextDiscount && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
              <Sparkles className="h-4 w-4 flex-shrink-0 text-amber-500" />
              <span>
                <b>{quote.nextDiscount.message}</b>
                <span className="block text-amber-700">{quote.nextDiscount.label}</span>
              </span>
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 flex items-center gap-1.5">
                Subtotal
                {quoteLoading && <Loader2 className="h-3 w-3 animate-spin text-gray-400" aria-label="Updating" />}
              </span>
              <span className="font-medium">{money(subtotal)}</span>
            </div>

            {quote && quote.giftCount > 0 && (
              <div className="flex justify-between text-xs text-pink-700">
                <span className="flex items-center gap-1">
                  <Gift className="h-3 w-3" /> {quote.giftCount} gift piece{quote.giftCount !== 1 ? 's' : ''} (free)
                </span>
                <span>worth {money(quote.giftValue)}</span>
              </div>
            )}

            {/* Applied discounts (rules + manual) */}
            {(quote?.appliedDiscounts || []).map((d, i) => (
              <div key={`${d.name}-${i}`} className="flex justify-between gap-2 text-sm text-green-700">
                <span className="flex items-center gap-1 min-w-0">
                  <Percent className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate" title={d.label || d.name}>
                    {d.kind === 'manual' ? d.name : d.label || d.name}
                  </span>
                  {d.kind === 'manual' && onApplyDiscount && (
                    <button onClick={removeManual} disabled={busy} className="text-red-400 hover:text-red-600 flex-shrink-0" title="Remove discount">
                      <X size={14} />
                    </button>
                  )}
                </span>
                <span className="font-medium whitespace-nowrap">−{money(d.amount)}</span>
              </div>
            ))}

            {/* Tax Selector */}
            {availableTaxes.length > 0 && onTaxSelectionChange ? (
              <div className="relative">
                <button
                  onClick={() => setShowTaxDropdown(!showTaxDropdown)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">{selectedTaxIds.length > 0 ? selectedTaxNames : 'Select Tax'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{money(quote?.tax ?? 0)}</span>
                    <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showTaxDropdown ? 'rotate-180' : ''}`} />
                  </div>
                </button>
                {showTaxDropdown && (
                  <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                    <div className="py-1">
                      {availableTaxes.map((tax) => (
                        <button key={tax.taxId} onClick={() => handleTaxToggle(tax.taxId)} className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedTaxIds.includes(tax.taxId) ? 'bg-honey-500 border-honey-500' : 'border-gray-300'}`}>
                              {selectedTaxIds.includes(tax.taxId) && <Check className="h-3 w-3 text-gray-900" />}
                            </div>
                            <div className="text-left">
                              <div className="text-sm font-medium text-gray-900">{tax.name}</div>
                              {tax.description && <div className="text-xs text-gray-500">{tax.description}</div>}
                            </div>
                          </div>
                          <span className="text-sm font-medium text-gray-600">{tax.rate}%</span>
                        </button>
                      ))}
                    </div>
                    <div className="border-t border-gray-100 p-2">
                      <button onClick={() => setShowTaxDropdown(false)} className="w-full px-3 py-1.5 text-sm text-honey-700 hover:bg-red-50 rounded transition-colors">
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (quote?.tax ?? 0) > 0 ? (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tax</span>
                <span className="font-medium">{money(quote?.tax)}</span>
              </div>
            ) : null}

            {/* Manual discount */}
            {onApplyDiscount && !manual && (
              <div className="space-y-2">
                {!showDiscountInput ? (
                  <button onClick={() => setShowDiscountInput(true)} disabled={busy} className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 disabled:opacity-50">
                    <Percent size={14} />
                    Add Discount
                    {limits && !limits.unlimitedManualDiscount && (
                      <span className="text-xs font-normal text-gray-400">(up to {limits.maxManualDiscountPct}%)</span>
                    )}
                  </button>
                ) : (
                  <div className="space-y-2 bg-gray-50 p-2 rounded-lg">
                    <div className="flex items-center gap-2">
                      <SearchSelect value={discountType} onChange={(e) => setDiscountType(e.target.value as 'fixed' | 'percentage')} className="text-sm border rounded px-2 py-1">
                        <option value="fixed">Fixed ({symbol})</option>
                        <option value="percentage">Percent (%)</option>
                      </SearchSelect>
                      <MoneyInput
                        placeholder="0"
                        value={discountValue}
                        onValue={(v) => {
                          setDiscountValue(v);
                          setDiscountError(null);
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && applyDiscount()}
                        className="text-sm border rounded px-2 py-1 w-24"
                        autoFocus
                      />
                      <button
                        onClick={() => {
                          setShowDiscountInput(false);
                          setDiscountValue('');
                          setDiscountReason('');
                          setDiscountError(null);
                        }}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <input type="text" placeholder="Reason (optional)" value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} className="text-sm border rounded px-2 py-1 w-full" />
                    {discountError && <p className="text-xs text-red-600">{discountError}</p>}
                    <button onClick={applyDiscount} className="text-sm bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 w-full">
                      Apply Discount
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between items-baseline text-lg font-bold border-t pt-2">
              <span>Total</span>
              <span className={quoteLoading ? 'text-gray-400' : ''}>{money(quote?.total ?? cart.total)}</span>
            </div>
            {quote?.canSeeCost && quote.cogs !== undefined && (
              <div className="flex justify-between text-[11px] text-gray-500">
                <span>Cost {money(quote.cogs)}{quote.giftCost ? ` (gifts ${money(quote.giftCost)})` : ''}</span>
                <span className={(quote.profit ?? 0) < 0 ? 'text-red-600 font-medium' : ''}>Profit {money(quote.profit)}</span>
              </div>
            )}
          </div>

          {quote?.offline && quoteReady && (
            <div className="px-3 py-1.5 text-[11px] bg-amber-50 text-amber-800 border border-amber-200 rounded-lg">
              Priced on this PC (no internet). Same rules as the server.
            </div>
          )}

          {quoteError && (
            <div className="flex items-start gap-2 px-3 py-2 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{quoteError.message}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2">
            <button
              onClick={onCheckout}
              disabled={!canPay}
              aria-busy={paying}
              title={payHint || 'F9'}
              className="w-full bg-honey-500 text-gray-900 py-3 rounded-lg font-semibold hover:bg-honey-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-honey-500"
            >
              {paying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing payment…
                </>
              ) : blockedReason ? (
                <>
                  <Lock className="h-4 w-4" />
                  Open the till to sell
                </>
              ) : (
                <>
                  Process Payment
                  {quoteReady && quote ? ` · ${money(quote.total)}` : ''}
                  <kbd className="hidden sm:inline text-[10px] font-normal opacity-70 border border-white/40 rounded px-1">F9</kbd>
                </>
              )}
            </button>
            {payHint && !paying && <p className="text-[11px] text-center text-gray-500">{payHint}</p>}
            <button
              onClick={onHoldCart}
              disabled={busy || !!holdDisabledReason}
              title={holdDisabledReason || undefined}
              aria-busy={holding}
              className="w-full border border-gray-300 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-white"
            >
              {holding ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Holding order…
                </>
              ) : (
                <>
                  <Archive className="h-4 w-4" />
                  Hold Order
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
