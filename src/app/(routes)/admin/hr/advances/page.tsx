'use client';

// Salary advances (given, recovered by payroll) and deductions (till shortages
// from cash closing, damage, other) waiting for approval or already cut.
import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Banknote, CheckCircle2, HandCoins, MinusCircle, Search, WalletCards, XCircle } from 'lucide-react';
import { LoadingCard, NoAccessCard, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import TablePagination from '@/components/admin/TablePagination';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage, formatDate, formatRs, type PageMeta } from '@/lib/storeApi';
import { METHOD_LABEL, payrollApi, type DeductionSummary, type PayrollDeduction, type SalaryAdvance } from '../payroll/_shared/payrollApi';
import { ErrorCard, PageHeader, StatTile, StatusChip, cardClass, tdClass, thClass } from '../payroll/_shared/PayrollBits';
import { AddDeductionModal, ApproveDeductionModal, CancelAdvanceModal, GiveAdvanceModal, WaiveDeductionModal } from './components/AdvanceModals';

type Tab = 'advances' | 'deductions';
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
    <select value={value} onChange={(e) => onChange(e.target.value as T)} className="text-sm border border-gray-300 rounded-lg px-2.5 py-2 bg-white" aria-label={label}>
      {options.map(([k, l]) => (
        <option key={k} value={k}>
          {l}
        </option>
      ))}
    </select>
  );
}

/* ------------------------------ Advances ------------------------------ */

function AdvancesTab({ canCreate, canEdit, reloadKey }: { canCreate: boolean; canEdit: boolean; reloadKey: number }) {
  const [status, setStatus] = useState<(typeof ADV_STATUS)[number][0]>('open');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<SalaryAdvance[]>([]);
  const [meta, setMeta] = useState<(PageMeta & { summary?: { openCount: number; openBalance: number } }) | null>(null);
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
      const res = await payrollApi.advances({ status, search: q, page, limit: 25 });
      setRows(res.data || []);
      setMeta((res.meta || null) as typeof meta);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load advances.'));
    } finally {
      setLoading(false);
    }
  }, [status, q, page]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const summary = meta?.summary;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatTile label="Open advances" value={String(summary?.openCount ?? '—')} />
        <StatTile label="Still to recover" value={summary ? formatRs(summary.openBalance) : '—'} tone="accent" hint="Taken back by payroll each month" />
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
      </div>

      {loading && !rows.length ? (
        <LoadingCard text="Loading advances…" />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : !rows.length ? (
        <div className={`${cardClass} text-center py-12 px-4`}>
          <HandCoins className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">{status === 'open' ? 'No open advances.' : 'Nothing here.'} {canCreate && status === 'open' && 'Use “Give advance” to add one.'}</p>
        </div>
      ) : (
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
                {rows.map((a) => (
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
                      {a.status === 'open' && <span className="block text-[11px] text-gray-500">next {formatRs(a.perMonth)} ({a.remainingInstallments} left)</span>}
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
              </tbody>
            </table>
          </div>
          <div className="md:hidden divide-y divide-gray-100">
            {rows.map((a) => (
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
          {meta && meta.pages > 1 && (
            <div className="border-t border-gray-100">
              <TablePagination page={meta.page} pages={meta.pages} total={meta.total} limit={meta.limit} onPageChange={setPage} label="advances" loading={loading} />
            </div>
          )}
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
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<PayrollDeduction[]>([]);
  const [meta, setMeta] = useState<(PageMeta & { summary?: DeductionSummary }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState<PayrollDeduction | null>(null);
  const [waiving, setWaiving] = useState<PayrollDeduction | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await payrollApi.deductions({ status, type, page, limit: 25 });
      setRows(res.data || []);
      setMeta((res.meta || null) as typeof meta);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load deductions.'));
    } finally {
      setLoading(false);
    }
  }, [status, type, page]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const s = meta?.summary;
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
        <div className={`${cardClass} overflow-hidden ${loading ? 'opacity-60' : ''}`}>
          <ul className="divide-y divide-gray-100">
            {rows.map((d) => (
              <li key={d._id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{d.employeeName}</span>
                    <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${d.type === 'till_shortage' ? 'bg-gray-900 text-honey-400' : 'bg-gray-100 text-gray-700'}`}>{d.typeLabel}</span>
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
                        <button type="button" onClick={() => setApproving(d)} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-gray-900 bg-honey-500 rounded-lg hover:bg-honey-600">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                        </button>
                      )}
                      <button type="button" onClick={() => setWaiving(d)} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                        <XCircle className="h-3.5 w-3.5" /> Waive
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {meta && meta.pages > 1 && (
            <div className="border-t border-gray-100">
              <TablePagination page={meta.page} pages={meta.pages} total={meta.total} limit={meta.limit} onPageChange={setPage} label="deductions" loading={loading} />
            </div>
          )}
        </div>
      )}
      {approving && <ApproveDeductionModal deduction={approving} onClose={() => setApproving(null)} onDone={done} />}
      {waiving && <WaiveDeductionModal deduction={waiving} onClose={() => setWaiving(null)} onDone={done} />}
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
  const [tab, setTab] = useState<Tab>(params.get('tab') === 'deductions' ? 'deductions' : 'advances');
  const [modal, setModal] = useState<null | 'advance' | 'deduction'>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const switchTab = (t: Tab) => {
    setTab(t);
    router.replace(t === 'deductions' ? `${pathname}?tab=deductions` : pathname, { scroll: false });
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
          title="Advances & deductions"
          subtitle="Money given before payday, and amounts to cut from salary. Payroll takes both into account."
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
                ) : (
                  <button type="button" onClick={() => setModal('deduction')} className={primaryBtn}>
                    <MinusCircle className="h-4 w-4" /> Add deduction
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
        ) : (
          <DeductionsTab canEdit={canEdit} reloadKey={reloadKey} initialStatus={params.get('status') || 'pending'} />
        )}
      </div>

      {modal === 'advance' && (
        <GiveAdvanceModal
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
      {modal === 'deduction' && (
        <AddDeductionModal
          canApprove={canEdit}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

export default function AdvancesPage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-8"><LoadingCard text="Loading…" /></div>}>
      <AdvancesPageInner />
    </Suspense>
  );
}
