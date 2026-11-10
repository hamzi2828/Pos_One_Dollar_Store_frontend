'use client';

// Employee Portal — Home: today, this month, last pay, advance left, tips.
import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { formatDate, formatRs } from '@/lib/storeApi';
import { StatTile, StatusChip } from '@/app/(routes)/admin/hr/attendance/components/AttendanceBits';
import { dayLabel, mins, monthLabel, type AttendanceStatus } from '@/app/(routes)/admin/hr/attendance/services/attendanceApi';
import { Card, Pill, Row, payTone, usePortal } from './_lib/PortalBits';
import { moneyStatus, planWords, timeText } from './_lib/portalApi';

export default function PortalHome() {
  const { profile } = usePortal();
  const { employee: emp, today, thisMonth: m, lastPayslip: last } = profile;
  const first = emp.firstName || emp.name?.split(' ')[0] || '';

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Hello{first ? `, ${first}` : ''}</h1>
        <p className="text-xs text-gray-500">
          {[emp.designation, emp.code].filter(Boolean).join(' · ') || 'Your attendance and salary in one place.'}
        </p>
      </div>

      <Card
        title="Today"
        action={today ? <StatusChip status={today.status as AttendanceStatus} /> : undefined}
      >
        {today ? (
          <>
            <p className="text-xs text-gray-500 mb-1">{dayLabel(today.date, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            <Row label="Plan" value={planWords(today.planned)} />
            <Row label="Check in" value={timeText(today.checkIn)} />
            <Row label="Check out" value={timeText(today.checkOut)} />
          </>
        ) : (
          <p className="text-sm text-gray-500">Nothing for today yet.</p>
        )}
      </Card>

      <Card
        title={m?.month ? `This month · ${monthLabel(m.month)}` : 'This month'}
        action={
          <Link href="/portal/attendance" className="inline-flex items-center text-xs font-semibold text-honey-700">
            See days <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        }
      >
        {m ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              <StatTile label="Present" value={m.present ?? 0} tone="green" />
              <StatTile label="Late" value={m.late ?? 0} tone="amber" />
              <StatTile label="Absent" value={m.absent ?? 0} tone="red" />
              <StatTile label="Leave" value={m.leave ?? 0} tone="blue" />
              <StatTile label="Off" value={m.off ?? 0} />
              <StatTile label="Worked" value={mins(m.workedMinutes)} tone="honey" />
            </div>
            {(m.lateMinutes > 0 || m.overtimeMinutes > 0) && (
              <p className="mt-2 text-xs text-gray-500">
                {m.lateMinutes > 0 && <>Late in total: {mins(m.lateMinutes)}. </>}
                {m.overtimeMinutes > 0 && <>Overtime: {mins(m.overtimeMinutes)}.</>}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-500">No attendance this month yet.</p>
        )}
      </Card>

      <Card
        title="Last salary"
        action={
          <Link href="/portal/salary" className="inline-flex items-center text-xs font-semibold text-honey-700">
            All payslips <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        }
      >
        {last ? (
          <Link href={`/portal/salary/${last.runId}`} className="flex items-center justify-between gap-3 rounded-lg bg-honey-50 border border-honey-200 px-3 py-3">
            <div>
              <p className="text-xs text-gray-600">{monthLabel(last.month)}</p>
              <p className="text-xl font-bold text-gray-900">{formatRs(last.net)}</p>
              <p className="text-[11px] text-gray-500">{last.paidAt ? `Paid ${formatDate(last.paidAt)}` : 'Not paid yet'}</p>
            </div>
            <div className="flex items-center gap-1">
              <Pill tone={payTone(last.status)}>{moneyStatus(last.status)}</Pill>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </div>
          </Link>
        ) : (
          <p className="text-sm text-gray-500">No payslip yet. It shows here once the shop makes your salary.</p>
        )}
      </Card>

      <Card
        title="Money"
        action={
          <Link href="/portal/money" className="inline-flex items-center text-xs font-semibold text-honey-700">
            Details <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        }
      >
        <Row label="Advance still to pay back" value={formatRs(profile.openAdvanceBalance)} strong={profile.openAdvanceBalance > 0} />
        <Row label="Tips this month" value={formatRs(profile.tipsThisMonth)} />
      </Card>
    </div>
  );
}
