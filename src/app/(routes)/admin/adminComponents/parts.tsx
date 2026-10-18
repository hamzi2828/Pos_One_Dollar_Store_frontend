'use client';

// Building blocks of the owner's dashboard (AdminDashboardClient.tsx).
import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Info,
  PackageCheck,
  PackageOpen,
  PackageX,
  Receipt,
  ShoppingCart,
  Store,
} from 'lucide-react';
import { formatRs } from '@/lib/storeApi';
import { useAccess } from '@/context/AccessContext';
import type { AttentionItem, AttentionLevel, RecentBill, StockSnapshot, TillsNow, TopProduct } from '../dashboardService';

/* ------------------------------------------------------------------ */
/* Delta chip: direction icon + % (never colour alone)                  */
/* ------------------------------------------------------------------ */

export function Delta({ now, prev, goodWhenUp = true, dark = false }: { now: number; prev: number; goodWhenUp?: boolean; dark?: boolean }) {
  if (!prev && !now) return <span className={`text-xs ${dark ? 'text-gray-500' : 'text-gray-400'}`}>No change</span>;
  if (!prev) return <span className={`text-xs font-medium ${dark ? 'text-emerald-300' : 'text-emerald-700'}`}>New</span>;
  const pct = ((now - prev) / Math.abs(prev)) * 100;
  const up = pct >= 0;
  const good = up === goodWhenUp;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  const tone = dark
    ? good
      ? 'text-emerald-300 bg-emerald-400/10'
      : 'text-red-300 bg-red-400/10'
    : good
    ? 'text-emerald-700 bg-emerald-50'
    : 'text-red-700 bg-red-50';
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold ${tone}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {Math.abs(pct) >= 1000 ? '999+' : Math.abs(pct).toFixed(Math.abs(pct) < 10 ? 1 : 0)}%
      <span className="sr-only">{up ? 'up' : 'down'}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* KPI tile                                                             */
/* ------------------------------------------------------------------ */

export function KpiTile({
  label,
  value,
  sub,
  delta,
  icon,
}: {
  label: string;
  value: string;
  sub?: ReactNode;
  delta?: ReactNode;
  icon: ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 flex flex-col">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs sm:text-sm font-medium text-gray-500">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-honey-50 text-honey-700">{icon}</span>
      </div>
      <p className="mt-2 text-2xl sm:text-3xl font-semibold text-gray-900">{value}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
        {delta}
        {sub}
      </div>
    </div>
  );
}

/** One row of small numbers under the KPI tiles. */
export function StatStrip({ items }: { items: { label: string; value: string; hint?: string }[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
      {items.map((s) => (
        <div key={s.label} className="px-4 py-3" title={s.hint}>
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{s.label}</p>
          <p className="mt-0.5 text-base font-semibold text-gray-900">{s.value}</p>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Needs attention                                                     */
/* ------------------------------------------------------------------ */

const LEVEL: Record<AttentionLevel, { icon: ReactNode; ring: string; chip: string; word: string }> = {
  critical: { icon: <AlertOctagon className="h-4 w-4" />, ring: 'border-red-200 bg-red-50/40', chip: 'bg-red-100 text-red-700', word: 'Urgent' },
  warning: { icon: <AlertTriangle className="h-4 w-4" />, ring: 'border-amber-200 bg-amber-50/40', chip: 'bg-amber-100 text-amber-800', word: 'To do' },
  info: { icon: <Info className="h-4 w-4" />, ring: 'border-gray-200 bg-white', chip: 'bg-gray-100 text-gray-700', word: 'Info' },
  ok: { icon: <CheckCircle2 className="h-4 w-4" />, ring: 'border-gray-200 bg-white', chip: 'bg-emerald-50 text-emerald-700', word: 'All clear' },
};
const ORDER: AttentionLevel[] = ['critical', 'warning', 'info', 'ok'];

export function AttentionGrid({ items }: { items: AttentionItem[] }) {
  if (!items.length) return null;
  const sorted = [...items].sort((a, b) => ORDER.indexOf(a.level) - ORDER.indexOf(b.level) || b.count - a.count);
  const open = sorted.filter((i) => i.level !== 'ok');
  const clear = sorted.filter((i) => i.level === 'ok');
  return (
    <section aria-labelledby="attention-title">
      <div className="mb-2 flex items-center justify-between">
        <h2 id="attention-title" className="text-sm font-semibold text-gray-900">
          Needs your attention
        </h2>
        {open.length === 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Everything is up to date
          </span>
        )}
      </div>
      {open.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-3">
          {open.map((it) => {
            const l = LEVEL[it.level];
            return (
              <Link
                key={it.key}
                href={it.href}
                className={`group flex items-center gap-3 rounded-xl border p-3 transition-colors hover:border-honey-400 hover:bg-honey-50/50 ${l.ring}`}
              >
                <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${l.chip}`} aria-hidden>
                  {l.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-1.5">
                    <span className="text-lg font-semibold text-gray-900">{it.amount !== undefined ? formatRs(it.amount) : it.count.toLocaleString('en-PK')}</span>
                    <span className="sr-only">{l.word}:</span>
                  </span>
                  <span className="block truncate text-sm font-medium text-gray-800">{it.label}</span>
                  <span className="block truncate text-[11px] text-gray-500">
                    {it.amount !== undefined ? `${it.count} · ${it.hint}` : it.hint}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-300 group-hover:text-gray-500" />
              </Link>
            );
          })}
        </div>
      )}
      {clear.length > 0 && (
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1 text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Clear:
          </span>
          {clear.map((c) => (
            <Link key={c.key} href={c.href} className="hover:text-gray-800 hover:underline">
              {c.label}
            </Link>
          ))}
        </p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Quick actions                                                       */
/* ------------------------------------------------------------------ */

export function QuickActions() {
  const { can } = useAccess();
  const actions = [
    { label: 'New sale', href: '/admin/pos', icon: <ShoppingCart className="h-4 w-4" />, show: can('pos', 'create'), primary: true },
    { label: 'Purchase order', href: '/admin/purchasing/orders?new=1', icon: <ClipboardList className="h-4 w-4" />, show: can('purchase_orders', 'create') },
    { label: 'Check in goods', href: '/admin/purchasing/receiving', icon: <PackageCheck className="h-4 w-4" />, show: can('goods_receiving', 'view') },
    { label: 'Send to shop', href: '/admin/inventory/putaway', icon: <PackageOpen className="h-4 w-4" />, show: can('stock_putaway', 'create') },
    { label: 'Report damage', href: '/admin/inventory/damages', icon: <PackageX className="h-4 w-4" />, show: can('damages', 'create') },
    { label: 'Add expense', href: '/admin/expenses/create', icon: <Receipt className="h-4 w-4" />, show: can('expenses', 'create') },
  ].filter((a) => a.show);
  if (!actions.length) return null;
  return (
    <nav aria-label="Quick actions" className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 print:hidden">
      {actions.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            a.primary ? 'bg-gray-950 text-honey-400 hover:bg-gray-800' : 'bg-white text-gray-700 border border-gray-200 hover:border-honey-400 hover:bg-honey-50'
          }`}
        >
          {a.icon}
          {a.label}
        </Link>
      ))}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Card shell                                                          */
/* ------------------------------------------------------------------ */

export function Card({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`bg-white rounded-xl border border-gray-200 p-4 sm:p-5 ${className}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function CardLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex flex-shrink-0 items-center gap-1 text-xs font-medium text-honey-700 hover:text-honey-800 print:hidden">
      {children} <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Best sellers                                                         */
/* ------------------------------------------------------------------ */

export function TopProductsTable({ products, showProfit }: { products: TopProduct[]; showProfit: boolean }) {
  if (!products.length) return <p className="py-6 text-center text-xs text-gray-400">No products sold in this period yet.</p>;
  return (
    <div className="-mx-4 sm:-mx-5 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400">
            <th className="px-4 sm:px-5 pb-2 font-medium">Product</th>
            <th className="px-2 pb-2 font-medium text-right">Sold</th>
            <th className="px-2 pb-2 font-medium text-right">Sales</th>
            {showProfit && <th className="px-2 pb-2 font-medium text-right">Margin</th>}
            <th className="px-4 sm:px-5 pb-2 font-medium text-right">In stock</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {products.map((p, i) => (
            <tr key={p.id} className="hover:bg-gray-50">
              <td className="px-4 sm:px-5 py-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-gray-100 text-[11px] font-semibold text-gray-600 tabular-nums">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-900 max-w-[220px]">{p.name}</p>
                    <p className="truncate text-[11px] text-gray-400">
                      {p.category}
                      {p.code ? ` · ${p.code}` : ''}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-2 py-2.5 text-right tabular-nums text-gray-700">{p.qty.toLocaleString('en-PK')}</td>
              <td className="px-2 py-2.5 text-right tabular-nums font-medium text-gray-900">{formatRs(p.revenue)}</td>
              {showProfit && (
                <td className="px-2 py-2.5 text-right tabular-nums text-gray-700">{p.marginPct === null ? '—' : `${p.marginPct}%`}</td>
              )}
              <td className="px-4 sm:px-5 py-2.5 text-right">
                {p.stock <= 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                    <AlertOctagon className="h-3 w-3" /> Sold out
                  </span>
                ) : p.stock < Math.max(5, p.qty / 2) ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 tabular-nums">
                    <AlertTriangle className="h-3 w-3" /> {p.stock} left
                  </span>
                ) : (
                  <span className="tabular-nums text-gray-700">{p.stock.toLocaleString('en-PK')}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Recent bills                                                         */
/* ------------------------------------------------------------------ */

const timeShort = (iso: string) => {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' });
};

export function RecentBills({ bills, canOpen }: { bills: RecentBill[]; canOpen: boolean }) {
  if (!bills.length) return <p className="py-6 text-center text-xs text-gray-400">No bills yet. Ring up the first sale at the POS.</p>;
  const badge = (s: RecentBill['status']) =>
    s === 'refunded' ? 'bg-gray-100 text-gray-600' : s === 'unpaid' ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700';
  return (
    <ul className="-mx-4 sm:-mx-5 divide-y divide-gray-100">
      {bills.map((b) => {
        const body = (
          <div className="flex items-center gap-3 px-4 sm:px-5 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">
                {b.customerName}
                <span className="ml-1.5 text-[11px] font-normal text-gray-400">{b.orderNumber}</span>
              </p>
              <p className="truncate text-[11px] text-gray-500">
                {timeShort(b.createdAt)} · {b.items} item{b.items === 1 ? '' : 's'} · {b.paymentMethod}
                {b.cashierName ? ` · ${b.cashierName}` : ''}
              </p>
            </div>
            <div className="flex flex-shrink-0 flex-col items-end gap-0.5">
              <span className="text-sm font-semibold text-gray-900 tabular-nums">{formatRs(b.total)}</span>
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold capitalize ${badge(b.status)}`}>
                {b.status === 'unpaid' ? `Due ${formatRs(b.pendingAmount)}` : b.status}
              </span>
            </div>
          </div>
        );
        return (
          <li key={b.id}>
            {canOpen ? (
              <Link href={`/admin/pos/invoice/${b.id}`} className="block hover:bg-gray-50">
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Stock snapshot                                                       */
/* ------------------------------------------------------------------ */

export function StockPanel({ stock }: { stock: StockSnapshot }) {
  const shelvedPct = stock.pieces ? Math.round((stock.shelvedPieces / stock.pieces) * 100) : 0;
  const shelfUse = stock.shelvesTotal ? Math.round((stock.shelvesUsed / stock.shelvesTotal) * 100) : 0;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">At cost</p>
          <p className="text-lg font-semibold text-gray-900">{formatRs(stock.valueAtCost)}</p>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">At sale price</p>
          <p className="text-lg font-semibold text-gray-900">{formatRs(stock.valueAtPrice)}</p>
        </div>
      </div>
      <p className="text-xs text-gray-500">
        Profit waiting on the shelves: <span className="font-semibold text-gray-900">{formatRs(stock.potentialProfit)}</span>
      </p>
      <div>
        <div className="flex justify-between text-xs text-gray-600">
          <span>
            On display <span className="font-semibold text-gray-900 tabular-nums">{stock.shelvedPieces.toLocaleString('en-PK')}</span>
          </span>
          <span>
            Warehouse <span className="font-semibold text-gray-900 tabular-nums">{stock.warehousePieces.toLocaleString('en-PK')}</span>
          </span>
        </div>
        <div className="mt-1 flex h-2 w-full gap-[2px] overflow-hidden rounded-full" aria-label={`${shelvedPct}% of pieces on display`}>
          <div className="h-full rounded-l-full" style={{ width: `${shelvedPct}%`, backgroundColor: '#b77900' }} />
          <div className="h-full flex-1 rounded-r-full bg-gray-200" />
        </div>
        <p className="mt-1 text-[11px] text-gray-400">
          {shelvedPct}% of pieces on display · {stock.shelvesUsed}/{stock.shelvesTotal} shelves used ({shelfUse}%)
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-y-1.5 text-xs">
        <dt className="text-gray-500">Products</dt>
        <dd className="text-right font-medium text-gray-900 tabular-nums">{stock.skus.toLocaleString('en-PK')}</dd>
        <dt className="text-gray-500">Pieces in shop</dt>
        <dd className="text-right font-medium text-gray-900 tabular-nums">{stock.pieces.toLocaleString('en-PK')}</dd>
        <dt className="text-gray-500">Out of stock</dt>
        <dd className={`text-right font-medium tabular-nums ${stock.outOfStock ? 'text-red-700' : 'text-gray-900'}`}>{stock.outOfStock}</dd>
        {stock.consignmentPieces > 0 && (
          <>
            <dt className="text-gray-500">Consignment (vendors&apos;)</dt>
            <dd className="text-right font-medium text-gray-900 tabular-nums">{stock.consignmentPieces.toLocaleString('en-PK')} pcs</dd>
          </>
        )}
      </dl>
      {stock.itemsWithoutCost > 0 && (
        <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 p-2 text-[11px] text-amber-800">
          <AlertTriangle className="mt-px h-3.5 w-3.5 flex-shrink-0" />
          {stock.itemsWithoutCost} product{stock.itemsWithoutCost === 1 ? '' : 's'} with stock but no cost yet — receive them through a purchase order so profit is exact.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tills right now                                                      */
/* ------------------------------------------------------------------ */

export function TillsPanel({ tills }: { tills: TillsNow }) {
  return (
    <div className="space-y-2">
      {tills.open.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Store className="h-4 w-4 text-gray-400" /> No till is open right now.
        </p>
      ) : (
        <ul className="space-y-2">
          {tills.open.map((t) => (
            <li key={t.id} className="flex items-center gap-2.5 text-sm">
              <span className="relative flex h-2.5 w-2.5" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium text-gray-900">{t.counterName}</span>
                <span className="text-gray-500"> · {t.cashierName || 'Cashier'}</span>
              </span>
              <span className="text-[11px] text-gray-400">
                since {new Date(t.openedAt).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })}
                {t.lateOpen ? ' · late' : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
      {tills.toVerify > 0 && (
        <Link href="/admin/till" className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 hover:underline">
          <AlertTriangle className="h-3.5 w-3.5" /> {tills.toVerify} cash closing{tills.toVerify === 1 ? '' : 's'} to verify
        </Link>
      )}
    </div>
  );
}
