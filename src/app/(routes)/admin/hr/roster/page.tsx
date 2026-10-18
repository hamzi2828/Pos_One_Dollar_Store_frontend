'use client';

// HR → Shifts & Roster: the weekly roster, the shift types and the shop holidays.
// The open tab is kept in the address (?tab=shifts) so a refresh stays on it.
import React, { useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { LoadingCard, NoAccessCard } from '@/components/admin/FormBits';
import RosterTab from './components/RosterTab';
import ShiftsTab from './components/ShiftsTab';
import HolidaysTab from './components/HolidaysTab';

type Tab = 'roster' | 'shifts' | 'holidays';
const TABS: { key: Tab; label: string }[] = [
  { key: 'roster', label: 'Roster' },
  { key: 'shifts', label: 'Shifts' },
  { key: 'holidays', label: 'Holidays' },
];

export default function RosterPage() {
  const { can, loaded } = useAccess();
  const [tab, setTab] = useState<Tab>('roster');

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t === 'shifts' || t === 'holidays') setTab(t);
  }, []);

  const pick = (t: Tab) => {
    setTab(t);
    const url = new URL(window.location.href);
    if (t === 'roster') url.searchParams.delete('tab');
    else url.searchParams.set('tab', t);
    window.history.replaceState(null, '', url.toString());
  };

  if (!loaded) return <LoadingCard text="Loading…" />;
  if (!can('shifts', 'view')) return <NoAccessCard />;

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <CalendarClock className="h-6 w-6 text-honey-700 print:hidden" /> Shifts &amp; Roster
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-gray-500 print:hidden">Who works when: plan the week, set up shift times and shop holidays.</p>
        </div>
        <div role="tablist" aria-label="Section" className="flex gap-1 overflow-x-auto rounded-xl bg-white border border-gray-200 p-1 print:hidden self-start sm:self-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => pick(t.key)}
              className={`flex-shrink-0 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${tab === t.key ? 'bg-gray-950 text-honey-400' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'roster' && <RosterTab onOpenShifts={() => pick('shifts')} />}
      {tab === 'shifts' && <ShiftsTab />}
      {tab === 'holidays' && <HolidaysTab />}
    </div>
  );
}
