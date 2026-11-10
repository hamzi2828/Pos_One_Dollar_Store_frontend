'use client';

// Employee Portal — Salary: my payslips, newest first.
import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { apiErrorMessage, formatDate, formatRs } from '@/lib/storeApi';
import { monthLabel } from '@/app/(routes)/admin/hr/attendance/services/attendanceApi';
import { Card, Empty, ErrorCard, Loading, Pill, payTone } from '../_lib/PortalBits';
import { moneyStatus, portalApi, type PayslipRow } from '../_lib/portalApi';

export default function PortalSalaryPage() {
  const [rows, setRows] = useState<PayslipRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await portalApi.payslips();
      setRows(res.data?.payslips || []);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load your payslips.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-gray-900">Salary</h1>
      {error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : loading && !rows ? (
        <Loading text="Loading your payslips…" />
      ) : (
        <Card title="Payslips">
          {rows && rows.length ? (
            <ul className="-mx-4 divide-y divide-gray-100 border-y border-gray-100">
              {rows.map((p) => (
                <li key={`${p.runId}-${p.lineId || ''}`}>
                  <Link href={`/portal/salary/${p.runId}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900">{monthLabel(p.month)}</p>
                      <p className="text-[11px] text-gray-500">
                        Gross {formatRs(p.gross)} · Cut {formatRs(p.totalDeductions)}
                        {p.bonus ? ` · Bonus ${formatRs(p.bonus)}` : ''}
                      </p>
                      <p className="text-[11px] text-gray-400">{p.paidAt ? `Paid ${formatDate(p.paidAt)}` : 'Not paid yet'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-bold text-gray-900">{formatRs(p.net)}</p>
                      <Pill tone={payTone(p.status)}>{moneyStatus(p.status)}</Pill>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="No payslips yet" text="Your payslip shows here once the shop makes the month's salary." />
          )}
        </Card>
      )}
    </div>
  );
}
