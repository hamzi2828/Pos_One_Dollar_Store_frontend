'use client';

// The owner's dashboard: how the shop is doing now (sales, profit, bills vs the
// previous period), what needs doing (attention), when it is busy, what sells,
// what stock is worth and which tills are open. Shop time = Asia/Karachi.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Banknote, Loader2, Printer, ReceiptText, RefreshCw, Table2, BarChart3, TrendingUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage, formatRs } from '@/lib/storeApi';
import { dashboardService, RANGE_OPTIONS, type DashboardData, type RangeKey } from './dashboardService';
import { BarList, ColumnChart, Sparkline, compactRs } from './adminComponents/charts';
import {
  AttentionGrid,
  Card,
  CardLink,
  Delta,
  KpiTile,
  QuickActions,
  RecentBills,
  StatStrip,
  StockPanel,
  TillsPanel,
  TopProductsTable,
} from './adminComponents/parts';

const TZ = 'Asia/Karachi';
const RANGE_STORAGE = 'dashboard_range';
const REFRESH_MS = 60 * 1000;

const shopHour = () => Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
const greeting = () => {
  const h = shopHour();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};
const shopDate = () =>
  new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

function useNowTick(ms = 30000) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setTick((x) => x + 1), ms);
    return () => window.clearInterval(t);
  }, [ms]);
}

const ago = (d: Date | null) => {
  if (!d) return '';
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
};

// No dashboard permission: open the first page the role may use (work pages first, then menu order).
const LANDING: [string, string][] = [
  ['pos', '/admin/pos'], ['purchase_orders', '/admin/purchasing/orders'], ['goods_receiving', '/admin/purchasing/receiving'],
  ['pos_orders', '/admin/pos-orders'], ['till', '/admin/till'], ['products', '/admin/products'], ['product_stock', '/admin/products/stock'],
  ['vendors', '/admin/vendors'], ['stock_putaway', '/admin/inventory/putaway'], ['racks', '/admin/inventory/racks'],
  ['stock_movements', '/admin/inventory/movements'], ['damages', '/admin/inventory/damages'], ['shop_use', '/admin/inventory/shop-use'],
  ['stock_adjustments', '/admin/inventory/adjustments'], ['report_sales', '/admin/reports/sales'], ['report_stock', '/admin/reports/stock'],
  ['customers', '/admin/users'], ['expenses', '/admin/expenses'], ['employees', '/admin/hr/employees'], ['attendance', '/admin/hr/attendance'],
  ['payroll', '/admin/hr/payroll'], ['staff', '/admin/staff'], ['roles', '/admin/roles'], ['notifications', '/admin/notifications'],
  ['desktop_download', '/admin/desktop-app'],
];

export default function AdminDashboardClient() {
  const { access, can } = useAccess();
  const router = useRouter();
  const noDashboard = !!access && !can('dashboard', 'view');
  useEffect(() => {
    if (!noDashboard) return;
    const to = LANDING.find(([perm]) => can(perm, 'view'))?.[1];
    if (to) router.replace(to);
  }, [noDashboard, can, router]);
  const [range, setRange] = useState<RangeKey>('today');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [tableView, setTableView] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  useNowTick();

  // Remember the period the owner looks at.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(RANGE_STORAGE) as RangeKey | null;
      if (saved && RANGE_OPTIONS.some((o) => o.key === saved)) setRange(saved);
    } catch {
      /* storage blocked: keep "today" */
    }
  }, []);

  const load = useCallback(async (r: RangeKey) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRefreshing(true);
    try {
      const d = await dashboardService.get(r, ctrl.signal);
      setData(d);
      setError(null);
      setUpdatedAt(new Date());
    } catch (e) {
      if ((e as { name?: string })?.name === 'CanceledError') return;
      setError(apiErrorMessage(e, 'Could not load the dashboard.'));
    } finally {
      if (abortRef.current === ctrl) {
        setRefreshing(false);
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (noDashboard) return;
    load(range);
  }, [range, load, noDashboard]);

  // Auto refresh every minute while the tab is visible.
  useEffect(() => {
    const t = window.setInterval(() => {
      if (!noDashboard && document.visibilityState === 'visible') load(range);
    }, REFRESH_MS);
    return () => window.clearInterval(t);
  }, [range, load, noDashboard]);

  const pickRange = (r: RangeKey) => {
    setRange(r);
    try {
      localStorage.setItem(RANGE_STORAGE, r);
    } catch {
      /* ignore */
    }
  };

  const firstName = access?.user?.firstName || '';
  const canBills = can(['pos_orders', 'pos'], 'view');

  const k = data?.kpis;
  const p = data?.kpis.previous;

  // Sales columns: for "today" only up to the current hour (future hours are empty, not zero sales).
  const trendCols = useMemo(() => {
    if (!data) return [];
    let rows = data.trend;
    if (data.range.bucket === 'hour') {
      // Trading hours only: from the first bill (or 9am) to the last bill (or 10pm); today stops at this hour.
      const active = rows.filter((t) => t.bills > 0).map((t) => Number(t.key));
      const first = Math.min(9, ...(active.length ? active : [9]));
      let last = Math.max(22, ...(active.length ? active : [22]));
      if (data.range.key === 'today') last = Math.min(last, shopHour());
      rows = rows.filter((t) => Number(t.key) >= first && Number(t.key) <= Math.max(first, last));
    }
    return rows.map((t) => ({
      key: t.key,
      label: t.label,
      value: t.sales,
      extra: [
        { label: 'profit', value: compactRs(t.profit) },
        { label: t.bills === 1 ? 'bill' : 'bills', value: String(t.bills) },
      ],
    }));
  }, [data]);

  // Busy hours: trim to the hours the shop actually trades (first..last hour with bills), at least 9am–10pm.
  const hourCols = useMemo(() => {
    if (!data) return [];
    const active = data.hours.filter((h) => h.bills > 0).map((h) => h.hour);
    const first = Math.min(9, ...(active.length ? active : [9]));
    const last = Math.max(22, ...(active.length ? active : [22]));
    return data.hours
      .filter((h) => h.hour >= first && h.hour <= last)
      .map((h) => ({ key: String(h.hour), label: h.label, value: h.sales, extra: [{ label: h.bills === 1 ? 'bill' : 'bills', value: String(h.bills) }] }));
  }, [data]);
  const peakHour = useMemo(() => {
    if (!data) return null;
    const best = [...data.hours].sort((a, b) => b.sales - a.sales)[0];
    return best && best.sales > 0 ? best : null;
  }, [data]);

  const payTotal = data ? data.payments.reduce((s, x) => s + x.amount, 0) : 0;
  const catMax = data ? Math.max(0, ...data.topCategories.map((c) => c.revenue)) : 0;

  /* ---------------- first load / error ---------------- */
  if (loading && !data) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-7 w-7 animate-spin text-honey-700" />
          <p className="text-sm text-gray-500">Loading your dashboard…</p>
        </div>
      </div>
    );
  }
  if (error && !data) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-800">The dashboard could not load</p>
            <p className="mt-0.5 text-sm text-red-700">{error}</p>
            <button onClick={() => load(range)} className="mt-2 text-sm font-medium text-red-800 underline">
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (!data || !k || !p) return null;

  const isToday = data.range.key === 'today';
  const sparkValues = trendCols.map((c) => c.value);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-5">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-gray-500">{shopDate()}</p>
            <h1 className="mt-0.5 text-xl sm:text-2xl font-semibold text-gray-900">
              {greeting()}
              {firstName ? `, ${firstName}` : ''}
            </h1>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <span className="text-xs text-gray-400" aria-live="polite">
              {refreshing ? 'Updating…' : updatedAt ? `Updated ${ago(updatedAt)}` : ''}
            </span>
            <button
              onClick={() => load(range)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              title="Print or save as PDF"
            >
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">Print</span>
            </button>
          </div>
        </header>

        {/* Period filter: one row, scopes everything below */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <div role="tablist" aria-label="Period" className="flex gap-1 overflow-x-auto rounded-xl bg-white border border-gray-200 p-1 print:hidden">
            {RANGE_OPTIONS.map((o) => (
              <button
                key={o.key}
                role="tab"
                aria-selected={range === o.key}
                onClick={() => pickRange(o.key)}
                className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  range === o.key ? 'bg-gray-950 text-honey-400' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            <span className="hidden print:inline font-semibold text-gray-900">{data.range.label} · </span>
            Compared with {data.range.compareLabel}
          </p>
        </div>

        <QuickActions />

        {/* Everything below dims while refreshing (no layout jump) */}
        <div className={`space-y-4 sm:space-y-5 transition-opacity ${refreshing ? 'opacity-60' : ''}`}>
          {error && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Showing the last numbers — {error}
            </p>
          )}

          {/* KPIs: one hero figure + supporting tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="sm:col-span-2 rounded-xl bg-gray-950 p-5 text-white flex flex-col justify-between gap-4 overflow-hidden">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-400">Sales · {data.range.label.toLowerCase()}</p>
                  <p className="mt-1 text-5xl font-semibold tracking-tight text-honey-400">{formatRs(k.sales)}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                    <Delta now={k.sales} prev={p.sales} dark />
                    <span>vs {formatRs(p.sales)}</span>
                  </div>
                </div>
                <span className="hidden sm:flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-honey-400">
                  <Banknote className="h-5 w-5" />
                </span>
              </div>
              <Sparkline values={sparkValues} ariaLabel={`Sales ${isToday ? 'by hour today' : 'over the period'}`} />
            </div>

            <KpiTile
              label="Gross profit"
              value={formatRs(k.profit)}
              icon={<TrendingUp className="h-4 w-4" />}
              delta={<Delta now={k.profit} prev={p.profit} />}
              sub={<span>{k.marginPct === null ? 'No sales yet' : `${k.marginPct}% margin`}</span>}
            />
            <KpiTile
              label="Bills"
              value={k.bills.toLocaleString('en-PK')}
              icon={<ReceiptText className="h-4 w-4" />}
              delta={<Delta now={k.bills} prev={p.bills} />}
              sub={<span>avg {formatRs(Math.round(k.avgBill))}</span>}
            />
          </div>

          <StatStrip
            items={[
              { label: 'Items sold', value: k.items.toLocaleString('en-PK'), hint: `${k.itemsPerBill} items per bill` },
              { label: 'Items per bill', value: String(k.itemsPerBill) },
              { label: 'Discounts given', value: formatRs(k.discounts) },
              { label: 'Gifts (cost)', value: formatRs(k.giftCost), hint: 'Free gifts, counted in cost of sales' },
              { label: 'Refunds', value: k.refunds.count ? `${k.refunds.count} · ${formatRs(k.refunds.amount)}` : '0' },
            ]}
          />

          <AttentionGrid items={data.attention} />

          {/* Main grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
            <div className="lg:col-span-2 space-y-4 sm:space-y-5">
              <Card
                title={isToday || data.range.key === 'yesterday' ? 'Sales by hour' : data.range.bucket === 'month' ? 'Sales by month' : 'Sales by day'}
                subtitle={`${formatRs(k.sales)} from ${k.bills} bill${k.bills === 1 ? '' : 's'}`}
                action={
                  <button
                    onClick={() => setTableView((v) => !v)}
                    className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 print:hidden"
                    aria-pressed={tableView}
                  >
                    {tableView ? <BarChart3 className="h-3.5 w-3.5" /> : <Table2 className="h-3.5 w-3.5" />}
                    {tableView ? 'Chart' : 'Table'}
                  </button>
                }
              >
                {tableView ? (
                  <div className="max-h-72 overflow-y-auto -mx-4 sm:-mx-5">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white">
                        <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400">
                          <th className="px-4 sm:px-5 py-1.5 font-medium">When</th>
                          <th className="px-2 py-1.5 font-medium text-right">Sales</th>
                          <th className="px-2 py-1.5 font-medium text-right">Profit</th>
                          <th className="px-4 sm:px-5 py-1.5 font-medium text-right">Bills</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 tabular-nums">
                        {data.trend.filter((t) => t.bills > 0).map((t) => (
                          <tr key={t.key}>
                            <td className="px-4 sm:px-5 py-1.5 text-gray-700">{t.label}</td>
                            <td className="px-2 py-1.5 text-right font-medium text-gray-900">{formatRs(t.sales)}</td>
                            <td className="px-2 py-1.5 text-right text-gray-700">{formatRs(t.profit)}</td>
                            <td className="px-4 sm:px-5 py-1.5 text-right text-gray-700">{t.bills}</td>
                          </tr>
                        ))}
                        {data.trend.every((t) => t.bills === 0) && (
                          <tr>
                            <td colSpan={4} className="px-4 py-6 text-center text-xs text-gray-400">
                              No sales in this period yet
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <ColumnChart data={trendCols} height={200} ariaLabel="Sales over the period" />
                )}
              </Card>

              <Card title="Best sellers" subtitle="Ranked by sales in this period" action={can('products', 'view') ? <CardLink href="/admin/products">All products</CardLink> : undefined}>
                <TopProductsTable products={data.topProducts} showProfit={can('dashboard', 'view')} />
              </Card>

              <Card title="Latest bills" action={can('pos_orders', 'view') ? <CardLink href="/admin/pos-orders">All bills</CardLink> : undefined}>
                <RecentBills bills={data.recentBills} canOpen={canBills} />
              </Card>
            </div>

            <div className="space-y-4 sm:space-y-5">
              <Card
                title="Busy hours"
                subtitle={peakHour ? `Busiest at ${peakHour.label} — ${formatRs(peakHour.sales)}` : 'Shows when bills come in'}
              >
                <ColumnChart data={hourCols} height={120} emphasis="peak" maxLabels={5} ariaLabel="Sales by hour of day" emptyText="No bills yet" />
              </Card>

              <Card title="How customers paid">
                <BarList
                  emptyText="No payments in this period"
                  rows={data.payments.map((x) => ({
                    key: x.method,
                    label: x.label,
                    value: formatRs(x.amount),
                    pct: payTotal ? (x.amount / payTotal) * 100 : 0,
                    sub: `${x.bills} bill${x.bills === 1 ? '' : 's'}${x.unpaid > 0 ? ` · ${formatRs(x.unpaid)} still unpaid` : ''}`,
                  }))}
                />
              </Card>

              <Card title="Top categories" action={can('report_category_performance', 'view') ? <CardLink href="/admin/reports/category-performance">Details</CardLink> : undefined}>
                <BarList
                  emptyText="No category sales yet"
                  rows={data.topCategories.map((c) => ({
                    key: c.category,
                    label: c.category,
                    value: formatRs(c.revenue),
                    pct: catMax ? (c.revenue / catMax) * 100 : 0,
                    sub: `${c.sharePct ?? 0}% of sales · ${c.qty.toLocaleString('en-PK')} pcs`,
                  }))}
                />
              </Card>

              {data.stock && (
                <Card title="Stock right now" action={can('racks', 'view') ? <CardLink href="/admin/inventory/racks">Racks</CardLink> : undefined}>
                  <StockPanel stock={data.stock} />
                </Card>
              )}

              {data.tills && (
                <Card title="Tills right now" action={can(['till', 'till_verify'], 'view') ? <CardLink href="/admin/till">Tills</CardLink> : undefined}>
                  <TillsPanel tills={data.tills} />
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
