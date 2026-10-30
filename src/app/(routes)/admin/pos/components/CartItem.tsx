// Cart Item Component — one line of the current bill.
// Prices shown come from the server quote (`line`); the cashier may only type
// a price with POS "edit", and mark a line as a gift with "POS Gifts".
'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { CartItem as CartItemType, QuoteLine } from '../types';
import { Minus, Plus, X, Edit2, Check, Gift, Info, MapPin, Undo2 } from 'lucide-react';
import { getColorThumbnail, getProductThumbnail } from '../utils/imageHelper';
import { getCurrencySymbol } from '../utils/currency';
import MoneyInput from '@/components/ui/MoneyInput';

const GIFT_REASONS = ['Loyal customer', 'Kids gift', 'Eid / festival', 'Sorry for the wait'];

interface CartItemProps {
  item: CartItemType;
  /** Server-priced line (null while the quote is loading). */
  line?: QuoteLine | null;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemove: (itemId: string) => void;
  onUpdateUnitPrice?: (itemId: string, newPrice: number, minPrice: number) => void;
  /** User may go below the list price (discounts edit). */
  canGoBelowList?: boolean;
  /** Shown when the user has pos_gifts create. */
  onToggleGift?: (itemId: string, isGift: boolean, reason?: string) => void;
  onShowInsight?: (item: CartItemType) => void;
  currency?: string;
  disabled?: boolean;
}

export default function CartItem({
  item,
  line,
  onUpdateQuantity,
  onRemove,
  onUpdateUnitPrice,
  canGoBelowList = false,
  onToggleGift,
  onShowInsight,
  currency = 'PKR',
  disabled = false,
}: CartItemProps) {
  const symbol = getCurrencySymbol(currency);
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [editPrice, setEditPrice] = useState(item.unitPrice.toString());
  const [qtyText, setQtyText] = useState(String(item.quantity));
  const [askGift, setAskGift] = useState(false);
  const [giftReason, setGiftReason] = useState('');
  useEffect(() => setQtyText(String(item.quantity)), [item.quantity]);

  const unitPrice = line ? line.price : item.unitPrice;
  const lineTotal = line ? line.lineTotal : item.subtotal;
  const listPrice = line ? line.listPrice : item.originalPrice ?? item.unitPrice;
  // Without "discounts edit" a typed price can only go up from the list price.
  const minPrice = canGoBelowList ? 0 : listPrice;
  const maxStock = item.variant ? item.variant.stock : item.product.stock;
  const shelfCodes = (item.variant?.shelfCodes?.length ? item.variant.shelfCodes : item.product.shelfCodes) || [];
  const lowStock = line && typeof line.available === 'number' && line.available < item.quantity;

  const handlePriceEdit = () => {
    const newPrice = parseFloat(editPrice);
    if (isNaN(newPrice) || newPrice < minPrice) {
      toast.error(`Price cannot be less than ${symbol}${minPrice.toFixed(2)}`);
      setEditPrice(unitPrice.toString());
      return;
    }
    onUpdateUnitPrice?.(item.id, newPrice, minPrice);
    setIsEditingPrice(false);
  };

  const setQty = (n: number) => {
    if (!Number.isFinite(n) || n < 1) return setQtyText(String(item.quantity));
    const q = Math.floor(n);
    if (q > maxStock) {
      toast.error(`Only ${maxStock} in stock`);
      setQtyText(String(item.quantity));
      return;
    }
    onUpdateQuantity(item.id, q);
  };

  const confirmGift = (reason: string) => {
    const r = reason.trim();
    if (!r) {
      toast.error('Write why this is a gift');
      return;
    }
    onToggleGift?.(item.id, true, r);
    setAskGift(false);
    setGiftReason('');
  };

  const thumbnail = item.color ? getColorThumbnail(item.product, item.color) : getProductThumbnail(item.product);

  return (
    <div className={`py-3 border-b border-gray-200 ${item.isGift ? 'bg-pink-50/40 -mx-2 px-2 rounded' : ''}`}>
      <div className="flex items-start gap-3">
        {/* Product Image */}
        <div className="w-12 h-12 bg-gray-100 rounded flex-shrink-0 overflow-hidden">
          {thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbnail} alt={item.product.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-[10px]">No image</div>
          )}
        </div>

        {/* Product Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-1">
            <h4 className="text-sm font-medium text-gray-900 truncate flex-1" title={item.product.name}>
              {item.product.name}
            </h4>
            {onShowInsight && (
              <button
                type="button"
                onClick={() => onShowInsight(item)}
                className="p-0.5 text-gray-400 hover:text-blue-600"
                title="Product history: prices, vendors, stock"
                aria-label="Product history"
              >
                <Info className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1 mt-0.5">
            {(item.color || item.size) && (
              <span className="text-xs text-gray-500">{item.color && item.size ? `${item.color} / ${item.size}` : item.color || item.size}</span>
            )}
            {shelfCodes.slice(0, 2).map((code) => (
              <span key={code} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-semibold">
                <MapPin className="h-2.5 w-2.5" />
                {code}
              </span>
            ))}
            {item.batchNo && <span className="text-[10px] text-gray-400">Batch {item.batchNo}</span>}
          </div>

          <div className="flex items-center justify-between mt-2">
            {/* Quantity: buttons or type it */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => item.quantity > 1 && onUpdateQuantity(item.id, item.quantity - 1)}
                className="w-7 h-7 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center disabled:opacity-40"
                disabled={disabled || item.quantity <= 1}
                aria-label="One less"
              >
                <Minus className="h-3 w-3" />
              </button>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={qtyText}
                disabled={disabled}
                onChange={(e) => setQtyText(e.target.value)}
                onBlur={() => setQty(Number(qtyText))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                }}
                className="w-11 h-7 text-sm font-medium text-center border border-gray-200 rounded [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                aria-label="Quantity"
              />
              <button
                type="button"
                onClick={() => setQty(item.quantity + 1)}
                className="w-7 h-7 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center disabled:opacity-40"
                disabled={disabled}
                aria-label="One more"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>

            {/* Price */}
            <div className="text-right">
              {item.isGift ? (
                <div className="text-sm font-semibold text-pink-700">FREE — gift</div>
              ) : (
                <div className="text-sm font-semibold text-gray-900">
                  {symbol}
                  {lineTotal.toFixed(2)}
                </div>
              )}
              {isEditingPrice ? (
                <div className="flex items-center gap-1 justify-end mt-1">
                  <span className="text-xs text-gray-500">{symbol}</span>
                  <MoneyInput
                    value={editPrice}
                    onValue={setEditPrice}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handlePriceEdit();
                      if (e.key === 'Escape') {
                        setEditPrice(unitPrice.toString());
                        setIsEditingPrice(false);
                      }
                    }}
                    className="w-16 text-xs border rounded px-1 py-0.5 text-right"
                    autoFocus
                  />
                  <button type="button" onClick={handlePriceEdit} className="text-green-600 hover:text-green-700" aria-label="Save price">
                    <Check className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                !item.isGift && (
                  <div className="flex items-center gap-1 justify-end">
                    <span className={`text-xs ${item.priceOverride ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
                      {symbol}
                      {unitPrice.toFixed(2)} each{item.priceOverride ? ' (typed)' : ''}
                    </span>
                    {onUpdateUnitPrice && !disabled && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditPrice(unitPrice.toString());
                          setIsEditingPrice(true);
                        }}
                        className="text-gray-400 hover:text-blue-600"
                        title={canGoBelowList ? 'Edit price' : 'Edit price (can only increase)'}
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )
              )}
            </div>
          </div>

          {item.isGift && (
            <div className="mt-1 flex items-center justify-between gap-2 text-xs text-pink-700">
              <span className="truncate">
                Gift: {item.giftReason} · list {symbol}
                {(listPrice * item.quantity).toFixed(0)}
              </span>
              {onToggleGift && (
                <button type="button" onClick={() => onToggleGift(item.id, false)} className="inline-flex items-center gap-0.5 text-gray-500 hover:text-gray-800" disabled={disabled}>
                  <Undo2 className="h-3 w-3" /> Charge
                </button>
              )}
            </div>
          )}
          {lowStock && <p className="mt-1 text-xs text-red-600">Only {line?.available} in stock</p>}

          {askGift && (
            <div className="mt-2 p-2 rounded-lg border border-pink-200 bg-pink-50 space-y-1.5">
              <div className="flex flex-wrap gap-1">
                {GIFT_REASONS.map((r) => (
                  <button key={r} type="button" onClick={() => confirmGift(r)} className="px-2 py-0.5 text-[11px] rounded-full bg-white border border-pink-200 text-pink-700 hover:bg-pink-100">
                    {r}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={giftReason}
                  onChange={(e) => setGiftReason(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmGift(giftReason);
                    if (e.key === 'Escape') setAskGift(false);
                  }}
                  placeholder="Why is it free?"
                  className="flex-1 min-w-0 text-xs border border-pink-200 rounded px-2 py-1"
                  autoFocus
                />
                <button type="button" onClick={() => confirmGift(giftReason)} className="px-2 py-1 text-xs font-medium text-white bg-pink-600 rounded hover:bg-pink-700">
                  Give free
                </button>
                <button type="button" onClick={() => setAskGift(false)} className="p-1 text-gray-400 hover:text-gray-600" aria-label="Cancel">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-1">
          <button type="button" onClick={() => onRemove(item.id)} disabled={disabled} className="text-gray-400 hover:text-red-500 p-1 disabled:opacity-40" aria-label="Remove line">
            <X className="h-4 w-4" />
          </button>
          {onToggleGift && !item.isGift && !askGift && (
            <button
              type="button"
              onClick={() => setAskGift(true)}
              disabled={disabled}
              className="text-gray-400 hover:text-pink-600 p-1 disabled:opacity-40"
              title="Give this line free as a gift"
              aria-label="Make gift"
            >
              <Gift className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
