'use client';

// Salary earned so far this month, per employee (before payroll is run).
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, TrendingUp } from 'lucide-react';
import { apiErrorMessage, formatRs } from '@/lib/storeApi';
import { payrollApi, type SalaryToDate as Data } from './payrollApi';
import { cardClass, tdClass, thClass } from './PayrollBits';

export default function SalaryToDate() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

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
                  <th className={`${thClass} text-right`}>Earned so far</th>
                  <th className={`${thClass} text-right`}>Advances / deductions</th>
                  <th className={`${thClass} text-right`}>Payable now</th>
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
                    <td className={`${tdClass} text-right tabular-nums font-semibold text-gray-900`}>
                      {formatRs(r.earned)}
                      {r.overtime > 0 && <span className="block text-[11px] font-normal text-green-700">incl. overtime {formatRs(r.overtime)}</span>}
                    </td>
                    <td className={`${tdClass} text-right tabular-nums text-red-700`}>{r.due > 0 ? `−${formatRs(r.due)}` : '—'}</td>
                    <td className={`${tdClass} text-right tabular-nums font-semibold text-gray-900`}>{formatRs(r.payableNow)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-semibold">
                <tr>
                  <td className={tdClass}>Total ({data.totals.staff} staff)</td>
                  <td className={`${tdClass} text-right tabular-nums`}>{formatRs(data.totals.fullMonth)}</td>
                  <td className={tdClass} />
                  <td className={tdClass} />
                  <td className={`${tdClass} text-right tabular-nums`}>{formatRs(data.totals.earned)}</td>
                  <td className={`${tdClass} text-right tabular-nums text-red-700`}>{data.totals.due > 0 ? `−${formatRs(data.totals.due)}` : '—'}</td>
                  <td className={`${tdClass} text-right tabular-nums`}>{formatRs(data.totals.payableNow)}</td>
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
                </p>
              </div>
            ))}
          </div>
          <p className="px-4 py-2 text-[11px] text-gray-500 border-t border-gray-100">
            Worked out from attendance up to today. Overtime counts only once approved. The final figure is made when you run payroll for the month.
          </p>
        </>
      )}
    </div>
  );
}
