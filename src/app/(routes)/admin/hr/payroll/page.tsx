'use client';

// Payroll months: one run per month (draft → approved → paid) and the button
// to run payroll for last month (or any earlier month).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { AlertTriangle, Banknote, ChevronRight, Loader2, Play, WalletCards } from 'lucide-react';
import { LoadingCard, NoAccessCard, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import TablePagination from '@/components/admin/TablePagination';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage, formatRs } from '@/lib/storeApi';
import { payrollApi, recentMonths, type PayrollRunSummary, type RunListMeta } from './_shared/payrollApi';
import { ErrorCard, PageHeader, StatusChip, cardClass, tdClass, thClass } from './_shared/PayrollBits';

export default function PayrollMonthsPage() {
  const router = useRouter();
  const { can } = useAccess();
  const canView = can('payroll', 'view');
  const canCreate = can('payroll', 'create');

  const [rows, setRows] = useState<PayrollRunSummary[]>([]);
  const [meta, setMeta] = useState<RunListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState('');
  const [running, setRunning] = useState(false);
  const lock = useRef(false);
  const months = recentMonths(13);

  const load = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    setError(null);
    try {
      const res = await payrollApi.runs({ page, limit: 24 });
      setRows(res.data || []);
      const m = (res.meta || null) as RunListMeta | null;
      setMeta(m);
      setMonth((cur) => cur || m?.suggestedMonth || '');
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load payroll.'));
    } finally {
      setLoading(false);
    }
  }, [canView, page]);

  useEffect(() => {
    load();
  }, [load]);

  const existing = rows.find((r) => r.month === month);
  const chosenLabel = months.find((m) => m.key === month)?.label || month;

  const run = async () => {
    if (lock.current || !month) return;
    if (existing) {
      router.push(`/admin/hr/payroll/${existing._id}`);
      return;
    }
    lock.current = true;
    setRunning(true);
    try {
      const res = await payrollApi.generate(month);
      toast.success(res.message || 'Draft payroll ready');
      router.push(`/admin/hr/payroll/${res.data._id}`);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not run payroll.'));
      load();
    } finally {
      lock.current = false;
      setRunning(false);
    }
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
          title="Payroll"
          subtitle="Salaries from attendance, overtime, advances and deductions — one payroll per month."
          actions={
            <Link href="/admin/hr/advances" className={secondaryBtn}>
              <WalletCards className="h-4 w-4" /> Advances &amp; deductions
            </Link>
          }
        />

        {canCreate && (
          <div className={`${cardClass} p-4 mb-5 flex flex-col sm:flex-row sm:items-center gap-3`}>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="h-10 w-10 rounded-lg bg-honey-500 text-gray-900 flex items-center justify-center flex-shrink-0">
                <Banknote className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">Run payroll for {chosenLabel || 'a month'}</p>
                <p className="text-xs text-gray-500">
                  {existing
                    ? `${chosenLabel} already has a payroll (${existing.status}). Open it to review.`
                    : 'Makes a draft from attendance. Nothing is final until you approve it.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-2.5 py-2 bg-white"
                aria-label="Month"
              >
                {months.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                    {m.key === meta?.currentMonth ? ' (this month)' : ''}
                  </option>
                ))}
              </select>
              <button type="button" onClick={run} disabled={running || !month} aria-busy={running} className={primaryBtn}>
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : existing ? <ChevronRight className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {existing ? 'Open' : 'Run payroll'}
              </button>
            </div>
          </div>
        )}

        {loading && !rows.length ? (
          <LoadingCard text="Loading payroll…" />
        ) : error ? (
          <ErrorCard message={error} onRetry={load} />
        ) : !rows.length ? (
          <div className={`${cardClass} text-center py-14 px-4`}>
            <Banknote className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-medium text-gray-900 mb-1">No payroll yet</h3>
            <p className="text-sm text-gray-500">
              {canCreate ? `Pick a month above and press “Run payroll” to make the first draft.` : 'Nobody has run payroll yet.'}
            </p>
          </div>
        ) : (
          <div className={`${cardClass} overflow-hidden ${loading ? 'opacity-60' : ''}`}>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className={thClass}>Month</th>
                    <th className={thClass}>Status</th>
                    <th className={`${thClass} text-right`}>Staff</th>
                    <th className={`${thClass} text-right`}>Gross</th>
                    <th className={`${thClass} text-right`}>Deductions</th>
                    <th className={`${thClass} text-right`}>Net pay</th>
                    <th className={`${thClass} text-right`}>Paid</th>
                    <th className={thClass} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((r) => (
                    <tr key={r._id} className="hover:bg-honey-50/40 cursor-pointer" onClick={() => router.push(`/admin/hr/payroll/${r._id}`)}>
                      <td className={tdClass}>
                        <Link href={`/admin/hr/payroll/${r._id}`} className="font-semibold text-gray-900 hover:text-honey-700" onClick={(e) => e.stopPropagation()}>
                          {r.monthLabel}
                        </Link>
                        <span className="block text-[11px] text-gray-500">{r.runNo}</span>
                      </td>
                      <td className={tdClass}>
                        <div className="flex items-center gap-1.5">
                          <StatusChip status={r.status} />
                          {r.status === 'draft' && r.warningCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-amber-700" title="Things to check">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              {r.warningCount}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={`${tdClass} text-right tabular-nums`}>{r.totals.staff}</td>
                      <td className={`${tdClass} text-right tabular-nums`}>{formatRs(r.totals.gross)}</td>
                      <td className={`${tdClass} text-right tabular-nums text-red-700`}>{formatRs(r.totals.deductions)}</td>
                      <td className={`${tdClass} text-right tabular-nums font-semibold text-gray-900`}>{formatRs(r.totals.net)}</td>
                      <td className={`${tdClass} text-right tabular-nums`}>
                        {r.status === 'draft' ? '—' : `${formatRs(r.totals.paid)}`}
                        {r.status !== 'draft' && <span className="block text-[11px] text-gray-500">{r.totals.paidCount} of {r.totals.staff} staff</span>}
                      </td>
                      <td className={`${tdClass} text-right`}>
                        <ChevronRight className="h-4 w-4 text-gray-400 inline" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {rows.map((r) => (
                <Link key={r._id} href={`/admin/hr/payroll/${r._id}`} className="block px-4 py-3 active:bg-honey-50">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{r.monthLabel}</p>
                      <p className="text-[11px] text-gray-500">
                        {r.runNo} · {r.totals.staff} staff
                      </p>
                    </div>
                    <StatusChip status={r.status} />
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-gray-500">Gross</p>
                      <p className="font-medium tabular-nums">{formatRs(r.totals.gross)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Deductions</p>
                      <p className="font-medium tabular-nums text-red-700">{formatRs(r.totals.deductions)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Net</p>
                      <p className="font-semibold tabular-nums">{formatRs(r.totals.net)}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            {meta && meta.pages > 1 && (
              <div className="border-t border-gray-100">
                <TablePagination page={meta.page} pages={meta.pages} total={meta.total} limit={meta.limit} onPageChange={setPage} label="months" loading={loading} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
