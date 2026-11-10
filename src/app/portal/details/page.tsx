'use client';

// Employee Portal — My details: job, pay, pay day, bank (masked), leave left.
import React from 'react';
import { formatDate, formatRs } from '@/lib/storeApi';
import { Avatar } from '@/app/(routes)/admin/hr/attendance/components/AttendanceBits';
import { Card, Row, usePortal } from '../_lib/PortalBits';
import { humanize, maskTail, ordinal, type PortalEmployee } from '../_lib/portalApi';

const METHOD_WORD: Record<string, string> = {
  cash: 'Cash',
  bank: 'Bank transfer',
  easypaisa: 'Easypaisa',
  jazzcash: 'JazzCash',
};

/** Years / months since joining: "1 year 3 months". */
function servedFor(joining: string | null | undefined): string {
  if (!joining) return '';
  const start = new Date(joining);
  if (Number.isNaN(start.getTime())) return '';
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  if (months < 1) return 'Less than a month';
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y ? `${y} year${y > 1 ? 's' : ''}` : '', m ? `${m} month${m > 1 ? 's' : ''}` : ''].filter(Boolean).join(' ');
}

function leaveRows(l: PortalEmployee['leave']): { label: string; text: string }[] {
  if (!l) return [];
  const rows: { label: string; text: string }[] = [];
  if (l.paidPerMonth) rows.push({ label: 'Paid leave (this month)', text: `${l.paidLeft ?? 0} left · ${l.paidUsed ?? 0} used of ${l.paidPerMonth}` });
  if (l.sickPerMonth) rows.push({ label: 'Sick leave (this month)', text: `${l.sickLeft ?? 0} left · ${l.sickUsed ?? 0} used of ${l.sickPerMonth}` });
  if (l.unpaid) rows.push({ label: 'Unpaid leave (this month)', text: `${l.unpaid} days` });
  return rows;
}

export default function PortalDetailsPage() {
  const { profile } = usePortal();
  const e = profile.employee;
  const shift = e.shiftName || (typeof e.shift === 'string' ? e.shift : e.shift?.name) || '';
  const sb = e.salaryBreakdown || {};
  const breakdown: [string, number][] = [
    ...(Number(sb.basic) > 0 ? [['basic', Number(sb.basic)] as [string, number]] : []),
    ...(sb.allowances || []).filter((a) => Number(a.amount) > 0).map((a) => [a.name, Number(a.amount)] as [string, number]),
  ];
  const bank = e.bank;
  const bankNo = maskTail(bank?.accountNumber) || maskTail(bank?.iban);
  const leaves = leaveRows(e.leave);
  const served = servedFor(e.joiningDate);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Avatar url={e.photo} name={e.name} />
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-gray-900 truncate">{e.name}</h1>
          <p className="text-xs text-gray-500">{[e.designation, e.code].filter(Boolean).join(' · ') || 'Employee'}</p>
        </div>
      </div>

      <Card title="Job">
        <Row label="Joining date" value={e.joiningDate ? formatDate(e.joiningDate) : '—'} />
        {served && <Row label="Working here for" value={served} />}
        <Row label="Designation" value={e.designation || '—'} />
        {e.department && <Row label="Department" value={e.department} />}
        {e.employmentType && <Row label="Job type" value={humanize(e.employmentType)} />}
        {shift && <Row label="Shift" value={shift} />}
        {e.status && <Row label="Status" value={humanize(e.status)} />}
      </Card>

      <Card title="Pay">
        {e.payType === 'daily' ? (
          <Row label="Daily pay" value={formatRs(e.dailyRate)} strong />
        ) : (
          <Row label="Monthly salary" value={formatRs(e.salary)} strong />
        )}
        {breakdown.map(([k, v]) => (
          <Row key={k} label={humanize(k)} value={formatRs(Number(v))} />
        ))}
        <Row label="Pay day" value={e.salaryPayDay ? `${ordinal(e.salaryPayDay)} of each month` : '—'} />
        <Row label="Paid by" value={e.salaryPaymentMethod ? METHOD_WORD[e.salaryPaymentMethod] || humanize(e.salaryPaymentMethod) : '—'} />
        {bank && (bank.bankName || bankNo) && (
          <Row label="Bank" value={[bank.bankName, bankNo].filter(Boolean).join(' ')} />
        )}
      </Card>

      {leaves.length > 0 && (
        <Card title="Leave">
          {leaves.map((l) => (
            <Row key={l.label} label={l.label} value={l.text} />
          ))}
        </Card>
      )}

      <Card title="Contact">
        <Row label="Phone" value={e.phone || '—'} />
        <Row label="Email" value={e.email || '—'} />
      </Card>

      <p className="text-[11px] text-gray-400 text-center">Something wrong here? Ask the shop admin to fix it.</p>
    </div>
  );
}
