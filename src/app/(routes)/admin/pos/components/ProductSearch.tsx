// Product Search Component — scanner first: a barcode scanner types the code
// and presses Enter; Enter always asks the page to look the code up (and add
// the item). Typing without Enter searches by name as before.
'use client';

import { Search, Barcode, Loader2, X } from 'lucide-react';
import { useState } from 'react';

interface ProductSearchProps {
  value: string;
  onChange: (value: string) => void;
  /** Enter pressed: return true when the code was handled (the box is cleared). */
  onBarcodeScanned?: (barcode: string) => boolean | void | Promise<boolean | void>;
  placeholder?: string;
  /** True from the first key press until results for that text arrive. */
  searching?: boolean;
  /** Number of results for the current text (shown once the search is done). */
  resultCount?: number;
  /** Code lookup running (Enter pressed). */
  scanning?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
}

export default function ProductSearch({
  value,
  onChange,
  onBarcodeScanned,
  placeholder = 'Scan barcode or search by name, short code, SKU…  (F2)',
  searching = false,
  resultCount,
  scanning = false,
  inputRef,
}: ProductSearchProps) {
  const [isBarcodeMode, setIsBarcodeMode] = useState(true);

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && value.trim() && onBarcodeScanned) {
      e.preventDefault();
      const handled = await onBarcodeScanned(value.trim());
      if (handled) onChange('');
    }
    if (e.key === 'Escape' && value) onChange('');
  };

  const query = value.trim();
  const busy = searching || scanning;

  return (
    <div className="relative">
      <div className="relative">
        {busy ? (
          <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-honey-700 animate-spin" aria-hidden="true" />
        ) : (
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        )}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-busy={busy}
          className="w-full pl-10 pr-20 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-honey-500 focus:border-transparent"
          autoFocus
          autoComplete="off"
          spellCheck={false}
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
          className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded ${isBarcodeMode ? 'bg-red-100 text-honey-700' : 'text-gray-400 hover:text-gray-600'}`}
          title={isBarcodeMode ? 'Scanner hint ON' : 'Scanner hint OFF'}
        >
          <Barcode className="h-5 w-5" />
        </button>
        {/* Thin moving bar under the box while searching */}
        {busy && (
          <div className="absolute inset-x-1 bottom-0 h-0.5 overflow-hidden rounded-full">
            <div className="h-full w-1/3 bg-honey-500" style={{ animation: 'pos-search-bar 1s ease-in-out infinite' }} />
          </div>
        )}
      </div>
      <div className="mt-1 min-h-[1rem] text-xs" aria-live="polite">
        {scanning ? (
          <span className="text-honey-700">Looking up &ldquo;{query}&rdquo;…</span>
        ) : searching ? (
          <span className="text-honey-700">Searching for &ldquo;{query}&rdquo;…</span>
        ) : query && resultCount !== undefined ? (
          <span className="text-gray-500">
            {resultCount === 0 ? <>No products match &ldquo;{query}&rdquo;</> : <>{resultCount} product{resultCount !== 1 ? 's' : ''} found for &ldquo;{query}&rdquo; — Enter adds a scanned code</>}
          </span>
        ) : isBarcodeMode ? (
          <span className="text-gray-500">Scan a barcode (or type a short code) and press Enter to add it</span>
        ) : null}
      </div>
      <style>{`@keyframes pos-search-bar{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
    </div>
  );
}
