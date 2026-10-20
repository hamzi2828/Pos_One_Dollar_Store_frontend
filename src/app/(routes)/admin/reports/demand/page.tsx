'use client';

// Demand List — items whose stock fell to the reorder level (25% of what was
// last bought, or the item's own par level / %), how fast that happened, how
// fast they sell and how much to buy. Pick rows -> "Create purchase order".

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { TrendingDown, Settings2, ShoppingCart, AlertOctagon, AlertTriangle, Eye, PackageX, Pencil, X, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import ReportsNav from '../components/ReportsNav';
import { useAccess } from '@/context/AccessContext';
import { storeApi, apiErrorMessage } from '@/lib/storeApi';
import { Modal, Field, ErrorBox, HelpBox, LoadingCard, NoAccessCard, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
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
  Sparkline,
  useReport,
  useDebounced,
  useFilterOptions,
  downloadCsv,
  buildPdf,
  formatRs,
  fmtNum,
  fmtPct,
  fmtDate,
  fmtMonth,
  pktToday,
  selectClass,
} from './_shared/reportKit';
import { SearchSelect } from '@/components/ui/SearchSelect';

type Urgency = 'critical' | 'high' | 'medium';

interface DemandRow {
  key: string;
  productId: string;
  variantId: string | null;
  name: string;
  variantLabel: string;
  code: string;
  category: string;
  isConsignment: boolean;
  stock: number;
  base: number;
  baseSource: 'par_level' | 'last_receipt' | 'peak_since_receipt' | 'current_plus_sold';
  parLevel: number | null;
  reorderPct: number | null;
  thresholdPct: number;
  threshold: number;
  pctLeft: number | null;
  lastReceivedAt: string | null;
  lastReceivedQty: number | null;
  receiptType: string | null;
  crossedAt: string | null;
  daysToCross: number | null;
  daysSinceReceipt: number | null;
  soldSinceReceipt: number;
  sold30: number;
  lastSoldAt: string | null;
  avgDailySales: number;
  daysOfCover: number | null;
  suggestedQty: number;
  piecesPerBox: number;
  suggestedBoxes: number | null;
  vendorId: string | null;
  vendorName: string | null;
  cheapestVendorId: string | null;
  cheapestVendorName: string | null;
  cheapestPrice: number | null;
  lastPurchasePrice: number | null;
  landedCost: number;
  salePrice: number;
  margin: number;
  marginPct: number | null;
  reorderCost: number;
  urgency: Urgency;
  trend: { series: { month: string; qty: number }[]; direction: 'up' | 'down' | 'flat' } | null;
}

interface DemandData {
  rows: DemandRow[];
  summary: { items: number; critical: number; high: number; medium: number; outOfStock: number; suggestedQty: number; reorderCost: number };
  settings: { thresholdPct: number; coverDays: number };
}

const URGENCY: Record<Urgency, { label: string; cls: string; Icon: typeof AlertOctagon }> = {
  critical: { label: 'Critical', cls: 'bg-red-50 text-red-700 ring-red-200', Icon: AlertOctagon },
  high: { label: 'High', cls: 'bg-amber-50 text-amber-800 ring-amber-200', Icon: AlertTriangle },
  medium: { label: 'Watch', cls: 'bg-sky-50 text-sky-800 ring-sky-200', Icon: Eye },
};

const BASE_LABEL: Record<DemandRow['baseSource'], string> = {
  par_level: 'par level',
  last_receipt: 'last receipt',
  peak_since_receipt: 'peak since receipt',
  current_plus_sold: 'stock + sold',
};

function UrgencyBadge({ u }: { u: Urgency }) {
  const { label, cls, Icon } = URGENCY[u];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${cls}`}>
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
}

function TrendCell({ row }: { row: DemandRow }) {
  if (!row.trend) return <span className="text-gray-400">—</span>;
  const { series, direction } = row.trend;
  const Arrow = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus;
  const color = direction === 'up' ? 'text-emerald-600' : direction === 'down' ? 'text-red-600' : 'text-gray-400';
  return (
    <Link href={`/admin/reports/trends?productId=${row.productId}`} className="inline-flex items-center gap-1 group" title="Open sales trend">
      <Sparkline values={series.map((s) => s.qty)} title={series.map((s) => `${fmtMonth(s.month, true)}: ${s.qty}`).join(', ')} />
      <Arrow className={`h-3.5 w-3.5 ${color}`} />
    </Link>
  );
}

const stockBar = (row: DemandRow) => Math.min(100, Math.max(0, row.pctLeft ?? 0));

export default function DemandPage() {
  const { can, loaded } = useAccess();
  const canView = can('report_demand', 'view');
  const canExport = can('report_demand', 'export');
  const canEditGlobal = can('report_demand', 'edit');
  const canEditProducts = canEditGlobal || can('products', 'edit');
  const canCreatePO = can('purchase_orders', 'create');

  const opts = useFilterOptions(canView);
  const [category, setCategory] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [urgency, setUrgency] = useState<Urgency | ''>('');
  const [sort, setSort] = useState('urgency');
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Map<string, string>>(new Map()); // productId -> name
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editRow, setEditRow] = useState<DemandRow | null>(null);

  const filters = { category, vendorId, urgency, sort, search: debounced };
  const filterKey = JSON.stringify(filters);
  useEffect(() => setPage(1), [filterKey]);
  const r = useReport<DemandData>('/analytics/demand', { ...filters, page, limit: 50 }, canView);
  const rows = r.data?.rows || [];
  const s = r.data?.summary;
  const settings = r.data?.settings;

  const toggle = (row: DemandRow) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(row.productId)) next.delete(row.productId);
      else next.set(row.productId, row.name);
      return next;
    });
  const allOnPage = rows.length > 0 && rows.every((x) => selected.has(x.productId));
  const togglePage = () =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (allOnPage) rows.forEach((x) => next.delete(x.productId));
      else rows.forEach((x) => next.set(x.productId, x.name));
      return next;
    });
  const poHref = `/admin/purchasing/orders?new=1&productIds=${[...selected.keys()].join(',')}`;

  const exportCsv = async () => {
    try {
      await downloadCsv('/analytics/demand/export', filters, `demand-list-${pktToday()}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const exportPdf = () => {
    if (!r.data) return;
    buildPdf({
      title: 'Demand List',
      subtitle: `Reorder at ${settings?.thresholdPct}% · ${settings?.coverDays} days cover${category ? ` · ${category}` : ''}`,
      landscape: true,
      summary: [
        ['Items to reorder', fmtNum(s?.items)],
        ['Critical', fmtNum(s?.critical)],
        ['Out of stock', fmtNum(s?.outOfStock)],
        ['Suggested pieces', fmtNum(s?.suggestedQty)],
        ['Estimated cost', formatRs(s?.reorderCost)],
      ],
      tables: [
        {
          title: `This page (${rows.length} of ${r.meta?.total ?? rows.length})`,
          head: ['Urgency', 'Product', 'Stock', 'Base', '% left', 'Received', 'Fell below', 'Days', 'Avg/day', 'Cover d', 'Suggest', 'Vendor', 'Landed', 'Price'],
          widths: [16, 50, 12, 12, 13, 20, 20, 10, 13, 13, 14, 30, 16, 14],
          rows: rows.map((x) => [
            URGENCY[x.urgency].label,
            `${x.name}${x.variantLabel ? ` (${x.variantLabel})` : ''}`,
            x.stock,
            x.base,
            x.pctLeft,
            fmtDate(x.lastReceivedAt),
            fmtDate(x.crossedAt),
            x.daysToCross,
            x.avgDailySales,
            x.daysOfCover,
            x.suggestedQty,
            x.vendorName || '',
            x.landedCost,
            x.salePrice,
          ]),
        },
      ],
      fileName: `demand-list-${pktToday()}`,
    });
  };

  if (!loaded) return <LoadingCard text="Loading…" />;
  if (!canView) return <NoAccessCard />;

  return (
    <div className="space-y-4 sm:space-y-5 pb-20">
      <PageHeader
        icon={<TrendingDown className="h-6 w-6" />}
        title="Demand List"
        subtitle="Items that fell to their reorder level since they were last bought — what to buy and how much."
        actions={
          <>
            <ReportActions canExport={canExport} onCsv={exportCsv} onPdf={exportPdf} onRefresh={r.reload} loading={r.loading} disabled={!r.data} />
            {(canEditGlobal || canEditProducts) && (
              <button type="button" onClick={() => setSettingsOpen(true)} className={secondaryBtn} disabled={!settings}>
                <Settings2 className="h-4 w-4" /> <span className="hidden sm:inline">Settings</span>
              </button>
            )}
          </>
        }
      />
      <ReportsNav />

      <HelpBox>
        An item shows here when its stock is at or below <strong>{settings?.thresholdPct ?? 25}%</strong> of the quantity last bought (or of
        its own par level / %). <em>Fell below</em> is the day it crossed that line and <em>days</em> how long it took after buying. The
        suggested quantity covers <strong>{settings?.coverDays ?? 30} days</strong> of sales.
      </HelpBox>

      <FilterBar>
        <SearchSelect value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass} aria-label="Category">
          <option value="">All categories</option>
          {opts.categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </SearchSelect>
        <SearchSelect value={vendorId} onChange={(e) => setVendorId(e.target.value)} className={selectClass} aria-label="Vendor">
          <option value="">All vendors</option>
          {opts.vendors.map((v) => (
            <option key={v._id} value={v._id}>
              {v.name}
            </option>
          ))}
        </SearchSelect>
        <SearchSelect value={urgency} onChange={(e) => setUrgency(e.target.value as Urgency | '')} className={selectClass} aria-label="Urgency">
          <option value="">Any urgency</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Watch</option>
        </SearchSelect>
        <SearchSelect value={sort} onChange={(e) => setSort(e.target.value)} className={selectClass} aria-label="Sort">
          <option value="urgency">Most urgent first</option>
          <option value="pctLeft">Lowest % left</option>
          <option value="daysToCross">Fastest to fall</option>
          <option value="suggestedQty">Biggest order</option>
          <option value="name">Name</option>
        </SearchSelect>
        <SearchBox value={search} onChange={setSearch} placeholder="Product, code, SKU" />
      </FilterBar>

      {r.error && <ErrorState message={r.error} onRetry={r.reload} />}

      {!r.data && r.loading ? (
        <LoadingBlock />
      ) : r.data ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
            <StatCard label="Items to reorder" value={fmtNum(s?.items)} />
            <StatCard label="Critical" value={fmtNum(s?.critical)} tone={s?.critical ? 'bad' : 'default'} hint="≤ 3 days left or none" />
            <StatCard label="High" value={fmtNum(s?.high)} tone={s?.high ? 'warn' : 'default'} hint="≤ 7 days left" />
            <StatCard label="Out of stock" value={fmtNum(s?.outOfStock)} tone={s?.outOfStock ? 'bad' : 'default'} />
            <StatCard label="Suggested pieces" value={fmtNum(s?.suggestedQty)} />
            <StatCard label="Estimated cost" value={formatRs(s?.reorderCost)} hint="at landed cost" />
          </div>

          <Card
            title={`${fmtNum(r.meta?.total ?? rows.length)} item${(r.meta?.total ?? rows.length) === 1 ? '' : 's'} to reorder`}
            subtitle={r.loading ? 'Updating…' : 'Tick items to start a purchase order.'}
            actions={
              rows.length > 0 && (
                <label className="inline-flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={allOnPage} onChange={togglePage} className="h-4 w-4 accent-honey-500" /> Select page
                </label>
              )
            }
          >
            {rows.length === 0 ? (
              <EmptyState
                icon={<PackageX className="h-10 w-10" />}
                title="Nothing to reorder"
                text="No item is at or below its reorder level with these filters. Items appear after they are bought (received) or once they have a par level."
              />
            ) : (
              <>
                {/* Phones: cards */}
                <ul className="md:hidden divide-y divide-gray-100">
                  {rows.map((x) => (
                    <li key={x.key} className="p-3 flex gap-3">
                      <input type="checkbox" checked={selected.has(x.productId)} onChange={() => toggle(x)} className="mt-1 h-4 w-4 accent-honey-500" aria-label={`Select ${x.name}`} />
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{x.name}</p>
                            <p className="text-[11px] text-gray-500 truncate">
                              {[x.variantLabel, x.code, x.category].filter(Boolean).join(' · ')}
                            </p>
                          </div>
                          <UrgencyBadge u={x.urgency} />
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full bg-red-500" style={{ width: `${stockBar(x)}%` }} />
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-[11px]">
                          <div><span className="text-gray-500">Stock</span><br /><b>{x.stock}</b> / {fmtNum(x.base)}</div>
                          <div><span className="text-gray-500">Fell below</span><br />{x.crossedAt ? `${fmtDate(x.crossedAt)} (${fmtNum(x.daysToCross, 1)} d)` : '—'}</div>
                          <div><span className="text-gray-500">Suggest</span><br /><b>{fmtNum(x.suggestedQty)}</b> pcs</div>
                          <div><span className="text-gray-500">Per day</span><br />{fmtNum(x.avgDailySales, 2)}</div>
                          <div><span className="text-gray-500">Cover</span><br />{x.daysOfCover === null ? '—' : `${fmtNum(x.daysOfCover, 1)} d`}</div>
                          <div><span className="text-gray-500">Vendor</span><br />{x.vendorName || '—'}</div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>

                {/* Tablets / desktop: table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-[11px] uppercase text-gray-500">
                      <tr>
                        <th className="px-3 py-2 w-8" />
                        <th className="px-3 py-2 text-left">Item</th>
                        <th className="px-3 py-2 text-left">Stock left</th>
                        <th className="px-3 py-2 text-left">Bought</th>
                        <th className="px-3 py-2 text-left">Fell below</th>
                        <th className="px-3 py-2 text-right">Sales</th>
                        <th className="px-3 py-2 text-left">6 months</th>
                        <th className="px-3 py-2 text-right">Suggest</th>
                        <th className="px-3 py-2 text-left">Vendor</th>
                        <th className="px-3 py-2 text-right">Cost / price</th>
                        {canEditProducts && <th className="px-2 py-2 w-8" />}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((x) => (
                        <tr key={x.key} className={`align-top ${selected.has(x.productId) ? 'bg-honey-50/40' : 'hover:bg-gray-50'}`}>
                          <td className="px-3 py-2.5">
                            <input type="checkbox" checked={selected.has(x.productId)} onChange={() => toggle(x)} className="h-4 w-4 accent-honey-500" aria-label={`Select ${x.name}`} />
                          </td>
                          <td className="px-3 py-2.5 min-w-[200px]">
                            <div className="flex items-center gap-2">
                              <UrgencyBadge u={x.urgency} />
                              {x.isConsignment && <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-700">Consignment</span>}
                            </div>
                            <p className="font-medium text-gray-900 mt-1">{x.name}</p>
                            <p className="text-[11px] text-gray-500">
                              {[x.variantLabel, x.code, x.category].filter(Boolean).join(' · ')}
                            </p>
                          </td>
                          <td className="px-3 py-2.5 min-w-[130px]">
                            <p>
                              <b className={x.stock <= 0 ? 'text-red-700' : 'text-gray-900'}>{fmtNum(x.stock)}</b>
                              <span className="text-gray-500"> / {fmtNum(x.base)}</span>
                              <span className="text-[11px] text-gray-500"> ({fmtPct(x.pctLeft)})</span>
                            </p>
                            <div className="h-1.5 mt-1 rounded-full bg-gray-100 overflow-hidden">
                              <div className="h-full bg-red-500" style={{ width: `${stockBar(x)}%` }} />
                            </div>
                            <p className="text-[10px] text-gray-500 mt-0.5">
                              base: {BASE_LABEL[x.baseSource]} · at {fmtNum(x.thresholdPct)}%
                            </p>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-xs">
                            <p>{fmtDate(x.lastReceivedAt)}</p>
                            <p className="text-gray-500">{x.lastReceivedQty !== null ? `${fmtNum(x.lastReceivedQty)} pcs` : ''}</p>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-xs">
                            {x.crossedAt ? (
                              <>
                                <p>{fmtDate(x.crossedAt)}</p>
                                <p className="text-gray-500">after {fmtNum(x.daysToCross, 1)} days</p>
                              </>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap text-xs">
                            <p>
                              <b>{fmtNum(x.avgDailySales, 2)}</b>/day
                            </p>
                            <p className={x.daysOfCover !== null && x.daysOfCover <= 7 ? 'text-red-600' : 'text-gray-500'}>
                              {x.daysOfCover === null ? 'no recent sales' : `${fmtNum(x.daysOfCover, 1)} days left`}
                            </p>
                            <p className="text-gray-400">{fmtNum(x.soldSinceReceipt)} sold since bought</p>
                          </td>
                          <td className="px-3 py-2.5">
                            <TrendCell row={x} />
                          </td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap">
                            <p className="font-semibold text-gray-900">{fmtNum(x.suggestedQty)} pcs</p>
                            {x.suggestedBoxes ? <p className="text-[11px] text-gray-500">{x.suggestedBoxes} box/pack × {x.piecesPerBox}</p> : null}
                            <p className="text-[11px] text-gray-500">{formatRs(x.reorderCost)}</p>
                          </td>
                          <td className="px-3 py-2.5 text-xs min-w-[140px]">
                            <p className="text-gray-900">{x.vendorName || '—'}</p>
                            {x.cheapestVendorName && (
                              <p className={x.cheapestVendorId === x.vendorId ? 'text-gray-500' : 'text-emerald-700'}>
                                Cheapest: {x.cheapestVendorName} · {formatRs(x.cheapestPrice)}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap text-xs">
                            <p>{formatRs(x.landedCost)} → {formatRs(x.salePrice)}</p>
                            <p className={x.margin < 0 ? 'text-red-600' : 'text-emerald-700'}>
                              {formatRs(x.margin)} ({fmtPct(x.marginPct)})
                            </p>
                          </td>
                          {canEditProducts && (
                            <td className="px-2 py-2.5">
                              <button type="button" onClick={() => setEditRow(x)} className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100" title="Reorder level for this product" aria-label={`Reorder level for ${x.name}`}>
                                <Pencil className="h-4 w-4" />
                              </button>
                            </td>
                          )}
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

      {/* Sticky action bar for the picked items */}
      {selected.size > 0 && (
        <div className="fixed bottom-3 inset-x-3 sm:inset-x-auto sm:right-6 z-30 bg-gray-900 text-white rounded-xl shadow-xl px-4 py-3 flex flex-wrap items-center gap-3">
          <span className="text-sm">
            {selected.size} product{selected.size === 1 ? '' : 's'} picked
          </span>
          <button type="button" onClick={() => setSelected(new Map())} className="inline-flex items-center gap-1 text-xs text-gray-300 hover:text-white">
            <X className="h-3.5 w-3.5" /> Clear
          </button>
          {canCreatePO ? (
            <Link href={poHref} className={`${primaryBtn} !py-1.5`}>
              <ShoppingCart className="h-4 w-4" /> Create purchase order
            </Link>
          ) : (
            <span className="text-xs text-gray-300">You cannot create purchase orders</span>
          )}
        </div>
      )}

      {settingsOpen && settings && (
        <SettingsModal
          settings={settings}
          canEditGlobal={canEditGlobal}
          onClose={() => setSettingsOpen(false)}
          onSaved={() => {
            setSettingsOpen(false);
            r.reload();
          }}
        />
      )}
      {editRow && (
        <ProductLevelModal
          row={editRow}
          defaultPct={settings?.thresholdPct ?? 25}
          onClose={() => setEditRow(null)}
          onSaved={() => {
            setEditRow(null);
            r.reload();
          }}
        />
      )}
    </div>
  );
}

function SettingsModal({
  settings,
  canEditGlobal,
  onClose,
  onSaved,
}: {
  settings: { thresholdPct: number; coverDays: number };
  canEditGlobal: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pct, setPct] = useState(String(settings.thresholdPct));
  const [cover, setCover] = useState(String(settings.coverDays));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const save = async () => {
    if (lock.current) return;
    const p = Number(pct);
    const c = Number(cover);
    if (!(p >= 1 && p <= 100)) return setError('Reorder % must be between 1 and 100.');
    if (!(c >= 1 && c <= 365)) return setError('Cover days must be between 1 and 365.');
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await storeApi.put('/analytics/demand/settings', { thresholdPct: p, coverDays: Math.round(c) });
      toast.success('Demand settings saved');
      onSaved();
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not save the settings.'));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <Modal
      title="Demand settings"
      subtitle="Store-wide rules (each product can override the %)"
      icon={<Settings2 className="h-5 w-5" />}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryBtn} disabled={busy}>
            Close
          </button>
          {canEditGlobal && (
            <button type="button" onClick={save} className={primaryBtn} disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {!canEditGlobal && <HelpBox>Only the super admin can change these. You can still set a par level per product with the pencil button.</HelpBox>}
        <Field label="Reorder when stock falls to (% of last bought quantity)" hint="Default 25%.">
          <input type="number" min={1} max={100} value={pct} onChange={(e) => setPct(e.target.value)} className={inputClass} disabled={!canEditGlobal} />
        </Field>
        <Field label="Suggested order covers (days of sales)" hint="Default 30 days.">
          <input type="number" min={1} max={365} value={cover} onChange={(e) => setCover(e.target.value)} className={inputClass} disabled={!canEditGlobal} />
        </Field>
        <ErrorBox message={error} />
      </div>
    </Modal>
  );
}

function ProductLevelModal({ row, defaultPct, onClose, onSaved }: { row: DemandRow; defaultPct: number; onClose: () => void; onSaved: () => void }) {
  const [par, setPar] = useState(row.parLevel === null ? '' : String(row.parLevel));
  const [pct, setPct] = useState(row.reorderPct === null ? '' : String(row.reorderPct));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const preview = useMemo(() => {
    const base = par ? Number(par) : row.lastReceivedQty || row.base;
    const p = pct ? Number(pct) : defaultPct;
    return base > 0 && p > 0 ? Math.round(((base * p) / 100) * 10) / 10 : null;
  }, [par, pct, row, defaultPct]);
  const save = async () => {
    if (lock.current) return;
    if (par && !(Number(par) >= 0)) return setError('Par level must be 0 or more.');
    if (pct && !(Number(pct) >= 1 && Number(pct) <= 100)) return setError('Reorder % must be between 1 and 100.');
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await storeApi.put('/analytics/demand/settings', {
        products: [{ productId: row.productId, parLevel: par === '' ? null : Number(par), reorderPct: pct === '' ? null : Number(pct) }],
      });
      toast.success('Reorder level saved');
      onSaved();
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not save.'));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <Modal
      title="Reorder level"
      subtitle={row.name}
      icon={<Pencil className="h-5 w-5" />}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryBtn} disabled={busy}>
            Cancel
          </button>
          <button type="button" onClick={save} className={primaryBtn} disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-gray-500">Applies to the whole product (all variants). Leave empty to use the store rule.</p>
        <Field label="Par level (target pieces)" hint={`Empty = last bought quantity (${row.lastReceivedQty ?? '—'} pcs).`}>
          <input type="number" min={0} value={par} onChange={(e) => setPar(e.target.value)} className={inputClass} placeholder="e.g. 100" />
        </Field>
        <Field label="Reorder at (%)" hint={`Empty = store rule (${defaultPct}%).`}>
          <input type="number" min={1} max={100} value={pct} onChange={(e) => setPct(e.target.value)} className={inputClass} placeholder={String(defaultPct)} />
        </Field>
        {preview !== null && (
          <p className="text-sm text-gray-700">
            Shows in the demand list at <b>{fmtNum(preview, 1)}</b> pieces or fewer.
          </p>
        )}
        <ErrorBox message={error} />
      </div>
    </Modal>
  );
}
