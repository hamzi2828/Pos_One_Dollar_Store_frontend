'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  page: number;
  pages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
}

export default function Pagination({ page, pages, total, limit, onPageChange, onLimitChange }: Props) {
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);

  // Compute visible page numbers: window of up to 7 centered on current.
  const windowSize = 5;
  let start = Math.max(1, page - Math.floor(windowSize / 2));
  const end = Math.min(pages, start + windowSize - 1);
  if (end - start + 1 < windowSize) start = Math.max(1, end - windowSize + 1);
  const nums: number[] = [];
  for (let i = start; i <= end; i += 1) nums.push(i);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-3 py-2 border-t border-gray-100 bg-white rounded-b-lg">
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span>Showing {from}–{to} of {total}</span>
        {onLimitChange && (
          <select
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            className="border border-gray-200 rounded-md px-1.5 py-0.5 text-xs bg-white"
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>{n} / page</option>
            ))}
          </select>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="p-1.5 rounded-md border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
          aria-label="Previous"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {start > 1 && (
          <>
            <button type="button" onClick={() => onPageChange(1)} className="px-2 py-1 text-xs rounded-md hover:bg-gray-100">1</button>
            {start > 2 && <span className="text-xs text-gray-400 px-1">…</span>}
          </>
        )}
        {nums.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onPageChange(n)}
            className={`px-2 py-1 text-xs rounded-md ${
              n === page ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            {n}
          </button>
        ))}
        {end < pages && (
          <>
            {end < pages - 1 && <span className="text-xs text-gray-400 px-1">…</span>}
            <button type="button" onClick={() => onPageChange(pages)} className="px-2 py-1 text-xs rounded-md hover:bg-gray-100">{pages}</button>
          </>
        )}
        <button
          type="button"
          onClick={() => onPageChange(Math.min(pages, page + 1))}
          disabled={page >= pages}
          className="p-1.5 rounded-md border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
          aria-label="Next"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
