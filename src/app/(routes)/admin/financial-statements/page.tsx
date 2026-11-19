"use client";

// Financial statements (owner, 2026-11-17): Income Statement, Balance Sheet and
// Cash Flow, worked out from sales, expenses, stock, vendors, loans, assets and
// investments (server: services/reports/financialStatements.js).

import { useEffect, useMemo, useState } from "react";
import { Scale, AlertTriangle, CheckCircle2 } from "lucide-react";
import { SearchSelect } from "@/components/ui/SearchSelect";
import InvestmentsView from "../investments/InvestmentsView";
import PartnersView from "./PartnersView";
import { useAccess } from "@/context/AccessContext";
import { LoadingCard, NoAccessCard } from "@/components/admin/FormBits";
import {
  PageHeader,
  FilterBar,
  StatCard,
  Card,
  ErrorState,
  LoadingBlock,
  ReportActions,
  useReport,
  buildPdf,
  formatRs,
  fmtDate,
  selectClass,
} from "../reports/demand/_shared/reportKit";

// ---------------------------------------------------------------- types
interface IncomeNumbers {
  bills: number;
  itemsSold: number;
  sales: number;
  billDiscounts: number;
  taxCollected: number;
  refunds: number;
  netSales: number;
  costOfGoods: number;
  /** Cost of goods split (missing on an old server). */
  goodsCost?: number;
  tripCost?: number;
  grossProfit: number;
  grossMargin: number | null;
  expenses: { category: string; amount: number; count: number }[];
  totalExpenses: number;
  operatingProfit: number;
  damage: number;
  damageCount: number;
  stockCount: number;
  depreciation: number;
  otherCosts: number;
  netProfit: number;
  netMargin: number | null;
  /** Per counter (current period; missing on an old server). */
  byCounter?: { counter: string; netSales: number; cost: number; grossProfit: number; itemsSold: number }[] | null;
  /** Trip costs of the goods sold, by charge type (car rent, builty, loading ...). */
  tripByType?: { type: string; label: string; amount: number }[] | null;
  /** Goods (vendor price) sold per vendor + paid to that vendor in the period. */
  byVendor?: { vendorId: string | null; name: string; goodsCost: number; qty: number; paid: number; payments: number }[] | null;
}
interface IncomeData {
  range: { from: string; to: string };
  current: IncomeNumbers;
  previous: (IncomeNumbers & { from: string; to: string }) | null;
}
interface Line {
  key: string;
  label: string;
  amount: number;
  hint?: string;
  missing?: boolean;
  partners?: { name: string; amount: number }[];
}
interface BalanceData {
  asOf: string;
  systemStart: string;
  assets: Line[];
  totalAssets: number;
  liabilities: Line[];
  totalLiabilities: number;
  equity: Line[];
  totalEquity: number;
  consignmentStock: number;
  cashMissing: boolean;
}
interface CashFlowData {
  range: { from: string; to: string };
  baseline: { amount: number; at: string } | null;
  startsAtBaseline?: boolean;
  opening?: number;
  operating?: Line[];
  operatingTotal?: number;
  financing?: Line[];
  financingTotal?: number;
  netChange?: number;
  closing?: number;
  nonCash?: { assetsBought: number; partnerPaid: number };
  /** JazzCash part of the money, same days. */
  jazzcash?: { in: number; out: number; net: number; bills: number } | null;
  /** Closing money split: cash + bank vs JazzCash wallet. */
  closingSplit?: { cashBank: number; jazzcash: number } | null;
}

// ---------------------------------------------------------------- periods
const SYSTEM_START = "2026-10-25";
const FIRST_END = "2026-11-30";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pkToday = () => new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
const pad = (n: number) => String(n).padStart(2, "0");
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

interface Period {
  key: string;
  label: string;
  from: string;
  to: string;
}
/** Same periods as Cash in Hand: 25 Oct – 30 Nov 2026, then monthly, plus everything. */
function periods(today: string): Period[] {
  const list: Period[] = [{ key: "first", label: "25 Oct – 30 Nov 2026 (first period)", from: SYSTEM_START, to: FIRST_END }];
  let y = 2026;
  let m = 12;
  while (`${y}-${pad(m)}-01` <= today) {
    list.push({ key: `${y}-${pad(m)}`, label: `${MONTHS[m - 1]} ${y}`, from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(lastDay(y, m))}` });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  list.reverse();
  list.unshift({ key: "all", label: "Everything (25 Oct 2026 – today)", from: SYSTEM_START, to: today });
  return list;
}

// ---------------------------------------------------------------- bits
/** Rs 1,200 / (Rs 1,200) for money going out. */
const money = (n: number) => (n < 0 ? `(${formatRs(-n)})` : formatRs(n));
const pctText = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `${n.toFixed(1)}%`);

function change(cur: number, prev: number | undefined) {
  if (prev === undefined) return null;
  if (!prev) return cur ? "new" : "—";
  const p = ((cur - prev) / Math.abs(prev)) * 100;
  return `${p >= 0 ? "+" : ""}${p.toFixed(0)}%`;
}

type RowKind = "line" | "sub" | "total" | "head";
interface Row {
  label: string;
  amount?: number;
  prev?: number;
  kind?: RowKind;
  hint?: string;
  indent?: boolean;
}

function Statement({ rows, compare, prevLabel }: { rows: Row[]; compare?: boolean; prevLabel?: string }) {
  return (
    <div className="overflow-x-auto max-w-3xl mx-auto">
      <table className="w-full text-sm">
        {compare && (
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-gray-500 border-b border-gray-100">
              <th className="text-left font-medium px-3 sm:px-4 py-2" />
              <th className="text-right font-medium px-3 py-2">This period</th>
              <th className="text-right font-medium px-3 py-2 hidden sm:table-cell">{prevLabel || "Before"}</th>
              <th className="text-right font-medium px-3 sm:px-4 py-2 hidden sm:table-cell">Change</th>
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((r, i) => {
            if (r.kind === "head")
              return (
                <tr key={i}>
                  <td colSpan={4} className="px-3 sm:px-4 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    {r.label}
                  </td>
                </tr>
              );
            const strong = r.kind === "sub" || r.kind === "total";
            const neg = (r.amount ?? 0) < 0;
            return (
              <tr
                key={i}
                className={
                  r.kind === "total"
                    ? "bg-honey-50 border-y-2 border-honey-200"
                    : r.kind === "sub"
                      ? "border-t border-gray-200 bg-gray-50"
                      : "border-t border-gray-100 even:bg-gray-50/60 hover:bg-honey-50/50"
                }
              >
                <td className={`px-3 sm:px-4 py-2 ${r.indent ? "pl-6 sm:pl-8" : ""} ${strong ? "font-semibold text-gray-900" : "text-gray-700"}`}>
                  {r.label}
                  {r.hint && <div className="text-[11px] font-normal text-gray-400">{r.hint}</div>}
                </td>
                <td className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${strong ? "font-semibold" : ""} ${neg ? "text-red-700" : "text-gray-900"}`}>
                  {r.amount === undefined ? "" : money(r.amount)}
                </td>
                {compare && (
                  <>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap text-gray-500 hidden sm:table-cell">
                      {r.prev === undefined ? "" : money(r.prev)}
                    </td>
                    <td className="px-3 sm:px-4 py-2 text-right tabular-nums text-xs text-gray-500 hidden sm:table-cell">
                      {r.amount === undefined ? "" : change(r.amount, r.prev)}
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Note({ tone = "info", children }: { tone?: "info" | "warn" | "good"; children: React.ReactNode }) {
  const cls =
    tone === "warn"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : tone === "good"
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : "border-gray-200 bg-white text-gray-600";
  const Icon = tone === "good" ? CheckCircle2 : AlertTriangle;
  return (
    <div className={`flex gap-2 rounded-lg border px-3 py-2 text-xs ${cls}`}>
      {tone !== "info" && <Icon className="h-4 w-4 flex-shrink-0" />}
      <div>{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------- rows
function incomeRows(c: IncomeNumbers, p?: IncomeNumbers | null): Row[] {
  const prevExp = new Map((p?.expenses || []).map((e) => [e.category, e.amount]));
  const cats = [...new Set([...c.expenses.map((e) => e.category), ...(p?.expenses || []).map((e) => e.category)])];
  const curExp = new Map(c.expenses.map((e) => [e.category, e.amount]));
  return [
    { label: "Revenue", kind: "head" },
    { label: "Sales (after discounts, without tax)", amount: c.sales, prev: p?.sales, indent: true, hint: `${c.bills} bills · ${Math.round(c.itemsSold)} pieces` },
    { label: "Refunds given", amount: -c.refunds, prev: p ? -p.refunds : undefined, indent: true },
    { label: "Net sales", amount: c.netSales, prev: p?.netSales, kind: "sub" },
    ...(c.goodsCost !== undefined && c.tripCost !== undefined
      ? [
          { label: "Goods (vendor price)", amount: -c.goodsCost, prev: p && p.goodsCost !== undefined ? -p.goodsCost : undefined, indent: true },
          { label: "Trip costs (rent, builty, loading)", amount: -c.tripCost, prev: p && p.tripCost !== undefined ? -p.tripCost : undefined, indent: true, hint: "Share of trip costs in the goods sold" },
          { label: "Cost of goods sold", amount: -c.costOfGoods, prev: p ? -p.costOfGoods : undefined, kind: "sub" as RowKind },
        ]
      : [{ label: "Cost of goods sold", amount: -c.costOfGoods, prev: p ? -p.costOfGoods : undefined, indent: true, hint: "Landed cost: price + trip costs" }]),
    { label: `Gross profit · margin ${pctText(c.grossMargin)}`, amount: c.grossProfit, prev: p?.grossProfit, kind: "sub" },
    { label: "Operating expenses", kind: "head" },
    ...cats.map((cat) => ({ label: cat, amount: -(curExp.get(cat) || 0), prev: p ? -(prevExp.get(cat) || 0) : undefined, indent: true })),
    { label: "Total expenses", amount: -c.totalExpenses, prev: p ? -p.totalExpenses : undefined, kind: "sub" as RowKind },
    { label: "Operating profit", amount: c.operatingProfit, prev: p?.operatingProfit, kind: "sub" as RowKind },
    // Paid to each vendor in the period (owner 2026-11-20). For information only: paying a
    // vendor is not an expense (the goods' cost is in Cost of goods), so profit does not change.
    ...((c.byVendor || []).some((v) => v.paid)
      ? [
          { label: "Vendor payments (for information — not taken off profit)", kind: "head" as RowKind },
          ...(c.byVendor || [])
            .filter((v) => v.paid)
            .sort((a, b) => b.paid - a.paid)
            .map((v) => ({
              label: v.name,
              amount: v.paid,
              indent: true,
              hint: `${v.payments} payment${v.payments === 1 ? "" : "s"} · goods sold ${formatRs(v.goodsCost)}`,
            })),
          {
            label: "Total paid to vendors",
            amount: Math.round((c.byVendor || []).reduce((t, v) => t + v.paid, 0) * 100) / 100,
            kind: "sub" as RowKind,
          },
        ]
      : []),
    { label: "Other costs", kind: "head" as RowKind },
    { label: "Damaged stock", amount: -c.damage, prev: p ? -p.damage : undefined, indent: true, hint: c.damageCount ? `${c.damageCount} approved records` : undefined },
    { label: "Stock count differences", amount: -c.stockCount, prev: p ? -p.stockCount : undefined, indent: true },
    { label: "Depreciation of assets", amount: -c.depreciation, prev: p ? -p.depreciation : undefined, indent: true },
    { label: `Net profit · margin ${pctText(c.netMargin)}`, amount: c.netProfit, prev: p?.netProfit, kind: "total" as RowKind },
    // Details at the bottom (owner 2026-11-20): they explain lines above, they are not taken off again.
    ...((c.byVendor || []).some((v) => v.goodsCost !== 0)
      ? [
          { label: "Goods (vendor price) by vendor — detail of the line above", kind: "head" as RowKind },
          ...(c.byVendor || [])
            .filter((v) => v.goodsCost !== 0)
            .map((v) => ({
              label: v.name,
              amount: v.goodsCost,
              indent: true,
              hint: `${Math.round(v.qty)} pieces · ${v.paid ? `paid ${formatRs(v.paid)} in this period` : "nothing paid in this period"}`,
            })),
          { label: "Total goods (vendor price)", amount: Math.round((c.byVendor || []).reduce((t, v) => t + v.goodsCost, 0) * 100) / 100, kind: "sub" as RowKind },
        ]
      : []),
    ...((c.tripByType || []).length
      ? [
          { label: "Trip costs by type — detail of the line above", kind: "head" as RowKind },
          ...(c.tripByType || []).map((t) => ({ label: t.label, amount: t.amount, indent: true })),
          { label: "Total trip costs", amount: Math.round((c.tripByType || []).reduce((t, x) => t + x.amount, 0) * 100) / 100, kind: "sub" as RowKind },
        ]
      : []),
  ];
}

function balanceRows(b: BalanceData): Row[] {
  const rows: Row[] = [{ label: "Assets — what the shop owns", kind: "head" }];
  b.assets.forEach((a) => rows.push({ label: a.label, amount: a.amount, hint: a.missing ? "Set a start balance in Cash in Hand → Money left" : a.hint, indent: true }));
  rows.push({ label: "Total assets", amount: b.totalAssets, kind: "sub" });
  rows.push({ label: "Liabilities — what the shop owes", kind: "head" });
  b.liabilities.forEach((l) => rows.push({ label: l.label, amount: l.amount, indent: true }));
  rows.push({ label: "Total liabilities", amount: b.totalLiabilities, kind: "sub" });
  rows.push({ label: "Equity — owners' share", kind: "head" });
  b.equity.forEach((e) => {
    rows.push({ label: e.label, amount: e.amount, indent: true });
    (e.partners || []).forEach((p) => rows.push({ label: `· ${p.name}`, amount: p.amount, indent: true }));
  });
  rows.push({ label: "Total equity", amount: b.totalEquity, kind: "sub" });
  rows.push({ label: "Liabilities + equity", amount: b.totalLiabilities + b.totalEquity, kind: "total" });
  return rows;
}

function cashRows(c: CashFlowData): Row[] {
  return [
    { label: c.startsAtBaseline ? "Opening cash + bank + JazzCash (your start balance)" : "Opening cash + bank + JazzCash", amount: c.opening, kind: "sub" },
    { label: "Operating — running the shop", kind: "head" },
    ...(c.operating || []).map((l) => ({ label: l.label, amount: l.amount, indent: true })),
    { label: "Net cash from operating", amount: c.operatingTotal, kind: "sub" as RowKind },
    { label: "Investing — assets", kind: "head" as RowKind },
    { label: "Assets bought / sold from the till or bank", amount: 0, indent: true, hint: "Not recorded as cash yet — see note below" },
    { label: "Net cash from investing", amount: 0, kind: "sub" as RowKind },
    { label: "Financing — loans", kind: "head" as RowKind },
    ...(c.financing || []).map((l) => ({ label: l.label, amount: l.amount, indent: true })),
    { label: "Net cash from financing", amount: c.financingTotal, kind: "sub" as RowKind },
    { label: "Net change in cash", amount: c.netChange, kind: "sub" as RowKind },
    ...(c.closingSplit
      ? [
          { label: "Closing money (cash + bank + JazzCash)", kind: "head" as RowKind },
          { label: "Cash + bank (UBL)", amount: c.closingSplit.cashBank, indent: true },
          { label: "JazzCash wallet", amount: c.closingSplit.jazzcash, indent: true },
          { label: "Closing cash + bank + JazzCash", amount: c.closing, kind: "total" as RowKind },
        ]
      : [{ label: "Closing cash + bank + JazzCash", amount: c.closing, kind: "total" as RowKind }]),
  ];
}

const pdfRows = (rows: Row[]) =>
  rows.map((r) => [r.kind === "head" ? r.label.toUpperCase() : `${r.indent ? "   " : ""}${r.label}`, r.amount === undefined ? "" : money(r.amount)]);

// ---------------------------------------------------------------- page
type Tab = "investments" | "income" | "balance" | "cash" | "partners";
const TABS: { key: Tab; label: string }[] = [
  // Investments moved here as the first tab (owner 2026-11-17).
  { key: "investments", label: "Investments" },
  { key: "income", label: "Income Statement" },
  { key: "balance", label: "Balance Sheet" },
  { key: "cash", label: "Cash Flow" },
  // Partners: who owns what, profit split, money taken (owner 2026-11-17).
  { key: "partners", label: "Partners" },
];

export default function FinancialStatementsPage() {
  const { can, loaded } = useAccess();
  const canStatements = can("report_financial_statements", "view");
  const canInvest = can("investments", "view");
  const canView = canStatements || canInvest;
  const canExport = can("report_financial_statements", "export");
  const tabs = TABS.filter((t) => (t.key === "investments" ? canInvest : t.key === "partners" ? canStatements || canInvest : canStatements));
  const today = pkToday();
  const list = useMemo(() => periods(today), [today]);
  const current = list.find((p) => p.key !== "all" && p.from <= today && today <= p.to) || list[0];
  const [key, setKey] = useState(current.key);
  const period = list.find((p) => p.key === key) || current;
  const to = period.to > today ? today : period.to;

  const [rawTab, setTab] = useState<Tab>("investments");
  useEffect(() => {
    const h = window.location.hash.slice(1) as Tab;
    if (TABS.some((t) => t.key === h)) setTab(h);
  }, []);
  // A tab the role cannot see falls back to the first one it can.
  const tab: Tab = tabs.some((t) => t.key === rawTab) ? rawTab : tabs[0]?.key || "income";
  const openTab = (t: Tab) => {
    setTab(t);
    window.history.replaceState(null, "", `#${t}`);
  };

  const income = useReport<IncomeData>("/analytics/financial/income", { from: period.from, to, compare: key === "all" ? 0 : 1 }, canStatements && tab === "income");
  const balance = useReport<BalanceData>("/analytics/financial/balance-sheet", {}, canStatements && tab === "balance");
  const cash = useReport<CashFlowData>("/analytics/financial/cash-flow", { from: period.from, to }, canStatements && tab === "cash");
  const active = tab === "income" ? income : tab === "balance" ? balance : cash;

  const sub = `${period.label} · ${fmtDate(period.from)} – ${fmtDate(to)}`;
  const exportPdf = () => {
    if (tab === "income" && income.data) {
      const c = income.data.current;
      buildPdf({
        title: "Income Statement",
        subtitle: sub,
        summary: [
          ["Net sales", formatRs(c.netSales)],
          ["Gross profit", `${formatRs(c.grossProfit)} (${pctText(c.grossMargin)})`],
          ["Net profit", `${money(c.netProfit)} (${pctText(c.netMargin)})`],
        ],
        tables: [{ head: ["", "Amount"], widths: [130, 50], rows: pdfRows(incomeRows(c)) }],
        fileName: `income-statement-${period.from}-${to}`,
      });
    } else if (tab === "balance" && balance.data) {
      const b = balance.data;
      buildPdf({
        title: "Balance Sheet",
        subtitle: `As of ${fmtDate(b.asOf)}`,
        summary: [
          ["Total assets", formatRs(b.totalAssets)],
          ["Total liabilities", formatRs(b.totalLiabilities)],
          ["Equity", money(b.totalEquity)],
        ],
        tables: [{ head: ["", "Amount"], widths: [130, 50], rows: pdfRows(balanceRows(b)) }],
        fileName: `balance-sheet-${today}`,
      });
    } else if (tab === "cash" && cash.data && cash.data.baseline) {
      buildPdf({
        title: "Cash Flow Statement",
        subtitle: sub,
        summary: [
          ["Opening", money(cash.data.opening || 0)],
          ["Net change", money(cash.data.netChange || 0)],
          ["Closing", money(cash.data.closing || 0)],
        ],
        tables: [{ head: ["", "Amount"], widths: [130, 50], rows: pdfRows(cashRows(cash.data)) }],
        fileName: `cash-flow-${period.from}-${to}`,
      });
    }
  };

  if (!loaded) return <LoadingCard text="Loading…" />;
  if (!canView) return <NoAccessCard />;

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        icon={<Scale className="h-6 w-6" />}
        title="Financial Statements"
        subtitle="Investments, Income Statement, Balance Sheet and Cash Flow from your sales, stock, expenses, vendors, loans and investments."
        actions={
          tab === "investments" || tab === "partners" ? undefined : (
            <ReportActions canExport={canExport} onPdf={exportPdf} onRefresh={active.reload} loading={active.loading} disabled={!active.data} />
          )
        }
      />

      <div className="flex gap-1 overflow-x-auto border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => openTab(t.key)}
            className={`whitespace-nowrap px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t.key ? "border-honey-600 text-honey-800" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "investments" && (
        <InvestmentsView />
      )}

      {tab === "partners" && <PartnersView />}

      {tab !== "balance" && tab !== "investments" && tab !== "partners" && (
        <FilterBar>
          <SearchSelect value={key} onChange={(e) => setKey(e.target.value)} className={selectClass} aria-label="Period">
            {list.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </SearchSelect>
          <span className="text-xs text-gray-500">
            {fmtDate(period.from)} – {fmtDate(to)}
          </span>
        </FilterBar>
      )}

      {tab !== "investments" && tab !== "partners" && active.error && <ErrorState message={active.error} onRetry={active.reload} />}
      {tab !== "investments" && tab !== "partners" && !active.data && active.loading && <LoadingBlock />}

      {tab === "income" && income.data && <IncomeView d={income.data} />}
      {tab === "balance" && balance.data && <BalanceView b={balance.data} />}
      {tab === "cash" && cash.data && <CashView c={cash.data} />}
    </div>
  );
}

function IncomeView({ d }: { d: IncomeData }) {
  const c = d.current;
  const p = d.previous;
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <StatCard label="Net sales" value={formatRs(c.netSales)} hint={`${c.bills} bills`} />
        <StatCard label="Gross profit" value={formatRs(c.grossProfit)} hint={`Margin ${pctText(c.grossMargin)}`} tone="info" />
        <StatCard label="Expenses + other costs" value={formatRs(c.totalExpenses + c.otherCosts)} tone="warn" />
        <StatCard label="Net profit" value={money(c.netProfit)} hint={`Margin ${pctText(c.netMargin)}`} tone={c.netProfit >= 0 ? "good" : "bad"} />
      </div>
      <Card title="Income Statement (Profit & Loss)" subtitle={p ? `Compared with ${fmtDate(p.from)} – ${fmtDate(p.to)}` : undefined}>
        <Statement rows={incomeRows(c, p)} compare={!!p} prevLabel="Before" />
      </Card>
      {c.byCounter && c.byCounter.length > 0 && (
        <Card title="Sales by counter" subtitle="Before refunds paid back · same rules as the statement">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-gray-500 border-b border-gray-100">
                  <th className="text-left font-medium px-3 sm:px-4 py-2">Counter</th>
                  <th className="text-right font-medium px-3 py-2">Pieces</th>
                  <th className="text-right font-medium px-3 py-2">Sales</th>
                  <th className="text-right font-medium px-3 py-2">Cost of goods</th>
                  <th className="text-right font-medium px-3 sm:px-4 py-2">Gross profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {c.byCounter.map((r) => (
                  <tr key={r.counter}>
                    <td className="px-3 sm:px-4 py-2 font-medium text-gray-900">{r.counter}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-600">{r.itemsSold.toLocaleString("en-PK")}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatRs(r.netSales)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-600">{formatRs(r.cost)}</td>
                    <td className="px-3 sm:px-4 py-2 text-right tabular-nums font-semibold">
                      {money(r.grossProfit)}{" "}
                      <span className="text-[10px] font-normal text-gray-500">{r.netSales > 0 ? `${((r.grossProfit / r.netSales) * 100).toFixed(1)}%` : ""}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-200 font-semibold">
                <tr>
                  <td className="px-3 sm:px-4 py-2">All counters</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.byCounter.reduce((t, r) => t + r.itemsSold, 0).toLocaleString("en-PK")}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatRs(c.byCounter.reduce((t, r) => t + r.netSales, 0))}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatRs(c.byCounter.reduce((t, r) => t + r.cost, 0))}</td>
                  <td className="px-3 sm:px-4 py-2 text-right tabular-nums">{money(c.byCounter.reduce((t, r) => t + r.grossProfit, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}
      {c.byVendor && c.byVendor.length > 0 && (
        <Card title="Goods (vendor price) by vendor" subtitle="What was sold from each vendor at vendor price, and what was paid to them in this period">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-gray-500 border-b border-gray-100">
                  <th className="text-left font-medium px-3 sm:px-4 py-2">Vendor</th>
                  <th className="text-right font-medium px-3 py-2">Pieces sold</th>
                  <th className="text-right font-medium px-3 py-2">Goods sold (vendor price)</th>
                  <th className="text-right font-medium px-3 py-2">Paid to vendor</th>
                  <th className="text-right font-medium px-3 sm:px-4 py-2">Paid − goods sold</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {c.byVendor.map((v) => {
                  const diff = Math.round((v.paid - v.goodsCost) * 100) / 100;
                  return (
                    <tr key={v.vendorId || "none"}>
                      <td className="px-3 sm:px-4 py-2 font-medium text-gray-900">
                        {v.vendorId ? (
                          <a href={`/admin/vendors/${v.vendorId}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                            {v.name}
                          </a>
                        ) : (
                          <span className="text-gray-500">{v.name}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-600">{v.qty ? v.qty.toLocaleString("en-PK") : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{v.goodsCost ? formatRs(v.goodsCost) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {v.paid ? formatRs(v.paid) : "—"}
                        {v.payments > 0 && <span className="block text-[10px] text-gray-400">{v.payments} payment{v.payments === 1 ? "" : "s"}</span>}
                      </td>
                      <td className={`px-3 sm:px-4 py-2 text-right tabular-nums text-xs ${diff > 0 ? "text-emerald-700" : diff < 0 ? "text-amber-700" : "text-gray-400"}`}>
                        {diff === 0 ? "—" : `${diff > 0 ? "+" : "−"}${formatRs(Math.abs(diff))}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-gray-200 font-semibold">
                <tr>
                  <td className="px-3 sm:px-4 py-2">All vendors ({c.byVendor.filter((v) => v.vendorId).length})</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.byVendor.reduce((t, v) => t + v.qty, 0).toLocaleString("en-PK")}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatRs(c.byVendor.reduce((t, v) => t + v.goodsCost, 0))}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatRs(c.byVendor.reduce((t, v) => t + v.paid, 0))}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="px-3 sm:px-4 pb-3 pt-1 text-[11px] text-gray-500">
            Payments are for everything bought from the vendor (also stock not sold yet, and older bills), so they do not have to match the goods sold. A piece&apos;s
            vendor is the stock code it was sold with, else the product&apos;s latest goods receipt.
          </p>
        </Card>
      )}
      <Note>
        Sales tax collected ({formatRs(c.taxCollected)}) is not income — it is owed to FBR and shows on the Balance Sheet. Trip costs are inside the
        cost of goods, so they are not counted again as expenses.
      </Note>
    </>
  );
}

function BalanceView({ b }: { b: BalanceData }) {
  const diff = b.equity.find((e) => e.key === "difference")?.amount || 0;
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3">
        <StatCard label="Total assets" value={formatRs(b.totalAssets)} />
        <StatCard label="Total liabilities" value={formatRs(b.totalLiabilities)} tone="warn" />
        <StatCard label="Equity (net worth)" value={money(b.totalEquity)} tone={b.totalEquity >= 0 ? "good" : "bad"} />
        <StatCard label="In goods / stock" value={formatRs(b.assets.find((x) => x.key === "stock")?.amount || 0)} hint="At cost" tone="info" />
        <StatCard label="Vendor stock on shelves" value={formatRs(b.consignmentStock)} hint="Consignment — not ours" />
      </div>
      {b.cashMissing && (
        <Note tone="warn">No start balance is set, so cash + bank shows as 0. Set it in Cash in Hand → Money left.</Note>
      )}
      <Card title="Balance Sheet" subtitle={`As of ${fmtDate(b.asOf)} · stock is valued at today's cost`}>
        <Statement rows={balanceRows(b)} />
      </Card>
      <Note tone={Math.abs(diff) < 1 ? "good" : "warn"}>
        {Math.abs(diff) < 1 ? (
          <>Assets = Liabilities + Equity. Everything is explained.</>
        ) : (
          <>
            <b>{money(diff)}</b> is not explained by partner money or profit. Usually this is the money and stock the shop had before 25 Oct 2026
            (start balance, vendor opening balances), or something not entered yet — e.g. owner withdrawals, assets paid from the till, or stock
            received without a vendor bill.
          </>
        )}
      </Note>
    </>
  );
}

function CashView({ c }: { c: CashFlowData }) {
  if (!c.baseline)
    return <Note tone="warn">Cash flow needs a start balance. Set it in Cash in Hand → Money left, then come back.</Note>;
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <StatCard label="Opening" value={money(c.opening || 0)} />
        <StatCard label="From operating" value={money(c.operatingTotal || 0)} tone={(c.operatingTotal || 0) >= 0 ? "good" : "bad"} />
        <StatCard label="From financing" value={money(c.financingTotal || 0)} tone="info" />
        <StatCard label="Closing" value={money(c.closing || 0)} />
      </div>
      {c.startsAtBaseline && (
        <Note>This period starts before your start balance ({fmtDate(c.baseline.at)}), so the opening is that start balance.</Note>
      )}
      <Card title="Cash Flow Statement" subtitle="Cash + bank together, same movements as Cash in Hand → Money left">
        <Statement rows={cashRows(c)} />
      </Card>
      {c.jazzcash && (
        <Card title="JazzCash wallet" subtitle="Already inside the cash flow above — shown here on its own">
          <div className="grid grid-cols-3 gap-2 p-3 sm:p-4 max-w-3xl mx-auto">
            <StatCard label="Received" value={formatRs(c.jazzcash.in)} hint={`${c.jazzcash.bills} bills`} tone="good" />
            <StatCard label="Paid out" value={formatRs(c.jazzcash.out)} tone="bad" />
            <StatCard label="Net" value={money(c.jazzcash.net)} tone={c.jazzcash.net >= 0 ? "good" : "bad"} />
          </div>
        </Card>
      )}
      {c.nonCash && (c.nonCash.assetsBought > 0 || c.nonCash.partnerPaid > 0) && (
        <Note>
          Not in the cash above (paid outside the till / bank): assets bought {formatRs(c.nonCash.assetsBought)}, bills paid by partners{" "}
          {formatRs(c.nonCash.partnerPaid)}.
        </Note>
      )}
    </>
  );
}
