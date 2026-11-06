// Reports: one list used by the Reports home (cards) and by each report's
// "All reports" back link. A report shows only when the role has its permission.
'use client';

import Link from 'next/link';
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
  PiggyBank,
  ArrowLeft,
  type LucideIcon,
} from 'lucide-react';

export interface ReportLink {
  href: string;
  label: string;
  icon: LucideIcon;
  perm: string;
  about: string;
  group: 'Sales' | 'Stock' | 'Money';
}

export const REPORTS: ReportLink[] = [
  { href: '/admin/reports/sales', label: 'Sales Reports', icon: TrendingUp, perm: 'report_sales', about: 'Every bill: total, cost, profit by day, week or month.', group: 'Sales' },
  { href: '/admin/reports/trends', label: 'Sales Trends', icon: CalendarRange, perm: 'report_trends', about: 'Sales day by day and how they change.', group: 'Sales' },
  { href: '/admin/reports/footfall', label: 'Footfall', icon: Footprints, perm: 'report_footfall', about: 'Busy hours and days, bills and buyers.', group: 'Sales' },
  { href: '/admin/reports/category-performance', label: 'Category Performance', icon: Target, perm: 'report_category_performance', about: 'Which categories sell and earn the most.', group: 'Sales' },
  { href: '/admin/reports/cost-analysis', label: 'Cost Analysis', icon: LineChart, perm: 'report_cost_analysis', about: 'Cost, profit and margin of what was sold.', group: 'Sales' },
  { href: '/admin/reports/stock', label: 'Stock', icon: Boxes, perm: 'report_stock', about: 'Stock on hand and its value.', group: 'Stock' },
  { href: '/admin/reports/demand', label: 'Demand List', icon: TrendingDown, perm: 'report_demand', about: 'Items running low that need ordering.', group: 'Stock' },
  { href: '/admin/reports/slow-moving', label: 'Slow Moving', icon: Hourglass, perm: 'report_slow_moving', about: 'Items that are not selling.', group: 'Stock' },
  { href: '/admin/reports/stock-timeline', label: 'Stock Timeline', icon: Route, perm: 'report_stock_movement', about: 'Every move of one item: in, sold, moved, damaged.', group: 'Stock' },
  { href: '/admin/reports/cash-closing', label: 'Cash Closing', icon: Calculator, perm: 'report_cash_closing', about: 'Each till: cash, POS, bank, expenses, over / short.', group: 'Money' },
  { href: '/admin/reports/cash-in-hand', label: 'Cash in Hand', icon: Wallet, perm: 'report_cash_in_hand', about: 'Cash taken in and paid out.', group: 'Money' },
  { href: '/admin/reports/spending', label: 'Spending', icon: PiggyBank, perm: 'report_expenses', about: 'Bought, paid to vendors, money left (cash + bank).', group: 'Money' },
  { href: '/admin/reports/expenses', label: 'Expenses', icon: Receipt, perm: 'report_expenses', about: 'Shop expenses by day, week or month.', group: 'Money' },
  { href: '/admin/reports/receivables', label: 'Receivables', icon: AlertCircle, perm: 'report_receivables', about: 'Money customers still owe.', group: 'Money' },
];

/** Shown at the top of every report: back to the Reports home. */
export default function ReportsNav() {
  return (
    <Link
      href="/admin/reports"
      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
    >
      <ArrowLeft className="h-4 w-4" /> All reports
    </Link>
  );
}
