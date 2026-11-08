'use client';

// "Paid from" dropdown: which counter's cash drawer paid the expense.
// Only that counter's till takes it off. Blank = no counter (old rule).

import { useEffect, useState } from 'react';
import axios from 'axios';
import { getAuthHeader } from '@/helper/helper';
import { SearchSelect } from '@/components/ui/SearchSelect';

interface CounterOption {
  _id: string;
  name: string;
  code?: string;
}

/** Small coloured tag: blue Counter 1, purple Counter 2. */
export function CounterTag({ name, className = '' }: { name?: string | null; className?: string }) {
  if (!name) return null;
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 align-middle text-[10px] font-semibold ${
        /2/.test(name) ? 'bg-violet-100 text-violet-800' : 'bg-sky-100 text-sky-800'
      } ${className}`}
    >
      {name}
    </span>
  );
}

export default function CounterSelect({
  value,
  onChange,
  disabled,
  savedName,
}: {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  /** Name saved on the expense (shown if that counter is now switched off). */
  savedName?: string;
}) {
  const [counters, setCounters] = useState<CounterOption[] | null>(null);
  useEffect(() => {
    axios
      .get(`${process.env.NEXT_PUBLIC_BACKEND_URL}/expenses/counters`, { headers: getAuthHeader() })
      .then((r) => setCounters(r.data?.data || []))
      .catch(() => setCounters([]));
  }, []);

  const list = counters || [];
  const missing = !!value && !!counters && !list.some((c) => c._id === value);
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Paid from</label>
      <SearchSelect
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-honey-500 focus:border-transparent"
        disabled={disabled || counters === null}
      >
        <option value="">{counters === null ? 'Loading…' : 'No counter (as before)'}</option>
        {list.map((c) => (
          <option key={c._id} value={c._id}>
            {c.name}
          </option>
        ))}
        {missing && <option value={value}>{savedName || 'Old counter'}</option>}
      </SearchSelect>
      <p className="mt-1 text-xs text-gray-500">Cash comes out of this counter&apos;s till.</p>
    </div>
  );
}
