'use client';

// Slow-Moving Stock — items in the shop for N days (default 30) that sold less
// than X% (default 10%) of what was received. Suggests: order less, replace,
// return to the vendor (smaller vendor bill) or swap consignment stock.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Hourglass, Undo2, Repeat, Scissors, Shuffle, Save, PackageCheck } from 'lucide-react';
import ReportsNav from '../components/ReportsNav';
import { useAccess } from '@/context/AccessContext';
import { storeApi, apiErrorMessage } from '@/lib/storeApi';
import { HelpBox, LoadingCard, NoAccessCard } from '@/components/admin/FormBits';
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
  useReport,
  useDebounced,
  useFilterOptions,
  downloadCsv,
  buildPdf,
  formatRs,
  fmtNum,
  fmtPct,
  fmtDate,
  pktToday,
  selectClass,
} from '../demand/_shared/reportKit';

type Action = 'reduce' | 'replace' | 'return' | 'swap';

interface SlowRow {
  key: string;
  productId: string;
  variantId: string | null;
  name: string;
  variantLabel: string;
  code: string;
  category: string;
  isConsignment: boolean;
  vendorId: string | null;
  vendorName: string | null;
  receivedQty: number;
  receivedAt: string;
  basis: 'receipt' | 'shelf';
  receiptType: string | null;
  days: number;
  soldQty: number;
  soldPct: number;
  lastSoldAt: string | null;
  stock: number;
  costPrice: number;
  stockValue: number;
  salePrice: number;
  saleValue: number;
  shelves: { code: string; qty: number }[];
  onShelfSince: string | null;
  warehouseQty: number;
  action: Action;
  actionQty: number;
  nextOrderQty: number;
  reason: string;
}

interface SlowData {
  rows: SlowRow[];
  summary: {
    items: number;
    pieces: number;
    stockValue: number;
    saleValue: number;
    byAction: Record<Action, number>;
    valueByAction: Record<Action, number>;
  };
  settings: { days: number; soldPct: number; coverDays: number };
}

const ACTIONS: Record<Action, { label: string; cls: string; Icon: typeof Undo2; hint: string }> = {
  return: { label: 'Return to vendor', cls: 'bg-red-50 text-red-700 ring-red-200', Icon: Undo2, hint: 'Nothing sold' },
  replace: { label: 'Replace item', cls: 'bg-amber-50 text-amber-800 ring-amber-200', Icon: Repeat, hint: 'Sold under half the limit' },
  reduce: { label: 'Order less', cls: 'bg-sky-50 text-sky-800 ring-sky-200', Icon: Scissors, hint: 'Sells, but slowly' },
  swap: { label: 'Swap (consignment)', cls: 'bg-violet-50 text-violet-800 ring-violet-200', Icon: Shuffle, hint: 'Vendor’s stock' },
};

function returnLink(r: SlowRow, qty: number) {
  const q = new URLSearchParams({ new: '1', productId: r.productId, ...(r.vendorId ? { vendorId: r.vendorId } : {}), qty: String(qty) });
  if (r.variantId) q.set('variantId', r.variantId);
  return `/admin/vendors/returns?${q.toString()}`;
}
function consignmentLink(r: SlowRow) {
  const q = new URLSearchParams({ productId: r.productId, ...(r.vendorId ? { vendorId: r.vendorId } : {}), qty: String(r.stock) });
  if (r.variantId) q.set('variantId', r.variantId);
  return `/admin/vendors/consignment?${q.toString()}`;
}

export default function SlowMovingPage() {
  const { can, loaded } = useAccess();
  const canView = can('report_slow_moving', 'view');
  const canExport = can('report_slow_moving', 'export');
  const canSaveDefaults = can('report_slow_moving', 'edit');
  const canReturn = can('vendor_returns', 'create');
  const canConsign = can('consignment', 'view');

  const opts = useFilterOptions(canView);
  const [days, setDays] = useState('');
  const [soldPct, setSoldPct] = useState('');
  const [category, setCategory] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [action, setAction] = useState<Action | ''>('');
  const [sort, setSort] = useState('value');
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const dDays = useDebounced(days, 500);
  const dPct = useDebounced(soldPct, 500);
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);

  const filters = { days: dDays, soldPct: dPct, category, vendorId, sort, search: debounced };
  const filterKey = JSON.stringify({ ...filters, action });
  useEffect(() => setPage(1), [filterKey]);
  const r = useReport<SlowData>('/analytics/slow-moving', { ...filters, action, page, limit: 50 }, canView);
  const d = r.data;
  const s = d?.summary;
  // Show the saved rule in the inputs once known.
  useEffect(() => {
    if (d?.settings && days === '' && soldPct === '') {
      setDays(String(d.settings.days));
      setSoldPct(String(d.settings.soldPct));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d?.settings]);

  const saveDefaults = async () => {
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    try {
      await storeApi.put('/analytics/slow-moving/settings', { days: Number(days), soldPct: Number(soldPct) });
      toast.success('Saved as the default rule');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not save.'));
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  const exportCsv = async () => {
    try {
      await downloadCsv('/analytics/slow-moving/export', { ...filters, action }, `slow-moving-${pktToday()}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const exportPdf = () => {
    if (!d || !s) return;
    buildPdf({
      title: 'Slow-Moving Stock',
      subtitle: `In shop ${d.settings.days}+ days · sold under ${d.settings.soldPct}%`,
      landscape: true,
      summary: [
        ['Items', fmtNum(s.items)],
        ['Pieces', fmtNum(s.pieces)],
        ['Stock value (cost)', formatRs(s.stockValue)],
        ['Sale value', formatRs(s.saleValue)],
        ['Return to vendor', `${s.byAction.return} items · ${formatRs(s.valueByAction.return)}`],
        ['Replace', `${s.byAction.replace} items · ${formatRs(s.valueByAction.replace)}`],
        ['Order less', `${s.byAction.reduce} items · ${formatRs(s.valueByAction.reduce)}`],
        ['Swap (consignment)', `${s.byAction.swap} items · ${formatRs(s.valueByAction.swap)}`],
      ],
      tables: [
        {
          title: `This page (${d.rows.length} of ${r.meta?.total ?? d.rows.length})`,
          head: ['Product', 'Vendor', 'Received', 'Qty in', 'Days', 'Sold', 'Sold %', 'Stock', 'Value', 'Shelves', 'Action', 'Qty'],
          widths: [55, 32, 20, 13, 11, 12, 13, 13, 18, 30, 26, 11],
          rows: d.rows.map((x) => [
            `${x.name}${x.variantLabel ? ` (${x.variantLabel})` : ''}`,
            x.vendorName || '',
            fmtDate(x.receivedAt),
            x.receivedQty,
            x.days,
            x.soldQty,
            x.soldPct,
            x.stock,
            x.stockValue,
            x.shelves.map((sh) => sh.code).join(' ') || 'warehouse',
            ACTIONS[x.action].label,
            x.actionQty,
          ]),
        },
      ],
      fileName: `slow-moving-${pktToday()}`,
    });
  };

  if (!loaded) return <LoadingCard text="Loading…" />;
  if (!canView) return <NoAccessCard />;

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        icon={<Hourglass className="h-6 w-6" />}
        title="Slow-Moving Stock"
        subtitle="Items sitting in the shop that hardly sell — order less, replace them or give them back to the vendor."
        actions={<ReportActions canExport={canExport} onCsv={exportCsv} onPdf={exportPdf} onRefresh={r.reload} loading={r.loading} disabled={!d} />}
      />
      <ReportsNav />

      <HelpBox>
        Listed: items in stock for at least <b>{d?.settings.days ?? 30} days</b> since they were last received (or first put on a shelf) that sold
        less than <b>{d?.settings.soldPct ?? 10}%</b> of the received quantity. Returning them lowers what you owe the vendor.
      </HelpBox>

      <FilterBar>
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          In shop ≥
          <input type="number" min={1} max={730} value={days} onChange={(e) => setDays(e.target.value)} className={`${selectClass} w-20`} aria-label="Days in shop" />
          days
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          sold &lt;
          <input type="number" min={1} max={100} value={soldPct} onChange={(e) => setSoldPct(e.target.value)} className={`${selectClass} w-20`} aria-label="Sold percent" />%
        </label>
        {canSaveDefaults && (
          <button type="button" onClick={saveDefaults} disabled={saving || !days || !soldPct} className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50" title="Use these numbers by default">
            <Save className="h-3.5 w-3.5" /> Save as default
          </button>
        )}
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass} aria-label="Category">
          <option value="">All categories</option>
          {opts.categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className={selectClass} aria-label="Vendor">
          <option value="">All vendors</option>
          {opts.vendors.map((v) => (
            <option key={v._id} value={v._id}>
              {v.name}
            </option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className={selectClass} aria-label="Sort">
          <option value="value">Most money stuck</option>
          <option value="days">Longest in shop</option>
          <option value="soldPct">Lowest sold %</option>
          <option value="stock">Most pieces</option>
          <option value="name">Name</option>
        </select>
        <SearchBox value={search} onChange={setSearch} placeholder="Product, code, SKU" />
      </FilterBar>

      {r.error && <ErrorState message={r.error} onRetry={r.reload} />}

      {!d && r.loading ? (
        <LoadingBlock />
      ) : d && s ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            <StatCard label="Slow items" value={fmtNum(s.items)} hint={`${fmtNum(s.pieces)} pieces`} />
            <StatCard label="Money stuck (cost)" value={formatRs(s.stockValue)} tone={s.stockValue > 0 ? 'warn' : 'default'} />
            <StatCard label="At sale price" value={formatRs(s.saleValue)} />
            <StatCard label="Can go back to vendors" value={formatRs(s.valueByAction.return + s.valueByAction.swap)} hint={`${s.byAction.return + s.byAction.swap} items`} tone="info" />
          </div>

          {/* Action tabs with counts */}
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Suggested action">
            {([['', 'All', s.items], ...(Object.keys(ACTIONS) as Action[]).map((a) => [a, ACTIONS[a].label, s.byAction[a]])] as [Action | '', string, number][]).map(([key, label, n]) => (
              <button
                key={key || 'all'}
                type="button"
                role="tab"
                aria-selected={action === key}
                onClick={() => setAction(key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border ${action === key ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
              >
                {label} <span className="opacity-70">({n})</span>
              </button>
            ))}
          </div>

          <Card title={`${fmtNum(r.meta?.total ?? d.rows.length)} item${(r.meta?.total ?? 0) === 1 ? '' : 's'}`} subtitle={r.loading ? 'Updating…' : undefined}>
            {d.rows.length === 0 ? (
              <EmptyState icon={<PackageCheck className="h-10 w-10" />} title="No slow movers" text="Everything that has been in the shop this long is selling above the limit." />
            ) : (
              <>
                <ul className="md:hidden divide-y divide-gray-100">
                  {d.rows.map((x) => (
                    <li key={x.key} className="p-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{x.name}</p>
                          <p className="text-[11px] text-gray-500 truncate">{[x.variantLabel, x.code, x.vendorName].filter(Boolean).join(' · ')}</p>
                        </div>
                        <ActionBadge a={x.action} />
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[11px]">
                        <div><span className="text-gray-500">In shop</span><br /><b>{x.days}</b> days</div>
                        <div><span className="text-gray-500">Sold</span><br /><b>{x.soldQty}</b> / {x.receivedQty} ({fmtPct(x.soldPct)})</div>
                        <div><span className="text-gray-500">Stuck</span><br /><b>{x.stock}</b> · {formatRs(x.stockValue)}</div>
                      </div>
                      <p className="text-[11px] text-gray-600">{x.reason}</p>
                      <ActionLink row={x} canReturn={canReturn} canConsign={canConsign} />
                    </li>
                  ))}
                </ul>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-[11px] uppercase text-gray-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Item</th>
                        <th className="px-3 py-2 text-left">Vendor</th>
                        <th className="px-3 py-2 text-left">Received</th>
                        <th className="px-3 py-2 text-left">Sold</th>
                        <th className="px-3 py-2 text-right">In stock</th>
                        <th className="px-3 py-2 text-left">Where</th>
                        <th className="px-3 py-2 text-left">Suggestion</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {d.rows.map((x) => (
                        <tr key={x.key} className="align-top hover:bg-gray-50">
                          <td className="px-3 py-2.5 min-w-[180px]">
                            <p className="font-medium text-gray-900">{x.name}</p>
                            <p className="text-[11px] text-gray-500">{[x.variantLabel, x.code, x.category].filter(Boolean).join(' · ')}</p>
                          </td>
                          <td className="px-3 py-2.5 text-xs">
                            <p className="text-gray-900">{x.vendorName || '—'}</p>
                            {x.isConsignment && <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-700">Consignment</span>}
                          </td>
                          <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                            <p>{fmtDate(x.receivedAt)}</p>
                            <p className="text-gray-500">
                              {fmtNum(x.receivedQty)} pcs · <b>{x.days}</b> days{x.basis === 'shelf' ? ' (on shelf)' : ''}
                            </p>
                          </td>
                          <td className="px-3 py-2.5 text-xs min-w-[120px]">
                            <p>
                              <b>{fmtNum(x.soldQty)}</b> pcs ({fmtPct(x.soldPct)})
                            </p>
                            <div className="h-1.5 mt-1 rounded-full bg-gray-100 overflow-hidden" aria-hidden>
                              <div className="h-full bg-sky-500" style={{ width: `${Math.min(100, x.soldPct)}%` }} />
                            </div>
                            <p className="text-gray-400 mt-0.5">last sold {fmtDate(x.lastSoldAt)}</p>
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs whitespace-nowrap">
                            <p className="text-sm font-semibold text-gray-900">{fmtNum(x.stock)} pcs</p>
                            <p className="text-gray-500">{formatRs(x.stockValue)} at cost</p>
                          </td>
                          <td className="px-3 py-2.5 text-xs">
                            {x.shelves.length ? (
                              <div className="flex flex-wrap gap-1">
                                {x.shelves.map((sh) => (
                                  <span key={sh.code} className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-mono text-[10px]">
                                    {sh.code} · {sh.qty}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                            {x.warehouseQty > 0 && <p className="text-gray-500 mt-0.5">{fmtNum(x.warehouseQty)} in warehouse</p>}
                          </td>
                          <td className="px-3 py-2.5 text-xs min-w-[220px]">
                            <ActionBadge a={x.action} />
                            <p className="text-gray-600 mt-1">{x.reason}</p>
                            <div className="mt-1.5">
                              <ActionLink row={x} canReturn={canReturn} canConsign={canConsign} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pager meta={r.meta} onPage={setPage} />
              </>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}

function ActionBadge({ a }: { a: Action }) {
  const { label, cls, Icon } = ACTIONS[a];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 whitespace-nowrap ${cls}`}>
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
}

function ActionLink({ row, canReturn, canConsign }: { row: SlowRow; canReturn: boolean; canConsign: boolean }) {
  const linkCls = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border border-gray-300 text-gray-700 hover:bg-gray-50';
  if (row.action === 'swap') {
    return canConsign ? (
      <Link href={consignmentLink(row)} className={linkCls}>
        <Shuffle className="h-3.5 w-3.5" /> Open consignment
      </Link>
    ) : null;
  }
  if (row.action === 'reduce') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-gray-500">Next order ≈ {fmtNum(row.nextOrderQty)} pcs</span>
        {canReturn && row.vendorId && row.actionQty > 0 && (
          <Link href={returnLink(row, row.actionQty)} className={linkCls}>
            <Undo2 className="h-3.5 w-3.5" /> Return extra {row.actionQty}
          </Link>
        )}
      </div>
    );
  }
  if (!canReturn || !row.vendorId || row.actionQty <= 0) return null;
  return (
    <Link href={returnLink(row, row.actionQty)} className={linkCls}>
      <Undo2 className="h-3.5 w-3.5" /> Return {row.actionQty} to vendor
    </Link>
  );
}
