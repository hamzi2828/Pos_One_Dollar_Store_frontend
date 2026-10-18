// Tab bar shared across every report page. Each tab shows only when the
// user's role has that report's permission (same keys as the sidebar).
'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Wallet,
  TrendingUp,
  LineChart,
  AlertCircle,
  Boxes,
  Receipt,
  TrendingDown,
  CalendarRange,
  Hourglass,
  Footprints,
  Target,
  Calculator,
  Route,
} from 'lucide-react';
import { useAccess } from '@/context/AccessContext';

const TABS = [
  { href: '/admin/reports/sales', label: 'Sales Reports', icon: TrendingUp, perm: 'report_sales' },
  { href: '/admin/reports/cost-analysis', label: 'Cost Analysis', icon: LineChart, perm: 'report_cost_analysis' },
  { href: '/admin/reports/stock', label: 'Stock', icon: Boxes, perm: 'report_stock' },
  { href: '/admin/reports/demand', label: 'Demand List', icon: TrendingDown, perm: 'report_demand' },
  { href: '/admin/reports/slow-moving', label: 'Slow Moving', icon: Hourglass, perm: 'report_slow_moving' },
  { href: '/admin/reports/trends', label: 'Sales Trends', icon: CalendarRange, perm: 'report_trends' },
  { href: '/admin/reports/footfall', label: 'Footfall', icon: Footprints, perm: 'report_footfall' },
  { href: '/admin/reports/category-performance', label: 'Category Performance', icon: Target, perm: 'report_category_performance' },
  { href: '/admin/reports/expenses', label: 'Expenses', icon: Receipt, perm: 'report_expenses' },
  { href: '/admin/reports/receivables', label: 'Receivables', icon: AlertCircle, perm: 'report_receivables' },
  { href: '/admin/reports/cash-in-hand', label: 'Cash in Hand', icon: Wallet, perm: 'report_cash_in_hand' },
  { href: '/admin/reports/cash-closing', label: 'Cash Closing', icon: Calculator, perm: 'report_cash_closing' },
  { href: '/admin/reports/stock-timeline', label: 'Stock Timeline', icon: Route, perm: 'report_stock_movement' },
];

export default function ReportsNav() {
  const pathname = usePathname();
  const { can } = useAccess();
  const activeRef = useRef<HTMLAnchorElement>(null);
  const tabs = TABS.filter((t) => can(t.perm, 'view'));

  // Keep the current tab visible when the bar scrolls sideways (phones).
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [pathname]);

  if (!tabs.length) return null;
  return (
    <nav aria-label="Reports" className="bg-white rounded-lg border border-gray-200 p-1 overflow-x-auto">
      <div className="flex items-center gap-1 min-w-max">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = pathname === t.href || pathname?.startsWith(`${t.href}/`);
          return (
            <Link
              key={t.href}
              href={t.href}
              ref={isActive ? activeRef : undefined}
              aria-current={isActive ? 'page' : undefined}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                isActive ? 'bg-honey-500 text-gray-900' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
