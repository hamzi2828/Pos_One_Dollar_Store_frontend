'use client';

// Live cash in every open counter (admin). Refreshes every minute.
// Shown on Reports → Cash Closing (owner 2026-11-17; was on /admin/till).
import { useCallback, useEffect, useState } from 'react';
import { storeApi, formatRs } from '@/lib/storeApi';
import { formatTime, type TillSession } from '@/components/store/TillStatusBar';
import { CountTable, type TillDetail } from './tillUi';

export default function OpenCounters({ refreshKey = 0, onOpen }: { refreshKey?: number; onOpen: (id: string) => void }) {
  const [tills, setTills] = useState<TillDetail[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await storeApi.get<TillSession[]>('/till-sessions', { status: 'open', page: 1, limit: 20 });
      const details = await Promise.all((res.data || []).map((s) => storeApi.get<TillDetail>(`/till-sessions/${s._id}`).then((d) => d.data)));
      setTills(details.filter(Boolean));
    } catch {
      /* the list below still shows the tills */
    }
  }, []);

  useEffect(() => {
    load();
    const t = window.setInterval(load, 60_000);
    return () => window.clearInterval(t);
  }, [load, refreshKey]);

  if (!tills.length) return null;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {tills.map((t) => {
        const e = t.liveExpected || t.expected;
        const floatAmt = t.openingFloat?.total ?? e?.float ?? 0;
        const salesCash = e ? e.cashSales + e.cashReceivedOnCredit - e.cashRefunds : 0;
        const exp = e?.expenses || 0;
        return (
          <button
            key={t._id}
            type="button"
            onClick={() => onOpen(t._id)}
            className="rounded-xl border border-green-200 bg-white p-4 text-left shadow-sm hover:border-green-400"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-gray-900">
                {t.counterName || 'No counter'} <span className="font-normal text-gray-500">· {t.cashierName}</span>
              </p>
              <span className="text-[11px] text-gray-500">since {formatTime(t.openedAt)}</span>
            </div>
            <p className="mt-2 text-xs text-gray-500">Cash in the counter now</p>
            <p className="text-2xl font-bold tabular-nums text-green-700">{formatRs(Math.round((floatAmt + salesCash - exp) * 100) / 100)}</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
              <dt className="text-gray-500">Till (float)</dt>
              <dd className="text-right tabular-nums">{formatRs(floatAmt)}</dd>
              <dt className="text-gray-500">Cash sales ({e?.billCount ?? 0} bills)</dt>
              <dd className="text-right tabular-nums">+{formatRs(salesCash)}</dd>
              {exp > 0 && (
                <>
                  <dt className="text-gray-500">Expenses paid</dt>
                  <dd className="text-right tabular-nums text-rose-700">−{formatRs(exp)}</dd>
                </>
              )}
              <dt className="text-gray-500">Card / Bank (UBL)</dt>
              <dd className="text-right tabular-nums text-gray-600">
                {formatRs(t.nonCash?.card ?? e?.card ?? 0)} / {formatRs(t.nonCash?.bank_transfer ?? e?.bankTransfer ?? 0)}
              </dd>
              <dt className="text-gray-500">JazzCash</dt>
              <dd className="text-right tabular-nums text-gray-600">{formatRs(t.nonCash?.jazzcash ?? e?.jazzcash ?? 0)}</dd>
            </dl>
            {t.openingFloat && Object.keys(t.openingFloat.denominations || {}).length > 0 && (
              <div className="mt-2 border-t border-gray-100 pt-2">
                <p className="mb-1 text-[11px] font-semibold uppercase text-gray-500">Float notes</p>
                <CountTable count={t.openingFloat} />
              </div>
            )}
            <p className="mt-2 text-[11px] text-gray-400">Sales cash is counted note by note when the cashier closes the till.</p>
          </button>
        );
      })}
    </div>
  );
}
