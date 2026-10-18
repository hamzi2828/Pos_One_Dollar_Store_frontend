'use client';

// One month's payroll: things to fix, totals, the staff table (tap a row for
// the breakdown), and the workflow buttons (regenerate → approve → pay).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Download,
  Info,
  Loader2,
  RefreshCw,
  RotateCcw,
  Trash2,
  Wallet,
} from 'lucide-react';
import { LoadingCard, NoAccessCard, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage, formatDate, formatRs } from '@/lib/storeApi';
import { METHOD_LABEL, downloadRegister, payrollApi, type PayrollLine, type PayrollRun, type RunWarning } from '../_shared/payrollApi';
import { ErrorCard, PageHeader, StatTile, StatusChip, cardClass, minusRs, tdClass, thClass } from '../_shared/PayrollBits';
import LineDrawer from './components/LineDrawer';
import { ApproveModal, PayModal, ReopenModal } from './components/RunModals';

const WARNING_TITLE: Record<string, string> = {
  month_open: 'Month not over',
  overtime_pending: 'Overtime waiting for approval',
  missing_out: 'Missing check-outs',
  deduction_pending: 'Deductions waiting for approval',
  no_schedule: 'No schedule',
  no_salary: 'No pay set',
  shortfall: 'Deductions more than pay',
  carried: 'Moved to next month',
};

function Warnings({ warnings, draft }: { warnings: RunWarning[]; draft: boolean }) {
  const [open, setOpen] = useState(true);
  const groups = useMemo(() => {
    const m = new Map<string, RunWarning[]>();
    for (const w of warnings) m.set(w.type, [...(m.get(w.type) || []), w]);
    return [...m.entries()];
  }, [warnings]);
  if (!warnings.length) return null;
  const serious = warnings.filter((w) => w.level !== 'info').length;
  return (
    <div className={`mb-5 rounded-xl border ${serious ? 'border-amber-300 bg-amber-50' : 'border-blue-200 bg-blue-50'}`}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left">
        <span className={`flex items-center gap-2 text-sm font-semibold ${serious ? 'text-amber-900' : 'text-blue-900'}`}>
          {serious ? <AlertTriangle className="h-4 w-4" /> : <Info className="h-4 w-4" />}
          {serious ? `${serious} thing${serious === 1 ? '' : 's'} to check${draft ? ' before you approve' : ''}` : 'Notes on this payroll'}
        </span>
        <span className="text-xs text-gray-600">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && (
        <div className="px-4 pb-3 space-y-3">
          {groups.map(([type, list]) => (
            <div key={type}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-600 mb-1">{WARNING_TITLE[type] || type}</p>
              <ul className="space-y-1">
                {list.map((w, i) => (
                  <li key={`${type}-${i}`} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-sm text-gray-800 bg-white/70 rounded-lg px-3 py-1.5">
                    <span>{w.message}</span>
                    {w.link && (
                      <Link href={w.link} className="text-xs font-semibold text-honey-700 hover:text-honey-900 whitespace-nowrap">
                        {w.linkLabel || 'Open'} →
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {draft && serious > 0 && <p className="text-[11px] text-gray-600">After fixing, press Regenerate to update the numbers.</p>}
        </div>
      )}
    </div>
  );
}

export default function PayrollRunPage() {
  const { runId } = useParams<{ runId: string }>();
  const router = useRouter();
  const { can, isSuperAdmin } = useAccess();
  const canView = can('payroll', 'view');
  const canCreate = can('payroll', 'create');
  const canEdit = can('payroll', 'edit');
  const canDelete = can('payroll', 'delete');
  const canExport = can('payroll', 'export');

  const [run, setRun] = useState<PayrollRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openLine, setOpenLine] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<null | 'approve' | 'pay' | 'reopen'>(null);
  const [payLines, setPayLines] = useState<PayrollLine[]>([]);
  const [busy, setBusy] = useState<null | 'regenerate' | 'delete' | 'csv'>(null);
  const lock = useRef(false);

  const load = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    setError(null);
    try {
      const res = await payrollApi.run(runId);
      setRun(res.data);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load this payroll.'));
    } finally {
      setLoading(false);
    }
  }, [canView, runId]);

  useEffect(() => {
    load();
  }, [load]);

  const updated = (r: PayrollRun) => {
    setRun(r);
    setModal(null);
    setSelected((s) => new Set([...s].filter((id) => r.lines.some((l) => l._id === id && l.status !== 'paid'))));
  };

  const action = async (kind: 'regenerate' | 'delete' | 'csv') => {
    if (lock.current || !run) return;
    if (kind === 'delete' && !window.confirm(`Delete the ${run.monthLabel} draft? Bonuses and adjustments typed on it are lost.`)) return;
    lock.current = true;
    setBusy(kind);
    try {
      if (kind === 'regenerate') {
        const res = await payrollApi.regenerate(run._id);
        setRun(res.data);
        toast.success('Numbers updated from attendance (your bonuses and adjustments are kept)');
      } else if (kind === 'delete') {
        await payrollApi.remove(run._id);
        toast.success('Draft deleted');
        router.push('/admin/hr/payroll');
      } else {
        await downloadRegister(run._id, `payroll-${run.month}.csv`);
      }
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Something went wrong'));
    } finally {
      lock.current = false;
      setBusy(null);
    }
  };

  if (!canView) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <NoAccessCard />
      </div>
    );
  }
  if (loading && !run) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <LoadingCard text="Loading payroll…" />
      </div>
    );
  }
  if (error || !run) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <ErrorCard message={error || 'Payroll not found'} onRetry={load} />
      </div>
    );
  }

  const draft = run.status === 'draft';
  const unfinished = run.status === 'approved' && !run.effectsDone;
  const payable = !draft && !unfinished && !run.reopening;
  const unpaid = run.lines.filter((l) => l.status !== 'paid');
  const nothingPaid = run.lines.every((l) => l.status !== 'paid') && !run.payments.length;
  const line = openLine ? run.lines.find((l) => l._id === openLine) || null : null;
  const selectable = payable && canEdit;
  const selectedLines = unpaid.filter((l) => selected.has(l._id));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const openPay = (lines: PayrollLine[]) => {
    setPayLines(lines);
    setModal('pay');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <Link href="/admin/hr/payroll" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mb-2">
          <ArrowLeft className="h-3.5 w-3.5" /> All months
        </Link>
        <PageHeader
          title={`Payroll · ${run.monthLabel}`}
          subtitle={
            <span className="inline-flex flex-wrap items-center gap-2">
              <StatusChip status={run.status} />
              <span>{run.runNo}</span>
              <span>· made {formatDate(run.generatedAt, true)}</span>
              {run.approvedAt && <span>· approved {formatDate(run.approvedAt)}</span>}
            </span>
          }
          actions={
            <>
              {canExport && (
                <button type="button" onClick={() => action('csv')} disabled={!!busy} className={secondaryBtn}>
                  {busy === 'csv' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} CSV
                </button>
              )}
              {draft && canDelete && (
                <button type="button" onClick={() => action('delete')} disabled={!!busy} className={secondaryBtn} title="Delete draft">
                  {busy === 'delete' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  <span className="sr-only sm:not-sr-only">Delete</span>
                </button>
              )}
              {draft && canCreate && (
                <button type="button" onClick={() => action('regenerate')} disabled={!!busy} aria-busy={busy === 'regenerate'} className={secondaryBtn}>
                  {busy === 'regenerate' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Regenerate
                </button>
              )}
              {!draft && isSuperAdmin && nothingPaid && (
                <button type="button" onClick={() => setModal('reopen')} disabled={!!busy} className={secondaryBtn}>
                  <RotateCcw className="h-4 w-4" /> Reopen
                </button>
              )}
              {draft && canEdit && (
                <button type="button" onClick={() => setModal('approve')} disabled={!!busy || !run.lines.length} className={primaryBtn}>
                  <CheckCircle2 className="h-4 w-4" /> Approve
                </button>
              )}
              {payable && canEdit && unpaid.length > 0 && (
                <button type="button" onClick={() => openPay(unpaid)} disabled={!!busy} className={primaryBtn}>
                  <Wallet className="h-4 w-4" /> Pay all ({unpaid.length})
                </button>
              )}
            </>
          }
        />

        {unfinished && (
          <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-800">Approval did not finish (attendance lock, deductions or advances). Press the button to finish it.</p>
            {canEdit && (
              <button type="button" onClick={() => setModal('approve')} className={primaryBtn}>
                Finish approval
              </button>
            )}
          </div>
        )}

        <Warnings warnings={run.warnings} draft={draft} />

        {/* Totals */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
          <StatTile label="Staff" value={String(run.totals.staff)} hint={`${run.from} → ${run.to}`} />
          <StatTile label="Gross" value={formatRs(run.totals.gross)} hint={run.totals.overtime ? `incl. ${formatRs(run.totals.overtime)} overtime` : undefined} />
          <StatTile
            label="Deductions"
            value={formatRs(run.totals.deductions)}
            hint={run.totals.advanceRecovery ? `incl. ${formatRs(run.totals.advanceRecovery)} advances` : undefined}
          />
          <StatTile
            label="Net pay"
            value={formatRs(run.totals.net)}
            tone="accent"
            hint={
              run.totals.advanceRecovery
                ? `+ ${formatRs(run.totals.advanceRecovery)} advance recovered = ${formatRs(run.totals.net + run.totals.advanceRecovery)} salary cost`
                : undefined
            }
          />
          {draft ? (
            <StatTile label="Bonuses" value={formatRs(run.totals.bonus)} />
          ) : (
            <StatTile
              label={run.status === 'paid' ? 'Paid' : 'Still to pay'}
              value={formatRs(run.status === 'paid' ? run.totals.paid : run.totals.unpaid)}
              hint={`${run.totals.paidCount} of ${run.totals.staff} paid`}
              tone={run.status === 'paid' ? 'good' : 'warn'}
            />
          )}
        </div>

        {/* Selection bar */}
        {selectable && selectedLines.length > 0 && (
          <div className="sticky top-2 z-10 mb-3 flex items-center justify-between gap-2 rounded-xl border border-honey-300 bg-honey-50 px-4 py-2.5 shadow-sm">
            <p className="text-sm text-gray-900">
              <span className="font-semibold">{selectedLines.length} selected</span> · {formatRs(selectedLines.reduce((s, l) => s + l.net, 0))}
            </p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setSelected(new Set())} className="text-xs text-gray-600 hover:text-gray-900">
                Clear
              </button>
              <button type="button" onClick={() => openPay(selectedLines)} className={primaryBtn}>
                <Wallet className="h-4 w-4" /> Pay selected
              </button>
            </div>
          </div>
        )}

        {/* Staff */}
        {!run.lines.length ? (
          <div className={`${cardClass} text-center py-12 px-4`}>
            <p className="text-sm text-gray-500">Nobody was employed in {run.monthLabel}. Add staff under HR → Employees, then Regenerate.</p>
          </div>
        ) : (
          <div className={`${cardClass} overflow-hidden`}>
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    {selectable && (
                      <th className={`${thClass} w-8`}>
                        <input
                          type="checkbox"
                          aria-label="Select all unpaid"
                          checked={unpaid.length > 0 && selectedLines.length === unpaid.length}
                          onChange={(e) => setSelected(e.target.checked ? new Set(unpaid.map((l) => l._id)) : new Set())}
                          className="h-4 w-4 accent-honey-500"
                        />
                      </th>
                    )}
                    <th className={thClass}>Employee</th>
                    <th className={`${thClass} text-right`}>Days worked</th>
                    <th className={`${thClass} text-right`}>Absent</th>
                    <th className={`${thClass} text-right`}>Late</th>
                    <th className={`${thClass} text-right`}>Gross</th>
                    <th className={`${thClass} text-right`}>Deductions</th>
                    <th className={`${thClass} text-right`}>Net pay</th>
                    <th className={thClass}>Status</th>
                    <th className={thClass} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {run.lines.map((l) => {
                    const a = l.attendance;
                    return (
                      <tr key={l._id} className="hover:bg-honey-50/40 cursor-pointer" onClick={() => setOpenLine(l._id)}>
                        {selectable && (
                          <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                            {l.status !== 'paid' && (
                              <input
                                type="checkbox"
                                aria-label={`Select ${l.name}`}
                                checked={selected.has(l._id)}
                                onChange={() => toggle(l._id)}
                                className="h-4 w-4 accent-honey-500"
                              />
                            )}
                          </td>
                        )}
                        <td className={tdClass}>
                          <span className="font-medium text-gray-900">{l.name}</span>
                          <span className="block text-[11px] text-gray-500">
                            {[l.code, l.payType === 'daily' ? `${formatRs(l.dailyRate)}/day` : `${formatRs(l.salary)}/month`].filter(Boolean).join(' · ')}
                          </span>
                        </td>
                        <td className={`${tdClass} text-right tabular-nums`}>
                          {a.daysWorked}
                          <span className="block text-[11px] text-gray-500">of {a.scheduledDaysInMonth} shifts</span>
                        </td>
                        <td className={`${tdClass} text-right tabular-nums ${a.absentDays ? 'text-red-700' : ''}`}>
                          {a.absentDays}
                          {a.halfDays > 0 && <span className="block text-[11px] text-gray-500">+{a.halfDays} half</span>}
                        </td>
                        <td className={`${tdClass} text-right tabular-nums ${a.lateCount ? 'text-amber-700' : ''}`}>{a.lateCount}</td>
                        <td className={`${tdClass} text-right tabular-nums`}>{formatRs(l.gross)}</td>
                        <td className={`${tdClass} text-right tabular-nums text-red-700`}>{l.totalDeductions ? minusRs(l.totalDeductions) : '—'}</td>
                        <td className={`${tdClass} text-right tabular-nums font-semibold text-gray-900`}>{formatRs(l.net)}</td>
                        <td className={tdClass}>
                          <StatusChip status={l.status === 'paid' ? 'paid' : draft ? 'draft' : 'to_pay'} />
                        </td>
                        <td className={`${tdClass} text-right`}>
                          <ChevronRight className="h-4 w-4 text-gray-400 inline" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Mobile */}
            <div className="md:hidden divide-y divide-gray-100">
              {run.lines.map((l) => (
                <div key={l._id} className="flex items-stretch">
                  {selectable && (
                    <label className="flex items-center pl-3">
                      {l.status !== 'paid' && (
                        <input type="checkbox" aria-label={`Select ${l.name}`} checked={selected.has(l._id)} onChange={() => toggle(l._id)} className="h-5 w-5 accent-honey-500" />
                      )}
                    </label>
                  )}
                  <button type="button" onClick={() => setOpenLine(l._id)} className="flex-1 text-left px-4 py-3 active:bg-honey-50">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900 truncate">{l.name}</p>
                      <span className="text-sm font-bold tabular-nums">{formatRs(l.net)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <p className="text-[11px] text-gray-500">
                        {l.attendance.daysWorked} days · {l.attendance.absentDays} absent · {l.attendance.lateCount} late
                      </p>
                      <StatusChip status={l.status === 'paid' ? 'paid' : draft ? 'draft' : 'to_pay'} />
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Payments */}
        {run.payments.length > 0 && (
          <div className={`${cardClass} mt-5`}>
            <h2 className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-900">Payments</h2>
            <ul className="divide-y divide-gray-100">
              {run.payments.map((p) => (
                <li key={p._id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 px-4 py-2.5 text-sm">
                  <span className="text-gray-800">
                    #{p.no} · {formatDate(p.date)} · {METHOD_LABEL[p.method] || p.method}
                    {p.reference && <span className="text-gray-500"> · {p.reference}</span>}
                  </span>
                  <span className="text-gray-600 sm:text-right">
                    {p.count} staff · paid <span className="font-semibold text-gray-900 tabular-nums">{formatRs(p.amount)}</span>
                    {(p.advanceRecovered || 0) > 0 && (
                      <span className="block text-[11px] text-gray-500">
                        Expense {formatRs(p.expenseAmount ?? p.amount)} = net {formatRs(p.amount)} + advance recovered {formatRs(p.advanceRecovered)}
                      </span>
                    )}
                    {!p.expensePosted && <span className="ml-2 text-xs text-red-600">expense not posted yet</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {line && <LineDrawer run={run} line={line} canEdit={canEdit} onClose={() => setOpenLine(null)} onSaved={(r) => setRun(r)} />}
      {modal === 'approve' && <ApproveModal run={run} onClose={() => setModal(null)} onDone={updated} />}
      {modal === 'pay' && <PayModal run={run} lines={payLines} onClose={() => setModal(null)} onDone={updated} />}
      {modal === 'reopen' && <ReopenModal run={run} onClose={() => setModal(null)} onDone={updated} />}
    </div>
  );
}
