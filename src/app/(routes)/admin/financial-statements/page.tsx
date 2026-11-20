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
  /** Bills refunded in full / part refunds (missing on an old server). */
  refundsFull?: number;
  refundsPartial?: number;
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
  equipmentBought?: number;
  equipmentItems?: { title: string; amount: number; date: string | null }[];
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
  fixedAssets?: { value: number; cost: number; depreciation: number; paidFromCash: number };
  cashMissing: boolean;
  gapReasons?: { overBills: number; overCount: number; placeholders: number; inBoxes: number; inBoxesCount: number } | null;
}
interface CashFlowData {
  range: { from: string; to: string };
  baseline: { amount: number; at: string } | null;
  startsAtBaseline?: boolean;
  opening?: number;
  operating?: Line[];
  operatingTotal?: number;
  investing?: Line[];
  investingTotal?: number;
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
  /** One level deeper (a child of the row above). */
  child?: boolean;
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
                <td className={`px-3 sm:px-4 py-2 ${r.child ? "pl-10 sm:pl-14" : r.indent ? "pl-6 sm:pl-8" : ""} ${strong ? "font-semibold text-gray-900" : "text-gray-700"}`}>
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
/** "27,051 pieces × Rs 303.02 avg" (owner 2026-11-20). */
const perPiece = (pieces: number, amount: number) => {
  const n = Math.round(pieces || 0);
  return n > 0 ? `${n.toLocaleString("en-PK")} pieces × ${formatRs(Math.round((amount / n) * 100) / 100)} avg` : `${n} pieces`;
};

function incomeRows(c: IncomeNumbers, p?: IncomeNumbers | null): Row[] {
  const prevExp = new Map((p?.expenses || []).map((e) => [e.category, e.amount]));
  const cats = [...new Set([...c.expenses.map((e) => e.category), ...(p?.expenses || []).map((e) => e.category)])];
  const curExp = new Map(c.expenses.map((e) => [e.category, e.amount]));
  return [
    { label: "Revenue", kind: "head" },
    { label: "Sales (after discounts, without tax)", amount: c.sales, prev: p?.sales, indent: true, hint: `${c.bills} bills · ${perPiece(c.itemsSold, c.sales - (c.refundsFull ?? 0))}${c.refundsFull ? ` · incl. refunded bills ${formatRs(c.refundsFull)}` : ""}` },
    { label: "Refunds given", amount: -c.refunds, prev: p ? -p.refunds : undefined, indent: true, hint: c.refundsFull !== undefined ? `Whole bills ${formatRs(c.refundsFull)} + part refunds ${formatRs(c.refundsPartial ?? 0)} (same as Cash Flow)` : undefined },
    { label: "Net sales", amount: c.netSales, prev: p?.netSales, kind: "sub" },
    ...(c.goodsCost !== undefined && c.tripCost !== undefined
      ? [
          // Laid out like the expenses (owner 2026-11-20): heading, goods, each trip cost type,
          // the trip total once after its types, then the total.
          { label: "Cost of goods sold", kind: "head" as RowKind },
          { label: "Goods (vendor price)", amount: -c.goodsCost, prev: p && p.goodsCost !== undefined ? -p.goodsCost : undefined, indent: true, hint: perPiece(c.itemsSold, c.goodsCost ?? 0) },
          ...(c.tripByType || []).map((t) => ({
            label: t.label,
            amount: -t.amount,
            indent: true,
            hint: `Trip cost · ${perPiece(c.itemsSold, t.amount)}`,
          })),
          {
            label: (c.tripByType || []).length ? `Trip costs (${(c.tripByType || []).map((t) => t.label).join(" + ")})` : "Trip costs (rent, builty, loading)",
            amount: -(c.tripCost ?? 0),
            prev: p && p.tripCost !== undefined ? -p.tripCost : undefined,
            indent: true,
            hint: `Share of trip costs in the goods sold · ${perPiece(c.itemsSold, c.tripCost ?? 0)}`,
          },
          { label: "Total cost of goods sold", amount: -c.costOfGoods, prev: p ? -p.costOfGoods : undefined, kind: "sub" as RowKind, hint: perPiece(c.itemsSold, c.costOfGoods) },
        ]
      : [{ label: "Cost of goods sold", amount: -c.costOfGoods, prev: p ? -p.costOfGoods : undefined, indent: true, hint: `Landed cost: price + trip costs · ${perPiece(c.itemsSold, c.costOfGoods)}` }]),
    { label: `Gross profit · margin ${pctText(c.grossMargin)}`, amount: c.grossProfit, prev: p?.grossProfit, kind: "sub", hint: perPiece(c.itemsSold, c.grossProfit) },
    { label: "Operating expenses", kind: "head" },
    ...cats.map((cat) => ({ label: cat, amount: -(curExp.get(cat) || 0), prev: p ? -(prevExp.get(cat) || 0) : undefined, indent: true })),
    {
      label: "Assets purchased",
      amount: -(c.equipmentBought ?? 0),
      prev: p ? -(p.equipmentBought ?? 0) : undefined,
      indent: true,
      hint: "Bought this period from shop money (Shop Setup / Equipment)",
    },
    // Each asset bought, as a child of the line above (owner 2026-11-20).
    ...(c.equipmentItems || []).map((it) => ({
      label: `· ${it.title}`,
      amount: -it.amount,
      indent: true,
      child: true,
      hint: it.date ? fmtDate(it.date) : undefined,
    })),
    {
      label: "Total expenses",
      amount: -(c.totalExpenses + (c.equipmentBought ?? 0)),
      prev: p ? -(p.totalExpenses + (p.equipmentBought ?? 0)) : undefined,
      kind: "sub" as RowKind,
    },
    { label: "Operating profit", amount: c.operatingProfit, prev: p?.operatingProfit, kind: "sub" as RowKind },
    { label: "Other costs", kind: "head" as RowKind },
    { label: "Damaged stock", amount: -c.damage, prev: p ? -p.damage : undefined, indent: true, hint: c.damageCount ? `${c.damageCount} approved records` : undefined },
    { label: "Stock count differences", amount: -c.stockCount, prev: p ? -p.stockCount : undefined, indent: true },
    { label: "Depreciation of assets", amount: -c.depreciation, prev: p ? -p.depreciation : undefined, indent: true },
    { label: `Net profit · margin ${pctText(c.netMargin)}`, amount: c.netProfit, prev: p?.netProfit, kind: "total" as RowKind },
  ];
}

function balanceRows(b: BalanceData): Row[] {
  const rows: Row[] = [{ label: "Stock & cash — what the shop has", kind: "head" }];
  b.assets.forEach((a) => rows.push({ label: a.label, amount: a.amount, hint: a.missing ? "Set a start balance in Cash in Hand → Money left" : a.hint, indent: true }));
  rows.push({ label: "Total stock & cash", amount: b.totalAssets, kind: "sub" });
  rows.push({ label: "Liabilities — what the shop owes", kind: "head" });
  // Owner 2026-11-20: loans / salaries / investment bills sit under "Owed to vendors" as its children.
  const UNDER_VENDORS = new Set(["loans", "salaries", "investBills"]);
  b.liabilities.forEach((l) => rows.push({ label: l.label, amount: l.amount, indent: true, child: UNDER_VENDORS.has(l.key) }));
  rows.push({ label: "Total liabilities", amount: b.totalLiabilities, kind: "sub" });
  // Owner 2026-11-20: no Equity section here (partner money is on the Investments tab).
  rows.push({ label: "Net worth (stock & cash − liabilities)", amount: b.totalEquity, kind: "total" });
  return rows;
}

function cashRows(c: CashFlowData): Row[] {
  return [
    { label: c.startsAtBaseline ? "Opening cash + bank + JazzCash (your start balance)" : "Opening cash + bank + JazzCash", amount: c.opening, kind: "sub" },
    { label: "Operating — running the shop", kind: "head" },
    ...(c.operating || []).map((l) => ({ label: l.label, amount: l.amount, indent: true })),
    { label: "Net cash from operating", amount: c.operatingTotal, kind: "sub" as RowKind },
    { label: "Investing — assets", kind: "head" as RowKind },
    ...(c.investing || []).map((l) => ({ label: l.label, amount: l.amount, indent: true, hint: "Shop Setup / Equipment paid from the till or bank" })),
    { label: "Net cash from investing", amount: c.investingTotal ?? 0, kind: "sub" as RowKind },
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
          ["Total stock & cash", formatRs(b.totalAssets)],
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
        <StatCard label="Expenses + other costs" value={formatRs(c.totalExpenses + (c.equipmentBought ?? 0) + c.otherCosts)} tone="warn" />
        <StatCard label="Net profit" value={money(c.netProfit)} hint={`Margin ${pctText(c.netMargin)}`} tone={c.netProfit >= 0 ? "good" : "bad"} />
      </div>
      <Card title="Income Statement (Profit & Loss)" subtitle={p ? `Compared with ${fmtDate(p.from)} – ${fmtDate(p.to)}` : undefined}>
        <Statement rows={incomeRows(c, p)} compare={!!p} prevLabel="Before" />
      </Card>
      <Note>
        Sales tax collected ({formatRs(c.taxCollected)}) is not income — it is owed to FBR and shows on the Balance Sheet. Trip costs are inside the
        cost of goods, so they are not counted again as expenses.
      </Note>
    </>
  );
}

function BalanceView({ b }: { b: BalanceData }) {
  const diff = b.equity.find((e) => e.key === "difference")?.amount || 0;
  const stock = b.assets.find((x) => x.key === "stock")?.amount || 0;
  const fixed = b.assets.find((x) => x.key === "fixed")?.amount || 0;
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3">
        {/* Owner 2026-11-20: show what the total is made of. */}
        <StatCard
          label="Total stock & cash"
          value={formatRs(b.totalAssets)}
          hint={`Stock ${formatRs(stock)} + cash & other ${formatRs(b.totalAssets - fixed - stock)}`}
        />
        <StatCard label="Total liabilities" value={formatRs(b.totalLiabilities)} tone="warn" />
        <StatCard label="Equity (net worth)" value={money(b.totalEquity)} tone={b.totalEquity >= 0 ? "good" : "bad"} />
        <StatCard label="In goods / stock" value={formatRs(stock)} hint="At cost" tone="info" />
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
          <div className="text-red-700">
            <b>{money(diff)}</b> is not explained. Why:
            {/* Owner 2026-11-20: the reasons, from the data (the shop started from 0). */}
            {b.gapReasons ? (
              <ul className="mt-1 list-disc pl-4 space-y-0.5">
                {Math.abs(b.gapReasons.overBills) >= 1 && (
                  <li>
                    <b>{money(b.gapReasons.overBills)}</b> — unpacked goods do not match {b.gapReasons.overCount} vendor bill
                    {b.gapReasons.overCount === 1 ? "" : "s"}
                    {b.gapReasons.placeholders ? ` (${b.gapReasons.placeholders} still Rs 1,000)` : ""}. Fix the bill amounts (red warning on each trip).
                  </li>
                )}
                {Math.abs(b.gapReasons.inBoxes) >= 1 && (
                  <li>
                    <b>{money(b.gapReasons.inBoxes)}</b> — {b.gapReasons.inBoxesCount} bill{b.gapReasons.inBoxesCount === 1 ? "" : "s"} not unpacked yet (owed, not in stock yet).
                  </li>
                )}
                <li>
                  <b>{money(diff - b.gapReasons.overBills - b.gapReasons.inBoxes)}</b> — partner money not entered right (check Investments).
                </li>
              </ul>
            ) : (
              <> Check vendor bill amounts and partner money (Investments).</>
            )}
          </div>
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
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3">
        <StatCard label="Opening" value={money(c.opening || 0)} />
        <StatCard label="From operating" value={money(c.operatingTotal || 0)} tone={(c.operatingTotal || 0) >= 0 ? "good" : "bad"} />
        <StatCard label="Assets bought" value={money(c.investingTotal || 0)} tone="warn" />
        <StatCard label="From financing" value={money(c.financingTotal || 0)} tone="info" />
        <StatCard label="Closing" value={money(c.closing || 0)} />
      </div>
      {c.startsAtBaseline && (
        <Note>This period starts before your start balance ({fmtDate(c.baseline.at)}), so the opening is that start balance.</Note>
      )}
      <Card title="Cash Flow Statement" subtitle="Cash + bank together, same movements as Cash in Hand → Money left">
        <Statement rows={cashRows(c)} />
      </Card>
      {c.nonCash && (c.nonCash.assetsBought > 0 || c.nonCash.partnerPaid > 0) && (
        <Note>
          Not in the cash above (paid outside the till / bank): assets bought {formatRs(c.nonCash.assetsBought)}, bills paid by partners{" "}
          {formatRs(c.nonCash.partnerPaid)}.
        </Note>
      )}
    </>
  );
}
