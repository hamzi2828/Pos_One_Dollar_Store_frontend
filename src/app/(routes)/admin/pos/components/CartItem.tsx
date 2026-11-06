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
  // Sold in sets (e.g. 2 tissues for one price): one sale = pps pieces handed over.
  const pps = item.variant ? 1 : Math.max(1, Math.floor(Number(item.product.piecesPerSale) || 1));

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
    // Out of stock still sells (owner, 2026-11-05): warn only.
    if (!item.isManual && q > maxStock) toast(`Only ${Math.max(0, maxStock)} in stock – sold anyway`, { icon: '⚠️', id: 'pos-stock' });
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
    <div className={`py-1.5 border-b border-gray-100 ${item.isGift ? 'bg-pink-50/40 -mx-2 px-2 rounded' : ''}`}>
      <div className="flex items-center gap-2">
        {/* Small picture */}
        <div className="w-8 h-8 bg-gray-100 rounded flex-shrink-0 overflow-hidden">
          {item.isManual ? (
            <div className="w-full h-full flex items-center justify-center bg-honey-100 text-honey-900 text-[8px] font-semibold">Manual</div>
          ) : thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbnail} alt={item.product.name} className="w-full h-full object-cover" />
          ) : null}
        </div>

        {/* Name + unit price */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <h4 className="text-[13px] leading-tight font-medium text-gray-900 truncate" title={item.product.name}>
              {item.product.name}
            </h4>
            {onShowInsight && (
              <button type="button" onClick={() => onShowInsight(item)} className="shrink-0 text-gray-300 hover:text-blue-600" title="Product history: prices, vendors, stock" aria-label="Product history">
                <Info className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 text-[11px] leading-tight text-gray-500">
            {isEditingPrice ? (
              <span className="flex items-center gap-1">
                {symbol}
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
                  className="w-16 text-xs border rounded px-1 py-0 text-right"
                  autoFocus
                />
                <button type="button" onClick={handlePriceEdit} className="text-green-600 hover:text-green-700" aria-label="Save price">
                  <Check className="h-3 w-3" />
                </button>
              </span>
            ) : (
              !item.isGift && (
                <>
                  <span className={item.priceOverride ? 'text-blue-600 font-medium' : ''}>
                    {symbol}
                    {unitPrice.toFixed(0)} {pps > 1 ? `/${pps} pcs` : 'each'}
                    {item.priceOverride ? ' (typed)' : ''}
                  </span>
                  {onUpdateUnitPrice && !disabled && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditPrice(unitPrice.toString());
                        setIsEditingPrice(true);
                      }}
                      className="text-gray-300 hover:text-blue-600"
                      title={canGoBelowList ? 'Edit price' : 'Edit price (can only increase)'}
                    >
                      <Edit2 className="h-3 w-3" />
                    </button>
                  )}
                </>
              )
            )}
            {(item.color || item.size) && <span className="truncate">· {item.color && item.size ? `${item.color} / ${item.size}` : item.color || item.size}</span>}
            {shelfCodes.slice(0, 1).map((code) => (
              <span key={code} className="inline-flex items-center gap-0.5 rounded bg-blue-50 px-1 text-[10px] font-semibold text-blue-700">
                <MapPin className="h-2.5 w-2.5" />
                {code}
              </span>
            ))}
          </div>
          {pps > 1 && <p className="text-[10px] font-semibold text-amber-800">1 sale = {pps} pcs · give {item.quantity * pps}</p>}
        </div>

        {/* Qty */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => item.quantity > 1 && onUpdateQuantity(item.id, item.quantity - 1)}
            className="w-6 h-6 rounded-l bg-gray-100 hover:bg-gray-200 flex items-center justify-center disabled:opacity-40"
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
            className="w-9 h-6 text-xs font-semibold text-center border-y border-gray-200 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            aria-label="Quantity"
          />
          <button
            type="button"
            onClick={() => setQty(item.quantity + 1)}
            className="w-6 h-6 rounded-r bg-gray-100 hover:bg-gray-200 flex items-center justify-center disabled:opacity-40"
            disabled={disabled}
            aria-label="One more"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>

        {/* Line total */}
        <div className="w-[4.5rem] shrink-0 text-right text-[13px] font-semibold tabular-nums">
          {item.isGift ? <span className="text-pink-700">FREE</span> : <span className="text-gray-900">{symbol}{lineTotal.toFixed(0)}</span>}
        </div>

        {/* Gift / remove */}
        <div className="flex shrink-0 items-center">
          {onToggleGift && !item.isGift && !askGift && (
            <button type="button" onClick={() => setAskGift(true)} disabled={disabled} className="p-0.5 text-gray-300 hover:text-pink-600 disabled:opacity-40" title="Give this line free as a gift" aria-label="Make gift">
              <Gift className="h-3.5 w-3.5" />
            </button>
          )}
          <button type="button" onClick={() => onRemove(item.id)} disabled={disabled} className="p-0.5 text-gray-400 hover:text-red-500 disabled:opacity-40" aria-label="Remove line">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="pl-10">
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
          {lowStock && <p className="mt-1 text-xs text-amber-700">Only {line?.available} in stock – the rest is sold as out of stock</p>}

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
    </div>
  );
}
