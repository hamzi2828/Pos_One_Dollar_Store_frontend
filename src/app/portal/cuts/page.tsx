'use client';

// Employee Portal — Cuts / Tips (owner, 2026-11-17): money taken from salary
// (approved, or waiting for the manager) and tips given, in plain words.
import React, { useState } from 'react';
import { Gift, Scissors } from 'lucide-react';
import { formatDate, formatRs } from '@/lib/storeApi';
import { Card, Empty, usePortal } from '../_lib/PortalBits';

export default function PortalCutsTips() {
  const { profile } = usePortal();
  const [tab, setTab] = useState<'cuts' | 'tips'>('cuts');
  const pay = profile.pay;
  const deds = pay?.deductions || [];
  const waiting = deds.filter((d) => d.status === 'pending');
  const taken = deds.filter((d) => d.status === 'approved' || d.status === 'applied');
  const tips = pay?.tips || [];
  const sum = (list: { amount: number }[]) => list.reduce((t, x) => t + x.amount, 0);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-gray-900">Cuts / Tips</h1>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-red-200 bg-red-50 px-2 py-3 text-center text-red-800">
          <div className="text-lg font-bold">{formatRs(sum(taken))}</div>
          <div className="text-xs font-medium">Cut</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-2 py-3 text-center text-amber-800">
          <div className="text-lg font-bold">{formatRs(sum(waiting))}</div>
          <div className="text-xs font-medium">Waiting</div>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 px-2 py-3 text-center text-green-800">
          <div className="text-lg font-bold">{formatRs(sum(tips))}</div>
          <div className="text-xs font-medium">Tips</div>
        </div>
      </div>

      <div className="flex rounded-lg border border-gray-200 bg-white p-1 text-sm font-semibold">
        <button
          type="button"
          onClick={() => setTab('cuts')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 ${tab === 'cuts' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
        >
          <Scissors className="h-4 w-4" /> Cuts
        </button>
        <button
          type="button"
          onClick={() => setTab('tips')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 ${tab === 'tips' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
        >
          <Gift className="h-4 w-4" /> Tips
        </button>
      </div>

      {tab === 'cuts' && (
      <Card title="Cuts (deductions)">
        {deds.length ? (
          <ul className="space-y-2">
            {[...waiting, ...taken].map((d) => (
              <li key={d.id} className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900">{d.label}</div>
                  <div className="text-[11px] text-gray-500">
                    {formatDate(d.date)}
                    {d.note ? ` · ${d.note}` : ''}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-red-700">{formatRs(d.amount)}</div>
                  <div className={`text-[11px] font-semibold ${d.status === 'pending' ? 'text-amber-700' : 'text-red-700'}`}>
                    {d.status === 'pending' ? 'Manager will decide' : 'Cut'}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="No cuts" text="Nothing is taken from your salary." />
        )}
      </Card>
      )}

      {tab === 'tips' && (
      <Card title="Tips this month">
        {tips.length ? (
          <ul className="divide-y divide-gray-100">
            {tips.map((t, i) => (
              <li key={i} className="flex items-center justify-between py-2 text-sm">
                <span className="text-gray-700">
                  {formatDate(t.day)}
                  {t.toSalary ? ' · added to salary' : ''}
                  {t.note ? ` · ${t.note}` : ''}
                </span>
                <span className="font-bold text-green-700">{formatRs(t.amount)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="No tips yet" />
        )}
      </Card>
      )}

      {tab === 'cuts' && profile.openAdvanceBalance > 0 && (
        <Card>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Advance still to pay back</span>
            <span className="font-bold text-gray-900">{formatRs(profile.openAdvanceBalance)}</span>
          </div>
        </Card>
      )}
    </div>
  );
}
