'use client';

// Salary earned so far this month, per employee (before payroll is run).
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, TrendingUp } from 'lucide-react';
import { apiErrorMessage, formatRs } from '@/lib/storeApi';
import { payrollApi, type SalaryToDate as Data } from './payrollApi';
import { cardClass, tdClass, thClass } from './PayrollBits';

/** 240 -> "4 h", 90 -> "1 h 30 m", 0 -> "". */
function hoursOf(min: number): string {
  const m = Math.round(Number(min) || 0);
  if (m <= 0) return '';
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h && r ? `${h} h ${r} m` : h ? `${h} h` : `${r} m`;
}

export default function SalaryToDate() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Long-day rule from the HR policy (owner: past 12 h in a day = × 2).
  const dblRow = data?.rows.find((r) => (r.doubleAfterHours || 0) > 0);
  const dblAfter = dblRow?.doubleAfterHours || 0;
  const dblRate = dblRow?.doubleRate ?? 2;
  const dblLabel = `Over ${dblAfter} h (×${dblRate})`;
  const normalMin = (r: Data['rows'][number]) => (r.otNormalMinutes ?? r.otApprovedMinutes) || 0;
  const normalRs = (r: Data['rows'][number]) => r.overtimeNormal ?? r.overtime;

  useEffect(() => {
    payrollApi
      .toDate()
      .then((r) => setData(r.data))
      .catch((e) => setError(apiErrorMessage(e, 'Could not work out the salary so far.')));
  }, []);

  return (
    <div className={`${cardClass} mb-5 overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-honey-700" />
          <h2 className="text-sm font-semibold text-gray-900">Salary so far{data ? ` — ${data.monthLabel}` : ''}</h2>
        </div>
        {data && (
          <p className="text-xs text-gray-500">
            Up to today · earned <strong className="text-gray-900">{formatRs(data.totals.earned)}</strong> · payable now{' '}
            <strong className="text-gray-900">{formatRs(data.totals.payableNow)}</strong>
          </p>
        )}
      </div>
      {error ? (
        <p className="px-4 py-3 text-sm text-red-600">{error}</p>
      ) : !data ? (
        <div className="px-4 py-6 text-center">
          <Loader2 className="h-5 w-5 animate-spin text-honey-700 mx-auto" />
        </div>
      ) : !data.rows.length ? (
        <p className="px-4 py-3 text-sm text-gray-500">No staff this month.</p>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className={thClass}>Employee</th>
                  <th className={`${thClass} text-right`}>Salary</th>
                  <th className={`${thClass} text-right`}>Days so far</th>
                  <th className={`${thClass} text-right`}>Absent / late</th>
                  <th className={`${thClass} text-right`} title="Approved overtime at the normal hourly rate. Reject it in Fix before payroll if needed.">Overtime</th>
                  {dblAfter > 0 && (
                    <th className={`${thClass} text-right`} title={`Approved overtime worked past ${dblAfter} hours in one day is paid at ${dblRate}× the hourly rate.`}>
                      {dblLabel}
                    </th>
                  )}
                  <th className={`${thClass} text-right`}>Earned so far</th>
                  <th className={`${thClass} text-right`}>Advances / deductions</th>
                  <th className={`${thClass} text-right`}>Payable now</th>
                  <th className={`${thClass} text-right`} title="Tips already given this month. Not part of salary.">Tips taken</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.rows.map((r) => (
                  <tr key={r.employee}>
                    <td className={tdClass}>
                      <Link href={`/admin/hr/employees/${r.employee}`} className="font-medium text-gray-900 hover:text-honey-700">
                        {r.name}
                      </Link>
                      <span className="block text-[11px] text-gray-500">{[r.code, r.designation].filter(Boolean).join(' · ')}</span>
                    </td>
                    <td className={`${tdClass} text-right tabular-nums`}>
                      {r.payType === 'daily' ? `${formatRs(r.dailyRate)} / day` : formatRs(r.salary)}
                    </td>
                    <td className={`${tdClass} text-right tabular-nums`}>
                      {r.daysSoFar} of {r.employedDays}
                      <span className="block text-[11px] text-gray-500">{r.presentDays} present</span>
                    </td>
                    <td className={`${tdClass} text-right tabular-nums text-red-700`}>
                      {r.cuts > 0 ? `−${formatRs(r.cuts)}` : '—'}
                      {(r.absentDays > 0 || r.lateCount > 0) && (
                        <span className="block text-[11px] text-gray-500">
                          {r.absentDays} absent · {r.lateCount} late
                        </span>
                      )}
                    </td>
                    <td className={`${tdClass} text-right tabular-nums`}>
                      {normalMin(r) ? (
                        <span className="font-semibold text-green-700">
                          {hoursOf(normalMin(r))} approved
                          <span className="block text-[11px] font-normal">{formatRs(normalRs(r))}</span>
                        </span>
                      ) : (
                        !r.otPendingMinutes && <span className="text-gray-400">—</span>
                      )}
                      {r.otPendingMinutes ? <span className="block text-[11px] text-amber-700">{hoursOf(r.otPendingMinutes)} waiting</span> : null}
                    </td>
                    {dblAfter > 0 && (
                      <td className={`${tdClass} text-right tabular-nums`}>
                        {r.otDoubleMinutes ? (
                          <span className="font-semibold text-green-700">
                            {hoursOf(r.otDoubleMinutes)}
                            <span className="block text-[11px] font-normal">{formatRs(r.overtimeDouble || 0)}</span>
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    )}
                    <td className={`${tdClass} text-right tabular-nums font-semibold text-gray-900`}>
                      {formatRs(r.earned)}
                      {r.tipsToSalary ? <span className="block text-[11px] font-normal text-honey-700">incl. tips {formatRs(r.tipsToSalary)}</span> : null}
                    </td>
                    <td className={`${tdClass} text-right tabular-nums text-red-700`}>{r.due > 0 ? `−${formatRs(r.due)}` : '—'}</td>
                    <td className={`${tdClass} text-right tabular-nums font-semibold text-gray-900`}>{formatRs(r.payableNow)}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>
                      {r.tips ? (
                        <span className="font-semibold text-green-700">
                          {formatRs(r.tips)}
                          {r.tipCount ? <span className="block text-[11px] font-normal text-green-600">{r.tipCount} tip{r.tipCount === 1 ? '' : 's'}</span> : null}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-semibold">
                <tr>
                  <td className={tdClass}>Total ({data.totals.staff} staff)</td>
                  <td className={`${tdClass} text-right tabular-nums`}>{formatRs(data.totals.fullMonth)}</td>
                  <td className={tdClass} />
                  <td className={tdClass} />
                  <td className={`${tdClass} text-right tabular-nums text-green-700`}>
                    {hoursOf(data.rows.reduce((t, r) => t + normalMin(r), 0)) || '—'}
                  </td>
                  {dblAfter > 0 && (
                    <td className={`${tdClass} text-right tabular-nums text-green-700`}>
                      {hoursOf(data.rows.reduce((t, r) => t + (r.otDoubleMinutes || 0), 0)) || '—'}
                    </td>
                  )}
                  <td className={`${tdClass} text-right tabular-nums`}>{formatRs(data.totals.earned)}</td>
                  <td className={`${tdClass} text-right tabular-nums text-red-700`}>{data.totals.due > 0 ? `−${formatRs(data.totals.due)}` : '—'}</td>
                  <td className={`${tdClass} text-right tabular-nums`}>{formatRs(data.totals.payableNow)}</td>
                  <td className={`${tdClass} text-right tabular-nums text-green-700`}>{data.totals.tips ? formatRs(data.totals.tips) : '—'}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="md:hidden divide-y divide-gray-100">
            {data.rows.map((r) => (
              <div key={r.employee} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{r.name}</p>
                    <p className="text-[11px] text-gray-500">
                      {r.daysSoFar} of {r.employedDays} days · {r.absentDays} absent · {r.lateCount} late
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums">{formatRs(r.earned)}</p>
                    <p className="text-[11px] text-gray-500">earned so far</p>
                  </div>
                </div>
                <p className="mt-1 text-[11px] text-gray-600">
                  Salary {r.payType === 'daily' ? `${formatRs(r.dailyRate)} / day` : formatRs(r.salary)}
                  {r.due > 0 ? ` · advances / deductions −${formatRs(r.due)}` : ''} · payable now <strong>{formatRs(r.payableNow)}</strong>
                  {normalMin(r) ? <span className="text-green-700"> · overtime {hoursOf(normalMin(r))} {formatRs(normalRs(r))}</span> : null}
                  {r.otDoubleMinutes ? (
                    <span className="text-green-700">
                      {' '}· {dblLabel.toLowerCase()} {hoursOf(r.otDoubleMinutes)} {formatRs(r.overtimeDouble || 0)}
                    </span>
                  ) : null}
                  {r.otPendingMinutes ? <span className="text-amber-700"> · {hoursOf(r.otPendingMinutes)} waiting</span> : null}
                  {r.tips ? <span className="font-semibold text-green-700"> · tips taken {formatRs(r.tips)}</span> : null}
                </p>
              </div>
            ))}
          </div>
          <p className="px-4 py-2 text-[11px] text-gray-500 border-t border-gray-100">
            Worked out from attendance up to today. Overtime counts only once approved.{dblAfter > 0 ? ` Hours past ${dblAfter} h in one day are paid at ${dblRate}× the hourly rate.` : ''} The final figure is made when you run payroll for the month.
          </p>
        </>
      )}
    </div>
  );
}
