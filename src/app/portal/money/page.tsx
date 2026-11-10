'use client';

// Employee Portal — Money: advances (with what is left), cuts, tips, bonuses.
import React, { useCallback, useEffect, useState } from 'react';
import { apiErrorMessage, formatDate, formatRs } from '@/lib/storeApi';
import { dayLabel, monthLabel } from '@/app/(routes)/admin/hr/attendance/services/attendanceApi';
import { Card, Empty, ErrorCard, Loading, Pill, payTone } from '../_lib/PortalBits';
import { humanize, moneyStatus, portalApi, type PortalMoney } from '../_lib/portalApi';

const DEDUCTION_WORD: Record<string, string> = {
  till_shortage: 'Till short',
  damage: 'Damage',
  other: 'Other',
};

const METHOD_WORD: Record<string, string> = {
  cash: 'Cash',
  bank: 'Bank',
  easypaisa: 'Easypaisa',
  jazzcash: 'JazzCash',
  salary: 'With salary',
};

function Item({ title, sub, note, amount, right }: { title: string; sub?: string; note?: string; amount: number; right?: React.ReactNode }) {
  return (
    <li className="flex items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900">{title}</p>
        {sub && <p className="text-[11px] text-gray-500">{sub}</p>}
        {note && <p className="text-[11px] text-gray-400 break-words">{note}</p>}
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-bold text-gray-900">{formatRs(amount)}</p>
        {right}
      </div>
    </li>
  );
}

const listClass = '-mx-4 divide-y divide-gray-100 border-y border-gray-100';

export default function PortalMoneyPage() {
  const [data, setData] = useState<PortalMoney | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await portalApi.money();
      setData(res.data);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load your money details.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <ErrorCard message={error} onRetry={load} />;
  if (loading && !data) return <Loading text="Loading…" />;
  if (!data) return null;

  const advances = data.advances || [];
  const deductions = data.deductions || [];
  const tips = data.tips || [];
  const bonuses = data.bonuses || [];
  const advanceLeft = advances.reduce((s, a) => s + (a.status === 'cancelled' ? 0 : Number(a.balance) || 0), 0);
  const tipsTotal = tips.reduce((s, t) => s + (Number(t.amount) || 0), 0);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-gray-900">Money</h1>

      <Card title="Advances" action={advanceLeft > 0 ? <span className="text-xs font-semibold text-red-600">Left to pay back: {formatRs(advanceLeft)}</span> : undefined}>
        {advances.length ? (
          <ul className={listClass}>
            {advances.map((a, i) => (
              <Item
                key={a.advanceNo || i}
                title={`${formatDate(a.date)}${a.advanceNo ? ` · ${a.advanceNo}` : ''}`}
                sub={`Paid back ${formatRs(a.recovered)} · Left ${formatRs(a.balance)}${a.installments ? ` · ${a.installments} part${a.installments === 1 ? '' : 's'}` : ''}`}
                note={a.note}
                amount={a.amount}
                right={<Pill tone={payTone(a.status)}>{moneyStatus(a.status)}</Pill>}
              />
            ))}
          </ul>
        ) : (
          <Empty title="No advances" text="Money taken before salary shows here." />
        )}
      </Card>

      <Card title="Cuts (deductions)">
        {deductions.length ? (
          <ul className={listClass}>
            {deductions.map((d, i) => (
              <Item
                key={i}
                title={DEDUCTION_WORD[d.type] || humanize(d.type || 'Other')}
                sub={formatDate(d.date)}
                note={d.note}
                amount={d.amount}
                right={<Pill tone={payTone(d.status)}>{moneyStatus(d.status)}</Pill>}
              />
            ))}
          </ul>
        ) : (
          <Empty title="No cuts" text="Good — nothing has been cut from your pay." />
        )}
      </Card>

      <Card title="Tips" action={tips.length ? <span className="text-xs font-semibold text-green-700">Total {formatRs(tipsTotal)}</span> : undefined}>
        {tips.length ? (
          <ul className={listClass}>
            {tips.map((t, i) => (
              <Item
                key={t.tipNo || i}
                title={t.day ? dayLabel(t.day.slice(0, 10)) : '—'}
                sub={[t.tipNo, t.method ? METHOD_WORD[t.method] || humanize(t.method) : ''].filter(Boolean).join(' · ')}
                note={t.note}
                amount={t.amount}
              />
            ))}
          </ul>
        ) : (
          <Empty title="No tips yet" />
        )}
      </Card>

      <Card title="Bonuses">
        {bonuses.length ? (
          <ul className={listClass}>
            {bonuses.map((b, i) => (
              <Item key={`${b.month}-${i}`} title={monthLabel(b.month)} note={b.note} amount={b.amount} />
            ))}
          </ul>
        ) : (
          <Empty title="No bonuses yet" text="Bonuses added to your salary show here." />
        )}
      </Card>
    </div>
  );
}
