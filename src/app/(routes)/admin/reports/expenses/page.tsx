'use client';

// Expense Report — daily / weekly / monthly expense totals (Pakistan time) per
// category. Items taken from our own stock for the shop ("shop use") are listed
// separately and are part of the totals.

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Receipt, Download, PackageOpen } from 'lucide-react';
import ReportsNav from '../components/ReportsNav';
import { useAccess } from '@/context/AccessContext';
import { LoadingCard, NoAccessCard } from '@/components/admin/FormBits';
import {
  PageHeader,
  FilterBar,
  SearchBox,
  StatCard,
  Card,
  EmptyState,
  ErrorState,
  LoadingBlock,
  ReportActions,
  Pager,
  BarChart,
  DateRangePicker,
  useDateRange,
  useReport,
  useDebounced,
  downloadCsv,
  buildPdf,
  formatRs,
  fmtNum,
  fmtPct,
  fmtDate,
  fmtShortRs,
  selectClass,
} from '../demand/_shared/reportKit';
import { SearchSelect } from '@/components/ui/SearchSelect';

type GroupBy = 'day' | 'week' | 'month';

interface ExpenseRow {
  _id: string;
  title: string;
  amount: number;
  category: string;
  date: string;
  paymentMethod?: string;
  reference?: string;
  notes?: string;
  source?: string;
  sourceType?: string;
}
interface ExpenseData {
  range: { from: string; to: string; days: number; groupBy: GroupBy };
  summary: {
    total: number;
    count: number;
    shopUse: number;
    shopUseCount: number;
    other: number;
    shopUsePct: number | null;
    periods: number;
    activePeriods: number;
    avgPerPeriod: number;
    avgPerDay: number;
    topCategory: { category: string; total: number } | null;
  };
  periods: { key: string; label: string; total: number; shopUse: number; other: number; count: number; categories: Record<string, number> }[];
  categoriesInPeriods: string[];
  byCategory: { category: string; total: number; shopUse: number; count: number; pct: number | null }[];
  bySource: { source: string; total: number; count: number }[];
  shopUse: ExpenseRow[];
  expenses: ExpenseRow[];
}

const PERIOD_NAME: Record<GroupBy, string> = { day: 'Day', week: 'Week', month: 'Month' };

export default function ExpenseReportPage() {
  const { can, loaded } = useAccess();
  const canView = can('report_expenses', 'view');
  const canExport = can('report_expenses', 'export');

  const dr = useDateRange('month');
  const range = dr.range;
  const [picked, setGroupBy] = useState<GroupBy>('day');
  const [category, setCategory] = useState('');
  const [source, setSource] = useState('');
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [page, setPage] = useState(1);
  const [knownCats, setKnownCats] = useState<string[]>([]);

  // A daily view of a long range is too wide: show weeks instead.
  const tooLongForDays = range ? dayCount(range.from, range.to) > 120 : false;
  const groupBy: GroupBy = picked === 'day' && tooLongForDays ? 'week' : picked;
  const filters = { from: range?.from, to: range?.to, groupBy, category, source, search: debounced };
  const filterKey = JSON.stringify(filters);
  useEffect(() => setPage(1), [filterKey]);
  const r = useReport<ExpenseData>('/analytics/expenses', { ...filters, page, limit: 25 }, canView && !!range);
  const d = r.data;
  const s = d?.summary;
  // Keep every category seen so the dropdown does not shrink when one is picked.
  useEffect(() => {
    if (!d) return;
    setKnownCats((prev) => [...new Set([...prev, ...d.byCategory.map((c) => c.category)])].sort());
  }, [d]);

  const exportCsv = async (part?: 'periods') => {
    try {
      await downloadCsv('/analytics/expenses/export', { ...filters, part }, part ? `expenses-by-${groupBy}-${range?.from}-${range?.to}` : `expenses-${range?.from}-${range?.to}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const exportPdf = () => {
    if (!d || !s) return;
    buildPdf({
      title: 'Expense Report',
      subtitle: `${range?.label} · by ${groupBy}`,
      summary: [
        ['Total', formatRs(s.total)],
        ['Entries', fmtNum(s.count)],
        ['Shop use (from stock)', `${formatRs(s.shopUse)} (${fmtPct(s.shopUsePct)})`],
        ['Other expenses', formatRs(s.other)],
        [`Average per ${groupBy}`, formatRs(s.avgPerPeriod)],
        ['Top category', s.topCategory ? `${s.topCategory.category} ${formatRs(s.topCategory.total)}` : '-'],
      ],
      tables: [
        {
          title: `By ${groupBy}`,
          head: [PERIOD_NAME[groupBy], 'Entries', 'Other', 'Shop use', 'Total'],
          widths: [50, 20, 30, 30, 30],
          rows: d.periods.map((p) => [p.label, p.count, p.other, p.shopUse, p.total]),
        },
        {
          title: 'By category',
          head: ['Category', 'Entries', 'Shop use', 'Total', '% of total'],
          widths: [60, 20, 30, 30, 20],
          rows: d.byCategory.map((c) => [c.category, c.count, c.shopUse, c.total, c.pct]),
        },
        {
          title: 'Taken from shop stock (shop use)',
          head: ['Date', 'Item', 'Category', 'Amount'],
          widths: [25, 90, 40, 25],
          rows: d.shopUse.map((e) => [fmtDate(e.date), e.title, e.category, e.amount]),
        },
      ],
      fileName: `expenses-${range?.from}-${range?.to}`,
    });
  };

  if (!loaded) return <LoadingCard text="Loading…" />;
  if (!canView) return <NoAccessCard />;

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        icon={<Receipt className="h-6 w-6" />}
        title="Expense Report"
        subtitle="Daily, weekly or monthly spending by category — shop use from our own stock shown separately."
        actions={
          <>
            {canExport && (
              <button type="button" onClick={() => exportCsv('periods')} disabled={!d} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-60">
                <Download className="h-4 w-4" /> Totals CSV
              </button>
            )}
            <ReportActions canExport={canExport} onCsv={() => exportCsv()} onPdf={exportPdf} onRefresh={r.reload} loading={r.loading} disabled={!d} />
          </>
        }
      />
      <ReportsNav />

      <FilterBar>
        <DateRangePicker state={dr} />
        <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden" role="group" aria-label="Group by">
          {(['day', 'week', 'month'] as GroupBy[]).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGroupBy(g)}
              aria-pressed={groupBy === g}
              disabled={g === 'day' && tooLongForDays}
              title={g === 'day' && tooLongForDays ? 'Pick 120 days or less for a daily view' : undefined}
              className={`px-3 py-2 text-sm disabled:opacity-40 ${groupBy === g ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              {g === 'day' ? 'Daily' : g === 'week' ? 'Weekly' : 'Monthly'}
            </button>
          ))}
        </div>
        <SearchSelect value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass} aria-label="Category">
          <option value="">All categories</option>
          {knownCats.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </SearchSelect>
        <SearchSelect value={source} onChange={(e) => setSource(e.target.value)} className={selectClass} aria-label="Type">
          <option value="">All expenses</option>
          <option value="shop_use">Shop use only</option>
          <option value="other">Without shop use</option>
        </SearchSelect>
        <SearchBox value={search} onChange={setSearch} placeholder="Title, reference, note" />
      </FilterBar>

      {!range && <ErrorState message="Pick both dates of the custom range." />}
      {r.error && <ErrorState message={r.error} onRetry={r.reload} />}

      {!d && r.loading ? (
        <LoadingBlock />
      ) : d && s ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
            <StatCard label="Total spent" value={formatRs(s.total)} tone="bad" hint={`${fmtNum(s.count)} entries`} />
            <StatCard label="Other expenses" value={formatRs(s.other)} />
            <StatCard label="Shop use (from stock)" value={formatRs(s.shopUse)} tone="warn" hint={`${fmtPct(s.shopUsePct)} · ${s.shopUseCount} items`} />
            <StatCard label={`Average per ${groupBy}`} value={formatRs(s.avgPerPeriod)} hint={`${s.activePeriods} of ${s.periods} with spending`} />
            <StatCard label="Average per day" value={formatRs(s.avgPerDay)} />
            <StatCard label="Top category" value={s.topCategory?.category || '—'} hint={s.topCategory ? formatRs(s.topCategory.total) : undefined} />
          </div>

          {s.count === 0 ? (
            <Card>
              <EmptyState title="No expenses in this period" text="Pick another period or clear the filters." />
            </Card>
          ) : (
            <>
              <Card title={`Spending by ${groupBy}`} subtitle="Other expenses and shop use (Rs)" bodyClass="p-3 sm:p-4">
                <BarChart
                  series={['Other expenses', 'Shop use']}
                  format={fmtShortRs}
                  data={d.periods.map((p) => ({
                    label: groupBy === 'day' ? String(Number(p.key.slice(8))) : groupBy === 'week' ? p.label.split(' – ')[0] : p.label.split(' ')[0],
                    values: [p.other, p.shopUse],
                    tip: `${p.label}: ${formatRs(p.total)} (${p.count} entries${p.shopUse ? `, shop use ${formatRs(p.shopUse)}` : ''})`,
                  }))}
                />
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
                <Card title="By category" className="lg:col-span-1">
                  <ul className="divide-y divide-gray-100 max-h-[26rem] overflow-y-auto">
                    {d.byCategory.map((c) => (
                      <li key={c.category} className="px-3 py-2">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="text-gray-800 truncate">{c.category}</span>
                          <span className="font-semibold text-gray-900 tabular-nums">{formatRs(c.total)}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden" aria-hidden>
                            <div className="h-full bg-[#2a78d6]" style={{ width: `${Math.min(100, c.pct || 0)}%` }} />
                          </div>
                          <span className="text-[10px] text-gray-500 w-10 text-right">{fmtPct(c.pct)}</span>
                        </div>
                        {c.shopUse > 0 && <p className="text-[10px] text-amber-700 mt-0.5">incl. shop use {formatRs(c.shopUse)}</p>}
                      </li>
                    ))}
                  </ul>
                </Card>

                <Card title={`Totals per ${groupBy}`} className="lg:col-span-2">
                  <div className="overflow-x-auto max-h-[26rem]">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-[11px] uppercase text-gray-500 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left">{PERIOD_NAME[groupBy]}</th>
                          {d.categoriesInPeriods.map((c) => (
                            <th key={c} className="px-3 py-2 text-right whitespace-nowrap">
                              {c}
                            </th>
                          ))}
                          <th className="px-3 py-2 text-right">Shop use</th>
                          <th className="px-3 py-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {[...d.periods].reverse().map((p) => (
                          <tr key={p.key} className={p.total ? 'hover:bg-gray-50' : 'text-gray-400'}>
                            <td className="px-3 py-2 whitespace-nowrap">{p.label}</td>
                            {d.categoriesInPeriods.map((c) => (
                              <td key={c} className="px-3 py-2 text-right tabular-nums">
                                {p.categories[c] ? formatRs(p.categories[c]) : '—'}
                              </td>
                            ))}
                            <td className="px-3 py-2 text-right tabular-nums text-amber-700">{p.shopUse ? formatRs(p.shopUse) : '—'}</td>
                            <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatRs(p.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>

              <Card title="Taken from shop stock" subtitle="Items used by the shop itself — posted as expenses at cost">
                {d.shopUse.length === 0 ? (
                  <EmptyState icon={<PackageOpen className="h-10 w-10" />} title="No shop use in this period" />
                ) : (
                  <ExpenseTable rows={d.shopUse} />
                )}
              </Card>

              <Card title="All expenses" subtitle={`${fmtNum(r.meta?.total ?? d.expenses.length)} entries, newest first`}>
                <ExpenseTable rows={d.expenses} />
                <Pager meta={r.meta} onPage={setPage} />
              </Card>
            </>
          )}
        </>
      ) : null}
    </div>
  );
}

function dayCount(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;
}

function ExpenseTable({ rows }: { rows: ExpenseRow[] }) {
  if (!rows.length) return <EmptyState title="No expenses match these filters" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-[11px] uppercase text-gray-500">
          <tr>
            <th className="px-3 py-2 text-left">Date</th>
            <th className="px-3 py-2 text-left">Title</th>
            <th className="px-3 py-2 text-left">Category</th>
            <th className="px-3 py-2 text-left">Method / ref</th>
            <th className="px-3 py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((e) => (
            <tr key={e._id} className="hover:bg-gray-50 align-top">
              <td className="px-3 py-2 whitespace-nowrap text-gray-600">{fmtDate(e.date)}</td>
              <td className="px-3 py-2">
                <p className="font-medium text-gray-900">{e.title}</p>
                {e.source === 'shop_use' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-800">Shop use</span>}
                {e.notes && <p className="text-[11px] text-gray-500">{e.notes}</p>}
              </td>
              <td className="px-3 py-2">{e.category}</td>
              <td className="px-3 py-2 text-xs text-gray-500">
                {[e.paymentMethod, e.reference].filter(Boolean).join(' · ') || '—'}
              </td>
              <td className="px-3 py-2 text-right font-semibold text-red-700 tabular-nums">{formatRs(e.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
