'use client';

// Employee Portal — one payslip (my own line in that month's salary). Printable.
import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Printer } from 'lucide-react';
import { Wordmark } from '@/components/ui/wordmark';
import { primaryBtn } from '@/components/admin/FormBits';
import { apiErrorMessage, formatDate, formatRs } from '@/lib/storeApi';
import { mins, monthLabel } from '@/app/(routes)/admin/hr/attendance/services/attendanceApi';
import { Card, ErrorCard, Loading, Pill, Row, payTone, usePortal } from '../../_lib/PortalBits';
import { isNoEmployee, moneyStatus, portalApi, type MoneyRow, type PayslipDetail } from '../../_lib/portalApi';

// Attendance numbers worth showing on the slip (if the server sends them).
const ATT_FIELDS: [string, string, 'days' | 'minutes'][] = [
  ['scheduledDaysInMonth', 'Shift days', 'days'],
  ['daysWorked', 'Days worked', 'days'],
  ['presentDays', 'Present', 'days'],
  ['absentDays', 'Absent', 'days'],
  ['halfDays', 'Half days', 'days'],
  ['lateCount', 'Lates', 'days'],
  ['workedMinutes', 'Hours worked', 'minutes'],
  ['overtimeMinutesPaid', 'Overtime paid', 'minutes'],
];

function MoneyList({ title, rows, total, totalLabel }: { title: string; rows: MoneyRow[]; total: number; totalLabel: string }) {
  return (
    <Card title={title}>
      {rows.length ? (
        rows.map((r, i) => (
          <div key={r.key || `${r.label}-${i}`} className="flex items-start justify-between gap-3 py-2 border-b border-gray-100">
            <div className="min-w-0">
              <p className="text-sm text-gray-800">{r.label}</p>
              {r.detail && <p className="text-[11px] text-gray-500">{r.detail}</p>}
            </div>
            <p className="text-sm font-medium text-gray-900 whitespace-nowrap">{formatRs(r.amount)}</p>
          </div>
        ))
      ) : (
        <p className="py-2 text-sm text-gray-500">None</p>
      )}
      <div className="flex items-center justify-between pt-2">
        <span className="text-sm font-semibold text-gray-700">{totalLabel}</span>
        <span className="text-sm font-bold text-gray-900">{formatRs(total)}</span>
      </div>
    </Card>
  );
}

export default function PortalPayslipPage() {
  const { runId } = useParams<{ runId: string }>();
  const { profile } = usePortal();
  const emp = profile.employee;
  const [data, setData] = useState<PayslipDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await portalApi.payslip(runId);
      setData(res.data);
    } catch (e) {
      setError(isNoEmployee(e) ? 'This payslip was not found, or it is not ready yet.' : apiErrorMessage(e, 'Could not load the payslip.'));
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    load();
  }, [load]);

  const line = data?.line;
  const att = (line?.attendance || {}) as Record<string, unknown>;
  const facts = ATT_FIELDS.filter(([k]) => typeof att[k] === 'number').map(([k, label, kind]) => [
    label,
    kind === 'minutes' ? mins(att[k] as number) : String(att[k]),
  ]);

  return (
    <div className="space-y-4">
      <div className="print:hidden flex items-center justify-between gap-2">
        <Link href="/portal/salary" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" /> All payslips
        </Link>
        <button type="button" onClick={() => window.print()} disabled={!data} className={primaryBtn}>
          <Printer className="h-4 w-4" /> Print
        </button>
      </div>

      {error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : loading && !data ? (
        <Loading text="Opening the payslip…" />
      ) : data && line ? (
        <div className="space-y-4">
          {/* Slip header (also the print letterhead) */}
          <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 print:border-0 print:shadow-none print:p-0">
            <div className="flex items-start justify-between gap-3 border-b-2 border-brand-ink pb-3">
              <Wordmark tone="light" className="text-2xl" />
              <div className="text-right">
                <span className="inline-block rounded bg-brand-yellow px-2 py-0.5 text-xs font-extrabold tracking-[0.12em] text-brand-ink [print-color-adjust:exact]">
                  PAYSLIP
                </span>
                <p className="text-sm font-semibold text-gray-900 mt-1">{monthLabel(data.month)}</p>
                <p className="text-[11px] text-gray-500">{line.payslipNo || data.runNo || ''}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-3 text-sm">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-gray-500">Name</p>
                <p className="font-semibold text-gray-900">{emp.name}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-gray-500">Code</p>
                <p className="font-semibold text-gray-900">{emp.code || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-gray-500">Designation</p>
                <p className="font-semibold text-gray-900">{emp.designation || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-gray-500">Status</p>
                <p className="font-semibold text-gray-900">
                  <Pill tone={payTone(line.status)}>{moneyStatus(line.status)}</Pill>
                  {line.paidAt && <span className="ml-1 text-xs font-normal text-gray-500">{formatDate(line.paidAt)}</span>}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-xl bg-honey-50 border border-honey-200 p-4 text-center [print-color-adjust:exact]">
            <p className="text-xs font-medium text-gray-600">Net pay</p>
            <p className="text-3xl font-black text-gray-900">{formatRs(line.net)}</p>
            {Number(line.advanceRecovery) > 0 && (
              <p className="mt-1 text-[11px] text-gray-600">
                Salary earned {formatRs(line.net + Number(line.advanceRecovery))} = net pay {formatRs(line.net)} + advance paid back{' '}
                {formatRs(line.advanceRecovery)}
              </p>
            )}
          </section>

          {facts.length > 0 && (
            <Card title="Attendance this month">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {facts.map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-gray-50 px-2.5 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
                    <p className="text-sm font-bold text-gray-900">{value}</p>
                  </div>
                ))}
              </div>
              {typeof line.employedDays === 'number' && (
                <p className="mt-2 text-[11px] text-gray-500">Days employed this month: {line.employedDays}</p>
              )}
            </Card>
          )}

          <div className="grid gap-4 sm:grid-cols-2 print:grid-cols-2">
            <MoneyList title="Earnings" rows={line.earnings || []} total={line.gross} totalLabel="Gross pay" />
            <MoneyList title="Deductions" rows={line.deductions || []} total={line.totalDeductions} totalLabel="Total cut" />
          </div>

          {(Number(line.bonus) > 0 || (line.adjustments && line.adjustments.length > 0)) && (
            <Card title="Bonus and changes">
              {Number(line.bonus) > 0 && <Row label={line.bonusNote ? `Bonus · ${line.bonusNote}` : 'Bonus'} value={formatRs(line.bonus)} />}
              {(line.adjustments || []).map((a, i) => (
                <Row key={`${a.label}-${i}`} label={a.note ? `${a.label} · ${a.note}` : a.label} value={formatRs(a.amount)} />
              ))}
            </Card>
          )}

          <p className="text-[11px] text-gray-400 text-center">Computer-made payslip. Questions? Ask the shop admin.</p>
        </div>
      ) : null}
    </div>
  );
}
