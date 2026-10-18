// Product Search Component
'use client';

import { Search, Barcode, Loader2, X } from 'lucide-react';
import { useState } from 'react';

interface ProductSearchProps {
  value: string;
  onChange: (value: string) => void;
  onBarcodeScanned?: (barcode: string) => void;
  placeholder?: string;
  /** True from the first key press until results for that text arrive. */
  searching?: boolean;
  /** Number of results for the current text (shown once the search is done). */
  resultCount?: number;
}

export default function ProductSearch({
  value,
  onChange,
  onBarcodeScanned,
  placeholder = "Search products by name, SKU, or barcode...",
  searching = false,
  resultCount,
}: ProductSearchProps) {
  const [isBarcodeMode, setIsBarcodeMode] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // If Enter is pressed in barcode mode, trigger barcode scan
    if (e.key === 'Enter' && isBarcodeMode && value.trim()) {
      onBarcodeScanned?.(value.trim());
      onChange('');
    }
    if (e.key === 'Escape' && value) onChange('');
  };

  const query = value.trim();

  return (
    <div className="relative">
      <div className="relative">
        {searching ? (
          <Loader2
            className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[#DC2626] animate-spin"
            aria-hidden="true"
          />
        ) : (
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        )}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-busy={searching}
          className="w-full pl-10 pr-20 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#DC2626] focus:border-transparent"
          autoFocus
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute right-11 top-1/2 -translate-y-1/2 p-1.5 rounded text-gray-400 hover:text-gray-600"
            title="Clear search"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
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
        {/* Thin moving bar under the box while searching */}
        {searching && (
          <div className="absolute inset-x-1 bottom-0 h-0.5 overflow-hidden rounded-full">
            <div className="h-full w-1/3 bg-[#DC2626]" style={{ animation: 'pos-search-bar 1s ease-in-out infinite' }} />
          </div>
        )}
      </div>
      <div className="mt-1 min-h-[1rem] text-xs" aria-live="polite">
        {searching ? (
          <span className="text-[#DC2626]">Searching for &ldquo;{query}&rdquo;…</span>
        ) : query && resultCount !== undefined ? (
          <span className="text-gray-500">
            {resultCount === 0
              ? <>No products match &ldquo;{query}&rdquo;</>
              : <>{resultCount} product{resultCount !== 1 ? 's' : ''} found for &ldquo;{query}&rdquo;</>}
          </span>
        ) : isBarcodeMode ? (
          <span className="text-[#DC2626]">Barcode mode: Scan or type barcode and press Enter</span>
        ) : null}
      </div>
      <style>{`@keyframes pos-search-bar{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
    </div>
  );
}
