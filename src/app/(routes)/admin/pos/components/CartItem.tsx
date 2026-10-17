// Cart Item Component
'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { CartItem as CartItemType } from '../types';
import { Minus, Plus, X, Wrench, Edit2, Check } from 'lucide-react';
import { getColorThumbnail, getProductThumbnail } from '../utils/imageHelper';
import { getCurrencySymbol } from '../utils/currency';

interface CartItemProps {
  item: CartItemType;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemove: (itemId: string) => void;
  onUpdateUnitPrice?: (itemId: string, newPrice: number, minPrice: number) => void;
  currency?: string;
}

export default function CartItem({
  item,
  onUpdateQuantity,
  onRemove,
  onUpdateUnitPrice,
  currency = 'PKR',
}: CartItemProps) {
  const symbol = getCurrencySymbol(currency);
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [editPrice, setEditPrice] = useState(item.unitPrice.toString());

  // Get the original/minimum price (the price the item came with)
  const minPrice = item.originalPrice ?? item.unitPrice;

  const handlePriceEdit = () => {
    const newPrice = parseFloat(editPrice);
    if (isNaN(newPrice) || newPrice < minPrice) {
      toast.error(`Price cannot be less than ${symbol}${minPrice.toFixed(2)}`);
      setEditPrice(item.unitPrice.toString());
      return;
    }
    if (onUpdateUnitPrice) {
      onUpdateUnitPrice(item.id, newPrice, minPrice);
    }
    setIsEditingPrice(false);
  };

  const handleDecrease = () => {
    if (item.quantity > 1) {
      onUpdateQuantity(item.id, item.quantity - 1);
    }
  };

  const handleIncrease = () => {
    if (item.isLabour) {
      onUpdateQuantity(item.id, item.quantity + 1);
      return;
    }
    const maxStock = item.variant ? item.variant.stock : item.product.stock;
    if (item.quantity < maxStock) {
      onUpdateQuantity(item.id, item.quantity + 1);
    }
  };

  const thumbnail = item.color
    ? getColorThumbnail(item.product, item.color)
    : getProductThumbnail(item.product);

  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-200">
      {/* Product Image */}
      <div className="w-16 h-16 bg-gray-100 rounded flex-shrink-0 overflow-hidden">
        {item.isLabour ? (
          <div className="w-full h-full flex items-center justify-center bg-orange-50 text-orange-500">
            <Wrench className="h-6 w-6" />
          </div>
        ) : thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnail}
            alt={item.product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
            No image
          </div>
        )}
      </div>

      {/* Product Details */}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-gray-900 truncate flex items-center gap-1">
          {item.product.name}
        </h4>
        {(item.color || item.size) && (
          <p className="text-xs text-gray-500 mt-0.5">
            {item.color && item.size
              ? `${item.color} / ${item.size}`
              : item.color || item.size}
          </p>
        )}
        <div className="flex items-center justify-between mt-2">
          {/* Quantity Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleDecrease}
              className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
              disabled={item.quantity <= 1}
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="text-sm font-medium w-8 text-center">
              {item.quantity}
            </span>
            <button
              onClick={handleIncrease}
              className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>

          {/* Price */}
          <div className="text-right">
            <div className="text-sm font-semibold text-gray-900">
              {symbol}{item.subtotal.toFixed(2)}
            </div>
            {isEditingPrice ? (
              <div className="flex items-center gap-1 justify-end mt-1">
                <span className="text-xs text-gray-500">{symbol}</span>
                <input
                  type="number"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handlePriceEdit();
                    if (e.key === 'Escape') {
                      setEditPrice(item.unitPrice.toString());
                      setIsEditingPrice(false);
                    }
                  }}
                  className="w-16 text-xs border rounded px-1 py-0.5 text-right"
                  min={minPrice}
                  step="0.01"
                  autoFocus
                />
                <button
                  onClick={handlePriceEdit}
                  className="text-green-600 hover:text-green-700"
                >
                  <Check className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 justify-end">
                <span className="text-xs text-gray-500">
                  {symbol}{item.unitPrice.toFixed(2)} each
                </span>
                {onUpdateUnitPrice && (
                  <button
                    onClick={() => {
                      setEditPrice(item.unitPrice.toString());
                      setIsEditingPrice(true);
                    }}
                    className="text-gray-400 hover:text-blue-600"
                    title="Edit price (can only increase)"
                  >
                    <Edit2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Remove Button */}
      <button
        onClick={() => onRemove(item.id)}
        className="text-gray-400 hover:text-red-500 p-1"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
