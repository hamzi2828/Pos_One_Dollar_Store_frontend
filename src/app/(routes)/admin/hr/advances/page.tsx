'use client';

// Salary advances (given, recovered by payroll), deductions (till shortages
// from cash closing, damage, other) and staff tips (gift money, saved as an
// expense in "Staff Tips", never cut from salary). Each tab is grouped by day
// with the day's total, and has a date filter and a day-by-day totals card.
import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Banknote, CheckCircle2, Gift, HandCoins, MinusCircle, Search, Trash2, WalletCards, XCircle } from 'lucide-react';
import { LoadingCard, NoAccessCard, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import TablePagination from '@/components/admin/TablePagination';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage, formatDate, formatRs, type PageMeta } from '@/lib/storeApi';
import { METHOD_LABEL, payrollApi, type DayTotal, type DeductionSummary, type PayrollDeduction, type SalaryAdvance, type StaffTip, type TipListMeta } from '../payroll/_shared/payrollApi';
import { ErrorCard, PageHeader, StatTile, StatusChip, cardClass, tdClass, thClass } from '../payroll/_shared/PayrollBits';
import { AddDeductionModal, ApproveDeductionModal, CancelAdvanceModal, GiveAdvanceModal, WaiveDeductionModal } from './components/AdvanceModals';
import { DailyTotalsCard, DayBand, RangeFilter, dayTotalOf, groupByDay, makeRange, rangeParams, rangeText, type DayRange } from './components/DayBreakdown';
import { DeleteTipModal, GiveTipModal, TIPS_CATEGORY } from './components/TipModals';
import { SearchSelect } from '@/components/ui/SearchSelect';

type Tab = 'advances' | 'deductions' | 'tips';
const TABS: Tab[] = ['advances', 'deductions', 'tips'];
const ADV_STATUS = [
  ['open', 'Open'],
  ['recovered', 'Recovered'],
  ['cancelled', 'Cancelled'],
  ['all', 'All'],
] as const;
const DED_STATUS = [
  ['pending', 'Waiting approval'],
  ['approved', 'Approved (to cut)'],
  ['applied', 'Cut from pay'],
  ['waived', 'Waived'],
  ['all', 'All'],
] as const;
const DED_TYPE = [
  ['all', 'All types'],
  ['till_shortage', 'Till shortage'],
  ['damage', 'Damage'],
  ['other', 'Other'],
] as const;

function Filter<T extends string>({ value, options, onChange, label }: { value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void; label: string }) {
  return (
    <SearchSelect value={value} onChange={(e) => onChange(e.target.value as T)} className="text-sm border border-gray-300 rounded-lg px-2.5 py-2 bg-white" aria-label={label}>
      {options.map(([k, l]) => (
        <option key={k} value={k}>
          {l}
        </option>
      ))}
    </SearchSelect>
  );
}

/** "12 advances · total Rs 5,000 · all dates" above a list. */
function ListedLine({ count, amount, range, word }: { count: number; amount: number; range: DayRange; word: string }) {
  return (
    <p className="text-xs text-gray-600 mb-2">
      <b className="text-gray-900">{count}</b> {word}
      {count === 1 ? '' : 's'} · total <b className="text-gray-900 tabular-nums">{formatRs(amount)}</b> · {rangeText(range)}
    </p>
  );
}

/** Day band as a full-width table row. */
const DayRow = ({ total, cols, tone }: { total: DayTotal; cols: number; tone?: 'gray' | 'red' | 'green' }) => (
  <tr>
    <td colSpan={cols} className="p-0">
      <DayBand total={total} tone={tone} />
    </td>
  </tr>
);

/* ------------------------------ Advances ------------------------------ */

function AdvancesTab({ canCreate, canEdit, reloadKey }: { canCreate: boolean; canEdit: boolean; reloadKey: number }) {
  const [status, setStatus] = useState<(typeof ADV_STATUS)[number][0]>('open');
  const [range, setRange] = useState<DayRange>(() => makeRange('all'));
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<SalaryAdvance[]>([]);
  const [meta, setMeta] = useState<(PageMeta & { summary?: { openCount: number; openBalance: number; listed?: { count: number; amount: number } }; byDay?: DayTotal[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<SalaryAdvance | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await payrollApi.advances({ status, search: q, page, limit: 25, ...rangeParams(range) });
      setRows(res.data || []);
      setMeta((res.meta || null) as typeof meta);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load advances.'));
    } finally {
      setLoading(false);
    }
  }, [status, q, page, range]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const summary = meta?.summary;
  const groups = groupByDay(rows, (a) => a.date);
  const totalOf = (day: string, list: SalaryAdvance[]) => dayTotalOf(meta?.byDay, day, list, (a) => a.amount);
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        <StatTile label="Open advances" value={String(summary?.openCount ?? '—')} />
        <StatTile label="Still to recover" value={summary ? formatRs(summary.openBalance) : '—'} tone="accent" hint="Taken back by payroll each month" />
        <StatTile
          label="Given (this list)"
          value={summary?.listed ? formatRs(summary.listed.amount) : '—'}
          hint={summary?.listed ? `${summary.listed.count} advance(s) · ${rangeText(range)}` : undefined}
        />
      </div>
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or advance no." className={`${inputClass} pl-9`} />
        </div>
        <Filter
          value={status}
          options={ADV_STATUS}
          label="Status"
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        />
        <RangeFilter
          value={range}
          onChange={(r) => {
            setRange(r);
            setPage(1);
          }}
        />
      </div>

      {loading && !rows.length ? (
        <LoadingCard text="Loading advances…" />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : !rows.length ? (
        <div className={`${cardClass} text-center py-12 px-4`}>
          <HandCoins className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">
            {status === 'open' ? 'No open advances.' : 'Nothing here.'} {canCreate && status === 'open' && 'Use “Give advance” to add one.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_18rem] gap-4 items-start">
          <div className="min-w-0">
            {summary?.listed && <ListedLine count={summary.listed.count} amount={summary.listed.amount} range={range} word="advance" />}
            <div className={`${cardClass} overflow-hidden ${loading ? 'opacity-60' : ''}`}>
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className={thClass}>Advance</th>
                      <th className={thClass}>Employee</th>
                      <th className={`${thClass} text-right`}>Amount</th>
                      <th className={thClass}>Plan</th>
                      <th className={`${thClass} text-right`}>Recovered</th>
                      <th className={`${thClass} text-right`}>Balance</th>
                      <th className={thClass}>Status</th>
                      <th className={thClass} />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {groups.map((g) => (
                      <React.Fragment key={g.day}>
                        <DayRow total={totalOf(g.day, g.rows)} cols={8} />
                        {g.rows.map((a) => (
                          <tr key={a._id}>
                            <td className={tdClass}>
                              <span className="font-medium text-gray-900">{a.advanceNo}</span>
                              <span className="block text-[11px] text-gray-500">
                                {formatDate(a.date)} · {METHOD_LABEL[a.method] || a.method}
                                {a.reference && ` · ${a.reference}`}
                              </span>
                            </td>
                            <td className={tdClass}>
                              {a.employeeName}
                              {a.note && <span className="block text-[11px] text-gray-500 max-w-[16rem] truncate">{a.note}</span>}
                            </td>
                            <td className={`${tdClass} text-right tabular-nums`}>{formatRs(a.amount)}</td>
                            <td className={tdClass}>
                              {a.installments} month{a.installments === 1 ? '' : 's'}
                              {a.status === 'open' && (
                                <span className="block text-[11px] text-gray-500">
                                  next {formatRs(a.perMonth)} ({a.remainingInstallments} left)
                                </span>
                              )}
                            </td>
                            <td className={`${tdClass} text-right tabular-nums`}>
                              {formatRs(a.recovered)}
                              {a.recoveries.length > 0 && <span className="block text-[11px] text-gray-500">{a.recoveries.map((r) => r.month).join(', ')}</span>}
                            </td>
                            <td className={`${tdClass} text-right tabular-nums font-semibold text-gray-900`}>{formatRs(a.balance)}</td>
                            <td className={tdClass}>
                              <StatusChip status={a.status} />
                            </td>
                            <td className={`${tdClass} text-right`}>
                              {canEdit && a.status === 'open' && a.recovered === 0 && (
                                <button type="button" onClick={() => setCancelling(a)} className="text-xs font-semibold text-gray-500 hover:text-red-600">
                                  Cancel
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="md:hidden">
                {groups.map((g) => (
                  <div key={g.day}>
                    <DayBand total={totalOf(g.day, g.rows)} />
                    <div className="divide-y divide-gray-100">
                      {g.rows.map((a) => (
                        <div key={a._id} className="px-4 py-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-gray-900">{a.employeeName}</p>
                            <StatusChip status={a.status} />
                          </div>
                          <p className="text-[11px] text-gray-500">
                            {a.advanceNo} · {formatDate(a.date)} · {formatRs(a.amount)} in {a.installments}
                          </p>
                          <div className="flex items-center justify-between mt-1 text-xs">
                            <span>
                              Balance <b className="tabular-nums">{formatRs(a.balance)}</b>
                              {a.status === 'open' && <span className="text-gray-500"> · next {formatRs(a.perMonth)}</span>}
                            </span>
                            {canEdit && a.status === 'open' && a.recovered === 0 && (
                              <button type="button" onClick={() => setCancelling(a)} className="font-semibold text-gray-500">
                                Cancel
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {meta && meta.pages > 1 && (
                <div className="border-t border-gray-100">
                  <TablePagination page={meta.page} pages={meta.pages} total={meta.total} limit={meta.limit} onPageChange={setPage} label="advances" loading={loading} />
                </div>
              )}
            </div>
          </div>
          <DailyTotalsCard byDay={meta?.byDay} title="Advances given, day by day" />
        </div>
      )}
      {cancelling && (
        <CancelAdvanceModal
          advance={cancelling}
          onClose={() => setCancelling(null)}
          onDone={() => {
            setCancelling(null);
            load();
          }}
        />
      )}
    </>
  );
}

/* ------------------------------ Deductions ------------------------------ */

function DeductionsTab({ canEdit, reloadKey, initialStatus }: { canEdit: boolean; reloadKey: number; initialStatus: string }) {
  const initial = (DED_STATUS.find(([k]) => k === initialStatus)?.[0] || 'pending') as (typeof DED_STATUS)[number][0];
  const [status, setStatus] = useState(initial);
  const [type, setType] = useState<(typeof DED_TYPE)[number][0]>('all');
  const [range, setRange] = useState<DayRange>(() => makeRange('all'));
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<PayrollDeduction[]>([]);
  const [meta, setMeta] = useState<(PageMeta & { summary?: DeductionSummary; byDay?: DayTotal[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState<PayrollDeduction | null>(null);
  const [waiving, setWaiving] = useState<PayrollDeduction | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await payrollApi.deductions({ status, type, page, limit: 25, ...rangeParams(range) });
      setRows(res.data || []);
      setMeta((res.meta || null) as typeof meta);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load deductions.'));
    } finally {
      setLoading(false);
    }
  }, [status, type, page, range]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const s = meta?.summary;
  const groups = groupByDay(rows, (d) => d.date);
  const done = () => {
    setApproving(null);
    setWaiving(null);
    load();
  };

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatTile label="Waiting approval" value={s ? formatRs(s.pending.amount) : '—'} hint={s ? `${s.pending.count} item(s)` : undefined} tone={s && s.pending.count ? 'warn' : undefined} />
        <StatTile label="Approved, to cut" value={s ? formatRs(s.approved.amount) : '—'} hint={s ? `${s.approved.count} item(s)` : undefined} />
        <StatTile label="Cut from pay" value={s ? formatRs(s.applied.amount) : '—'} hint={s ? `${s.applied.count} item(s)` : undefined} tone="good" />
        <StatTile label="Waived" value={s ? formatRs(s.waived.amount) : '—'} hint={s ? `${s.waived.count} item(s)` : undefined} />
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        <Filter
          value={status}
          options={DED_STATUS}
          label="Status"
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        />
        <Filter
          value={type}
          options={DED_TYPE}
          label="Type"
          onChange={(v) => {
            setType(v);
            setPage(1);
          }}
        />
        <RangeFilter
          value={range}
          onChange={(r) => {
            setRange(r);
            setPage(1);
          }}
        />
      </div>

      {loading && !rows.length ? (
        <LoadingCard text="Loading deductions…" />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : !rows.length ? (
        <div className={`${cardClass} text-center py-12 px-4`}>
          <MinusCircle className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">{status === 'pending' ? 'Nothing is waiting for approval.' : 'Nothing here.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_18rem] gap-4 items-start">
          <div className="min-w-0">
            {s?.listed && <ListedLine count={s.listed.count} amount={s.listed.amount} range={range} word="deduction" />}
            <div className={`${cardClass} overflow-hidden ${loading ? 'opacity-60' : ''}`}>
              <ul>
                {groups.map((g) => (
                  <li key={g.day}>
                    <DayBand total={dayTotalOf(meta?.byDay, g.day, g.rows, (d) => d.amount)} tone="red" />
                    <ul className="divide-y divide-gray-100">
                      {g.rows.map((d) => (
                        <li key={d._id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-gray-900">{d.employeeName}</span>
                              <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${d.type === 'till_shortage' ? 'bg-gray-900 text-honey-400' : 'bg-gray-100 text-gray-700'}`}>
                                {d.typeLabel}
                              </span>
                              <StatusChip status={d.status} />
                            </div>
                            <p className="text-xs text-gray-600 mt-0.5">
                              {formatDate(d.date)}
                              {d.refNo && (
                                <>
                                  {' · '}
                                  {d.link ? (
                                    <Link href={d.link} className="font-medium text-honey-700 hover:text-honey-900">
                                      {d.refNo}
                                    </Link>
                                  ) : (
                                    d.refNo
                                  )}
                                </>
                              )}
                              {d.appliedMonth && ` · cut in ${d.appliedMonth}`}
                            </p>
                            {d.note && <p className="text-xs text-gray-500 mt-0.5 break-words">{d.note}</p>}
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-3">
                            <span className="text-base font-semibold tabular-nums text-red-700">{formatRs(d.amount)}</span>
                            {canEdit && (d.status === 'pending' || d.status === 'approved') && (
                              <div className="flex items-center gap-1.5">
                                {d.status === 'pending' && (
                                  <button
                                    type="button"
                                    onClick={() => setApproving(d)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-gray-900 bg-honey-500 rounded-lg hover:bg-honey-600"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setWaiving(d)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                                >
                                  <XCircle className="h-3.5 w-3.5" /> Waive
                                </button>
                              </div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
              {meta && meta.pages > 1 && (
                <div className="border-t border-gray-100">
                  <TablePagination page={meta.page} pages={meta.pages} total={meta.total} limit={meta.limit} onPageChange={setPage} label="deductions" loading={loading} />
                </div>
              )}
            </div>
          </div>
          <DailyTotalsCard byDay={meta?.byDay} title="Deductions, day by day" tone="red" />
        </div>
      )}
      {approving && <ApproveDeductionModal deduction={approving} onClose={() => setApproving(null)} onDone={done} />}
      {waiving && <WaiveDeductionModal deduction={waiving} onClose={() => setWaiving(null)} onDone={done} />}
    </>
  );
}

/* ------------------------------ Tips ------------------------------ */

function TipsTab({ canCreate, canDelete, reloadKey, onGive }: { canCreate: boolean; canDelete: boolean; reloadKey: number; onGive: () => void }) {
  const [range, setRange] = useState<DayRange>(() => makeRange('this_month'));
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<StaffTip[]>([]);
  const [meta, setMeta] = useState<TipListMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<StaffTip | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await payrollApi.tips({ search: q, page, limit: 50, ...rangeParams(range) });
      setRows(res.data || []);
      setMeta((res.meta || null) as TipListMeta | null);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load tips.'));
    } finally {
      setLoading(false);
    }
  }, [q, page, range]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const s = meta?.summary;
  const groups = groupByDay(rows, (t) => t.date);
  const totalOf = (day: string, list: StaffTip[]) => dayTotalOf(meta?.byDay, day, list, (t) => t.amount);
  const cols = canDelete ? 6 : 5;

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        <StatTile label="Tips total" value={s ? formatRs(s.amount) : '—'} tone="accent" hint={rangeText(range)} />
        <StatTile label="Tips given" value={s ? String(s.count) : '—'} hint={s ? `to ${s.employees} employee(s)` : undefined} />
        <StatTile label="Goes to expenses" value={TIPS_CATEGORY} hint="Added by itself. Not cut from salary." />
      </div>
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, tip no. or note" className={`${inputClass} pl-9`} />
        </div>
        <RangeFilter
          value={range}
          onChange={(r) => {
            setRange(r);
            setPage(1);
          }}
        />
      </div>

      {loading && !rows.length ? (
        <LoadingCard text="Loading tips…" />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : !rows.length ? (
        <div className={`${cardClass} text-center py-12 px-4`}>
          <Gift className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No tips for {rangeText(range)}.</p>
          {canCreate && (
            <button type="button" onClick={onGive} className={`${primaryBtn} mt-3`}>
              <Gift className="h-4 w-4" /> Give tip
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_18rem] gap-4 items-start">
          <div className="min-w-0">
            {s && <ListedLine count={s.count} amount={s.amount} range={range} word="tip" />}
            <div className={`${cardClass} overflow-hidden ${loading ? 'opacity-60' : ''}`}>
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className={thClass}>Tip</th>
                      <th className={thClass}>Employee</th>
                      <th className={thClass}>Given by</th>
                      <th className={thClass}>Note</th>
                      <th className={`${thClass} text-right`}>Amount</th>
                      {canDelete && <th className={thClass} />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {groups.map((g) => (
                      <React.Fragment key={g.day}>
                        <DayRow total={totalOf(g.day, g.rows)} cols={cols} tone="green" />
                        {g.rows.map((t) => (
                          <tr key={t._id}>
                            <td className={tdClass}>
                              <span className="font-medium text-gray-900">{t.tipNo}</span>
                              <span className="block text-[11px] text-gray-500">{formatDate(t.date)}</span>
                            </td>
                            <td className={tdClass}>
                              {t.employeeName}
                              {t.employeeCode && <span className="block text-[11px] text-gray-500">{t.employeeCode}</span>}
                            </td>
                            <td className={tdClass}>{t.methodLabel || (t.method === 'salary' ? 'Added to salary' : METHOD_LABEL[t.method]) || t.method}</td>
                            <td className={`${tdClass} whitespace-normal max-w-[18rem] text-gray-600`}>{t.note || '—'}</td>
                            <td className={`${tdClass} text-right tabular-nums font-semibold text-gray-900`}>{formatRs(t.amount)}</td>
                            {canDelete && (
                              <td className={`${tdClass} text-right`}>
                                <button type="button" onClick={() => setDeleting(t)} className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50" aria-label={`Delete ${t.tipNo}`}>
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="md:hidden">
                {groups.map((g) => (
                  <div key={g.day}>
                    <DayBand total={totalOf(g.day, g.rows)} tone="green" />
                    <div className="divide-y divide-gray-100">
                      {g.rows.map((t) => (
                        <div key={t._id} className="px-4 py-3 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900">{t.employeeName}</p>
                            <p className="text-[11px] text-gray-500">
                              {t.tipNo} · {t.methodLabel || (t.method === 'salary' ? 'Added to salary' : METHOD_LABEL[t.method])}
                            </p>
                            {t.note && <p className="text-xs text-gray-600 mt-0.5 break-words">{t.note}</p>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-sm font-semibold tabular-nums text-gray-900">{formatRs(t.amount)}</span>
                            {canDelete && (
                              <button type="button" onClick={() => setDeleting(t)} className="p-1 rounded text-gray-400 hover:text-red-600" aria-label={`Delete ${t.tipNo}`}>
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {meta && meta.pages > 1 && (
                <div className="border-t border-gray-100">
                  <TablePagination page={meta.page} pages={meta.pages} total={meta.total} limit={meta.limit} onPageChange={setPage} label="tips" loading={loading} />
                </div>
              )}
            </div>
          </div>
          <div className="space-y-4">
            <DailyTotalsCard byDay={meta?.byDay} title="Tips, day by day" tone="green" />
            {meta && meta.byEmployee.length > 0 && (
              <div className={`${cardClass} overflow-hidden`}>
                <div className="px-4 py-2.5 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900">Tips per employee</h3>
                </div>
                <ul className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
                  {meta.byEmployee.map((b) => (
                    <li key={b.employee} className="px-4 py-1.5 flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate text-gray-700">
                        {b.name} <span className="text-xs text-gray-500">× {b.count}</span>
                      </span>
                      <span className="tabular-nums font-medium text-emerald-700">{formatRs(b.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
      {deleting && (
        <DeleteTipModal
          tip={deleting}
          onClose={() => setDeleting(null)}
          onDone={() => {
            setDeleting(null);
            load();
          }}
        />
      )}
    </>
  );
}

/* ------------------------------ Page ------------------------------ */

function AdvancesPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { can } = useAccess();
  const canView = can('payroll', 'view');
  const canCreate = can('payroll', 'create');
  const canEdit = can('payroll', 'edit');
  const canDelete = can('payroll', 'delete');
  const [tab, setTab] = useState<Tab>(() => TABS.find((t) => t === params.get('tab')) || 'advances');
  const [modal, setModal] = useState<null | 'advance' | 'deduction' | 'tip'>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const switchTab = (t: Tab) => {
    setTab(t);
    router.replace(t === 'advances' ? pathname : `${pathname}?tab=${t}`, { scroll: false });
  };
  const done = () => {
    setModal(null);
    setReloadKey((k) => k + 1);
  };

  if (!canView) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <NoAccessCard />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <PageHeader
          title="Advances, deductions & tips"
          subtitle="Advances and deductions are taken from salary by payroll. Tips are a gift: they go to expenses, not cut from salary."
          actions={
            <>
              <Link href="/admin/hr/payroll" className={secondaryBtn}>
                <Banknote className="h-4 w-4" /> Payroll
              </Link>
              {canCreate &&
                (tab === 'advances' ? (
                  <button type="button" onClick={() => setModal('advance')} className={primaryBtn}>
                    <HandCoins className="h-4 w-4" /> Give advance
                  </button>
                ) : tab === 'deductions' ? (
                  <button type="button" onClick={() => setModal('deduction')} className={primaryBtn}>
                    <MinusCircle className="h-4 w-4" /> Add deduction
                  </button>
                ) : (
                  <button type="button" onClick={() => setModal('tip')} className={primaryBtn}>
                    <Gift className="h-4 w-4" /> Give tip
                  </button>
                ))}
            </>
          }
        />

        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 text-sm mb-4" role="tablist">
          {(
            [
              ['advances', 'Advances', <WalletCards key="a" className="h-4 w-4" />],
              ['deductions', 'Deductions', <MinusCircle key="d" className="h-4 w-4" />],
              ['tips', 'Tips', <Gift key="t" className="h-4 w-4" />],
            ] as [Tab, string, React.ReactNode][]
          ).map(([k, label, icon]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => switchTab(k)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium ${tab === k ? 'bg-honey-500 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {tab === 'advances' ? (
          <AdvancesTab canCreate={canCreate} canEdit={canEdit} reloadKey={reloadKey} />
        ) : tab === 'deductions' ? (
          <DeductionsTab canEdit={canEdit} reloadKey={reloadKey} initialStatus={params.get('status') || 'pending'} />
        ) : (
          <TipsTab canCreate={canCreate} canDelete={canDelete} reloadKey={reloadKey} onGive={() => setModal('tip')} />
        )}
      </div>

      {modal === 'advance' && <GiveAdvanceModal onClose={() => setModal(null)} onDone={done} />}
      {modal === 'deduction' && <AddDeductionModal canApprove={canEdit} onClose={() => setModal(null)} onDone={done} />}
      {modal === 'tip' && <GiveTipModal onClose={() => setModal(null)} onDone={done} />}
    </div>
  );
}

export default function AdvancesPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 py-8">
          <LoadingCard text="Loading…" />
        </div>
      }
    >
      <AdvancesPageInner />
    </Suspense>
  );
}
