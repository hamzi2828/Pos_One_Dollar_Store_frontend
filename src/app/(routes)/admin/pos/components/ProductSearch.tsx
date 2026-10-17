// Product Search Component
'use client';

import { Search, Barcode } from 'lucide-react';
import { useState } from 'react';

interface ProductSearchProps {
  value: string;
  onChange: (value: string) => void;
  onBarcodeScanned?: (barcode: string) => void;
  placeholder?: string;
}

export default function ProductSearch({
  value,
  onChange,
  onBarcodeScanned,
  placeholder = "Search products by name, SKU, or barcode..."
}: ProductSearchProps) {
  const [isBarcodeMode, setIsBarcodeMode] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // If Enter is pressed in barcode mode, trigger barcode scan
    if (e.key === 'Enter' && isBarcodeMode && value.trim()) {
      onBarcodeScanned?.(value.trim());
      onChange('');
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#DC2626] focus:border-transparent"
          autoFocus
        />
        <button
          type="button"
          onClick={() => setIsBarcodeMode(!isBarcodeMode)}
          className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded ${
            isBarcodeMode
              ? 'bg-red-100 text-[#DC2626]'
              : 'text-gray-400 hover:text-gray-600'
          }`}
          title={isBarcodeMode ? 'Barcode mode ON' : 'Barcode mode OFF'}
        >
          <Barcode className="h-5 w-5" />
        </button>
      </div>
      {isBarcodeMode && (
        <div className="mt-1 text-xs text-[#DC2626]">
          Barcode mode: Scan or type barcode and press Enter
        </div>
      )}
    </div>
  );
}
