// Cash in Hand Report — the authoritative snapshot of every rupee that
// flowed through the business in the selected window. All arithmetic is done
// server-side (see reportsController.cashInHand). The UI only displays and
// renders PDFs.
'use client';

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import {
  RefreshCw,
  Loader2,
  Download,
  Wallet,
  TrendingUp,
  TrendingDown,
  Landmark,
  Banknote,
  AlertCircle,
  Calendar,
} from 'lucide-react';
import ReportsNav from '../components/ReportsNav';
import { usePdfExport } from '../components/usePdfExport';
import {
  fetchCashInHand,
  rangeFromFilter,
  type CashInHandReport,
  type DateFilter,
} from '../services/reportsService';
import { getCurrencySymbol } from '../../pos/utils/currency';
import { SearchSelect } from '@/components/ui/SearchSelect';

const CURRENCY = 'PKR';

export default function CashInHandPage() {
  const symbol = getCurrencySymbol(CURRENCY);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>(
    (searchParams.get('dateFilter') as DateFilter) || 'month',
  );
  const [customStart, setCustomStart] = useState(searchParams.get('startDate') || '');
  const [customEnd, setCustomEnd] = useState(searchParams.get('endDate') || '');
  const [storeName, setStoreName] = useState<string>('DOLLAR & Co');
  const [report, setReport] = useState<CashInHandReport | null>(null);

  // Load store name once for PDF header.
  useEffect(() => {
    try {
      const cached = localStorage.getItem('siteName');
      if (cached) setStoreName(cached);
    } catch {}
  }, []);

  // Keep URL in sync with the selected filters so the view is shareable / refreshable.
  useEffect(() => {
    const params = new URLSearchParams();
    if (dateFilter && dateFilter !== 'month') params.set('dateFilter', dateFilter);
    if (customStart) params.set('startDate', customStart);
    if (customEnd) params.set('endDate', customEnd);
    const q = params.toString();
    router.replace(q ? `/admin/reports/cash-in-hand?${q}` : '/admin/reports/cash-in-hand', {
      scroll: false,
    });
  }, [dateFilter, customStart, customEnd, router]);

  const rangeLabel = useMemo(() => {
    const r = rangeFromFilter(dateFilter, customStart, customEnd);
    return r?.label ?? 'Select a range';
  }, [dateFilter, customStart, customEnd]);

  // Counts in-flight fetches so Refresh can't be re-fired while one is running.
  const inFlightRef = useRef(0);
  const loadData = useCallback(async () => {
    const range = rangeFromFilter(dateFilter, customStart, customEnd);
    if (!range) {
      // Custom range without both dates — wait for the user.
      return;
    }
    try {
      inFlightRef.current += 1;
      setLoading(true);
      const data = await fetchCashInHand(range.start, range.end);
      setReport(data);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      inFlightRef.current -= 1;
      if (inFlightRef.current === 0) setLoading(false);
    }
  }, [dateFilter, customStart, customEnd]);

  useEffect(() => {
    loadData();
  }, [loadData]);
  const handleRefresh = () => {
    if (inFlightRef.current > 0) return;
    loadData();
  };

  // -------- PDF (mirrors on-screen layout) --------
  const handleDownloadPdf = () => {
    if (!report) return;
    const { salesBreakdown, paymentsReceived, expenseSummary, vendorSummary, salarySummary, balances } =
      report;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    const gap = 4;
    const halfW = (pageWidth - 2 * margin - gap) / 2;
    const thirdW = (pageWidth - 2 * margin - 2 * gap) / 3;
    let y = 12;

    // Header bar
    doc.setFillColor(249, 250, 251);
    doc.rect(margin, y, pageWidth - 2 * margin, 10, 'F');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 24, 39);
    doc.text('Cash in Hand Breakdown', margin + 3, y + 7);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);
    doc.text(
      `${storeName} | ${rangeLabel} | ${new Date().toLocaleDateString()}`,
      pageWidth - margin - 3,
      y + 7,
      { align: 'right' },
    );
    y += 14;

    const pdfMoney = (n: number) => `${symbol}${(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

    // INFLOWS label
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(107, 114, 128);
    doc.text('INFLOWS', margin, y);
    y += 4;

    // Inflow card 1 — Total Sales
    const inflowH = 28;
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(187, 247, 208);
    doc.roundedRect(margin, y, halfW, inflowH, 2, 2, 'FD');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 101, 52);
    doc.text('Total Sales (Paid in Full)', margin + 3, y + 5);
    doc.setFontSize(10);
    doc.text(`+${pdfMoney(salesBreakdown.totalSales)}`, margin + halfW - 3, y + 5, { align: 'right' });
    doc.line(margin + 3, y + 8, margin + halfW - 3, y + 8);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(22, 163, 74);
    doc.text('Cash', margin + 3, y + 13);
    doc.text(pdfMoney(salesBreakdown.cashSales), margin + halfW - 3, y + 13, { align: 'right' });
    doc.text('Card', margin + 3, y + 18);
    doc.text(pdfMoney(salesBreakdown.cardSales), margin + halfW - 3, y + 18, { align: 'right' });
    doc.text('Bank', margin + 3, y + 23);
    doc.text(pdfMoney(salesBreakdown.bankTransfer), margin + halfW - 3, y + 23, { align: 'right' });

    // Inflow card 2 — Payments Received
    const x2 = margin + halfW + gap;
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(187, 247, 208);
    doc.roundedRect(x2, y, halfW, inflowH, 2, 2, 'FD');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 101, 52);
    doc.text('Pending Payments Received', x2 + 3, y + 5);
    doc.setFontSize(10);
    doc.text(`+${pdfMoney(paymentsReceived.total)}`, x2 + halfW - 3, y + 5, { align: 'right' });
    doc.line(x2 + 3, y + 8, x2 + halfW - 3, y + 8);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(22, 163, 74);
    doc.text('Cash', x2 + 3, y + 13);
    doc.text(pdfMoney(paymentsReceived.cash), x2 + halfW - 3, y + 13, { align: 'right' });
    doc.text('Card', x2 + 3, y + 18);
    doc.text(pdfMoney(paymentsReceived.card), x2 + halfW - 3, y + 18, { align: 'right' });
    doc.text('Bank', x2 + 3, y + 23);
    doc.text(pdfMoney(paymentsReceived.bank), x2 + halfW - 3, y + 23, { align: 'right' });
    y += inflowH + 5;

    // OUTFLOWS label
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(107, 114, 128);
    doc.text('OUTFLOWS', margin, y);
    y += 4;

    const outflowH = 22;
    // Expenses
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(254, 202, 202);
    doc.roundedRect(margin, y, thirdW, outflowH, 2, 2, 'FD');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(153, 27, 27);
    doc.text('Expenses', margin + 3, y + 5);
    doc.setFontSize(9);
    doc.text(`-${pdfMoney(expenseSummary.totalExpenses)}`, margin + thirdW - 3, y + 5, { align: 'right' });
    doc.line(margin + 3, y + 8, margin + thirdW - 3, y + 8);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(185, 28, 28);
    doc.text('Cash', margin + 3, y + 13);
    doc.text(pdfMoney(expenseSummary.cashExpenses), margin + thirdW - 3, y + 13, { align: 'right' });
    doc.text('Bank', margin + 3, y + 18);
    doc.text(pdfMoney(expenseSummary.bankExpenses), margin + thirdW - 3, y + 18, { align: 'right' });

    // Vendor Paid
    const vx = margin + thirdW + gap;
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(254, 202, 202);
    doc.roundedRect(vx, y, thirdW, outflowH, 2, 2, 'FD');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(153, 27, 27);
    doc.text('Vendor Paid', vx + 3, y + 5);
    doc.setFontSize(9);
    doc.text(`-${pdfMoney(vendorSummary.totalPaid)}`, vx + thirdW - 3, y + 5, { align: 'right' });
    doc.line(vx + 3, y + 8, vx + thirdW - 3, y + 8);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(185, 28, 28);
    doc.text('Cash', vx + 3, y + 13);
    doc.text(pdfMoney(vendorSummary.cashPaid), vx + thirdW - 3, y + 13, { align: 'right' });
    doc.text('Bank', vx + 3, y + 18);
    doc.text(pdfMoney(vendorSummary.bankPaid), vx + thirdW - 3, y + 18, { align: 'right' });

    // Salary Paid
    const sx = margin + 2 * thirdW + 2 * gap;
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(254, 202, 202);
    doc.roundedRect(sx, y, thirdW, outflowH, 2, 2, 'FD');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(153, 27, 27);
    doc.text('Salary Paid', sx + 3, y + 5);
    doc.setFontSize(9);
    doc.text(`-${pdfMoney(salarySummary.totalPaid)}`, sx + thirdW - 3, y + 5, { align: 'right' });
    doc.line(sx + 3, y + 8, sx + thirdW - 3, y + 8);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(185, 28, 28);
    doc.text('Cash', sx + 3, y + 13);
    doc.text(pdfMoney(salarySummary.cashPaid), sx + thirdW - 3, y + 13, { align: 'right' });
    doc.text('Bank', sx + 3, y + 18);
    doc.text(pdfMoney(salarySummary.bankPaid), sx + thirdW - 3, y + 18, { align: 'right' });
    y += outflowH + 5;

    // BALANCE label
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(107, 114, 128);
    doc.text('BALANCE SUMMARY', margin, y);
    y += 4;

    // Cash Balance box
    const balH = 34;
    doc.setFillColor(220, 252, 231);
    doc.setDrawColor(187, 247, 208);
    doc.roundedRect(margin, y, halfW, balH, 2, 2, 'FD');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(55, 65, 81);
    doc.text('Cash Balance', margin + 3, y + 6);
    doc.setFontSize(12);
    doc.setTextColor(21, 128, 61);
    doc.text(pdfMoney(balances.cashBalance), margin + halfW - 3, y + 6, { align: 'right' });
    doc.line(margin + 3, y + 9, margin + halfW - 3, y + 9);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    const cashRows: Array<[string, string, [number, number, number]]> = [
      ['Sales', `+${pdfMoney(salesBreakdown.cashSales)}`, [21, 128, 61]],
      ['Received', `+${pdfMoney(paymentsReceived.cash)}`, [13, 148, 136]],
      ['Expenses', `-${pdfMoney(expenseSummary.cashExpenses)}`, [220, 38, 38]],
      ['Vendor', `-${pdfMoney(vendorSummary.cashPaid)}`, [147, 51, 234]],
      ['Salary', `-${pdfMoney(salarySummary.cashPaid)}`, [79, 70, 229]],
    ];
    cashRows.forEach((row, i) => {
      const ry = y + 14 + i * 5;
      doc.setTextColor(75, 85, 99);
      doc.text(row[0], margin + 3, ry);
      doc.setTextColor(row[2][0], row[2][1], row[2][2]);
      doc.text(row[1], margin + halfW - 3, ry, { align: 'right' });
    });

    // Bank Balance box
    doc.setFillColor(219, 234, 254);
    doc.setDrawColor(191, 219, 254);
    doc.roundedRect(x2, y, halfW, balH, 2, 2, 'FD');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(55, 65, 81);
    doc.text('Bank Balance', x2 + 3, y + 6);
    doc.setFontSize(12);
    doc.setTextColor(29, 78, 216);
    doc.text(pdfMoney(balances.bankBalance), x2 + halfW - 3, y + 6, { align: 'right' });
    doc.line(x2 + 3, y + 9, x2 + halfW - 3, y + 9);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    const bankRows: Array<[string, string, [number, number, number]]> = [
      ['Sales', `+${pdfMoney(salesBreakdown.bankTransfer + salesBreakdown.cardSales)}`, [21, 128, 61]],
      ['Received', `+${pdfMoney(paymentsReceived.bank + paymentsReceived.card)}`, [13, 148, 136]],
      ['Expenses', `-${pdfMoney(expenseSummary.bankExpenses)}`, [220, 38, 38]],
      ['Vendor', `-${pdfMoney(vendorSummary.bankPaid)}`, [147, 51, 234]],
      ['Salary', `-${pdfMoney(salarySummary.bankPaid)}`, [79, 70, 229]],
    ];
    bankRows.forEach((row, i) => {
      const ry = y + 14 + i * 5;
      doc.setTextColor(75, 85, 99);
      doc.text(row[0], x2 + 3, ry);
      doc.setTextColor(row[2][0], row[2][1], row[2][2]);
      doc.text(row[1], x2 + halfW - 3, ry, { align: 'right' });
    });
    y += balH + 4;

    // Total card
    const totalH = 18;
    const positive = balances.totalBalance >= 0;
    if (positive) {
      doc.setFillColor(236, 253, 245);
      doc.setDrawColor(110, 231, 183);
    } else {
      doc.setFillColor(254, 242, 242);
      doc.setDrawColor(252, 165, 165);
    }
    doc.roundedRect(margin, y, pageWidth - 2 * margin, totalH, 2, 2, 'FD');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(55, 65, 81);
    doc.text('Cash in Hand', margin + 4, y + 7);
    doc.setFontSize(16);
    if (positive) doc.setTextColor(4, 120, 87);
    else doc.setTextColor(185, 28, 28);
    doc.text(pdfMoney(balances.totalBalance), pageWidth - margin - 4, y + 8, { align: 'right' });
    doc.setDrawColor(200, 200, 200);
    doc.line(margin + 4, y + 11, pageWidth - margin - 4, y + 11);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);
    doc.text(`Cash: ${pdfMoney(balances.cashBalance)}`, margin + 4, y + 16);
    doc.text(`Bank: ${pdfMoney(balances.bankBalance)}`, pageWidth - margin - 4, y + 16, { align: 'right' });

    const filename = `Cash_In_Hand_${rangeLabel.replace(/\s|\//g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
  };
  const pdfExport = usePdfExport(handleDownloadPdf);

  const fmt = (n: number) =>
    `${symbol}${(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  const hasValidRange = !!rangeFromFilter(dateFilter, customStart, customEnd);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <Wallet className="h-6 w-6 text-honey-700" />
            Cash in Hand
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-gray-500">
            Live reconciliation of every cash and bank movement for the selected period.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={pdfExport.run}
            disabled={loading || !report || pdfExport.exporting}
            aria-busy={pdfExport.exporting}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {pdfExport.exporting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
            ) : (
              <><Download className="h-4 w-4" /> Download PDF</>
            )}
          </button>
          <button
            onClick={handleRefresh}
            disabled={loading}
            aria-busy={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Loading…</>
            ) : (
              <><RefreshCw className="h-4 w-4" /> Refresh</>
            )}
          </button>
        </div>
      </div>

      <ReportsNav />

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-2 text-sm text-gray-500">
          <Calendar className="h-4 w-4" />
          Period:
        </div>
        <SearchSelect
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value as DateFilter)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-honey-500"
        >
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="custom">Custom Range</option>
        </SearchSelect>
        {dateFilter === 'custom' && (
          <>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </>
        )}
        <span className="ml-auto text-sm text-gray-500">
          Showing: <span className="font-medium text-gray-800">{rangeLabel}</span>
        </span>
      </div>

      {/* Body */}
      {!hasValidRange ? (
        <EmptyState title="Select both custom dates" subtitle="Pick a start and end date to run the report." />
      ) : loading && !report ? (
        <div className="flex items-center justify-center h-64 bg-white rounded-lg border border-gray-200">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : !report ? (
        <EmptyState title="No data yet" subtitle="Refresh to compute the report." />
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-200 bg-gray-50 rounded-t-lg flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Cash in Hand Breakdown</h2>
            {report.receivableData.totalReceivable > 0 && (
              <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">
                <AlertCircle className="h-3.5 w-3.5" />
                Open receivables: {fmt(report.receivableData.totalReceivable)} ({report.receivableData.pendingCount + report.receivableData.partialCount} orders)
              </div>
            )}
          </div>

          <div className="p-5 space-y-6">
            {/* Inflows */}
            <Section label="Inflows">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <MoneyCard
                  tone="green"
                  title="Total Sales (Paid in Full)"
                  total={report.salesBreakdown.totalSales}
                  sign="+"
                  rows={[
                    ['Cash', report.salesBreakdown.cashSales],
                    ['Card', report.salesBreakdown.cardSales],
                    ['Bank', report.salesBreakdown.bankTransfer],
                  ]}
                  symbol={symbol}
                />
                <MoneyCard
                  tone="green"
                  title="Pending Payments Received"
                  total={report.paymentsReceived.total}
                  sign="+"
                  rows={[
                    ['Cash', report.paymentsReceived.cash],
                    ['Card', report.paymentsReceived.card],
                    ['Bank', report.paymentsReceived.bank],
                  ]}
                  footer={`${report.paymentsReceived.count} payment${report.paymentsReceived.count === 1 ? '' : 's'}`}
                  symbol={symbol}
                />
              </div>
            </Section>

            {/* Outflows */}
            <Section label="Outflows">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <MoneyCard
                  tone="red"
                  title="Expenses"
                  total={report.expenseSummary.totalExpenses}
                  sign="-"
                  rows={[
                    ['Cash', report.expenseSummary.cashExpenses],
                    ['Bank', report.expenseSummary.bankExpenses],
                  ]}
                  symbol={symbol}
                />
                <MoneyCard
                  tone="red"
                  title="Vendor Paid"
                  total={report.vendorSummary.totalPaid}
                  sign="-"
                  rows={[
                    ['Cash', report.vendorSummary.cashPaid],
                    ['Bank', report.vendorSummary.bankPaid],
                  ]}
                  symbol={symbol}
                />
                <MoneyCard
                  tone="red"
                  title="Salary Paid"
                  total={report.salarySummary.totalPaid}
                  sign="-"
                  rows={[
                    ['Cash', report.salarySummary.cashPaid],
                    ['Bank', report.salarySummary.bankPaid],
                  ]}
                  footer={
                    report.salarySummary.totalRemaining > 0
                      ? `Outstanding balance: ${fmt(report.salarySummary.totalRemaining)}`
                      : undefined
                  }
                  symbol={symbol}
                />
              </div>
            </Section>

            {/* Balance */}
            <Section label="Balance Summary">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <BalanceCard
                  tone="green"
                  title="Cash Balance"
                  total={report.balances.cashBalance}
                  icon={<Banknote className="h-5 w-5" />}
                  rows={[
                    ['Sales', `+${fmt(report.salesBreakdown.cashSales)}`, 'text-emerald-700'],
                    ['Received', `+${fmt(report.paymentsReceived.cash)}`, 'text-teal-700'],
                    ['Expenses', `-${fmt(report.expenseSummary.cashExpenses)}`, 'text-red-600'],
                    ['Vendor', `-${fmt(report.vendorSummary.cashPaid)}`, 'text-purple-600'],
                    ['Salary', `-${fmt(report.salarySummary.cashPaid)}`, 'text-indigo-600'],
                  ]}
                  symbol={symbol}
                />
                <BalanceCard
                  tone="blue"
                  title="Bank Balance"
                  total={report.balances.bankBalance}
                  icon={<Landmark className="h-5 w-5" />}
                  rows={[
                    [
                      'Sales',
                      `+${fmt(report.salesBreakdown.bankTransfer + report.salesBreakdown.cardSales)}`,
                      'text-emerald-700',
                    ],
                    ['Received', `+${fmt(report.paymentsReceived.bank + report.paymentsReceived.card)}`, 'text-teal-700'],
                    ['Expenses', `-${fmt(report.expenseSummary.bankExpenses)}`, 'text-red-600'],
                    ['Vendor', `-${fmt(report.vendorSummary.bankPaid)}`, 'text-purple-600'],
                    ['Salary', `-${fmt(report.salarySummary.bankPaid)}`, 'text-indigo-600'],
                  ]}
                  symbol={symbol}
                />
              </div>

              <div
                className={`mt-3 p-5 rounded-lg border-2 ${
                  report.balances.totalBalance >= 0
                    ? 'bg-emerald-50 border-emerald-300'
                    : 'bg-red-50 border-red-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {report.balances.totalBalance >= 0 ? (
                      <TrendingUp className="h-6 w-6 text-emerald-700" />
                    ) : (
                      <TrendingDown className="h-6 w-6 text-red-700" />
                    )}
                    <p className="text-lg font-semibold text-gray-700">Cash in Hand</p>
                  </div>
                  <p
                    className={`text-2xl sm:text-3xl font-bold ${
                      report.balances.totalBalance >= 0 ? 'text-emerald-700' : 'text-red-700'
                    }`}
                  >
                    {fmt(report.balances.totalBalance)}
                  </p>
                </div>
                <div className="flex flex-wrap justify-between gap-2 text-sm mt-2 pt-2 border-t border-gray-200">
                  <span className="text-gray-500">Cash: {fmt(report.balances.cashBalance)}</span>
                  <span className="text-gray-500">Bank: {fmt(report.balances.bankBalance)}</span>
                </div>
              </div>
            </Section>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- small presentational helpers ----------

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs sm:text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
        {label}
      </h3>
      {children}
    </div>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 py-12 text-center">
      <div className="text-gray-700 font-medium">{title}</div>
      <div className="text-sm text-gray-500 mt-1">{subtitle}</div>
    </div>
  );
}

function MoneyCard({
  tone,
  title,
  total,
  sign,
  rows,
  footer,
  symbol,
}: {
  tone: 'green' | 'red';
  title: string;
  total: number;
  sign: '+' | '-';
  rows: Array<[string, number]>;
  footer?: string;
  symbol: string;
}) {
  const bg = tone === 'green' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200';
  const titleColor = tone === 'green' ? 'text-green-800' : 'text-red-800';
  const totalColor = tone === 'green' ? 'text-green-700' : 'text-red-700';
  const rowLabel = tone === 'green' ? 'text-green-600' : 'text-red-600';
  const rowValue = tone === 'green' ? 'text-green-700' : 'text-red-700';
  const border = tone === 'green' ? 'border-green-200' : 'border-red-200';
  const fmt = (n: number) =>
    `${symbol}${(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  return (
    <div className={`p-4 rounded-lg border ${bg}`}>
      <div className="flex items-center justify-between mb-2">
        <p className={`text-sm font-medium ${titleColor}`}>{title}</p>
        <p className={`text-base font-bold ${totalColor}`}>
          {sign}
          {fmt(total)}
        </p>
      </div>
      <div className={`pt-2 border-t ${border} space-y-1 text-sm`}>
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between">
            <span className={rowLabel}>{label}</span>
            <span className={rowValue}>{fmt(value)}</span>
          </div>
        ))}
        {footer && (
          <div className={`flex justify-between pt-1 border-t ${border}`}>
            <span className={rowLabel}>Note</span>
            <span className={rowValue}>{footer}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function BalanceCard({
  tone,
  title,
  total,
  icon,
  rows,
  symbol,
}: {
  tone: 'green' | 'blue';
  title: string;
  total: number;
  icon: React.ReactNode;
  rows: Array<[string, string, string]>;
  symbol: string;
}) {
  const bg = tone === 'green' ? 'bg-green-100' : 'bg-blue-100';
  const totalColor = tone === 'green' ? 'text-green-700' : 'text-blue-700';
  const border = tone === 'green' ? 'border-green-200' : 'border-blue-200';

  return (
    <div className={`p-5 rounded-lg ${bg}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-gray-700">
          {icon}
          <p className="text-base font-medium">{title}</p>
        </div>
        <p className={`text-xl font-bold ${totalColor}`}>
          {symbol}
          {(total || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </p>
      </div>
      <div className={`space-y-1.5 text-sm border-t ${border} pt-2`}>
        {rows.map(([label, value, colorClass]) => (
          <div key={label} className="flex justify-between">
            <span className="text-gray-600">{label}</span>
            <span className={colorClass}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
