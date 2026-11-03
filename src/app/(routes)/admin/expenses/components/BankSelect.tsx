'use client';

// "Paid from which bank" dropdown for Bank Transfer expenses.

import { useEffect, useState } from 'react';
import axios from 'axios';
import { getAuthHeader } from '@/helper/helper';
import { SearchSelect } from '@/components/ui/SearchSelect';

interface BankOption {
  _id: string;
  name: string;
  accountTitle?: string;
  accountNumber?: string;
}

export default function BankSelect({ value, onChange, disabled }: { value: string; onChange: (id: string) => void; disabled?: boolean }) {
  const [banks, setBanks] = useState<BankOption[] | null>(null);
  useEffect(() => {
    axios
      .get(`${process.env.NEXT_PUBLIC_BACKEND_URL}/expenses/banks`, { headers: getAuthHeader() })
      .then((r) => setBanks(r.data?.data || []))
      .catch(() => setBanks([]));
  }, []);
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Bank account</label>
      <SearchSelect
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-honey-500 focus:border-transparent"
        disabled={disabled || banks === null}
      >
        <option value="">{banks === null ? 'Loading…' : banks.length ? '— Choose the bank —' : 'No bank accounts (add one under Banks)'}</option>
        {(banks || []).map((b) => (
          <option key={b._id} value={b._id}>
            {b.name}
            {b.accountTitle ? ` · ${b.accountTitle}` : ''}
            {b.accountNumber ? ` (${b.accountNumber.slice(-4)})` : ''}
          </option>
        ))}
      </SearchSelect>
    </div>
  );
}
