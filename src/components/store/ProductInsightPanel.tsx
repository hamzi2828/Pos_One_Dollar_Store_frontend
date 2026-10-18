'use client';

// Product history & insight panel (slide-over): price history (first price,
// current price, landed cost), vendors and their prices, cheaper vendor
// recommendation, stock per shelf / warehouse, sales, recent movements.
// OWNER: Stock operations module.
// USED BY: POS screen (product info button), product list, demand list.
//
// Contract (keep stable):
//   <ProductInsightPanel productId="..." variantId={null} open onClose={() => ...} />
// Backend: GET /api/product-insights/:productId?variantId=

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  X,
  Loader2,
  AlertCircle,
  RefreshCw,
  TrendingDown,
  Truck,
  Warehouse,
  LayoutGrid,
  ShoppingCart,
  History,
  Route,
  Tag,
  BadgeCheck,
} from 'lucide-react';
import { storeApi, apiErrorMessage, formatRs, formatDate } from '@/lib/storeApi';

export interface ProductInsightPanelProps {
  productId: string | null;
  variantId?: string | null;
  open: boolean;
  onClose: () => void;
}

/* ---------------- response types ---------------- */

interface VendorStat {
  vendorId: string;
  name: string;
  firstPrice: number;
  lastPrice: number;
  minPrice: number;
  avgPrice: number;
  totalQty: number;
  receipts: number;
  lastDate: string;
  lastLandedCost: number | null;
  isCurrent: boolean;
}

interface Insight {
  product: {
    id: string;
    name: string;
    category: string;
    thumbnailUrl: string | null;
    productType: string;
    variantId: string | null;
    variantLabel: string;
    variants: { variantId: string; label: string; price: number }[];
    codes: { shortCode: string; sku: string; barcodes: string[] };
    salePrice: number;
    discountedPrice: number | null;
    priceTier: { id: string; name?: string; price?: number | null } | null;
    avgCost: number | null;
    lastLandedCost: number | null;
    margin: { amount: number; pct: number | null } | null;
    isConsignment: boolean;
    totalStock: number;
  };
  price: {
    firstPurchasePrice: number | null;
    firstLandedCost: number | null;
    firstReceivedAt: string | null;
    lastPurchasePrice: number | null;
    lastLandedCost: number | null;
    lastReceivedAt: string | null;
    avgCost: number | null;
    firstSalePrice: number | null;
    salePrice: number;
    receipts: { at: string; type: string; vendorName: string; qty: number; purchasePrice: number | null; landedCost: number | null; refNo: string }[];
    changes: { field: string; oldValue: number | null; newValue: number | null; changedAt: string; source: string; userName: string }[];
  };
  vendors: VendorStat[];
  currentVendor: { vendorId: string; name: string } | null;
  recommendation: {
    vendor: { vendorId: string; name: string };
    price: number;
    currentVendor: { vendorId: string; name: string };
    currentPrice: number;
    savingPerPiece: number;
    savingPct: number;
    lastDate: string;
  } | null;
  stock: { variantId: string | null; total: number; shelved: number; warehouse: number; shelves: { code: string; qty: number; isHome: boolean }[] }[];
  sales: { d7: { qty: number }; d30: { qty: number }; d90: { qty: number; orders: number }; avgPerDay30: number; lastSoldAt: string | null };
  movements: { _id: string; occurredAt: string; type: string; typeLabel: string; quantity: number; qtyChange: number; balanceAfter: number | null; from: string; to: string; refNo: string; userName: string }[];
}

/* ---------------- cache (per product + variant, short TTL) ---------------- */

const CACHE_MS = 2 * 60 * 1000;
const cache = new Map<string, { at: number; data: Insight }>();

async function fetchInsight(productId: string, variantId: string | null, force = false): Promise<Insight> {
  const key = `${productId}:${variantId || ''}`;
  const hit = cache.get(key);
  if (!force && hit && Date.now() - hit.at < CACHE_MS) return hit.data;
  const res = await storeApi.get<Insight>(`/product-insights/${productId}`, { variantId: variantId || undefined });
  cache.set(key, { at: Date.now(), data: res.data });
  return res.data;
}

const shortDate = (d: string | null | undefined) => {
  if (!d) return '';
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? '' : x.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

const rs = (n: number | null | undefined) => (n === null || n === undefined ? '—' : formatRs(n));

function Section({ icon, title, children, right }: { icon: React.ReactNode; title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-gray-100">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <span className="text-honey-700">{icon}</span>
          {title}
        </h3>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export default function ProductInsightPanel({ productId, variantId = null, open, onClose }: ProductInsightPanelProps) {
  const [activeVariant, setActiveVariant] = useState<string | null>(variantId);
  const [data, setData] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setActiveVariant(variantId ?? null), [variantId, productId]);

  const load = useCallback(
    async (force = false) => {
      if (!productId) return;
      // Never show another product's numbers while the new one loads.
      if (!force) setData((d) => (d && d.product.id === productId && (d.product.variantId || null) === (activeVariant || null) ? d : null));
      setLoading(true);
      setError(null);
      try {
        setData(await fetchInsight(productId, activeVariant, force));
      } catch (e) {
        setError(apiErrorMessage(e, 'Could not load product insights.'));
      } finally {
        setLoading(false);
      }
    },
    [productId, activeVariant]
  );

  useEffect(() => {
    if (open && productId) load();
  }, [open, productId, load]);

  // Esc closes; page behind does not scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !productId) return null;

  const p = data?.product;
  const pr = data?.price;
  const timelineHref = `/admin/reports/stock-timeline?productId=${productId}${p?.variantId ? `&variantId=${encodeURIComponent(p.variantId)}` : ''}`;
  const ledgerHref = `/admin/inventory/movements?productId=${productId}${p?.variantId ? `&variantId=${encodeURIComponent(p.variantId)}` : ''}`;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-label="Product insights">
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-[1px]" onClick={onClose} />
      <aside className="relative h-full w-full sm:max-w-xl bg-gray-50 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-start gap-3 px-4 py-3 bg-white border-b border-gray-200">
          {p?.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.thumbnailUrl.startsWith('/') ? `${process.env.NEXT_PUBLIC_BACKEND_URL || ''}${p.thumbnailUrl}` : p.thumbnailUrl}
              alt=""
              className="h-12 w-12 rounded-lg object-cover border border-gray-200 flex-shrink-0"
            />
          ) : (
            <div className="h-12 w-12 rounded-lg bg-honey-50 text-honey-700 flex items-center justify-center flex-shrink-0">
              <Tag className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-gray-900 truncate">{p ? p.name : 'Product insights'}</h2>
            {p && (
              <p className="text-xs text-gray-500 truncate">
                {p.variantLabel ? `${p.variantLabel} · ` : ''}
                {p.category}
                {p.codes.shortCode ? ` · #${p.codes.shortCode}` : ''}
                {p.isConsignment ? ' · Consignment' : ''}
              </p>
            )}
          </div>
          <button type="button" onClick={() => load(true)} disabled={loading} className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-50" title="Refresh">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button type="button" onClick={onClose} className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Variant switcher */}
        {p && p.variants.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto px-4 py-2 bg-white border-b border-gray-100">
            {[{ variantId: '', label: 'All' }, ...p.variants].map((v) => {
              const active = (activeVariant || '') === v.variantId;
              return (
                <button
                  key={v.variantId || 'all'}
                  type="button"
                  onClick={() => setActiveVariant(v.variantId || null)}
                  className={`px-2.5 py-1 rounded-full text-xs whitespace-nowrap border ${active ? 'bg-honey-500 text-gray-900 border-honey-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                >
                  {v.label || v.variantId}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
          {loading && !data && (
            <div className="py-16 text-center">
              <Loader2 className="h-8 w-8 text-honey-700 mx-auto mb-3 animate-spin" />
              <p className="text-sm text-gray-500">Loading product history…</p>
            </div>
          )}
          {error && (
            <div className="bg-white rounded-xl border border-red-200 p-6 text-center">
              <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
              <p className="text-sm text-red-700 mb-3">{error}</p>
              <button type="button" onClick={() => load(true)} className="text-sm font-medium text-honey-700 hover:text-honey-800">
                Try again
              </button>
            </div>
          )}

          {data && p && pr && (
            <>
              {/* Price */}
              <Section icon={<Tag className="h-4 w-4" />} title="Price">
                <p className="text-sm text-gray-800 leading-relaxed">
                  {pr.firstPurchasePrice !== null ? (
                    <>
                      Started at <strong>{rs(pr.firstPurchasePrice)}</strong>
                      {pr.firstReceivedAt ? ` on ${shortDate(pr.firstReceivedAt)}` : ''} →{' '}
                    </>
                  ) : (
                    <>No purchase recorded yet. </>
                  )}
                  {pr.lastLandedCost !== null || pr.avgCost !== null ? (
                    <>
                      now <strong>{rs(pr.lastLandedCost ?? pr.avgCost)}</strong> landed;{' '}
                    </>
                  ) : null}
                  sells at <strong>{rs(p.salePrice)}</strong>
                  {p.margin && p.margin.pct !== null ? (
                    <>
                      ; margin <strong className={p.margin.pct < 20 ? 'text-red-600' : 'text-green-700'}>{Math.round(p.margin.pct)}%</strong>
                    </>
                  ) : null}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                  <Fact label="Sale price" value={rs(p.salePrice)} />
                  <Fact label="Avg landed cost" value={rs(p.avgCost)} />
                  <Fact label="Margin / pc" value={p.margin ? rs(p.margin.amount) : '—'} />
                  <Fact label="Price tier" value={p.priceTier ? p.priceTier.name || rs(p.priceTier.price ?? null) : '—'} />
                  <Fact label="Last vendor price" value={rs(pr.lastPurchasePrice)} />
                  <Fact label="Last received" value={pr.lastReceivedAt ? formatDate(pr.lastReceivedAt) : '—'} />
                  <Fact label="First sale price" value={rs(pr.firstSalePrice)} />
                  <Fact label="Codes" value={[p.codes.shortCode, p.codes.sku, ...p.codes.barcodes].filter(Boolean).slice(0, 3).join(', ') || '—'} mono />
                </div>
                {pr.receipts.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs font-medium text-gray-500 mb-1">Landed cost per receipt</div>
                    <ul className="divide-y divide-gray-100 text-xs">
                      {pr.receipts.slice(0, 6).map((r, i) => (
                        <li key={i} className="flex items-center justify-between gap-2 py-1.5">
                          <span className="text-gray-600 truncate">
                            {shortDate(r.at)} · {r.vendorName || '—'} · {r.qty} pcs
                          </span>
                          <span className="whitespace-nowrap text-gray-900">
                            {rs(r.purchasePrice)} → <strong>{rs(r.landedCost)}</strong>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {pr.changes.filter((c) => c.field === 'price').length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs font-medium text-gray-500 mb-1">Sale price changes</div>
                    <ul className="divide-y divide-gray-100 text-xs">
                      {pr.changes
                        .filter((c) => c.field === 'price')
                        .slice(0, 5)
                        .map((c, i) => (
                          <li key={i} className="flex items-center justify-between gap-2 py-1.5">
                            <span className="text-gray-600 truncate">
                              {shortDate(c.changedAt)} {c.userName ? `· ${c.userName}` : ''}
                            </span>
                            <span className="whitespace-nowrap text-gray-900">
                              {rs(c.oldValue)} → <strong>{rs(c.newValue)}</strong>
                            </span>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </Section>

              {/* Cheaper vendor callout */}
              {data.recommendation && (
                <div className="flex items-start gap-3 rounded-xl border border-green-300 bg-green-50 p-3.5">
                  <TrendingDown className="h-5 w-5 text-green-700 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-green-900">
                    <div className="font-semibold">Cheaper vendor available</div>
                    <p className="mt-0.5">
                      <strong>{data.recommendation.vendor.name}</strong> supplied it at <strong>{rs(data.recommendation.price)}</strong>
                      {data.recommendation.lastDate ? ` (last on ${shortDate(data.recommendation.lastDate)})` : ''} — {rs(data.recommendation.savingPerPiece)} less per piece (
                      {Math.round(data.recommendation.savingPct)}%) than {data.recommendation.currentVendor.name} ({rs(data.recommendation.currentPrice)}).
                    </p>
                  </div>
                </div>
              )}

              {/* Vendors */}
              <Section icon={<Truck className="h-4 w-4" />} title="Vendors">
                {data.vendors.length === 0 ? (
                  <p className="text-sm text-gray-500">No vendor purchases recorded yet.</p>
                ) : (
                  <div className="overflow-x-auto -mx-4">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="text-left text-gray-500">
                          <th className="px-4 py-1.5 font-medium">Vendor</th>
                          <th className="px-2 py-1.5 font-medium text-right">First</th>
                          <th className="px-2 py-1.5 font-medium text-right">Last</th>
                          <th className="px-2 py-1.5 font-medium text-right">Min</th>
                          <th className="px-2 py-1.5 font-medium text-right">Avg</th>
                          <th className="px-2 py-1.5 font-medium text-right">Qty</th>
                          <th className="px-4 py-1.5 font-medium text-right">Last</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {data.vendors.map((v) => {
                          const cheaper = data.recommendation?.vendor.vendorId === v.vendorId;
                          return (
                            <tr key={v.vendorId} className={cheaper ? 'bg-green-50' : ''}>
                              <td className="px-4 py-2 text-gray-900">
                                <span className="inline-flex items-center gap-1">
                                  {v.name}
                                  {v.isCurrent && <BadgeCheck className="h-3.5 w-3.5 text-blue-600" aria-label="Current vendor" />}
                                </span>
                                <div className="text-[10px] text-gray-500">{v.receipts} receipt{v.receipts === 1 ? '' : 's'}</div>
                              </td>
                              <td className="px-2 py-2 text-right whitespace-nowrap">{rs(v.firstPrice)}</td>
                              <td className={`px-2 py-2 text-right whitespace-nowrap font-medium ${cheaper ? 'text-green-700' : 'text-gray-900'}`}>{rs(v.lastPrice)}</td>
                              <td className="px-2 py-2 text-right whitespace-nowrap">{rs(v.minPrice)}</td>
                              <td className="px-2 py-2 text-right whitespace-nowrap">{rs(v.avgPrice)}</td>
                              <td className="px-2 py-2 text-right">{v.totalQty}</td>
                              <td className="px-4 py-2 text-right whitespace-nowrap text-gray-600">{shortDate(v.lastDate)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>

              {/* Stock & shelves */}
              <Section icon={<Warehouse className="h-4 w-4" />} title="Stock & shelves" right={<span className="text-xs font-semibold text-gray-700">{p.totalStock} pcs</span>}>
                {data.stock.length === 0 ? (
                  <p className="text-sm text-gray-500">No stock.</p>
                ) : (
                  <ul className="space-y-2.5">
                    {data.stock.map((s) => (
                      <li key={s.variantId || 'product'} className="text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-gray-900">
                            {s.variantId ? p?.variants.find((v) => v.variantId === s.variantId)?.label || 'Variant' : 'In the shop'}
                          </span>
                          <span className="text-gray-700">{s.total} pcs</span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {s.shelves.map((sh) => (
                            <span key={sh.code} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[11px] font-mono">
                              <LayoutGrid className="h-3 w-3" />
                              {sh.code} × {sh.qty}
                              {sh.isHome ? ' ★' : ''}
                            </span>
                          ))}
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-[11px]">
                            <Warehouse className="h-3 w-3" />
                            Warehouse × {s.warehouse}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              {/* Sales */}
              <Section icon={<ShoppingCart className="h-4 w-4" />} title="Sales">
                <div className="grid grid-cols-3 gap-2">
                  <Fact label="Last 7 days" value={`${data.sales.d7.qty} pcs`} />
                  <Fact label="Last 30 days" value={`${data.sales.d30.qty} pcs`} />
                  <Fact label="Last 90 days" value={`${data.sales.d90.qty} pcs`} />
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {data.sales.lastSoldAt ? `Last sold ${formatDate(data.sales.lastSoldAt, true)}` : 'Not sold yet'} · about {data.sales.avgPerDay30} / day (30 days)
                </p>
              </Section>

              {/* Recent movements */}
              <Section
                icon={<History className="h-4 w-4" />}
                title="Recent movements"
                right={
                  <Link href={ledgerHref} className="text-xs font-medium text-honey-700 hover:text-honey-800" onClick={onClose}>
                    Full ledger
                  </Link>
                }
              >
                {data.movements.length === 0 ? (
                  <p className="text-sm text-gray-500">No movements yet.</p>
                ) : (
                  <ul className="divide-y divide-gray-100 text-xs">
                    {data.movements.map((m) => (
                      <li key={m._id} className="flex items-center justify-between gap-2 py-1.5">
                        <span className="min-w-0">
                          <span className="font-medium text-gray-900">{m.typeLabel}</span>
                          <span className="text-gray-500">
                            {' '}
                            · {shortDate(m.occurredAt)}
                            {m.refNo ? ` · ${m.refNo}` : ''}
                            {m.from || m.to ? ` · ${[m.from, m.to].filter(Boolean).join(' → ')}` : ''}
                          </span>
                        </span>
                        <span className={`whitespace-nowrap font-semibold ${m.qtyChange > 0 ? 'text-green-700' : m.qtyChange < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                          {m.qtyChange > 0 ? `+${m.qtyChange}` : m.qtyChange < 0 ? m.qtyChange : `↔ ${m.quantity}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </>
          )}
        </div>

        <div className="px-4 py-3 bg-white border-t border-gray-200 flex items-center justify-between gap-2">
          <Link
            href={timelineHref}
            onClick={onClose}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-honey-700 hover:text-honey-800"
          >
            <Route className="h-4 w-4" />
            Full stock timeline
          </Link>
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
            Close
          </button>
        </div>
      </aside>
    </div>
  );
}

function Fact({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="rounded-lg bg-gray-50 border border-gray-100 px-2.5 py-1.5 min-w-0">
      <div className="text-[10px] text-gray-500">{label}</div>
      <div className={`text-sm font-semibold text-gray-900 truncate ${mono ? 'font-mono text-xs' : ''}`}>{value}</div>
    </div>
  );
}
