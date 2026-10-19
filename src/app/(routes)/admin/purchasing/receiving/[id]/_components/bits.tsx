'use client';

// Small pieces shared by the receive-goods steps.
import { AlertTriangle } from 'lucide-react';

export function SameReceiverNote() {
  return (
    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
      <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
      <span>
        <strong>Someone else must receive these goods.</strong> You bought them, so another staff member has to check the boxes and enter the goods.
      </span>
    </div>
  );
}

/** Round to 2 decimals (money). */
export const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** Profit % on the sale price after trip costs, or null when it cannot be worked out. */
export function marginPct(salePrice: number, costPrice: number, chargeRate = 0) {
  if (!(salePrice > 0) || !(costPrice > 0)) return null;
  const full = costPrice * (1 + (chargeRate || 0));
  return Math.round(((salePrice - full) / salePrice) * 100);
}
