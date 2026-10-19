'use client';

// Sales Trends & Seasonality — monthly net sales / profit / pieces for the last
// 12–36 months, a category × month heatmap, the best sellers of every calendar
// month and one product's months against the year before.

import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { CalendarRange, Download, Loader2, X, Sun } from 'lucide-react';
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
  BarChart,
  LineChart,
  Heatmap,
  Sparkline,
  useReport,
  useDebounced,
  useFilterOptions,
  useQueryParam,
  downloadCsv,
  buildPdf,
  formatRs,
  fmtNum,
  fmtPct,
  fmtMonth,
  fmtShortRs,
  pktToday,
  selectClass,
} from '../demand/_shared/reportKit';
import { SearchSelect } from '@/components/ui/SearchSelect';

interface Money {
  qty: number;
  giftQty: number;
  revenue: number;
  cost: number;
  profit: number;
}
interface MonthRow extends Money {
  month: string;
}
interface TrendsData {
  months: string[];
  monthly: (MonthRow & { bills: number; billTotal: number; marginPct: number | null })[];
  categories: { category: string; total: Money; months: MonthRow[]; peakMonth: string | null }[];
  products: { productId: string; name: string; category: string; total: Money; months: MonthRow[] }[];
  seasonality: { month: number; label: string; qty: number; revenue: number; top: { productId: string; name: string; qty: number; revenue: number }[] }[];
  summary: Money & {
    bills: number;
    marginPct: number | null;
    avgMonthlyRevenue: number;
    bestMonth: string | null;
    worstMonth: string | null;
    productsSold: number;
    categories: number;
  };
  generatedAt?: string;
}

interface ProductTrend {
  productId: string;
  name: string | null;
  category: string | null;
  months: (MonthRow & { prevYear: Money; yoyPct: number | null })[];
  bestMonths: string[];
}

type Metric = 'revenue' | 'qty' | 'profit';
const METRIC_LABEL: Record<Metric, string> = { revenue: 'Net sales', qty: 'Pieces', profit: 'Profit' };

export default function TrendsPage() {
  const { can, loaded } = useAccess();
  const canView = can('report_trends', 'view');
  const canExport = can('report_trends', 'export');

  const opts = useFilterOptions(canView);
  const [months, setMonths] = useState('12');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<Metric>('revenue');
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [productId, setProductId] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | undefined>(undefined);
  const fromUrl = useQueryParam('productId');
  useEffect(() => {
    if (fromUrl) setProductId(fromUrl);
  }, [fromUrl]);

  const params = { months, category, sort, search: debounced, fresh };
  const r = useReport<TrendsData>('/analytics/trends', params, canView);
  const d = r.data;
  // One product's months vs the year before (its own small request).
  const pr = useReport<ProductTrend>('/analytics/trends/product', { months, productId: productId || undefined }, canView && !!productId);
  const product = productId && pr.data && pr.data.productId === productId ? pr.data : null;
  const detailRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (productId) detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [productId]);

  // Refresh skips the server's 5-minute cache.
  const refresh = () => {
    setFresh(String(Date.now()));
    if (productId) pr.reload();
  };

  const heat = useMemo(() => {
    if (!d) return null;
    const cats = d.categories.slice(0, 15);
    return {
      rows: cats.map((c) => c.category),
      cols: d.months.map((m) => fmtMonth(m, true)),
      values: cats.map((c) => c.months.map((m) => m[sort])),
    };
  }, [d, sort]);

  const exportPart = async (part: 'products' | 'categories' | 'monthly') => {
    try {
      await downloadCsv('/analytics/trends/export', { ...params, fresh: undefined, part }, `sales-trends-${part}-${pktToday()}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const exportPdf = () => {
    if (!d) return;
    buildPdf({
      title: 'Sales Trends',
      subtitle: `Last ${d.months.length} months${category ? ` · ${category}` : ''}`,
      summary: [
        ['Net sales', formatRs(d.summary.revenue)],
        ['Profit', `${formatRs(d.summary.profit)} (${fmtPct(d.summary.marginPct)})`],
        ['Pieces sold', fmtNum(d.summary.qty)],
        ['Bills', fmtNum(d.summary.bills)],
        ['Best month', d.summary.bestMonth ? fmtMonth(d.summary.bestMonth) : '-'],
        ['Average per month', formatRs(d.summary.avgMonthlyRevenue)],
      ],
      tables: [
        {
          title: 'By month',
          head: ['Month', 'Bills', 'Pieces', 'Net sales', 'Cost', 'Profit', 'Margin %'],
          rows: d.monthly.map((m) => [fmtMonth(m.month), m.bills, m.qty, m.revenue, m.cost, m.profit, m.marginPct]),
        },
        {
          title: `Top ${d.products.length} products by ${METRIC_LABEL[sort].toLowerCase()}`,
          head: ['Product', 'Category', 'Pieces', 'Net sales', 'Profit'],
          widths: [60, 40, 20, 25, 25],
          rows: d.products.map((p) => [p.name, p.category, p.total.qty, p.total.revenue, p.total.profit]),
        },
        {
          title: 'Best sellers by calendar month',
          head: ['Month', 'Top products (pieces)'],
          widths: [20, 150],
          rows: d.seasonality.map((s) => [s.label, s.top.map((t) => `${t.name} (${t.qty})`).join(', ') || '-']),
        },
      ],
      fileName: `sales-trends-${pktToday()}`,
    });
  };

  if (!loaded) return <LoadingCard text="Loading…" />;
  if (!canView) return <NoAccessCard />;

  const thisMonthNum = Number(pktToday().slice(5, 7));

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        icon={<CalendarRange className="h-6 w-6" />}
        title="Sales Trends"
        subtitle="Which months and which products sell more — long-term view in Pakistan time."
        actions={
          <>
            {canExport && (
              <details className="relative">
                <summary className="list-none inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <Download className="h-4 w-4" /> CSV
                </summary>
                <div className="absolute right-0 z-20 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                  {(['products', 'categories', 'monthly'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={(e) => {
                        const menu = e.currentTarget.closest('details');
                        if (menu) menu.open = false;
                        exportPart(p);
                      }}
                      className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 capitalize"
                    >
                      {p === 'monthly' ? 'Months' : p}
                    </button>
                  ))}
                </div>
              </details>
            )}
            <ReportActions canExport={canExport} onPdf={exportPdf} onRefresh={refresh} loading={r.loading} disabled={!d} />
          </>
        }
      />
      <ReportsNav />

      <FilterBar>
        <SearchSelect value={months} onChange={(e) => setMonths(e.target.value)} className={selectClass} aria-label="Months">
          <option value="12">Last 12 months</option>
          <option value="24">Last 24 months</option>
          <option value="36">Last 36 months</option>
        </SearchSelect>
        <SearchSelect value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass} aria-label="Category">
          <option value="">All categories</option>
          {opts.categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </SearchSelect>
        <SearchSelect value={sort} onChange={(e) => setSort(e.target.value as Metric)} className={selectClass} aria-label="Measure">
          <option value="revenue">By net sales</option>
          <option value="qty">By pieces</option>
          <option value="profit">By profit</option>
        </SearchSelect>
        <SearchBox value={search} onChange={setSearch} placeholder="Find a product" />
        {r.loading && d && <Loader2 className="h-4 w-4 animate-spin text-gray-400" aria-label="Updating" />}
      </FilterBar>

      {r.error && <ErrorState message={r.error} onRetry={refresh} />}

      {!d && r.loading ? (
        <LoadingBlock text="Reading every bill of the period…" />
      ) : d ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
            <StatCard label="Net sales" value={formatRs(d.summary.revenue)} hint="after discounts, before tax" />
            <StatCard label="Profit" value={formatRs(d.summary.profit)} tone={d.summary.profit < 0 ? 'bad' : 'good'} hint={`${fmtPct(d.summary.marginPct)} margin`} />
            <StatCard label="Pieces sold" value={fmtNum(d.summary.qty)} hint={d.summary.giftQty ? `${fmtNum(d.summary.giftQty)} as gifts` : undefined} />
            <StatCard label="Bills" value={fmtNum(d.summary.bills)} />
            <StatCard label="Best month" value={d.summary.bestMonth ? fmtMonth(d.summary.bestMonth) : '—'} hint={d.summary.worstMonth ? `slowest ${fmtMonth(d.summary.worstMonth)}` : undefined} />
            <StatCard label="Average / month" value={formatRs(d.summary.avgMonthlyRevenue)} />
          </div>

          {d.summary.qty === 0 ? (
            <Card>
              <EmptyState title="No sales in this period" text="Pick a longer period or clear the category filter." />
            </Card>
          ) : (
            <>
              <Card title="Month by month" subtitle="Net sales and profit (Rs). Hover a month for numbers." bodyClass="p-3 sm:p-4">
                <BarChart
                  series={['Net sales', 'Profit']}
                  data={d.monthly.map((m) => ({
                    label: fmtMonth(m.month, true),
                    values: [m.revenue, Math.max(0, m.profit)],
                    tip: `${fmtMonth(m.month)}: ${formatRs(m.revenue)} sales · ${formatRs(m.profit)} profit · ${fmtNum(m.qty)} pcs · ${fmtNum(m.bills)} bills`,
                  }))}
                />
              </Card>

              {heat && heat.rows.length > 0 && (
                <Card
                  title={`Categories × months (${METRIC_LABEL[sort].toLowerCase()})`}
                  subtitle={d.categories.length > 15 ? `Top 15 of ${d.categories.length} categories` : 'Darker = sells more'}
                  bodyClass="p-3 sm:p-4"
                >
                  <Heatmap
                    rows={heat.rows}
                    cols={heat.cols}
                    values={heat.values}
                    format={sort === 'qty' ? (n) => fmtNum(n) : (n) => fmtShortRs(n).replace('Rs ', '')}
                    cellLabel={(ri, ci) => `${heat.rows[ri]} · ${heat.cols[ci]}: ${sort === 'qty' ? `${fmtNum(heat.values[ri][ci])} pcs` : formatRs(heat.values[ri][ci])}`}
                    minCell={44}
                  />
                </Card>
              )}

              <Card title="Best sellers by calendar month" subtitle="Which products sell most in each month of the year (pieces)" bodyClass="p-3 sm:p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                  {d.seasonality.map((s) => (
                    <div key={s.month} className={`rounded-lg border p-2.5 ${s.month === thisMonthNum ? 'border-honey-300 bg-honey-50/40' : 'border-gray-200'}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-semibold text-gray-800 flex items-center gap-1">
                          {s.month === thisMonthNum && <Sun className="h-3.5 w-3.5 text-honey-700" aria-label="This month" />}
                          {s.label}
                        </span>
                        <span className="text-[11px] text-gray-500">{s.qty ? `${fmtNum(s.qty)} pcs` : 'no sales'}</span>
                      </div>
                      {s.top.length ? (
                        <ol className="space-y-0.5">
                          {s.top.map((t, i) => (
                            <li key={t.productId} className="flex items-center gap-1.5 text-xs">
                              <span className="w-4 text-gray-400 tabular-nums">{i + 1}.</span>
                              <button type="button" onClick={() => setProductId(t.productId)} className="flex-1 truncate text-left text-gray-700 hover:text-honey-700 hover:underline">
                                {t.name}
                              </button>
                              <span className="tabular-nums text-gray-500">{fmtNum(t.qty)}</span>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className="text-xs text-gray-400">—</p>
                      )}
                    </div>
                  ))}
                </div>
              </Card>

              <Card title={`Top products by ${METRIC_LABEL[sort].toLowerCase()}`} subtitle={`${fmtNum(d.summary.productsSold)} products sold · click one for its year-on-year view`}>
                {d.products.length === 0 ? (
                  <EmptyState title="No product matches" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-[11px] uppercase text-gray-500">
                        <tr>
                          <th className="px-3 py-2 text-left">#</th>
                          <th className="px-3 py-2 text-left">Product</th>
                          <th className="px-3 py-2 text-left">Months</th>
                          <th className="px-3 py-2 text-right">Pieces</th>
                          <th className="px-3 py-2 text-right">Net sales</th>
                          <th className="px-3 py-2 text-right">Profit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {d.products.map((p, i) => (
                          <tr key={p.productId} className={`cursor-pointer ${productId === p.productId ? 'bg-honey-50/50' : 'hover:bg-gray-50'}`} onClick={() => setProductId(p.productId)}>
                            <td className="px-3 py-2 text-gray-400 tabular-nums">{i + 1}</td>
                            <td className="px-3 py-2">
                              <p className="font-medium text-gray-900">{p.name}</p>
                              <p className="text-[11px] text-gray-500">{p.category}</p>
                            </td>
                            <td className="px-3 py-2">
                              <Sparkline values={p.months.map((m) => m[sort])} title={p.months.map((m) => `${fmtMonth(m.month, true)}: ${sort === 'qty' ? m.qty : formatRs(m[sort])}`).join(', ')} />
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">{fmtNum(p.total.qty)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{formatRs(p.total.revenue)}</td>
                            <td className={`px-3 py-2 text-right tabular-nums ${p.total.profit < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{formatRs(p.total.profit)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </>
          )}

          {productId && (
            <div ref={detailRef}>
              <Card
                title={product?.name ? `${product.name} — this year vs last year` : 'Product trend'}
                subtitle={product?.category || undefined}
                actions={
                  <button type="button" onClick={() => setProductId(null)} className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100" aria-label="Close product trend">
                    <X className="h-4 w-4" />
                  </button>
                }
                bodyClass="p-3 sm:p-4 space-y-4"
              >
                {pr.error ? (
                  <ErrorState message={pr.error} onRetry={pr.reload} />
                ) : !product ? (
                  <EmptyState icon={<Loader2 className="h-8 w-8 animate-spin" />} title="Loading product…" />
                ) : product.months.every((m) => !m.qty && !m.prevYear.qty) ? (
                  <EmptyState title="No sales of this product in this period" />
                ) : (
                  <>
                    <LineChart
                      labels={product.months.map((m) => fmtMonth(m.month, true))}
                      series={[
                        { name: 'This period', values: product.months.map((m) => m.revenue) },
                        { name: 'Year before', values: product.months.map((m) => m.prevYear.revenue) },
                      ]}
                    />
                    {product.bestMonths.length > 0 && (
                      <p className="text-xs text-gray-600">
                        Sells best in: <b>{product.bestMonths.map((m) => fmtMonth(m)).join(', ')}</b>
                      </p>
                    )}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="text-[10px] uppercase text-gray-500 bg-gray-50">
                          <tr>
                            <th className="px-2 py-1.5 text-left">Month</th>
                            <th className="px-2 py-1.5 text-right">Pieces</th>
                            <th className="px-2 py-1.5 text-right">Net sales</th>
                            <th className="px-2 py-1.5 text-right">Profit</th>
                            <th className="px-2 py-1.5 text-right">Year before</th>
                            <th className="px-2 py-1.5 text-right">Change</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {product.months.map((m) => (
                            <tr key={m.month}>
                              <td className="px-2 py-1.5">{fmtMonth(m.month)}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums">{fmtNum(m.qty)}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums">{formatRs(m.revenue)}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums">{formatRs(m.profit)}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums text-gray-500">{formatRs(m.prevYear.revenue)}</td>
                              <td className={`px-2 py-1.5 text-right tabular-nums ${m.yoyPct === null ? 'text-gray-400' : m.yoyPct >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                                {m.yoyPct === null ? '—' : `${m.yoyPct > 0 ? '+' : ''}${fmtPct(m.yoyPct)}`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </Card>
            </div>
          )}
          {d.generatedAt && <p className="text-[11px] text-gray-400 text-right">Figures as of {new Date(d.generatedAt).toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit' })} · Refresh for the latest</p>}
        </>
      ) : null}
    </div>
  );
}
