'use client';

// One shop day, every counter added together (owner, 2026-11-09): the till
// page's "Sales of the day" for Counter 1 + Counter 2 on one page.
// Opened from Cash Closing → Combined → View. Reads ?day=YYYY-MM-DD&ids=<till ids>.

import { Fragment, Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { AlertCircle, BadgeCheck, Check, FileDown, Layers, Loader2, Pencil, X } from 'lucide-react';
import { storeApi, apiErrorMessage, formatRs, formatDate } from '@/lib/storeApi';
import { useAccess } from '@/context/AccessContext';
import { LoadingCard, NoAccessCard, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';

// Card machine settlement of the day (owner 2026-11-20): the total the POS machine
// settled, typed by the admin. When set, it is used as "Cashiers gave" for card,
// so the totals below show over / short against the system card sales.
type CardSettlement = { day: string; amount: number; note: string; byName: string; at: string } | null;
import { tillFigures, rowFigures, type TillFigs as Figs } from '../../../../till/components/tillPdf';
import { formatTime, type CashCount } from '@/components/store/TillStatusBar';
import { CountTable, StatusBadge, type TillDetail } from '../../../../till/components/tillUi';
import { CounterTag } from '../../../../expenses/components/CounterSelect';
import { dayLabel } from '../../closingBits';

const r2 = (n: number) => Math.round(n * 100) / 100;

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
  const [pdfBusy, setPdfBusy] = useState(false);
  const canEdit = can('till_verify', 'edit');
  const [settlement, setSettlement] = useState<CardSettlement>(null);
  const [editCard, setEditCard] = useState(false);
  const [cardDraft, setCardDraft] = useState('');
  const [cardSaving, setCardSaving] = useState(false);

  const saveSettlement = async () => {
    if (cardSaving) return;
    const raw = cardDraft.replace(/[,\s]/g, '');
    if (raw !== '' && !(Number(raw) >= 0)) return toast.error('Enter a valid amount.');
    setCardSaving(true);
    try {
      const r = await storeApi.put<CardSettlement>('/till-sessions/card-settlement', { day, amount: raw === '' ? null : Number(raw) });
      setSettlement(r.data ?? null);
      setEditCard(false);
      toast.success(raw === '' ? 'Card settlement removed' : 'Card settlement saved');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not save.'));
    } finally {
      setCardSaving(false);
    }
  };

  // Verify every till of the day at once (owner 2026-11-20). Same call as the till
  // page: a short till becomes a till-shortage deduction for its cashier.
  const [verifyBusy, setVerifyBusy] = useState(false);
  const toVerify = (tills || []).filter((t) => t.status === 'closed' || t.status === 'disputed');
  const verifyAll = async () => {
    if (verifyBusy || !toVerify.length) return;
    const lines = toVerify.map((t) => {
      const v = Number(t.variance) || 0;
      const what = v <= -1 ? `Short ${formatRs(-v)} → salary deduction for ${t.cashierName}` : v >= 1 ? `Over ${formatRs(v)}` : 'OK';
      return `${t.sessionNo} · ${t.counterName || 'No counter'} · ${t.cashierName}: ${what}`;
    });
    const card = settlement ? `\n\nPOS machine settlement: ${formatRs(settlement.amount)}` : '';
    if (!window.confirm(`Verify ${toVerify.length} till${toVerify.length === 1 ? '' : 's'} of ${dayLabel(day)}?\n\n${lines.join('\n')}${card}\n\nAfter verifying, the tills can no longer be changed.`)) return;
    setVerifyBusy(true);
    let done = 0;
    try {
      for (const t of toVerify) {
        await storeApi.post(`/till-sessions/${t._id}/verify`, { note: settlement ? `Day verified · POS machine settlement ${formatRs(settlement.amount)}` : 'Day verified' });
        done += 1;
      }
      toast.success(`${done} till${done === 1 ? '' : 's'} verified`);
    } catch (e) {
      toast.error(`${done ? `${done} verified, then: ` : ''}${apiErrorMessage(e, 'Could not verify.')}`);
    } finally {
      setVerifyBusy(false);
      load();
    }
  };

  const downloadPdf = async () => {
    if (!tills || pdfBusy) return;
    setPdfBusy(true);
    try {
      const { downloadCombinedDayPdf } = await import('../../../../till/components/tillPdf');
      await downloadCombinedDayPdf(tills, dayLabel(day), day);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not make the PDF.'));
    } finally {
      setPdfBusy(false);
    }
  };

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
      if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
        storeApi
          .get<CardSettlement>(`/till-sessions/card-settlement?day=${day}`)
          .then((r) => setSettlement(r.data ?? null))
          .catch(() => setSettlement(null));
      }
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load the tills.'));
    }
  }, [idKey, day]);

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
      <div className="w-full space-y-4 p-3 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-honey-100 text-honey-800">
            <Layers className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{dayLabel(day)} — all counters together</h1>
            <p className="text-sm text-gray-500">{tills ? tills.map((t) => t.counterName || 'No counter').join(' + ') : 'Loading…'}</p>
          </div>
          {tills && canEdit && toVerify.length > 0 && (
            <button type="button" onClick={verifyAll} disabled={verifyBusy} className={`${primaryBtn} ml-auto`}>
              {verifyBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
              Verify {toVerify.length === tills.length ? 'all' : toVerify.length} ({toVerify.length})
            </button>
          )}
          {tills && (
            <button type="button" onClick={downloadPdf} disabled={pdfBusy} className={`${secondaryBtn} ${canEdit && toVerify.length > 0 ? '' : 'ml-auto'}`}>
              {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              Download PDF
            </button>
          )}
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
  const anyGiven = (k: 'cash' | 'card' | 'bank' | 'jazz') => figs.some((f) => f[k] != null);
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
    {
      label: 'POS machine (card)',
      entered: settlement ? settlement.amount : anyGiven('card') ? add('card') : null,
      system: add('sysCard'),
    },
    { label: 'Bank (UBL)', entered: anyGiven('bank') ? add('bank') : null, system: add('sysBank') },
    { label: 'JazzCash', entered: anyGiven('jazz') ? add('jazz') : null, system: add('sysJazz') },
  ];
  const sum = (k: 'entered' | 'system') => r2(rows.reduce((t, r) => t + (r[k] || 0), 0));
  const anyEntered = rows.some((r) => r.entered != null);
  const shouldGive = r2(sum('system') - expensesAmt);
  // Change money, all counters (drawer not counted yet = as the float).
  const floatAmt = add('float');
  const drawerAmt = r2(figs.reduce((t, f) => t + (f.drawer ?? f.float), 0));
  const anyDrawer = figs.some((f) => f.drawer != null);

  // "All counters" row of the per-till table: the rows added up.
  const tillRows = figs.map(rowFigures);
  const sumOf = (vals: (number | null)[]) => (vals.some((v) => v != null) ? r2(vals.reduce<number>((t, v) => t + (v || 0), 0)) : null);
  const foot = {
    should: r2(tillRows.reduce((t, r) => t + r.should, 0)),
    salesDiff: sumOf(tillRows.map((r) => r.salesDiff)),
    changeDiff: sumOf(tillRows.map((r) => r.changeDiff)),
    totalDiff: sumOf(tillRows.map((r) => r.totalDiff)),
    // Change money of the counted drawers only (same as each row shows).
    left: r2(figs.reduce((t, f) => t + (f.drawer ?? 0), 0)),
    leftFloat: r2(figs.reduce((t, f) => t + (f.drawer != null ? f.float : 0), 0)),
  };
  const money = (v: number | null) => (v != null ? formatRs(v) : '—');

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
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-[11px] uppercase text-gray-500">
            <tr>
              <th className="px-2.5 py-2 text-left font-semibold align-bottom">Till</th>
              <th className="px-2.5 py-2 text-left font-semibold align-bottom">Opened → closed</th>
              <th className="px-2.5 py-2 text-right font-semibold align-bottom">Cash gave</th>
              <th className="px-2.5 py-2 text-right font-semibold align-bottom">Card</th>
              <th className="px-2.5 py-2 text-right font-semibold align-bottom">Bank (UBL)</th>
              <th className="px-2.5 py-2 text-right font-semibold align-bottom">JazzCash</th>
              <th className="px-2.5 py-2 text-right font-semibold align-bottom">Expenses</th>
              <th className="px-2.5 py-2 text-right font-semibold align-bottom">Should hand over</th>
              <th className="px-2.5 py-2 text-right font-semibold align-bottom">Sales over / short</th>
              <th className="px-2.5 py-2 text-right font-semibold align-bottom">Change money</th>
              <th className="px-2.5 py-2 text-right font-semibold align-bottom">Total over / short</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tills.map((t, i) => {
              const f = figs[i];
              const { given, should } = tillRows[i];
              return (
                <tr key={t._id} className="cursor-pointer hover:bg-gray-50" onClick={() => window.open(`/admin/till/${t._id}`, '_blank', 'noopener')}>
                  <td className="px-2.5 py-2">
                    <span className="font-medium text-gray-900 whitespace-nowrap">{t.sessionNo}</span> <StatusBadge status={t.status} />
                    <span className="block text-xs text-gray-500">
                      {t.counterName || 'No counter'} · {t.cashierName}
                    </span>
                  </td>
                  <td className="px-2.5 py-2 text-xs text-gray-600">
                    {formatDate(t.openedAt, true)}
                    {t.closedAt && <span className="block">→ {formatTime(t.closedAt)}</span>}
                  </td>
                  <td className="px-2.5 py-2 text-right tabular-nums">{f.cash != null ? formatRs(f.cash) : '—'}</td>
                  <td className="px-2.5 py-2 text-right tabular-nums">{f.card != null ? formatRs(f.card) : '—'}</td>
                  <td className="px-2.5 py-2 text-right tabular-nums">{f.bank != null ? formatRs(f.bank) : '—'}</td>
                  <td className="px-2.5 py-2 text-right tabular-nums">{f.jazz != null ? formatRs(f.jazz) : '—'}</td>
                  <td className="px-2.5 py-2 text-right tabular-nums text-gray-700">{f.expenses ? `−${formatRs(f.expenses)}` : '—'}</td>
                  <td className="px-2.5 py-2 text-right tabular-nums">{formatRs(should)}</td>
                  <td className="px-2.5 py-2 text-right text-xs tabular-nums">
                    <Diff entered={given} system={should} />
                  </td>
                  <td className="px-2.5 py-2 text-right text-xs tabular-nums">
                    {f.drawer != null && <span className="block text-gray-500">{formatRs(f.drawer)} left · float {formatRs(f.float)}</span>}
                    <Diff entered={f.drawer} system={f.float} />
                  </td>
                  <td className="px-2.5 py-2 text-right text-xs tabular-nums">
                    <Diff entered={given == null ? null : r2(given + (f.drawer ?? f.float))} system={r2(should + f.float)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t-2 border-gray-300 bg-gray-50 font-bold">
            <tr>
              <td className="px-2.5 py-2 text-gray-900" colSpan={2}>
                All counters
                <span className="block text-[11px] font-normal text-gray-500">
                  {tills.length} till{tills.length === 1 ? '' : 's'} added up
                </span>
              </td>
              <td className="px-2.5 py-2 text-right tabular-nums">{anyGiven('cash') ? formatRs(add('cash')) : '—'}</td>
              <td className="px-2.5 py-2 text-right tabular-nums">{anyGiven('card') ? formatRs(add('card')) : '—'}</td>
              <td className="px-2.5 py-2 text-right tabular-nums">{anyGiven('bank') ? formatRs(add('bank')) : '—'}</td>
              <td className="px-2.5 py-2 text-right tabular-nums">{anyGiven('jazz') ? formatRs(add('jazz')) : '—'}</td>
              <td className="px-2.5 py-2 text-right tabular-nums text-gray-700">{expensesAmt ? `−${formatRs(expensesAmt)}` : '—'}</td>
              <td className="px-2.5 py-2 text-right tabular-nums">{money(foot.should)}</td>
              <td className="px-2.5 py-2 text-right text-xs tabular-nums">
                <Diff entered={foot.salesDiff} system={foot.salesDiff == null ? null : 0} />
              </td>
              <td className="px-2.5 py-2 text-right text-xs tabular-nums">
                {foot.changeDiff != null && (
                  <span className="block font-normal text-gray-500">
                    {formatRs(foot.left)} left · float {formatRs(foot.leftFloat)}
                  </span>
                )}
                <Diff entered={foot.changeDiff} system={foot.changeDiff == null ? null : 0} />
              </td>
              <td className="px-2.5 py-2 text-right text-xs tabular-nums">
                <Diff entered={foot.totalDiff} system={foot.totalDiff == null ? null : 0} />
              </td>
            </tr>
          </tfoot>
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
                  <td className="py-1.5 pr-2 text-gray-700">
                    {r.label}
                    {r.label === 'POS machine (card)' && settlement && (
                      <span className="block text-[10px] text-gray-400">
                        machine settlement{settlement.byName ? ` · by ${settlement.byName}` : ''} · cashiers said{' '}
                        {anyGiven('card') ? formatRs(add('card')) : '—'}
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {r.label === 'POS machine (card)' && editCard ? (
                      <span className="inline-flex items-center gap-1">
                        <input
                          autoFocus
                          inputMode="decimal"
                          value={cardDraft}
                          onChange={(e) => setCardDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveSettlement();
                            if (e.key === 'Escape') setEditCard(false);
                          }}
                          placeholder="Machine total"
                          className="w-28 rounded-md border border-gray-300 px-2 py-1 text-right text-sm focus:border-honey-500 focus:outline-none"
                        />
                        <button type="button" onClick={saveSettlement} disabled={cardSaving} title="Save" className="rounded p-1 text-green-700 hover:bg-green-50">
                          {cardSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        </button>
                        <button type="button" onClick={() => setEditCard(false)} title="Cancel" className="rounded p-1 text-gray-500 hover:bg-gray-100">
                          <X className="h-4 w-4" />
                        </button>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        {r.entered != null ? formatRs(r.entered) : '—'}
                        {r.label === 'POS machine (card)' && canEdit && (
                          <button
                            type="button"
                            title="Enter the POS machine settlement (leave empty to use what the cashiers entered)"
                            onClick={() => {
                              setCardDraft(settlement ? String(settlement.amount) : '');
                              setEditCard(true);
                            }}
                            className="rounded p-1 text-gray-400 hover:bg-honey-50 hover:text-honey-800"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </span>
                    )}
                  </td>
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
