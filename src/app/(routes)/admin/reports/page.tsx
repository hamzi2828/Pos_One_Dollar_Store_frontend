'use client';

// Reports home: one card per report the role can see. Click a card to open it;
// every report has an "All reports" link back here.
import Link from 'next/link';
import { BarChart3, ChevronRight } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { REPORTS } from './components/ReportsNav';

const GROUPS = ['Sales', 'Money', 'Stock'] as const;

export default function ReportsHome() {
  const { can } = useAccess();
  const list = REPORTS.filter((r) => can(r.perm, 'view'));

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-3 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-honey-100 text-honey-800">
          <BarChart3 className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500">Pick a report to open it.</p>
        </div>
      </div>

      {list.length === 0 && <p className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">You do not have access to any report.</p>}

      {GROUPS.map((g) => {
        const items = list.filter((r) => r.group === g);
        if (!items.length) return null;
        return (
          <section key={g}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{g}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((r) => {
                const Icon = r.icon;
                return (
                  <Link
                    key={r.href}
                    href={r.href}
                    className="group flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 transition hover:border-honey-300 hover:shadow-md"
                  >
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-honey-50 text-honey-700 group-hover:bg-honey-500 group-hover:text-gray-900">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-gray-900">{r.label}</span>
                      <span className="mt-0.5 block text-xs text-gray-500">{r.about}</span>
                    </span>
                    <ChevronRight className="mt-2 h-4 w-4 flex-shrink-0 text-gray-300 group-hover:text-honey-700" />
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
