'use client';

// Shared bits of the Cash Closing report: per-till figures and the
// "by day — all counters together" table (owner, 2026-11-09).
import { Eye } from 'lucide-react';
import { formatRs } from '@/lib/storeApi';
import type { TillSession } from '@/components/store/TillStatusBar';
import { varianceClass, varianceLabel } from '../../till/components/tillUi';

/** YYYY-MM-DD in the browser's (Pakistan) time. */
export const dayString = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;


export type ReportRow = TillSession & { discountTotal?: number; discountBills?: number };

/** Cashier vs system per till: cash (after the day's expenses), POS machine, Bank (UBL), JazzCash; overall over / short. */
export function figures(r: ReportRow) {
  const e = r.expected;
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const sysCash = e ? r2(e.cashSales + e.cashReceivedOnCredit - e.cashRefunds - (e.expenses || 0)) : null;
  const sysCard = e?.card ?? null;
  const sysBank = e?.bankTransfer ?? null;
  // Old tills (before JazzCash had its own bucket) have no expected.jazzcash: 0.
  const sysJazz = e ? (e.jazzcash ?? 0) : null;
  const cash = r.dayCash ? r.dayCash.total : null;
  const card = r.cardTotal ?? null;
  const bank = r.bankTransferTotal ?? null;
  const jazz = r.jazzcashTotal ?? null;
  // Over / short: the cash result (till + cash) + card, bank and JazzCash differences.
  let over: number | null = r.variance ?? null;
  if (over != null && card != null && sysCard != null) over += card - sysCard;
  if (over != null && bank != null && sysBank != null) over += bank - sysBank;
  if (over != null && jazz != null && sysJazz != null) over += jazz - sysJazz;
  return {
    cash,
    sysCash,
    card,
    sysCard,
    bank,
    sysBank,
    jazz,
    sysJazz,
    expenses: e?.expenses || 0,
    discounts: r.discountTotal || 0,
    over: over == null ? null : r2(over),
  };
}

export function Pair({ got, should }: { got: number | null; should: number | null }) {
  return (
    <>
      <span className="block font-medium text-gray-900">{got != null ? formatRs(got) : '—'}</span>
      {should != null && <span className="block text-[10px] text-gray-500">sales {formatRs(should)}</span>}
    </>
  );
}

/** Shop day of a till: its closing time less 6 h, so a till closed after midnight counts for the day before. */
const shopDay = (r: ReportRow) => {
  const at = r.closedAt || r.openedAt;
  return at ? dayString(new Date(new Date(at).getTime() - 6 * 3600 * 1000)) : '';
};

type Fig = ReturnType<typeof figures>;
export type FigKey = 'cash' | 'sysCash' | 'card' | 'sysCard' | 'bank' | 'sysBank' | 'jazz' | 'sysJazz' | 'expenses' | 'discounts' | 'over';
export const addFig = (all: Fig[], k: FigKey) => all.reduce((t, f) => t + ((f[k] as number | null) || 0), 0);

/** Every day with all its counters added together (owner, 2026-11-09). */
export function byDay(rows: ReportRow[]) {
  const map = new Map<string, ReportRow[]>();
  for (const r of rows) {
    const d = shopDay(r);
    map.set(d, [...(map.get(d) || []), r]);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([day, list]) => ({
      day,
      tills: list.length,
      counters: [...new Set(list.map((r) => r.counterName || 'No counter'))].sort(),
      ids: list.map((r) => r._id),
      figs: list.map(figures),
    }));
}

/** "2026-11-08" -> "Sun, 8 Nov 2026". */
export const dayLabel = (d: string) =>
  d ? new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '—';


/** Every day, all counters added together. */
export function ByDayTable({ rows }: { rows: ReportRow[] }) {
  const days = byDay(rows);
  const allFigs = days.flatMap((d) => d.figs);
  const th = 'px-4 py-2 text-right font-semibold';
  const td = 'px-4 py-2 text-right tabular-nums whitespace-nowrap';
  const cells = (figs: Fig[], bold = true) => (
    <>
      <td className={td}>
        <Pair got={addFig(figs, 'cash')} should={addFig(figs, 'sysCash')} />
      </td>
      <td className={td}>
        <Pair got={addFig(figs, 'card')} should={addFig(figs, 'sysCard')} />
      </td>
      <td className={td}>
        <Pair got={addFig(figs, 'bank')} should={addFig(figs, 'sysBank')} />
      </td>
      <td className={td}>
        <Pair got={addFig(figs, 'jazz')} should={addFig(figs, 'sysJazz')} />
      </td>
      <td className={`${td} text-gray-700`}>{addFig(figs, 'expenses') ? formatRs(addFig(figs, 'expenses')) : '—'}</td>
      <td className={`${td} text-rose-700`}>{addFig(figs, 'discounts') ? formatRs(addFig(figs, 'discounts')) : '—'}</td>
      <td className={`${td} ${bold ? 'font-semibold' : ''} ${varianceClass(addFig(figs, 'over'))}`}>{varianceLabel(addFig(figs, 'over'))}</td>
    </>
  );
  return (
    <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-[11px] uppercase text-gray-500">
          <tr>
            <th className="px-4 py-2 text-left font-semibold">Day</th>
            <th className="px-4 py-2 text-left font-semibold">Counters</th>
            <th className={th}>Cash</th>
            <th className={th}>POS</th>
            <th className={th}>Bank (UBL)</th>
            <th className={th}>JazzCash</th>
            <th className={th}>Expenses</th>
            <th className={th}>Discounts</th>
            <th className={th}>Over / short</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {days.map((d) => (
            <tr key={d.day}>
              <td className="px-4 py-2 font-medium text-gray-900 whitespace-nowrap">{dayLabel(d.day)}</td>
              <td className="px-4 py-2 text-xs text-gray-600 whitespace-nowrap">
                {d.counters.join(' + ')}
                <span className="block text-[10px] text-gray-400">
                  {d.tills} till{d.tills === 1 ? '' : 's'}
                </span>
              </td>
              {cells(d.figs)}
              <td className="px-4 py-2 text-right">
                <a
                  href={`/admin/reports/cash-closing/combined/day?day=${d.day}&ids=${d.ids.join(',')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Eye className="h-3.5 w-3.5" /> View
                </a>
              </td>
            </tr>
          ))}
        </tbody>
        {days.length > 1 && (
          <tfoot className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
            <tr>
              <td className="px-4 py-2" colSpan={2}>
                Total ({days.length} days)
              </td>
              {cells(allFigs, false)}
              <td />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
