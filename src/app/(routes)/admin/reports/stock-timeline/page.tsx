'use client';

// Stock timeline of one product in the shop: when each lot arrived, how long
// it waited in the warehouse, when it reached a shelf, and how fast it sold.

import { Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowDownUp,
  ArrowLeftRight,
  Gift,
  Info,
  LayoutGrid,
  Lightbulb,
  PackagePlus,
  PackageX,
  Route,
  ShoppingBasket,
  ShoppingCart,
  SlidersHorizontal,
  Truck,
  Undo2,
  Warehouse,
} from 'lucide-react';
import { LoadingCard, NoAccessCard } from '@/components/admin/FormBits';
import ProductInsightPanel from '@/components/store/ProductInsightPanel';
import { useAccess } from '@/context/AccessContext';
import { storeApi, apiErrorMessage, formatRs, formatDate } from '@/lib/storeApi';
import { unitTitle, type MovementRow } from '../../inventory/movements/_shared/stockOpsApi';
import { ErrorCard, MovementTypeBadge, PageHeader, ProductPicker, StatCard, cardClass, thClass } from '../../inventory/movements/_shared/StockOpsBits';

interface Lot {
  lotId: string;
  type: string;
  typeLabel: string;
  synthetic: boolean;
  receivedAt: string | null;
  qty: number;
  vendorName: string;
  unitCost: number | null;
  purchasePrice: number | null;
  refNo: string;
  firstShelvedAt: string | null;
  daysInWarehouse: number | null;
  waitingInWarehouse: boolean;
  inWarehouse: number;
  sold: number;
  otherOut: number;
  onHand: number;
  daysTo50: number | null;
  daysTo100: number | null;
  status: 'sold_out' | 'selling' | 'not_started';
}

interface TimelineEvent extends MovementRow {
  day: string;
  count: number;
  lastAt: string;
}

interface Timeline {
  product: { id: string; name: string; variantId: string | null; variantLabel: string; code: string; category: string; variants: { variantId: string; label: string }[] };
  split: { total: number; shelved: number; warehouse: number };
  summary: {
    received: number;
    sold: number;
    otherOut: number;
    onHand: number;
    lots: number;
    firstReceivedAt: string | null;
    lastReceivedAt: string | null;
    lastShelvedAt: string | null;
    lastSoldAt: string | null;
    avgDaysInWarehouse: number | null;
    avgDaysTo50: number | null;
    avgDaysTo100: number | null;
  };
  lots: Lot[];
  events: TimelineEvent[];
  truncated: boolean;
}

const days = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${n} day${n === 1 ? '' : 's'}`);

const EVENT_ICON: Record<string, ReactNode> = {
  purchase_receipt: <Truck className="h-4 w-4" />,
  receive: <PackagePlus className="h-4 w-4" />,
  opening: <PackagePlus className="h-4 w-4" />,
  consignment_in: <Truck className="h-4 w-4" />,
  transfer_in: <ArrowLeftRight className="h-4 w-4" />,
  transfer_out: <ArrowLeftRight className="h-4 w-4" />,
  putaway: <LayoutGrid className="h-4 w-4" />,
  location_move: <ArrowDownUp className="h-4 w-4" />,
  sale: <ShoppingCart className="h-4 w-4" />,
  gift: <Gift className="h-4 w-4" />,
  sale_return: <Undo2 className="h-4 w-4" />,
  damage: <PackageX className="h-4 w-4" />,
  internal_use: <ShoppingBasket className="h-4 w-4" />,
  vendor_return: <Undo2 className="h-4 w-4" />,
  consignment_return: <Undo2 className="h-4 w-4" />,
  adjustment_in: <SlidersHorizontal className="h-4 w-4" />,
  adjustment_out: <SlidersHorizontal className="h-4 w-4" />,
};

/** One readable sentence per event. */
function eventText(e: TimelineEvent) {
  const pcs = `${e.quantity} pc${e.quantity === 1 ? '' : 's'}`;
  switch (e.type) {
    case 'purchase_receipt':
    case 'consignment_in':
      return `${e.typeLabel}: ${pcs}${e.vendorName ? ` from ${e.vendorName}` : ''}${e.unitCost !== null ? ` · landed ${formatRs(e.unitCost, { decimals: 2 })}` : ''} → ${e.to || 'Warehouse'}`;
    case 'putaway':
      return `Put on shelf ${e.to}: ${pcs}`;
    case 'location_move':
      return `Moved ${pcs}: ${e.from} → ${e.to}`;
    case 'sale':
      return `Sold ${pcs}${e.count > 1 ? ` (${e.count} bills)` : ''}${e.from ? ` from ${e.from}` : ''}`;
    case 'gift':
      return `Given free: ${pcs}${e.count > 1 ? ` (${e.count} bills)` : ''}`;
    default:
      return `${e.typeLabel}: ${pcs}${e.from && e.direction === 'out' ? ` from ${e.from}` : ''}${e.to && e.direction === 'in' ? ` → ${e.to}` : ''}`;
  }
}

function TimelineInner() {
  const { can } = useAccess();
  const canView = can(['report_stock_movement', 'stock_movements'], 'view');
  const router = useRouter();
  const params = useSearchParams();
  const productId = params.get('productId') || '';
  const variantId = params.get('variantId') || '';

  const [data, setData] = useState<Timeline | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newestFirst, setNewestFirst] = useState(false);
  const [insightOpen, setInsightOpen] = useState(false);

  const load = useCallback(async () => {
    if (!canView || !productId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await storeApi.get<Timeline>(`/stock-movements/timeline/${productId}`, { variantId: variantId || undefined });
      setData(res.data);
    } catch (e) {
      setData(null);
      setError(apiErrorMessage(e, 'Could not load the timeline.'));
    } finally {
      setLoading(false);
    }
  }, [canView, productId, variantId]);

  useEffect(() => {
    load();
  }, [load]);

  const go = (pid: string, vid?: string | null) => {
    const q = new URLSearchParams({ productId: pid });
    if (vid) q.set('variantId', vid);
    router.push(`/admin/reports/stock-timeline?${q.toString()}`, { scroll: false });
  };

  if (!canView) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <NoAccessCard />
      </div>
    );
  }

  const s = data?.summary;
  const events = data ? (newestFirst ? [...data.events].reverse() : data.events) : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <PageHeader title="Stock Timeline" subtitle="When it arrived, how long it stayed in the warehouse, when it reached the shelf and how fast it sold." />

        <div className={`${cardClass} p-3 sm:p-4 mb-4`}>
          <ProductPicker placeholder="Scan or search a product to see its timeline" onPick={(u) => go(u.productId, u.variantId)} autoFocus={!productId} />
        </div>

        {!productId ? (
          <div className={`${cardClass} text-center py-14 px-4`}>
            <Route className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Choose a product above.</p>
          </div>
        ) : loading && !data ? (
          <LoadingCard text="Building the timeline…" />
        ) : error ? (
          <ErrorCard message={error} onRetry={load} />
        ) : data && s ? (
          <div className="space-y-4">
            {/* Product + split */}
            <div className={`${cardClass} p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3`}>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 truncate">{unitTitle({ name: data.product.name, variantLabel: data.product.variantLabel })}</h2>
                <p className="text-xs text-gray-500">
                  {data.product.code && <span className="font-mono">#{data.product.code} · </span>}
                  {data.product.category}
                </p>
                {data.product.variants.length > 1 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {data.product.variants.map((v) => (
                      <button
                        key={v.variantId}
                        type="button"
                        onClick={() => go(data.product.id, v.variantId)}
                        className={`px-2 py-0.5 rounded-full text-xs border ${v.variantId === data.product.variantId ? 'bg-honey-500 text-gray-900 border-honey-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                      >
                        {v.label || v.variantId}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 text-xs text-gray-700">
                  <strong>{data.split.total}</strong> on hand
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 text-xs text-indigo-700">
                  <LayoutGrid className="h-3.5 w-3.5" /> {data.split.shelved} on shelves
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 text-xs text-amber-700">
                  <Warehouse className="h-3.5 w-3.5" /> {data.split.warehouse} in warehouse
                </span>
                <button type="button" onClick={() => setInsightOpen(true)} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-honey-200 bg-honey-50 text-xs font-medium text-honey-700 hover:bg-honey-100">
                  <Lightbulb className="h-3.5 w-3.5" /> Insights
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
              <StatCard label="Received" value={`${s.received} pcs`} hint={`${s.lots} lot${s.lots === 1 ? '' : 's'}`} />
              <StatCard label="Sold" value={`${s.sold} pcs`} hint={s.otherOut ? `${s.otherOut} other out` : undefined} tone="green" />
              <StatCard label="Avg days in warehouse" value={days(s.avgDaysInWarehouse)} tone={s.avgDaysInWarehouse !== null && s.avgDaysInWarehouse > 7 ? 'amber' : 'default'} />
              <StatCard label="Avg days to 50% gone" value={days(s.avgDaysTo50)} />
              <StatCard label="Avg days to sell out" value={days(s.avgDaysTo100)} />
              <StatCard label="Last sold" value={s.lastSoldAt ? formatDate(s.lastSoldAt) : '—'} />
            </div>

            {/* Lots */}
            <div className={`${cardClass} overflow-hidden`}>
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Lots (each delivery)</h3>
                <p className="text-[11px] text-gray-500">Oldest pieces are counted as sold first (FIFO).</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className={thClass}>Received</th>
                      <th className={thClass}>Vendor</th>
                      <th className={`${thClass} text-right`}>Qty</th>
                      <th className={`${thClass} text-right`}>Landed cost</th>
                      <th className={thClass}>First on shelf</th>
                      <th className={`${thClass} text-right`}>50% gone</th>
                      <th className={`${thClass} text-right`}>Sold out</th>
                      <th className={`${thClass} text-right`}>Sold</th>
                      <th className={`${thClass} text-right`}>On hand</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {data.lots.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-500">
                          No stock received yet.
                        </td>
                      </tr>
                    ) : (
                      data.lots.map((l) => (
                        <tr key={l.lotId} className={l.status === 'sold_out' ? 'text-gray-500' : ''}>
                          <td className="px-3 sm:px-4 py-2.5 text-sm whitespace-nowrap">
                            <div className="font-medium">{l.receivedAt ? formatDate(l.receivedAt) : '—'}</div>
                            <div className="text-[11px] text-gray-500">
                              {l.typeLabel}
                              {l.refNo ? ` · ${l.refNo}` : ''}
                            </div>
                          </td>
                          <td className="px-3 sm:px-4 py-2.5 text-sm">{l.vendorName || '—'}</td>
                          <td className="px-3 sm:px-4 py-2.5 text-right text-sm">{l.qty}</td>
                          <td className="px-3 sm:px-4 py-2.5 text-right text-xs whitespace-nowrap">
                            {l.unitCost !== null ? formatRs(l.unitCost, { decimals: 2 }) : '—'}
                            {l.purchasePrice !== null && <div className="text-[10px] text-gray-500">vendor {formatRs(l.purchasePrice)}</div>}
                          </td>
                          <td className="px-3 sm:px-4 py-2.5 text-xs whitespace-nowrap">
                            {l.firstShelvedAt ? (
                              <>
                                {formatDate(l.firstShelvedAt)}
                                <div className={`text-[10px] ${l.daysInWarehouse !== null && l.daysInWarehouse > 7 ? 'text-amber-700' : 'text-gray-500'}`}>after {days(l.daysInWarehouse)} in warehouse</div>
                              </>
                            ) : l.waitingInWarehouse ? (
                              <span className="text-amber-700">Still in warehouse ({days(l.daysInWarehouse)})</span>
                            ) : (
                              <span className="text-gray-400">Sold from warehouse</span>
                            )}
                          </td>
                          <td className="px-3 sm:px-4 py-2.5 text-right text-xs whitespace-nowrap">{days(l.daysTo50)}</td>
                          <td className="px-3 sm:px-4 py-2.5 text-right text-xs whitespace-nowrap">{l.daysTo100 !== null ? days(l.daysTo100) : <span className="text-gray-400">not yet</span>}</td>
                          <td className="px-3 sm:px-4 py-2.5 text-right text-sm whitespace-nowrap">
                            {l.sold}
                            {l.otherOut > 0 && <div className="text-[10px] text-gray-500">+{l.otherOut} other</div>}
                          </td>
                          <td className="px-3 sm:px-4 py-2.5 text-right text-sm font-semibold whitespace-nowrap">
                            {l.onHand}
                            {l.inWarehouse > 0 && <div className="text-[10px] font-normal text-amber-700">{l.inWarehouse} in warehouse</div>}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Vertical timeline */}
            <div className={`${cardClass}`}>
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-gray-900">Timeline</h3>
                <button type="button" onClick={() => setNewestFirst((v) => !v)} className="text-xs font-medium text-honey-700 hover:text-honey-800 inline-flex items-center gap-1">
                  <ArrowDownUp className="h-3.5 w-3.5" />
                  {newestFirst ? 'Oldest first' : 'Newest first'}
                </button>
              </div>
              {events.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-gray-500">No movements yet.</p>
              ) : (
                <ol className="relative px-4 py-4">
                  {events.map((e, i) => (
                    <li key={`${e._id}-${i}`} className="relative pl-10 pb-4 last:pb-0">
                      {i < events.length - 1 && <span className="absolute left-[15px] top-8 bottom-0 w-px bg-gray-200" aria-hidden />}
                      <span
                        className={`absolute left-0 top-0.5 flex h-8 w-8 items-center justify-center rounded-full border ${
                          e.direction === 'in' ? 'bg-blue-50 text-blue-700 border-blue-200' : e.direction === 'out' ? (e.type === 'sale' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200') : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        }`}
                      >
                        {EVENT_ICON[e.type] || <Info className="h-4 w-4" />}
                      </span>
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1">
                        <div className="min-w-0">
                          <div className="text-sm text-gray-900">{eventText(e)}</div>
                          <div className="text-[11px] text-gray-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                            <MovementTypeBadge type={e.type} label={e.typeLabel} />
                            {e.refNo && <span className="font-mono">{e.refNo}</span>}
                            {e.userName && <span>· {e.userName}</span>}
                            {e.note && <span className="truncate max-w-[240px]">· {e.note}</span>}
                          </div>
                        </div>
                        <div className="text-right text-[11px] text-gray-500 whitespace-nowrap">
                          <div>{formatDate(e.occurredAt, e.count === 1)}</div>
                          {e.balanceAfter !== null && <div>balance {e.balanceAfter}</div>}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              {data.truncated && <p className="px-4 pb-3 text-[11px] text-gray-500">Showing the latest events only.</p>}
            </div>
          </div>
        ) : null}
      </div>

      <ProductInsightPanel productId={productId || null} variantId={variantId || null} open={insightOpen && !!productId} onClose={() => setInsightOpen(false)} />
    </div>
  );
}

export default function StockTimelinePage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-8"><LoadingCard text="Loading…" /></div>}>
      <TimelineInner />
    </Suspense>
  );
}
