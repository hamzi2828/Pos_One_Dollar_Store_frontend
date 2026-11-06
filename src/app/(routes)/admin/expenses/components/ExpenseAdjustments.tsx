'use client';

// The expense amount is never typed over: each change is a + / − adjustment
// with a reason, kept as history (owner 2026-11-06).
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, Minus, Plus } from 'lucide-react';
import MoneyInput from '@/components/ui/MoneyInput';
import { apiErrorMessage, formatDate, formatRs } from '@/lib/storeApi';
import { expenseService } from '../service/expenseService';
import type { ExpenseAdjustment } from '../types';

export default function ExpenseAdjustments({
  expenseId,
  amount,
  originalAmount,
  adjustments,
  onChanged,
  disabled,
}: {
  expenseId: string;
  amount: number;
  originalAmount: number | null;
  adjustments: ExpenseAdjustment[];
  onChanged: (next: { amount: number; originalAmount: number | null; adjustments: ExpenseAdjustment[] }) => void;
  disabled?: boolean;
}) {
  const [sign, setSign] = useState<1 | -1>(1);
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const n = Math.max(0, Number(value) || 0);
  const after = Math.round((amount + sign * n) * 100) / 100;

  const add = async () => {
    if (busy) return;
    if (!n) return toast.error('Enter the adjustment amount');
    if (!note.trim()) return toast.error('Write why the amount changes');
    if (after < 0) return toast.error('The amount cannot go below 0');
    setBusy(true);
    try {
      const data = await expenseService.adjustExpense(expenseId, sign * n, note.trim());
      onChanged({ amount: Number(data.amount) || 0, originalAmount: data.originalAmount ?? null, adjustments: data.adjustments || [] });
      setValue('');
      setNote('');
      toast.success(`Amount is now ${formatRs(Number(data.amount) || 0)}`);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not add the adjustment.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2">
        <span className="text-sm text-gray-600">
          Amount {adjustments.length > 0 && originalAmount != null ? `(first ${formatRs(originalAmount)})` : ''}
        </span>
        <span className="text-xl font-bold tabular-nums text-gray-900">{formatRs(amount)}</span>
      </div>

      {adjustments.length > 0 && (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 text-sm">
          {adjustments.map((a, i) => (
            <li key={i} className="flex items-start justify-between gap-3 px-3 py-2">
              <span className="min-w-0">
                <span className="block text-gray-800">{a.note || 'Adjustment'}</span>
                <span className="block text-[11px] text-gray-500">
                  {a.byName || '—'} · {formatDate(a.at, true)}
                </span>
              </span>
              <span className={`tabular-nums font-semibold ${a.amount < 0 ? 'text-green-700' : 'text-rose-700'}`}>
                {a.amount < 0 ? '−' : '+'}
                {formatRs(Math.abs(a.amount))}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-lg border border-honey-300 bg-honey-50/60 p-3">
        <p className="mb-2 text-sm font-semibold text-gray-900">Add adjustment</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="inline-flex overflow-hidden rounded-lg border border-gray-300">
            <button
              type="button"
              onClick={() => setSign(1)}
              disabled={busy || disabled}
              className={`inline-flex items-center gap-1 px-3 py-2 text-sm font-semibold ${sign === 1 ? 'bg-rose-600 text-white' : 'bg-white text-gray-700'}`}
            >
              <Plus className="h-4 w-4" /> More
            </button>
            <button
              type="button"
              onClick={() => setSign(-1)}
              disabled={busy || disabled}
              className={`inline-flex items-center gap-1 px-3 py-2 text-sm font-semibold ${sign === -1 ? 'bg-green-600 text-white' : 'bg-white text-gray-700'}`}
            >
              <Minus className="h-4 w-4" /> Less
            </button>
          </div>
          <div className="sm:w-40">
            <MoneyInput value={value} onValue={setValue} disabled={busy || disabled} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-right" placeholder="0" />
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            disabled={busy || disabled}
            placeholder="Why? e.g. 2 more workers got a tip"
            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={add}
            disabled={busy || disabled || !n || !note.trim()}
            className="inline-flex items-center justify-center gap-1 rounded-lg bg-honey-500 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-honey-600 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Add
          </button>
        </div>
        {n > 0 && (
          <p className="mt-2 text-xs text-gray-600">
            {formatRs(amount)} {sign === 1 ? '+' : '−'} {formatRs(n)} = <strong className={after < 0 ? 'text-red-600' : 'text-gray-900'}>{formatRs(after)}</strong>
          </p>
        )}
      </div>
    </div>
  );
}
