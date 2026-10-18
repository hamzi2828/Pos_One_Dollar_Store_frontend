// Product Card Component
'use client';

import { POSProduct } from '../types';
import { Package } from 'lucide-react';
import { getProductThumbnail } from '../utils/imageHelper';
import { getCurrencySymbol } from '../utils/currency';

interface ProductCardProps {
  product: POSProduct;
  onSelect: (product: POSProduct) => void;
  currency?: string;
}

export default function ProductCard({ product, onSelect, currency = 'PKR' }: ProductCardProps) {
  const symbol = getCurrencySymbol(currency);
  const displayPrice = product.discountedPrice || product.price;
  const hasDiscount = product.discountedPrice && product.discountedPrice < product.price;

  const thumbnail = getProductThumbnail(product);

  return (
    <button
      onClick={() => onSelect(product)}
      className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-lg transition-shadow duration-200 hover:border-honey-500 text-left w-full"
      disabled={product.stock === 0}
    >
      <div className="aspect-square bg-gray-100 rounded-md mb-2 overflow-hidden relative">
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnail}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="h-12 w-12 text-gray-400" />
          </div>
        )}
        {product.stock === 0 && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <span className="text-white font-semibold">Out of Stock</span>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <h3 className="font-medium text-sm text-gray-900 line-clamp-2 min-h-[2.5rem]">
          {product.name}
        </h3>

        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-gray-900">
              {symbol}{displayPrice.toFixed(2)}
            </span>
            {hasDiscount && (
              <span className="text-sm text-gray-500 line-through">
                {symbol}{product.price.toFixed(2)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Stock: {product.stock}</span>
          {product.productType === 'variant' && (
            <span className="bg-red-100 text-honey-700 px-2 py-0.5 rounded">
              Variants
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
