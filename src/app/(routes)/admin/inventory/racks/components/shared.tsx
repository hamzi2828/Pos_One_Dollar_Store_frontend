'use client';

// Small pieces shared by the Racks and the Put-away pages.

import React from 'react';
import { openPrintWindow, showHtmlInWindow, printHtmlInHiddenFrame } from '@/app/(routes)/admin/products/services/labelService';

/** Small stat tile (icon + number + label). */
export function StatTile({ icon, bg, value, label }: { icon: React.ReactNode; bg: string; value: React.ReactNode; label: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-2 sm:p-3">
      <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2">
        <div className={`p-1 sm:p-1.5 rounded-md ${bg}`}>{icon}</div>
        <div className="text-center sm:text-left min-w-0">
          <p className="text-sm sm:text-lg font-semibold text-gray-900 tabular-nums">{value}</p>
          <p className="text-[9px] sm:text-[11px] text-gray-500 truncate">{label}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Open label HTML for printing. Call from the click handler: the window is
 * opened BEFORE the fetch so the browser does not block it as a popup.
 */
export async function printLabelHtml(getHtml: () => Promise<string>) {
  const w = openPrintWindow();
  try {
    const html = await getHtml();
    if (w) showHtmlInWindow(w, html);
    else await printHtmlInHiddenFrame(html);
  } catch (e) {
    if (w) w.close();
    throw e;
  }
}
