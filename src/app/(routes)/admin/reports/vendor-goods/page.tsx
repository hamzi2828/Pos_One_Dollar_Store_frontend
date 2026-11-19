'use client';

// Goods by Vendor (owner 2026-11-20): what was sold from each vendor at vendor price
// (the "Goods (vendor price)" line of the income statement, split by vendor) and
// what was paid to each vendor in the same period.

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
  goodsCost: number;
  qty: number;
  paid: number;
  payments: number;
}
interface VendorGoodsData {
  range: { from: string; to: string };
  summary: { vendors: number; goodsCost: number; qty: number; paid: number; payments: number };
  rows: VendorRow[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export default function VendorGoodsPage() {
  const { can, loaded } = useAccess();
  const canView = can('report_financial_statements', 'view') || can('report_vendor_payments', 'view');
  const canExport = can('report_financial_statements', 'export') || can('report_vendor_payments', 'export');

  const dr = useDateRange('month');
  const range = dr.range;
  const r = useReport<VendorGoodsData>('/analytics/financial/vendor-goods', { from: range?.from, to: range?.to }, canView && !!range);
  const d = r.data;
  const s = d?.summary;

  const exportCsv = () => {
    if (!d) return;
    const esc = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
    const lines = [
      ['Vendor', 'Pieces sold', 'Goods sold (vendor price)', 'Paid to vendor', 'Payments', 'Paid - goods sold'],
      ...d.rows.map((v) => [v.name, v.qty, v.goodsCost, v.paid, v.payments, r2(v.paid - v.goodsCost)]),
      ['Total', d.summary.qty, d.summary.goodsCost, d.summary.paid, d.summary.payments, r2(d.summary.paid - d.summary.goodsCost)],
    ];
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
        ['Goods sold (vendor price)', formatRs(s.goodsCost)],
        ['Paid to vendors', `${formatRs(s.paid)} (${s.payments} payments)`],
        ['Vendors', String(s.vendors)],
        ['Pieces sold', fmtNum(s.qty)],
      ],
      tables: [
        {
          title: 'Vendors',
          head: ['Vendor', 'Pieces', 'Goods sold', 'Paid', 'Paid - goods'],
          widths: [70, 20, 32, 32, 32],
          rows: d.rows.map((v) => [v.name, v.qty, v.goodsCost, v.paid, r2(v.paid - v.goodsCost)]),
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
        subtitle="Goods sold at vendor price from each vendor, and what was paid to each vendor in the same period."
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            <StatCard label="Goods sold (vendor price)" value={formatRs(s.goodsCost)} hint={`${fmtNum(s.qty)} pieces`} tone="info" />
            <StatCard label="Paid to vendors" value={formatRs(s.paid)} hint={`${s.payments} payment${s.payments === 1 ? '' : 's'}`} />
            <StatCard
              label="Paid − goods sold"
              value={`${s.paid - s.goodsCost >= 0 ? '+' : '−'}${formatRs(Math.abs(r2(s.paid - s.goodsCost)))}`}
              tone={s.paid - s.goodsCost >= 0 ? 'good' : 'warn'}
            />
            <StatCard label="Vendors" value={String(s.vendors)} />
          </div>

          <HelpBox>
            &quot;Goods sold&quot; is the vendor price of the pieces sold in this period (trip costs not included) — the same as the Goods (vendor price) line of the
            income statement. A piece&apos;s vendor is the stock code it was sold with, else the product&apos;s latest goods receipt. Payments are for everything
            bought from the vendor (also stock not sold yet and older bills), so they do not have to match.
          </HelpBox>

          <Card title="Vendors" subtitle="Most goods sold first">
            {d.rows.length === 0 ? (
              <EmptyState title="No sales or vendor payments in this period" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-[11px] uppercase text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Vendor</th>
                      <th className="px-3 py-2 text-right">Pieces sold</th>
                      <th className="px-3 py-2 text-right">Goods sold (vendor price)</th>
                      <th className="px-3 py-2 text-right">Share</th>
                      <th className="px-3 py-2 text-right">Paid to vendor</th>
                      <th className="px-3 py-2 text-right">Paid − goods sold</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {d.rows.map((v) => {
                      const diff = r2(v.paid - v.goodsCost);
                      return (
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
                          <td className="px-3 py-2 text-right tabular-nums text-gray-600">{v.qty ? fmtNum(v.qty) : '—'}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{v.goodsCost ? formatRs(v.goodsCost) : '—'}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-xs text-gray-500">
                            {s.goodsCost > 0 && v.goodsCost ? `${((v.goodsCost / s.goodsCost) * 100).toFixed(1)}%` : ''}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {v.paid ? formatRs(v.paid) : '—'}
                            {v.payments > 0 && <span className="block text-[10px] text-gray-400">{v.payments} payment{v.payments === 1 ? '' : 's'}</span>}
                          </td>
                          <td className={`px-3 py-2 text-right tabular-nums text-xs ${diff > 0 ? 'text-emerald-700' : diff < 0 ? 'text-amber-700' : 'text-gray-400'}`}>
                            {diff === 0 ? '—' : `${diff > 0 ? '+' : '−'}${formatRs(Math.abs(diff))}`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                    <tr>
                      <td className="px-3 py-2">All vendors ({s.vendors})</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtNum(s.qty)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatRs(s.goodsCost)}</td>
                      <td />
                      <td className="px-3 py-2 text-right tabular-nums">{formatRs(s.paid)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs">
                        {`${s.paid - s.goodsCost >= 0 ? '+' : '−'}${formatRs(Math.abs(r2(s.paid - s.goodsCost)))}`}
                      </td>
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
