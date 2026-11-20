'use client';

// Goods by Vendor (owner 2026-11-20): per vendor, for the picked period —
//   goods received (goods receipts, vendor price), sold (vendor price), in store now,
//   paid, still owed now, and goods received that have no vendor bill yet (since the start).

import Link from 'next/link';
import { Truck } from 'lucide-react';
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
  DateRangePicker,
  useDateRange,
  useReport,
  buildPdf,
  formatRs,
  fmtNum,
} from '../demand/_shared/reportKit';

interface VendorRow {
  vendorId: string | null;
  name: string;
  received: number;
  receivedQty: number;
  billed: number;
  goodsCost: number;
  qty: number;
  inStore: number;
  inStoreQty: number;
  paid: number;
  payments: number;
  owed: number;
  notBilled: number;
}
interface Summary {
  vendors: number;
  received: number;
  receivedQty: number;
  billed: number;
  notBilled: number;
  goodsCost: number;
  qty: number;
  inStore: number;
  inStoreQty: number;
  inStoreNoVendor: number;
  paid: number;
  payments: number;
  owed: number;
  advance: number;
}
interface VendorGoodsData {
  range: { from: string; to: string };
  summary: Summary;
  rows: VendorRow[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const rs = (n: number) => (n ? formatRs(n) : '—');
const signed = (n: number) => (Math.abs(n) < 0.5 ? '—' : `${n > 0 ? '+' : '−'}${formatRs(Math.abs(r2(n)))}`);

export default function VendorGoodsPage() {
  const { can, loaded } = useAccess();
  const canView = can('report_financial_statements', 'view') || can('report_vendor_payments', 'view');
  const canExport = can('report_financial_statements', 'export') || can('report_vendor_payments', 'export');

  const dr = useDateRange('month');
  const range = dr.range;
  const r = useReport<VendorGoodsData>('/analytics/financial/vendor-goods', { from: range?.from, to: range?.to }, canView && !!range);
  const d = r.data;
  const s = d?.summary;

  // Owner 2026-11-20: no "Billed this period" column — bills are often dated before the goods arrive.
  const head = ['Vendor', 'Goods received', 'Sold (vendor price)', 'In store now', 'Paid', 'Owed now', 'Not billed (since start)'];
  const line = (v: VendorRow | Summary, name: string) => [name, v.received, v.goodsCost, v.inStore, v.paid, v.owed, v.notBilled];

  const exportCsv = () => {
    if (!d || !s) return;
    const esc = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
    const lines = [head, ...d.rows.map((v) => line(v, v.name)), line(s, 'Total')];
    const blob = new Blob(['﻿' + lines.map((l) => l.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `goods-by-vendor-${d.range.from}-${d.range.to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const exportPdf = () => {
    if (!d || !s) return;
    buildPdf({
      title: 'Goods by Vendor',
      subtitle: range?.label,
      summary: [
        ['Goods received', formatRs(s.received)],
        ['In store now', formatRs(s.inStore)],
        ['Paid to vendors', `${formatRs(s.paid)} (${s.payments} payments)`],
        ['Owed to vendors now', formatRs(s.owed)],
        ['Received, not billed (since start)', signed(s.notBilled)],
      ],
      tables: [
        {
          title: 'Vendors',
          head,
          widths: [50, 24, 24, 24, 24, 24, 24],
          rows: d.rows.map((v) => line(v, v.name)),
        },
      ],
      fileName: `goods-by-vendor-${d.range.from}-${d.range.to}`,
    });
  };

  if (!loaded) return <LoadingCard text="Loading…" />;
  if (!canView) return <NoAccessCard />;

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        icon={<Truck className="h-6 w-6" />}
        title="Goods by Vendor"
        subtitle="Per vendor: goods received, sold, in store now, paid and still owed."
        actions={<ReportActions canExport={canExport} onCsv={exportCsv} onPdf={exportPdf} onRefresh={r.reload} loading={r.loading} disabled={!d} />}
      />
      <ReportsNav />

      <FilterBar>
        <DateRangePicker state={dr} presets={['today', 'yesterday', '7d', '30d', 'month', 'lastMonth', '90d', 'year', 'custom']} />
      </FilterBar>

      {!range && <ErrorState message="Pick both dates of the custom range." />}
      {r.error && <ErrorState message={r.error} onRetry={r.reload} />}

      {!d && r.loading ? (
        <LoadingBlock />
      ) : d && s ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3">
            <StatCard label="Goods received" value={formatRs(s.received)} hint={`${fmtNum(s.receivedQty)} pieces`} tone="info" />
            <StatCard label="In store now" value={formatRs(s.inStore)} hint={`${fmtNum(s.inStoreQty)} pieces · at cost`} />
            <StatCard label="Paid to vendors" value={formatRs(s.paid)} hint={`${s.payments} payment${s.payments === 1 ? '' : 's'}`} tone="good" />
            <StatCard label="Still owed now" value={formatRs(s.owed)} hint={s.advance ? `Paid ahead ${formatRs(s.advance)}` : 'Same as the balance sheet'} tone="warn" />
            <StatCard
              label="Received, not billed"
              value={signed(s.notBilled)}
              hint="Since the start · goods with no vendor bill"
              tone={Math.abs(s.notBilled) < 1 ? 'good' : 'bad'}
            />
          </div>

          <HelpBox>
            <b>Not billed +</b> = goods received with no vendor bill (or a lower bill), so the shop may owe that vendor more.
          </HelpBox>

          <Card title="Vendors" subtitle="Most goods received first">
            {d.rows.length === 0 ? (
              <EmptyState title="Nothing for this period" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-[11px] uppercase text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Vendor</th>
                      <th className="px-3 py-2 text-right">Goods received</th>
                      <th className="px-3 py-2 text-right">Sold (vendor price)</th>
                      <th className="px-3 py-2 text-right">In store now</th>
                      <th className="px-3 py-2 text-right">Paid</th>
                      <th className="px-3 py-2 text-right">Owed now</th>
                      <th className="px-3 py-2 text-right">Not billed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {d.rows.map((v) => (
                      <tr key={v.vendorId || 'none'} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-900">
                          {v.vendorId ? (
                            <Link href={`/admin/vendors/${v.vendorId}`} className="hover:underline">
                              {v.name}
                            </Link>
                          ) : (
                            <span className="text-gray-500">{v.name}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {rs(v.received)}
                          {v.receivedQty > 0 && <span className="block text-[10px] text-gray-400">{fmtNum(v.receivedQty)} pcs</span>}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                          {rs(v.goodsCost)}
                          {v.qty > 0 && <span className="block text-[10px] text-gray-400">{fmtNum(v.qty)} pcs</span>}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {rs(v.inStore)}
                          {v.inStoreQty > 0 && <span className="block text-[10px] text-gray-400">{fmtNum(v.inStoreQty)} pcs</span>}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-emerald-700">
                          {rs(v.paid)}
                          {v.payments > 0 && <span className="block text-[10px] text-gray-400">{v.payments} payment{v.payments === 1 ? '' : 's'}</span>}
                        </td>
                        <td className={`px-3 py-2 text-right tabular-nums ${v.owed > 0 ? 'text-amber-700' : v.owed < 0 ? 'text-emerald-700' : 'text-gray-400'}`}>
                          {v.owed < 0 ? `Paid ahead ${formatRs(-v.owed)}` : rs(v.owed)}
                        </td>
                        <td className={`px-3 py-2 text-right tabular-nums text-xs ${v.notBilled > 0.5 ? 'text-red-700 font-semibold' : v.notBilled < -0.5 ? 'text-gray-500' : 'text-gray-400'}`}>
                          {signed(v.notBilled)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                    <tr>
                      <td className="px-3 py-2">All vendors ({s.vendors})</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatRs(s.received)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatRs(s.goodsCost)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatRs(s.inStore)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatRs(s.paid)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatRs(s.owed)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs">{signed(s.notBilled)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}
