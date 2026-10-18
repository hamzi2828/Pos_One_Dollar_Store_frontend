// Tab bar shared across every report page.
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Wallet,
  TrendingUp,
  Package,
  LineChart,
  AlertCircle,
  Wrench,
  Boxes,
  Receipt,
  Building2,
  Briefcase,
} from 'lucide-react';

const TABS = [
  { href: '/admin/reports/sales', label: 'Sales Reports', icon: TrendingUp },
  { href: '/admin/reports/purchases', label: 'Purchase Reports', icon: Package },
  { href: '/admin/reports/cost-analysis', label: 'Cost Analysis', icon: LineChart },
  { href: '/admin/reports/stock', label: 'Stock', icon: Boxes },
  { href: '/admin/reports/expenses', label: 'Expenses', icon: Receipt },
  { href: '/admin/reports/vendor-payments', label: 'Vendor Payments', icon: Building2 },
  { href: '/admin/reports/receivables', label: 'Receivables', icon: AlertCircle },
  { href: '/admin/reports/cash-in-hand', label: 'Cash in Hand', icon: Wallet },
];

export default function ReportsNav() {
  const pathname = usePathname();
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-1 overflow-x-auto">
      <div className="flex items-center gap-1 min-w-max">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = pathname === t.href || pathname?.startsWith(`${t.href}/`);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-[#DC2626] text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
