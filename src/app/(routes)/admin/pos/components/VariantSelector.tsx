// Variant Selector Modal
'use client';

import { useState, useMemo } from 'react';
import { POSProduct, POSVariant } from '../types';
import { X, Package } from 'lucide-react';
import { getColorThumbnail, getProductThumbnail } from '../utils/imageHelper';
import { getCurrencySymbol } from '../utils/currency';

interface VariantSelectorProps {
  isOpen: boolean;
  product: POSProduct | null;
  onClose: () => void;
  onSelect: (variant: POSVariant) => void;
  currency?: string;
}

export default function VariantSelector({
  isOpen,
  product,
  onClose,
  onSelect,
  currency = 'PKR',
}: VariantSelectorProps) {
  const symbol = getCurrencySymbol(currency);
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');

  // Get unique colors and sizes
  const colors = useMemo(() => {
    if (!product || product.productType !== 'variant') return [];
    const uniqueColors = new Set(product.variants?.map(v => v.color) || []);
    return Array.from(uniqueColors);
  }, [product]);

  const sizes = useMemo(() => {
    if (!product || product.productType !== 'variant') return [];
    const uniqueSizes = new Set(product.variants?.map(v => v.size) || []);
    return Array.from(uniqueSizes);
  }, [product]);

  // Get available sizes for selected color
  const availableSizes = useMemo(() => {
    if (!selectedColor) return sizes;
    if (!product || !product.variants) return [];
    return product.variants
      ?.filter(v => v.color === selectedColor && v.stock > 0)
      .map(v => v.size) || [];
  }, [selectedColor, product, sizes]);

  // Get available colors for selected size
  const availableColors = useMemo(() => {
    if (!selectedSize) return colors;
    if (!product || !product.variants) return [];
    return product.variants
      ?.filter(v => v.size === selectedSize && v.stock > 0)
      .map(v => v.color) || [];
  }, [selectedSize, product, colors]);

  // Find matching variant
  const selectedVariant = useMemo(() => {
    if (!selectedColor || !selectedSize) return null;
    if (!product || !product.variants) return null;
    return product.variants?.find(
      v => v.color === selectedColor && v.size === selectedSize
    ) || null;
  }, [selectedColor, selectedSize, product]);

  // Early return after all hooks are called
  if (!isOpen || !product || product.productType !== 'variant') return null;

  const handleAddToCart = () => {
    if (selectedVariant && selectedVariant.stock > 0) {
      onSelect(selectedVariant);
      onClose();
      // Reset selections
      setSelectedColor('');
      setSelectedSize('');
    }
  };

  const thumbnail = selectedColor
    ? getColorThumbnail(product, selectedColor)
    : getProductThumbnail(product);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white p-4 border-b border-gray-200 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold">Select Variant</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Product Info */}
          <div className="flex gap-4 mb-6">
            <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
              {thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumbnail}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="h-10 w-10 text-gray-400" />
                </div>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-lg">{product.name}</h3>
              <p className="text-sm text-gray-500 mt-1">{product.category}</p>
              {selectedVariant ? (
                <p className="text-lg font-bold text-[#DC2626] mt-2">
                  {symbol}{(selectedVariant.discountedPrice || selectedVariant.price).toFixed(2)}
                  {selectedVariant.discountedPrice && (
                    <span className="text-sm text-gray-500 line-through ml-2">
                      {symbol}{selectedVariant.price.toFixed(2)}
                    </span>
                  )}
                </p>
              ) : (
                <p className="text-lg font-bold text-gray-900 mt-2">
                  From {symbol}{product.price.toFixed(2)}
                </p>
              )}
            </div>
          </div>

          {/* Color Selection */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Color {selectedColor && `(${selectedColor})`}
            </label>
            <div className="grid grid-cols-4 gap-2">
              {colors.map((color) => {
                const isAvailable = availableColors.includes(color) || !selectedSize;
                const isSelected = selectedColor === color;
                return (
                  <button
                    key={color}
                    onClick={() => isAvailable && setSelectedColor(color)}
                    disabled={!isAvailable}
                    className={`px-4 py-2 rounded-lg border-2 font-medium transition-colors ${
                      isSelected
                        ? 'border-[#DC2626] bg-red-50 text-[#DC2626]'
                        : isAvailable
                        ? 'border-gray-300 hover:border-red-300 text-gray-700'
                        : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {color}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Size Selection */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Size {selectedSize && `(${selectedSize})`}
            </label>
            <div className="grid grid-cols-5 gap-2">
              {sizes.map((size) => {
                const isAvailable = availableSizes.includes(size) || !selectedColor;
                const isSelected = selectedSize === size;
                return (
                  <button
                    key={size}
                    onClick={() => isAvailable && setSelectedSize(size)}
                    disabled={!isAvailable}
                    className={`px-4 py-2 rounded-lg border-2 font-medium transition-colors ${
                      isSelected
                        ? 'border-[#DC2626] bg-red-50 text-[#DC2626]'
                        : isAvailable
                        ? 'border-gray-300 hover:border-red-300 text-gray-700'
                        : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {size}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stock Info */}
          {selectedVariant && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Stock Available:</span>
                <span className="font-semibold text-gray-900">
                  {selectedVariant.stock} units
                </span>
              </div>
              <div className="flex justify-between items-center text-sm mt-2">
                <span className="text-gray-600">SKU:</span>
                <span className="font-mono text-gray-900">{selectedVariant.sku}</span>
              </div>
            </div>
          )}

          {/* Add to Cart Button */}
          <button
            onClick={handleAddToCart}
            disabled={!selectedVariant || selectedVariant.stock === 0}
            className={`w-full py-3 rounded-lg font-semibold transition-colors ${
              selectedVariant && selectedVariant.stock > 0
                ? 'bg-[#DC2626] text-white hover:bg-[#b91c1c]'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {!selectedColor || !selectedSize
              ? 'Please select color and size'
              : selectedVariant?.stock === 0
              ? 'Out of Stock'
              : 'Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  );
}
