'use client';

// "Paying an investment bill?" — pick an investment bill that still has money
// left to pay. The expense then lowers that bill's balance (it is not partner
// money, so it does not add to "invested").

import { useEffect, useState } from 'react';
import axios from 'axios';
import { getAuthHeader } from '@/helper/helper';
import { SearchSelect } from '@/components/ui/SearchSelect';

export interface InvestmentBill {
  _id: string;
  title: string;
  partner: string;
  paidTo: string;
  billNo: string;
  amount: number;
  paid: number;
  balance: number;
}

const rs = (n: number) => `Rs ${Math.round(n).toLocaleString('en-PK')}`;

export default function InvestmentBillSelect({
  value,
  onChange,
  current,
  disabled,
}: {
  value: string;
  /** Picked bill (null = not an investment bill). */
  onChange: (id: string, bill: InvestmentBill | null) => void;
  /** Edit: the bill this expense is already on (shown even when it is now fully paid), and what this expense put on it. */
  current?: { id: string; title: string; mine: number } | null;
  disabled?: boolean;
}) {
  const [bills, setBills] = useState<InvestmentBill[] | null>(null);
  useEffect(() => {
    axios
      .get(`${process.env.NEXT_PUBLIC_BACKEND_URL}/expenses/investment-bills`, { headers: getAuthHeader() })
      .then((r) => setBills(r.data?.data || []))
      .catch(() => setBills([]));
  }, []);

  const list = [...(bills || [])];
  if (current && current.id && !list.some((b) => b._id === current.id)) {
    list.unshift({ _id: current.id, title: current.title, partner: '', paidTo: '', billNo: '', amount: 0, paid: 0, balance: 0 });
  }
  // On edit, this expense's own amount is free again for this bill.
  const room = (b: InvestmentBill) => b.balance + (current && current.id === b._id ? current.mine : 0);
  const picked = list.find((b) => b._id === value) || null;

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Paying an investment bill? (optional)</label>
      <SearchSelect
        value={value}
        onChange={(e) => {
          const b = list.find((x) => x._id === e.target.value) || null;
          onChange(e.target.value, b ? { ...b, balance: room(b) } : null);
        }}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-honey-500 focus:border-transparent"
        disabled={disabled || bills === null}
      >
        <option value="">{bills === null ? 'Loading…' : '— No, a normal expense —'}</option>
        {list.map((b) => (
          <option key={b._id} value={b._id}>
            {b.title}
            {b.partner ? ` · ${b.partner}` : ''}
            {b.paidTo ? ` · ${b.paidTo}` : ''} · left {rs(room(b))}
          </option>
        ))}
      </SearchSelect>
      <p className="mt-1 text-xs text-gray-500">
        {picked
          ? `Pays what is left on "${picked.title}" (up to ${rs(room(picked))}). It lowers the bill's balance but is not added to the investment.`
          : 'Pick one when this money pays the remaining part of an investment bill.'}
      </p>
    </div>
  );
}
