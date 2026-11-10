'use client';

// One shop day, every counter added together (owner, 2026-11-09): the till
// page's "Sales of the day" for Counter 1 + Counter 2 on one page.
// Opened from Cash Closing → Combined → View. Reads ?day=YYYY-MM-DD&ids=<till ids>.

import { Fragment, Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, Layers, Loader2 } from 'lucide-react';
import { storeApi, apiErrorMessage, formatRs, formatDate } from '@/lib/storeApi';
import { useAccess } from '@/context/AccessContext';
import { LoadingCard, NoAccessCard, primaryBtn } from '@/components/admin/FormBits';
import { formatTime, type CashCount } from '@/components/store/TillStatusBar';
import { CountTable, StatusBadge, type TillDetail } from '../../../../till/components/tillUi';
import { CounterTag } from '../../../../expenses/components/CounterSelect';
import { dayLabel } from '../../closingBits';

const r2 = (n: number) => Math.round(n * 100) / 100;

/** One till's figures, the same way the till page works them out. */
function tillFigures(t: TillDetail) {
  const e = t.expected || t.liveExpected || null;
  // Change money: opening float vs what was left in the drawer (the till page's "Till" box).
  const drawer = t.drawerCount ?? (t.dayCash ? null : t.closingCount);
  return {
    float: t.openingFloat?.total ?? e?.float ?? 0,
    drawer: drawer ? drawer.total : null,
    sysCash: e ? r2(e.cashSales + e.cashReceivedOnCredit - e.cashRefunds) : 0,
    sysCard: t.nonCash?.card ?? e?.card ?? 0,
    sysBank: t.nonCash?.bank_transfer ?? e?.bankTransfer ?? 0,
    expenses: e?.expenses || 0,
    cash: t.dayCash ? t.dayCash.total : null,
    card: t.cardTotal ?? null,
    bank: t.bankTransferTotal ?? null,
    discounts: (t.discounts || []).reduce((s, d) => s + d.discount, 0),
    cashSales: e?.cashSales || 0,
    credit: e?.cashReceivedOnCredit || 0,
    refunds: e?.cashRefunds || 0,
  };
}
type Figs = ReturnType<typeof tillFigures>;

function Diff({ entered, system }: { entered: number | null; system: number | null }) {
  if (entered == null || system == null) return <span className="text-gray-400">—</span>;
  const d = r2(entered - system);
  if (Math.abs(d) < 1) return <span className="font-semibold text-green-600">OK</span>;
  return (
    <span className={`font-semibold ${d < 0 ? 'text-red-600' : 'text-amber-700'}`}>
      {d < 0 ? 'Short' : 'Over'} {formatRs(Math.abs(d))}
    </span>
  );
}

function DayPage() {
  const { can, loaded } = useAccess();
  const canView = can('report_cash_closing', 'view') && can('till_verify', 'view');
  const sp = useSearchParams();
  const day = sp.get('day') || '';
  const idKey = (sp.get('ids') || '')
    .split(',')
    .filter((x) => /^[a-f0-9]{24}$/i.test(x))
    .join(',');
  const [tills, setTills] = useState<TillDetail[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const list = await Promise.all(
        idKey
          .split(',')
          .filter(Boolean)
          .map((id) => storeApi.get<TillDetail>(`/till-sessions/${id}`).then((r) => r.data))
      );
      list.sort((a, b) => (a.counterName || '').localeCompare(b.counterName || '') || String(a.openedAt).localeCompare(String(b.openedAt)));
      setTills(list);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load the tills.'));
    }
  }, [idKey]);

  useEffect(() => {
    if (canView && idKey) load();
  }, [canView, idKey, load]);

  if (!loaded) return <div className="max-w-7xl mx-auto px-4 py-6"><LoadingCard text="Loading…" /></div>;
  if (!canView) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <NoAccessCard />
      </div>
    );
  }

  const shell = (body: ReactNode) => (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl space-y-4 p-3 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-honey-100 text-honey-800">
            <Layers className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{dayLabel(day)} — all counters together</h1>
            <p className="text-sm text-gray-500">{tills ? tills.map((t) => t.counterName || 'No counter').join(' + ') : 'Loading…'}</p>
          </div>
        </div>
        {body}
      </div>
    </div>
  );

  if (!idKey) return shell(<p className="text-sm text-gray-500">No tills picked. Open this page from Cash Closing → Combined → View.</p>);
  if (error)
    return shell(
      <div className="bg-white rounded-xl border border-red-200 text-center py-10 px-4">
        <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
        <p className="text-sm text-red-700 mb-4">{error}</p>
        <button type="button" onClick={load} className={primaryBtn}>
          Try again
        </button>
      </div>
    );
  if (!tills)
    return shell(
      <div className="py-10 text-center">
        <Loader2 className="h-6 w-6 text-honey-700 animate-spin mx-auto" />
      </div>
    );

  const figs = tills.map(tillFigures);
  const add = (k: keyof Figs) => r2(figs.reduce((t, f) => t + ((f[k] as number | null) || 0), 0));
  const anyGiven = (k: 'cash' | 'card' | 'bank') => figs.some((f) => f[k] != null);
  const expensesAmt = add('expenses');
  const discountAmt = add('discounts');
  const rows: { label: string; entered: number | null; system: number; target?: number; hint?: string }[] = [
    {
      label: 'Cash',
      entered: anyGiven('cash') ? add('cash') : null,
      system: add('sysCash'),
      target: r2(add('sysCash') - expensesAmt),
      hint: expensesAmt ? 'after expenses' : undefined,
    },
    { label: 'POS machine (card)', entered: anyGiven('card') ? add('card') : null, system: add('sysCard') },
    { label: 'Bank transfer', entered: anyGiven('bank') ? add('bank') : null, system: add('sysBank') },
  ];
  const sum = (k: 'entered' | 'system') => r2(rows.reduce((t, r) => t + (r[k] || 0), 0));
  const anyEntered = rows.some((r) => r.entered != null);
  const shouldGive = r2(sum('system') - expensesAmt);
  // Change money, all counters (drawer not counted yet = as the float).
  const floatAmt = add('float');
  const drawerAmt = r2(figs.reduce((t, f) => t + (f.drawer ?? f.float), 0));
  const anyDrawer = figs.some((f) => f.drawer != null);

  // All cash notes handed over, every counter together.
  const notes: CashCount = { denominations: {}, total: 0 };
  for (const t of tills) {
    if (!t.dayCash) continue;
    notes.total += t.dayCash.total;
    for (const [v, c] of Object.entries(t.dayCash.denominations || {})) notes.denominations[v] = (notes.denominations[v] || 0) + Number(c);
  }
  const noteTills = tills.filter((t) => t.dayCash && Object.keys(t.dayCash.denominations || {}).length);
  const seen = new Set<string>();
  const expenses = tills.flatMap((t) =>
    (t.expenses || [])
      .filter((x) => {
        if (seen.has(x._id)) return false;
        seen.add(x._id);
        return true;
      })
      .map((x) => ({ ...x, tillCounter: t.counterName || '' }))
  );
  const discounts = tills.flatMap((t) => t.discounts || []);

  return shell(
    <>
      {/* Each counter */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-[11px] uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2 text-left font-semibold">Till</th>
              <th className="px-4 py-2 text-left font-semibold">Opened → closed</th>
              <th className="px-4 py-2 text-right font-semibold">Cash gave</th>
              <th className="px-4 py-2 text-right font-semibold">Card</th>
              <th className="px-4 py-2 text-right font-semibold">Bank</th>
              <th className="px-4 py-2 text-right font-semibold">Expenses</th>
              <th className="px-4 py-2 text-right font-semibold">Should hand over</th>
              <th className="px-4 py-2 text-right font-semibold">Sales over / short</th>
              <th className="px-4 py-2 text-right font-semibold">Change money</th>
              <th className="px-4 py-2 text-right font-semibold">Total over / short</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tills.map((t, i) => {
              const f = figs[i];
              const given = f.cash == null && f.card == null && f.bank == null ? null : (f.cash || 0) + (f.card || 0) + (f.bank || 0);
              const should = r2(f.sysCash + f.sysCard + f.sysBank - f.expenses);
              return (
                <tr key={t._id} className="cursor-pointer hover:bg-gray-50" onClick={() => window.open(`/admin/till/${t._id}`, '_blank', 'noopener')}>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <span className="font-medium text-gray-900">{t.sessionNo}</span> <StatusBadge status={t.status} />
                    <span className="block text-xs text-gray-500">
                      {t.counterName || 'No counter'} · {t.cashierName}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-600 whitespace-nowrap">
                    {formatDate(t.openedAt, true)}
                    {t.closedAt ? ` → ${formatTime(t.closedAt)}` : ''}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{f.cash != null ? formatRs(f.cash) : '—'}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{f.card != null ? formatRs(f.card) : '—'}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{f.bank != null ? formatRs(f.bank) : '—'}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-700">{f.expenses ? `−${formatRs(f.expenses)}` : '—'}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatRs(should)}</td>
                  <td className="px-4 py-2 text-right text-xs tabular-nums">
                    <Diff entered={given} system={should} />
                  </td>
                  <td className="px-4 py-2 text-right text-xs tabular-nums whitespace-nowrap">
                    {f.drawer != null && <span className="block text-gray-500">{formatRs(f.drawer)} left · float {formatRs(f.float)}</span>}
                    <Diff entered={f.drawer} system={f.float} />
                  </td>
                  <td className="px-4 py-2 text-right text-xs tabular-nums">
                    <Diff entered={given == null ? null : r2(given + (f.drawer ?? f.float))} system={r2(should + f.float)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Sales of the day, all counters */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
        <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Sales of the day · all counters</p>
        <table className="w-full text-sm">
          <thead className="text-[11px] text-gray-500">
            <tr>
              <th className="py-1 text-left font-medium"></th>
              <th className="py-1 text-right font-medium">Cashiers gave</th>
              <th className="py-1 text-right font-medium">Sales were</th>
              <th className="py-1 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
              <Fragment key={r.label}>
                <tr>
                  <td className="py-1.5 pr-2 text-gray-700">{r.label}</td>
                  <td className="py-1.5 text-right tabular-nums">{r.entered != null ? formatRs(r.entered) : '—'}</td>
                  <td className="py-1.5 text-right tabular-nums text-gray-600">{formatRs(r.system)}</td>
                  <td className="py-1.5 pl-2 text-right text-xs tabular-nums">
                    <Diff entered={r.entered} system={r.target !== undefined ? r.target : r.system} />
                    {r.hint && r.entered != null && <span className="block text-[10px] font-normal text-gray-400">{r.hint}</span>}
                  </td>
                </tr>
                {r.label === 'Cash' && notes.total > 0 && (
                  <tr>
                    <td colSpan={4} className="pb-2 pl-3">
                      <div className="rounded-md bg-gray-50 p-2 space-y-2">
                        <div>
                          <p className="mb-1 text-[11px] font-semibold uppercase text-gray-500">Cash notes · all counters · {formatRs(notes.total)}</p>
                          <CountTable count={notes} />
                        </div>
                        {noteTills.length > 1 &&
                          noteTills.map((t) => (
                            <div key={t._id} className="border-t border-gray-200 pt-1.5">
                              <p className="mb-1 text-[10px] font-semibold uppercase text-gray-400">
                                {t.counterName || 'No counter'} · {t.cashierName} · {formatRs(t.dayCash?.total)}
                              </p>
                              <CountTable count={t.dayCash ?? null} />
                            </div>
                          ))}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
          <tfoot className="text-sm">
            {discountAmt > 0 && (
              <>
                <tr className="border-t-2 border-gray-300">
                  <td className="py-1.5 pr-2 text-gray-600">Sales at full price</td>
                  <td />
                  <td className="py-1.5 text-right tabular-nums text-gray-600">{formatRs(sum('system') + discountAmt)}</td>
                  <td />
                </tr>
                <tr>
                  <td className="py-1.5 pr-2 text-gray-600">− Discounts ({discounts.length})</td>
                  <td />
                  <td className="py-1.5 text-right tabular-nums text-rose-700">−{formatRs(discountAmt)}</td>
                  <td />
                </tr>
              </>
            )}
            <tr className={`font-semibold ${discountAmt > 0 ? '' : 'border-t-2 border-gray-300'}`}>
              <td className="py-1.5 pr-2 text-gray-900">= Total sales</td>
              <td className="py-1.5 text-right tabular-nums text-gray-900">{anyEntered ? formatRs(sum('entered')) : '—'}</td>
              <td className="py-1.5 text-right tabular-nums text-gray-900">{formatRs(sum('system'))}</td>
              <td />
            </tr>
            {expenses.length > 0 && (
              <>
                <tr>
                  <td colSpan={4} className="pt-2.5 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    − Expenses, payments &amp; trip costs ({expenses.filter((x) => !x.shopUse).length})
                  </td>
                </tr>
                {expenses.map((x) => (
                  <tr key={x._id} className={x.shopUse ? 'text-gray-400' : ''}>
                    <td className="py-1 pl-3 pr-2 text-gray-700">
                      {x.title}
                      {x.counterName && <CounterTag name={x.counterName} className="ml-1" />}
                      <span className="ml-1 text-[11px] text-gray-400">
                        {new Date(x.createdAt).toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Karachi' })}
                        {x.tillCounter ? ` · off ${x.tillCounter} till` : ''}
                        {x.paymentMethod && x.paymentMethod !== 'Cash' ? ` · ${x.paymentMethod}` : ''}
                        {x.shopUse ? ' · shop use, not from cash' : ''}
                      </span>
                    </td>
                    <td />
                    <td className="py-1 text-right tabular-nums text-gray-700">{x.shopUse ? '—' : `−${formatRs(x.amount)}`}</td>
                    <td />
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="py-1.5 pl-3 pr-2 text-gray-800">Total paid out</td>
                  <td />
                  <td className="py-1.5 text-right tabular-nums text-rose-700">−{formatRs(expensesAmt)}</td>
                  <td />
                </tr>
              </>
            )}
            <tr className="border-t border-gray-300 bg-gray-50 font-bold">
              <td className="py-2 pr-2 text-gray-900">= Rest (to hand over)</td>
              <td className="py-2 text-right tabular-nums text-gray-900">{anyEntered ? formatRs(sum('entered')) : '—'}</td>
              <td className="py-2 text-right tabular-nums text-gray-900">{formatRs(shouldGive)}</td>
              <td className="py-2 pl-2 text-right text-xs tabular-nums">
                {anyEntered ? <Diff entered={sum('entered')} system={shouldGive} /> : <span className="text-gray-400">—</span>}
              </td>
            </tr>
            <tr>
              <td className="py-1.5 pr-2 text-gray-700">
                Change money (left in drawers vs opening float)
                <span className="block text-[10px] text-gray-400">kept apart from sales, like on each till page</span>
              </td>
              <td className="py-1.5 text-right tabular-nums">{anyDrawer ? formatRs(drawerAmt) : '—'}</td>
              <td className="py-1.5 text-right tabular-nums text-gray-600">{formatRs(floatAmt)}</td>
              <td className="py-1.5 pl-2 text-right text-xs tabular-nums">
                {anyDrawer ? <Diff entered={drawerAmt} system={floatAmt} /> : <span className="text-gray-400">—</span>}
              </td>
            </tr>
            <tr className="border-t-2 border-gray-300 bg-honey-50 font-bold">
              <td className="py-2 pr-2 text-gray-900">
                = Total over / short
                <span className="block text-[10px] font-normal text-gray-500">sales + change money (same as the Cash Closing list)</span>
              </td>
              <td className="py-2 text-right tabular-nums text-gray-900">{anyEntered ? formatRs(r2(sum('entered') + drawerAmt)) : '—'}</td>
              <td className="py-2 text-right tabular-nums text-gray-900">{formatRs(r2(shouldGive + floatAmt))}</td>
              <td className="py-2 pl-2 text-right text-xs tabular-nums">
                {anyEntered ? <Diff entered={r2(sum('entered') + drawerAmt)} system={r2(shouldGive + floatAmt)} /> : <span className="text-gray-400">—</span>}
              </td>
            </tr>
          </tfoot>
        </table>
        <p className="mt-1 text-[11px] text-gray-500">
          Cash should be = cash sales {formatRs(add('cashSales'))}
          {add('credit') > 0 ? ` + credit received ${formatRs(add('credit'))}` : ''}
          {add('refunds') > 0 ? ` − refunds ${formatRs(add('refunds'))}` : ''}
          {expensesAmt > 0 ? ` − expenses, payments & trip costs ${formatRs(expensesAmt)}` : ''}
        </p>
      </div>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-6"><LoadingCard text="Loading…" /></div>}>
      <DayPage />
    </Suspense>
  );
}
