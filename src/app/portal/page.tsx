'use client';

// Employee Portal — Home (owner, 2026-11-17: keep it very simple, only what
// staff need): today, this month's attendance, salary so far, overtime
// (normal + after 12 hours), cuts and tips.
import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { formatRs } from '@/lib/storeApi';
import { mins, monthLabel } from '@/app/(routes)/admin/hr/attendance/services/attendanceApi';
import { Card, usePortal } from './_lib/PortalBits';
import { timeText } from './_lib/portalApi';

/** Big number box: number on top, one word below. */
function Box({ value, label, color }: { value: React.ReactNode; label: string; color: string }) {
  return (
    <div className={`rounded-xl border px-2 py-3 text-center ${color}`}>
      <div className="text-2xl font-bold leading-none">{value}</div>
      <div className="mt-1 text-xs font-medium">{label}</div>
    </div>
  );
}

/** One money line: label left, amount right. */
function Line({ label, amount, sub, tone = 'text-gray-900' }: { label: string; amount: string; sub?: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-gray-100 last:border-b-0">
      <div className="min-w-0">
        <div className="text-sm text-gray-800">{label}</div>
        {sub && <div className="text-[11px] text-gray-500">{sub}</div>}
      </div>
      <div className={`text-base font-bold whitespace-nowrap ${tone}`}>{amount}</div>
    </div>
  );
}

const More = ({ href, text }: { href: string; text: string }) => (
  <Link href={href} className="inline-flex items-center text-xs font-semibold text-honey-700">
    {text} <ChevronRight className="h-3.5 w-3.5" />
  </Link>
);

export default function PortalHome() {
  const { profile } = usePortal();
  const { employee: emp, today, thisMonth: m, pay } = profile;
  const first = emp.firstName || emp.name?.split(' ')[0] || '';
  const ot = pay?.overtime;
  const otHours = (ot?.normalMinutes || 0) + (ot?.doubleMinutes || 0);
  const cutsTaken = (pay?.deductions || []).filter((d) => d.status === 'approved' || d.status === 'applied');
  const tipsTotal = (pay?.tips || []).reduce((t, x) => t + x.amount, 0) || profile.tipsThisMonth || 0;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Hello{first ? `, ${first}` : ''} 👋</h1>

      {/* Today */}
      <Card title="Today">
        {today ? (
          <div className="grid grid-cols-2 gap-2">
            <Box value={timeText(today.checkIn) || '—'} label="Came in" color="bg-green-50 border-green-200 text-green-800" />
            <Box value={timeText(today.checkOut) || '—'} label="Went out" color="bg-gray-50 border-gray-200 text-gray-800" />
          </div>
        ) : (
          <p className="text-sm text-gray-500">No check-in today yet.</p>
        )}
      </Card>

      {/* Attendance this month */}
      <Card title={`Attendance · ${monthLabel(m?.month || pay?.month || '')}`} action={<More href="/portal/attendance" text="Every day" />}>
        {m ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Box value={m.present ?? 0} label="Present" color="bg-green-50 border-green-200 text-green-800" />
              <Box value={m.late ?? 0} label="Late" color="bg-amber-50 border-amber-200 text-amber-800" />
              <Box value={m.absent ?? 0} label="Absent" color="bg-red-50 border-red-200 text-red-800" />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Box value={mins(m.workedMinutes)} label="Hours worked" color="bg-honey-50 border-honey-200 text-gray-900" />
              <Box value={m.leave ?? 0} label="Leave" color="bg-blue-50 border-blue-200 text-blue-800" />
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-500">No attendance this month yet.</p>
        )}
      </Card>

      {/* Salary this month */}
      {pay && (
        <Card title="My salary this month" action={<More href="/portal/salary" text="Payslips" />}>
          <div className="rounded-xl bg-honey-50 border border-honey-200 px-4 py-3 mb-2">
            <div className="text-xs text-gray-600">Earned so far</div>
            <div className="text-3xl font-bold text-gray-900">{formatRs(pay.earned)}</div>
            <div className="text-xs text-gray-500">Overtime included, cuts taken out · full month salary {formatRs(pay.salary)}</div>
          </div>

          <Line
            label="Overtime"
            sub={otHours ? mins(otHours) : ot?.waitingMinutes ? `${mins(ot.waitingMinutes)} waiting for approval` : 'None'}
            amount={formatRs(ot?.normalAmount || 0)}
            tone="text-green-700"
          />
          {(ot?.doubleMinutes || 0) > 0 && (
            <Line
              label={`Overtime after ${ot?.doubleAfterHours || 12} hours (double)`}
              sub={mins(ot?.doubleMinutes || 0)}
              amount={formatRs(ot?.doubleAmount || 0)}
              tone="text-green-700"
            />
          )}
          {otHours > 0 && (ot?.waitingMinutes || 0) > 0 && (
            <p className="text-[11px] text-gray-500 py-1">{mins(ot?.waitingMinutes || 0)} more overtime is waiting for approval.</p>
          )}
          <Line label="Tips" sub={pay.tips.length ? `${pay.tips.length} tip${pay.tips.length === 1 ? '' : 's'}` : 'None'} amount={formatRs(tipsTotal)} tone="text-green-700" />
          <Line
            label="Cut from salary"
            sub={cutsTaken.length ? cutsTaken.map((d) => d.label).join(', ') : 'Nothing cut'}
            amount={formatRs(cutsTaken.reduce((t, d) => t + d.amount, 0))}
            tone="text-red-700"
          />
          {profile.openAdvanceBalance > 0 && <Line label="Advance still to pay back" amount={formatRs(profile.openAdvanceBalance)} />}
        </Card>
      )}

      <p className="text-center text-[11px] text-gray-400">Something wrong? Tell the shop manager.</p>
    </div>
  );
}
