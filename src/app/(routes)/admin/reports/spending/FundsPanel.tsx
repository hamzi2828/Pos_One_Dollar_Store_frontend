'use client';

// Money left now: the owner's starting balance (cash + bank together) plus
// sales, minus refunds, vendor payments, trip costs and expenses entered since.

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Landmark, Loader2, Pencil, RefreshCw } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage, formatRs, formatDate, storeApi } from '@/lib/storeApi';
import MoneyInput from '@/components/ui/MoneyInput';

interface Funds {
  baseline: { amount: number; at: string; setByName: string; note: string } | null;
  totals: { sales: number; refunds: number; vendorPayments: number; tripCosts: number; expenses: number } | null;
  left: number | null;
  movements: { at: string; kind: string; label: string; amount: number; balance: number }[];
}

const KIND: Record<string, string> = {
  sales: 'bg-emerald-50 text-emerald-700',
  refund: 'bg-orange-50 text-orange-700',
  vendor_payment: 'bg-rose-50 text-rose-700',
  trip_cost: 'bg-amber-50 text-amber-700',
  expense: 'bg-gray-100 text-gray-700',
};
const KIND_LABEL: Record<string, string> = { sales: 'Sales', refund: 'Refund', vendor_payment: 'Vendor paid', trip_cost: 'Trip cost', expense: 'Expense' };

export default function FundsPanel() {
  const { isSuperAdmin } = useAccess();
  const [d, setD] = useState<Funds | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [setting, setSetting] = useState(false);
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await storeApi.get<Funds>('/analytics/funds');
      setD(r.data);
      setError(null);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load the money left.'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    const n = Number(amount);
    if (!Number.isFinite(n)) return toast.error('Enter the money you have now');
    if (!window.confirm(`Start counting from ${formatRs(n)} now? Only things entered after this moment will change it.`)) return;
    setSaving(true);
    try {
      const r = await storeApi.post<Funds>('/analytics/funds/baseline', { amount: n });
      setD(r.data);
      setSetting(false);
      setAmount('');
      toast.success('Starting balance saved');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not save.'));
    } finally {
      setSaving(false);
    }
  };

  const t = d?.totals;
  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Landmark className="h-4 w-4 text-honey-700" /> Money left (cash + bank)
        </p>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={load} className="rounded-md border border-gray-300 p-1.5 text-gray-600 hover:bg-gray-50" title="Refresh">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </button>
          {isSuperAdmin && (
            <button type="button" onClick={() => setSetting((v) => !v)} className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
              <Pencil className="h-3.5 w-3.5" /> {d?.baseline ? 'Set new starting balance' : 'Set starting balance'}
            </button>
          )}
        </div>
      </div>

      {setting && (
        <div className="flex flex-col gap-2 border-b border-gray-100 bg-honey-50 px-4 py-3 sm:flex-row sm:items-center">
          <span className="text-sm text-gray-700">Money we have right now (all cash + bank):</span>
          <div className="w-44">
            <MoneyInput value={amount} onValue={setAmount} className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm" placeholder="e.g. 157195" />
          </div>
          <button type="button" onClick={save} disabled={saving} className="inline-flex items-center justify-center gap-1 rounded-lg bg-honey-500 px-3 py-1.5 text-sm font-medium text-gray-900 hover:bg-honey-600 disabled:opacity-60">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Start from now
          </button>
        </div>
      )}

      {error ? (
        <p className="px-4 py-4 text-sm text-red-600">{error}</p>
      ) : !d ? (
        <p className="px-4 py-4 text-sm text-gray-500">Loading…</p>
      ) : !d.baseline || !t ? (
        <p className="px-4 py-4 text-sm text-gray-600">No starting balance yet. Click &quot;Set starting balance&quot; and enter the money you have now.</p>
      ) : (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2 text-sm">
            <Box label="Started with" value={formatRs(d.baseline.amount)} hint={formatDate(d.baseline.at, true)} />
            <Box label="+ Sales" value={formatRs(t.sales)} tone="text-emerald-700" />
            <Box label="− Refunds" value={formatRs(t.refunds)} tone="text-orange-700" />
            <Box label="− Vendor payments" value={formatRs(t.vendorPayments)} tone="text-rose-700" />
            <Box label="− Trip costs" value={formatRs(t.tripCosts)} tone="text-amber-700" />
            <Box label="− Expenses" value={formatRs(t.expenses)} tone="text-gray-700" />
            <Box label="= Money left now" value={formatRs(d.left || 0)} tone={(d.left || 0) < 0 ? 'text-red-600' : 'text-gray-900'} strong />
          </div>
          {d.movements.length === 0 ? (
            <p className="text-xs text-gray-500">Nothing in or out since {formatDate(d.baseline.at, true)}.</p>
          ) : (
            <div className="max-h-96 overflow-y-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left">When</th>
                    <th className="px-3 py-2 text-left">What</th>
                    <th className="px-3 py-2 text-right">In / out</th>
                    <th className="px-3 py-2 text-right">Left after</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {d.movements.map((m, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">{formatDate(m.at, true)}</td>
                      <td className="px-3 py-2">
                        <span className={`mr-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ${KIND[m.kind] || 'bg-gray-100'}`}>{KIND_LABEL[m.kind] || m.kind}</span>
                        {m.label}
                      </td>
                      <td className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${m.amount >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {m.amount >= 0 ? '+' : '−'}
                        {formatRs(Math.abs(m.amount))}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap font-medium">{formatRs(m.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[11px] text-gray-500">
            Counts only what is entered after {formatDate(d.baseline.at, true)}
            {d.baseline.setByName ? ` (set by ${d.baseline.setByName})` : ''}. Sales are the money received on bills.
          </p>
        </div>
      )}
    </div>
  );
}

function Box({ label, value, hint, tone = 'text-gray-900', strong }: { label: string; value: string; hint?: string; tone?: string; strong?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${strong ? 'border-honey-400 bg-honey-50' : 'border-gray-200 bg-gray-50'}`}>
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className={`tabular-nums ${strong ? 'text-base font-bold' : 'font-semibold'} ${tone}`}>{value}</p>
      {hint && <p className="text-[10px] text-gray-400">{hint}</p>}
    </div>
  );
}
