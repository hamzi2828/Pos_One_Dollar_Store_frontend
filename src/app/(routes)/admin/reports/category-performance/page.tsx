'use client';

// Category Performance — net sales, profit and target progress per product
// category, and each assigned employee's credited sales (category sales ×
// their share) on a leaderboard.

import Link from 'next/link';
import toast from 'react-hot-toast';
import { Target, Trophy, Medal, UserPlus, Download } from 'lucide-react';
import ReportsNav from '../components/ReportsNav';
import { useAccess } from '@/context/AccessContext';
import { HelpBox, LoadingCard, NoAccessCard } from '@/components/admin/FormBits';
import {
  PageHeader,
  FilterBar,
  StatCard,
  Card,
  EmptyState,
  ErrorState,
  LoadingBlock,
  ReportActions,
  ProgressBar,
  DateRangePicker,
  useDateRange,
  useReport,
  downloadCsv,
  buildPdf,
  formatRs,
  fmtNum,
  fmtPct,
} from '../demand/_shared/reportKit';

interface CatEmployee {
  employeeId: string;
  name: string;
  sharePct: number;
  credited: number;
  target: number;
  progressPct: number | null;
}
interface CatRow {
  category: string;
  assigned: boolean;
  qty: number;
  giftQty: number;
  revenue: number;
  cost: number;
  profit: number;
  marginPct: number | null;
  salesSharePct: number | null;
  target: number;
  targetPct: number | null;
  employees: CatEmployee[];
}
interface EmpRow {
  employeeId: string;
  name: string;
  position: string;
  isActive: boolean;
  credited: number;
  profit: number;
  qty: number;
  target: number;
  progressPct: number | null;
  rank: number;
  categories: { category: string; credited: number; target: number; sharePct: number }[];
}
interface PerfData {
  range: { from: string; to: string; days: number; months: number };
  summary: {
    revenue: number;
    profit: number;
    marginPct: number | null;
    qty: number;
    categories: number;
    assignedCategories: number;
    assignedRevenue: number;
    assignedPct: number | null;
    unassignedRevenue: number;
    target: number;
    targetPct: number | null;
    employees: number;
    topEmployee: { name: string; credited: number } | null;
  };
  categories: CatRow[];
  employees: EmpRow[];
}

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Trophy className="h-4 w-4 text-amber-500" aria-label="First" />;
  if (rank <= 3) return <Medal className={`h-4 w-4 ${rank === 2 ? 'text-gray-400' : 'text-orange-400'}`} aria-label={`Rank ${rank}`} />;
  return <span className="w-4 text-center text-xs text-gray-400 tabular-nums">{rank}</span>;
}

export default function CategoryPerformancePage() {
  const { can, loaded } = useAccess();
  const canView = can('report_category_performance', 'view');
  const canExport = can('report_category_performance', 'export');
  const canAssign = can('category_assignments', 'edit');

  const dr = useDateRange('month');
  const range = dr.range;
  const params = { from: range?.from, to: range?.to };
  const r = useReport<PerfData>('/analytics/category-performance', params, canView && !!range);
  const d = r.data;
  const s = d?.summary;

  const exportCsv = async (part?: 'employees') => {
    try {
      await downloadCsv('/analytics/category-performance/export', { ...params, part }, `${part === 'employees' ? 'employee-progress' : 'category-performance'}-${range?.from}-${range?.to}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const exportPdf = () => {
    if (!d || !s) return;
    buildPdf({
      title: 'Category Performance',
      subtitle: range?.label,
      summary: [
        ['Net sales', formatRs(s.revenue)],
        ['Profit', `${formatRs(s.profit)} (${fmtPct(s.marginPct)})`],
        ['Sales with staff assigned', `${formatRs(s.assignedRevenue)} (${fmtPct(s.assignedPct)})`],
        ['Target', s.target ? `${formatRs(s.target)} · ${fmtPct(s.targetPct)} reached` : '-'],
      ],
      tables: [
        {
          title: 'Employee leaderboard',
          head: ['#', 'Employee', 'Credited sales', 'Target', 'Progress %', 'Categories'],
          widths: [8, 40, 28, 25, 20, 70],
          rows: d.employees.map((e) => [e.rank, e.name, e.credited, e.target, e.progressPct, e.categories.map((c) => `${c.category} ${c.sharePct}%`).join(', ')]),
        },
        {
          title: 'Categories',
          head: ['Category', 'Pieces', 'Net sales', 'Profit', 'Margin %', 'Target', 'Target %', 'Staff'],
          widths: [40, 15, 25, 22, 15, 22, 15, 55],
          rows: d.categories.map((c) => [c.category, c.qty, c.revenue, c.profit, c.marginPct, c.target || null, c.targetPct, c.employees.map((e) => `${e.name} ${e.sharePct}%`).join(', ')]),
        },
      ],
      fileName: `category-performance-${range?.from}-${range?.to}`,
    });
  };

  if (!loaded) return <LoadingCard text="Loading…" />;
  if (!canView) return <NoAccessCard />;

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        icon={<Target className="h-6 w-6" />}
        title="Category Performance"
        subtitle="Sales by product category and each employee's progress from the categories they look after."
        actions={
          <>
            {canExport && (
              <button type="button" onClick={() => exportCsv('employees')} disabled={!d} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-60">
                <Download className="h-4 w-4" /> Staff CSV
              </button>
            )}
            <ReportActions canExport={canExport} onCsv={() => exportCsv()} onPdf={exportPdf} onRefresh={r.reload} loading={r.loading} disabled={!d} />
          </>
        }
      />
      <ReportsNav />

      <FilterBar>
        <DateRangePicker state={dr} presets={['month', 'lastMonth', '7d', '30d', '90d', 'year', 'custom']} />
        {canAssign && (
          <Link href="/admin/hr/category-staff" className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-honey-700 hover:text-honey-700">
            <UserPlus className="h-4 w-4" /> Assign staff
          </Link>
        )}
      </FilterBar>

      {!range && <ErrorState message="Pick both dates of the custom range." />}
      {r.error && <ErrorState message={r.error} onRetry={r.reload} />}

      {!d && r.loading ? (
        <LoadingBlock />
      ) : d && s ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
            <StatCard label="Net sales" value={formatRs(s.revenue)} hint={`${fmtNum(s.qty)} pieces`} />
            <StatCard label="Profit" value={formatRs(s.profit)} tone={s.profit < 0 ? 'bad' : 'good'} hint={`${fmtPct(s.marginPct)} margin`} />
            <StatCard label="With staff assigned" value={fmtPct(s.assignedPct)} hint={`${s.assignedCategories} of ${s.categories} categories`} />
            <StatCard label="Target" value={s.target ? formatRs(s.target) : '—'} hint={d.range.months !== 1 ? `${fmtNum(d.range.months, 2)} months` : 'this period'} />
            <StatCard label="Target reached" value={fmtPct(s.targetPct)} tone={s.targetPct !== null && s.targetPct >= 100 ? 'good' : 'default'} />
            <StatCard label="Top employee" value={s.topEmployee ? s.topEmployee.name : '—'} hint={s.topEmployee ? formatRs(s.topEmployee.credited) : undefined} />
          </div>

          <HelpBox>
            An employee is credited with the category&apos;s net sales × their share (equal split when no shares are set). Monthly targets are
            pro-rated for the days picked.
          </HelpBox>

          <Card title="Employee leaderboard" subtitle={`${d.employees.length} employee${d.employees.length === 1 ? '' : 's'} with categories`}>
            {d.employees.length === 0 ? (
              <EmptyState
                title="No staff assigned to categories yet"
                text={canAssign ? 'Use “Assign staff” to give each category one or more employees and a monthly target.' : 'Ask an admin to assign staff to categories.'}
              />
            ) : (
              <ul className="divide-y divide-gray-100">
                {d.employees.map((e) => (
                  <li key={e.employeeId} className="px-3 sm:px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <div className="flex items-center gap-3 sm:w-64 min-w-0">
                      <RankIcon rank={e.rank} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {e.name}
                          {!e.isActive && <span className="ml-1 text-[10px] text-gray-400">(inactive)</span>}
                        </p>
                        <p className="text-[11px] text-gray-500 truncate">{e.position || e.categories.map((c) => c.category).join(', ')}</p>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2 text-xs mb-1">
                        <span className="font-semibold text-gray-900">{formatRs(e.credited)}</span>
                        <span className="text-gray-500">{e.target ? `of ${formatRs(e.target)}` : 'no target'}</span>
                      </div>
                      <ProgressBar pct={e.progressPct} label={`${e.name} progress`} />
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {e.categories.map((c) => (
                          <span key={c.category} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                            {c.category} · {fmtNum(c.sharePct, 1)}% · {formatRs(c.credited)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Categories" subtitle="Biggest sellers first">
            {d.categories.length === 0 ? (
              <EmptyState title="No sales in this period" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-[11px] uppercase text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Category</th>
                      <th className="px-3 py-2 text-right">Pieces</th>
                      <th className="px-3 py-2 text-right">Net sales</th>
                      <th className="px-3 py-2 text-right">Profit</th>
                      <th className="px-3 py-2 text-left min-w-[180px]">Target</th>
                      <th className="px-3 py-2 text-left">Staff (credited)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {d.categories.map((c) => (
                      <tr key={c.category} className="align-top hover:bg-gray-50">
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-gray-900">{c.category}</p>
                          <p className="text-[11px] text-gray-500">{fmtPct(c.salesSharePct)} of sales</p>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {fmtNum(c.qty)}
                          {c.giftQty > 0 && <p className="text-[10px] text-gray-400">{c.giftQty} gifts</p>}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatRs(c.revenue)}</td>
                        <td className={`px-3 py-2.5 text-right tabular-nums ${c.profit < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                          {formatRs(c.profit)}
                          <p className="text-[10px] text-gray-400">{fmtPct(c.marginPct)}</p>
                        </td>
                        <td className="px-3 py-2.5">
                          {c.target ? (
                            <>
                              <ProgressBar pct={c.targetPct} label={`${c.category} target`} />
                              <p className="text-[10px] text-gray-500 mt-0.5">target {formatRs(c.target)}</p>
                            </>
                          ) : (
                            <span className="text-xs text-gray-400">No target</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-xs">
                          {c.employees.length ? (
                            <ul className="space-y-0.5">
                              {c.employees.map((e) => (
                                <li key={e.employeeId} className="whitespace-nowrap">
                                  {e.name} <span className="text-gray-400">{fmtNum(e.sharePct, 1)}%</span> · {formatRs(e.credited)}
                                </li>
                              ))}
                            </ul>
                          ) : canAssign ? (
                            <Link href="/admin/hr/category-staff" className="text-honey-700 hover:underline">
                              Assign staff
                            </Link>
                          ) : (
                            <span className="text-gray-400">Not assigned</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}
