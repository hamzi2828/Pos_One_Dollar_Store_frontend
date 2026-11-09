'use client';

// Demand & Trends (owner, 2026-11-09): the Demand List and Sales Trends reports in one page,
// as two tabs. ?tab=demand | trends picks the tab (?productId= opens Sales trends).

import { useEffect, useState } from 'react';
import { CalendarRange, TrendingDown, LineChart } from 'lucide-react';
import ReportsNav from '../components/ReportsNav';
import { useAccess } from '@/context/AccessContext';
import { LoadingCard, NoAccessCard } from '@/components/admin/FormBits';
import { PageHeader } from '../demand/_shared/reportKit';
import DemandView from '../demand/DemandView';
import TrendsView from './TrendsView';

type Tab = 'demand' | 'trends';

export default function DemandTrendsPage() {
  const { can, loaded } = useAccess();
  const canDemand = can('report_demand', 'view');
  const canTrends = can('report_trends', 'view');
  const [tab, setTab] = useState<Tab | null>(null);

  useEffect(() => {
    if (!loaded) return;
    const q = new URLSearchParams(window.location.search);
    const want: Tab = q.get('tab') === 'trends' || q.get('productId') ? 'trends' : q.get('tab') === 'demand' ? 'demand' : canDemand ? 'demand' : 'trends';
    setTab(want === 'demand' && !canDemand ? 'trends' : want === 'trends' && !canTrends ? 'demand' : want);
  }, [loaded, canDemand, canTrends]);

  const open = (t: Tab) => {
    setTab(t);
    const q = new URLSearchParams(window.location.search);
    q.set('tab', t);
    if (t === 'demand') q.delete('productId');
    window.history.replaceState(null, '', `?${q.toString()}`);
  };

  if (!loaded) return <LoadingCard text="Loading…" />;
  if (!canDemand && !canTrends) return <NoAccessCard />;

  const tabs = [
    canDemand && { key: 'demand' as const, label: 'Demand list', hint: 'What to buy now', Icon: TrendingDown },
    canTrends && { key: 'trends' as const, label: 'Sales trends', hint: 'What sells, month by month', Icon: LineChart },
  ].filter(Boolean) as { key: Tab; label: string; hint: string; Icon: typeof TrendingDown }[];

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader icon={<CalendarRange className="h-6 w-6" />} title="Demand & Trends" subtitle="What to reorder now, and which months and products sell more." />
      <ReportsNav />

      {tabs.length > 1 && (
        <div className="grid grid-cols-2 gap-2 sm:max-w-xl">
          {tabs.map(({ key, label, hint, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => open(key)}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                tab === key ? 'border-honey-500 bg-honey-50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${tab === key ? 'bg-honey-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className={`block text-sm font-semibold ${tab === key ? 'text-honey-900' : 'text-gray-800'}`}>{label}</span>
                <span className="block truncate text-[11px] text-gray-500">{hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {tab === 'demand' && <DemandView embedded />}
      {tab === 'trends' && <TrendsView embedded />}
    </div>
  );
}
