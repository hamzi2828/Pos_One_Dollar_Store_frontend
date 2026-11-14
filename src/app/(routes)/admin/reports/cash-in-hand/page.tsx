"use client";

// Cash in Hand (was the Spending report, renamed 2026-11-14): bought from vendors, paid to them, trip costs and shop
// expenses for one period. Owner, 2026-11-04: the system starts 25 Oct 2026;
// the first period is 25 Oct - 30 Nov 2026, then every calendar month.

import { useEffect, useMemo, useState } from "react";
import { Wallet } from "lucide-react";
import ReportsNav from "../components/ReportsNav";
import FundsPanel from "./FundsPanel";
import BankCheckPanel from "./BankCheckPanel";
import JazzCashPanel from "./JazzCashPanel";
import { SearchSelect } from "@/components/ui/SearchSelect";
import { useAccess } from "@/context/AccessContext";
import { LoadingCard, NoAccessCard } from "@/components/admin/FormBits";
import {
  PageHeader,
  FilterBar,
  StatCard,
  Card,
  EmptyState,
  ErrorState,
  LoadingBlock,
  ReportActions,
  useReport,
  buildPdf,
  formatRs,
  fmtDate,
  selectClass,
} from "../demand/_shared/reportKit";

interface SpendingData {
  range: { from: string; to: string; systemStart: string };
  summary: {
    bought: number;
    opening: number;
    paid: number;
    adjusted: number;
    left: number;
    tripCosts: number;
    expenses: number;
    totalSpent: number;
    cashOut: number;
  };
  paidByMethod: Record<string, number>;
  tripByType: Record<string, number>;
  vendors: {
    vendorId: string;
    vendor: string;
    bought: number;
    opening: number;
    paid: number;
    adjusted: number;
    left: number;
  }[];
  payments: {
    date: string;
    vendor: string;
    refNo: string;
    method: string;
    amount: number;
  }[];
  tripCosts: {
    date: string;
    poNumber: string;
    type: string;
    note: string;
    paidTo: string;
    amount: number;
  }[];
  expensesByCategory: { category: string; total: number; count: number }[];
}

const SYSTEM_START = "2026-10-25";
const FIRST_END = "2026-11-30";
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const METHOD: Record<string, string> = {
  cash: "Cash",
  bank: "Bank",
  cheque: "Cheque",
  easypaisa: "Easypaisa",
  jazzcash: "JazzCash",
  other: "Other",
};

type Tab =
  | "overview"
  | "funds"
  | "bank"
  | "jazzcash"
  | "vendors"
  | "payments"
  | "trips"
  | "expenses";
const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "funds", label: "Money left" },
  { key: "bank", label: "Bank check" },
  { key: "jazzcash", label: "JazzCash" },
  { key: "vendors", label: "Vendors" },
  { key: "payments", label: "Payments" },
  { key: "trips", label: "Trip costs" },
  { key: "expenses", label: "Expenses" },
];

const pkToday = () =>
  new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
const pad = (n: number) => String(n).padStart(2, "0");
const lastDay = (y: number, m: number) =>
  new Date(Date.UTC(y, m, 0)).getUTCDate(); // m is 1-12

interface Period {
  key: string;
  label: string;
  from: string;
  to: string;
}

/** 25 Oct - 30 Nov 2026, then each month up to today (newest first), plus "everything". */
function periods(today: string): Period[] {
  const list: Period[] = [
    {
      key: "first",
      label: "25 Oct – 30 Nov 2026 (first period)",
      from: SYSTEM_START,
      to: FIRST_END,
    },
  ];
  let y = 2026;
  let m = 12;
  while (`${y}-${pad(m)}-01` <= today) {
    list.push({
      key: `${y}-${pad(m)}`,
      label: `${MONTHS[m - 1]} ${y}`,
      from: `${y}-${pad(m)}-01`,
      to: `${y}-${pad(m)}-${pad(lastDay(y, m))}`,
    });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  list.reverse();
  list.unshift({
    key: "all",
    label: `Everything (25 Oct 2026 – today)`,
    from: SYSTEM_START,
    to: today,
  });
  return list;
}

export default function CashInHandPage() {
  const { can, loaded } = useAccess();
  const canView = can(["report_cash_in_hand", "report_expenses"], "view");
  const canExport = can(["report_cash_in_hand", "report_expenses"], "export");
  const canBank = can("bank_check", "view");
  // The bank check tab shows only with the bank_check permission.
  const tabs = TABS.filter((t) => t.key !== "bank" || canBank);
  const today = pkToday();
  const list = useMemo(() => periods(today), [today]);
  // Default: the period today falls in.
  const current =
    list.find((p) => p.key !== "all" && p.from <= today && today <= p.to) ||
    list[0];
  const [key, setKey] = useState(current.key);
  const period = list.find((p) => p.key === key) || current;
  // Never ask past today.
  const to = period.to > today ? today : period.to;
  // Open tab, kept in the address (#vendors) so a refresh stays on it.
  const [rawTab, setTab] = useState<Tab>("overview");
  useEffect(() => {
    const h = window.location.hash.slice(1) as Tab;
    if (TABS.some((t) => t.key === h)) setTab(h);
  }, []);
  const openTab = (t: Tab) => {
    setTab(t);
    window.history.replaceState(null, "", `#${t}`);
  };
  // #bank without the permission falls back to the overview.
  const tab = rawTab === "bank" && !canBank ? "overview" : rawTab;
  // Tabs that do not use the period filter.
  const own = tab === "funds" || tab === "bank";

  const r = useReport<SpendingData>(
    "/analytics/spending",
    { from: period.from, to },
    canView,
  );
  const d = r.data;
  const s = d?.summary;

  const exportPdf = () => {
    if (!d || !s) return;
    buildPdf({
      title: "Cash in Hand",
      subtitle: `${period.label} · ${fmtDate(period.from)} – ${fmtDate(to)}`,
      summary: [
        ["Bought from vendors", formatRs(s.bought)],
        ["Paid to vendors", formatRs(s.paid)],
        ["Adjusted", formatRs(s.adjusted)],
        ["Left to pay", formatRs(s.left)],
        ["Trip costs", formatRs(s.tripCosts)],
        ["Shop expenses", formatRs(s.expenses)],
        ["Total spent (goods + trip + expenses)", formatRs(s.totalSpent)],
        ["Money out (paid + trip + expenses)", formatRs(s.cashOut)],
      ],
      tables: [
        {
          title: "By vendor",
          head: ["Vendor", "Bought", "Paid", "Adjusted", "Left"],
          widths: [70, 28, 28, 24, 28],
          rows: d.vendors.map((v) => [
            v.vendor,
            v.bought + v.opening,
            v.paid,
            v.adjusted,
            v.left,
          ]),
        },
        {
          title: "Trip costs",
          head: ["Date", "Trip", "Type", "Note", "Amount"],
          widths: [25, 30, 25, 70, 28],
          rows: d.tripCosts.map((t) => [
            fmtDate(t.date),
            t.poNumber,
            t.type,
            t.note,
            t.amount,
          ]),
        },
        {
          title: "Payments",
          head: ["Date", "Vendor", "No.", "Method", "Amount"],
          widths: [25, 65, 30, 25, 28],
          rows: d.payments.map((p) => [
            fmtDate(p.date),
            p.vendor,
            p.refNo,
            METHOD[p.method] || p.method,
            p.amount,
          ]),
        },
      ],
      fileName: `spending-${period.from}-${to}`,
    });
  };

  if (!loaded) return <LoadingCard text="Loading…" />;
  if (!canView) return <NoAccessCard />;

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        icon={<Wallet className="h-6 w-6" />}
        title="Cash in Hand"
        subtitle="Bought from vendors, paid, trip costs and shop expenses. First period 25 Oct – 30 Nov 2026, then monthly."
        actions={
          <ReportActions
            canExport={canExport}
            onPdf={exportPdf}
            onRefresh={r.reload}
            loading={r.loading}
            disabled={!d}
          />
        }
      />
      <ReportsNav />

      <div className="flex gap-1 overflow-x-auto border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => openTab(t.key)}
            className={`whitespace-nowrap px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t.key
                ? "border-honey-600 text-honey-800"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {t.label}
            {d && t.key === "vendors" ? (
              <span className="ml-1 text-[11px] text-gray-400">
                {d.vendors.length}
              </span>
            ) : null}
            {d && t.key === "payments" ? (
              <span className="ml-1 text-[11px] text-gray-400">
                {d.payments.length}
              </span>
            ) : null}
            {d && t.key === "trips" ? (
              <span className="ml-1 text-[11px] text-gray-400">
                {d.tripCosts.length}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === "funds" && <FundsPanel />}
      {tab === "bank" && canBank && <BankCheckPanel />}

      {!own && (
        <FilterBar>
          <SearchSelect
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className={selectClass}
            aria-label="Period"
          >
            {list.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </SearchSelect>
          <span className="text-xs text-gray-500">
            {fmtDate(period.from)} – {fmtDate(to)}
            {to !== period.to ? " (till today)" : ""}
          </span>
        </FilterBar>
      )}

      {tab === "jazzcash" && <JazzCashPanel from={period.from} to={to} />}

      {own || tab === "jazzcash" ? null : r.error ? (
        <ErrorState message={r.error} onRetry={r.reload} />
      ) : !d || !s ? (
        <LoadingBlock />
      ) : (
        <>
          {tab === "overview" && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
              <StatCard
                label="Bought from vendors"
                value={formatRs(s.bought)}
                hint={
                  s.opening
                    ? `+ ${formatRs(s.opening)} opening balances (not in totals)`
                    : "Vendor bills"
                }
              />
              <StatCard
                tone="good"
                label="Paid to vendors"
                value={formatRs(s.paid)}
                hint={
                  Object.entries(d.paidByMethod)
                    .map(([m, v]) => `${METHOD[m] || m} ${formatRs(v)}`)
                    .join(" · ") || "—"
                }
              />
              <StatCard
                tone="info"
                label="Adjusted"
                value={formatRs(s.adjusted)}
                hint="Adjustments, returns, discounts"
              />
              <StatCard
                tone="bad"
                label="Left to pay"
                value={formatRs(s.left)}
                hint="Bought − paid − adjusted"
              />
              <StatCard
                tone="warn"
                label="Trip costs"
                value={formatRs(s.tripCosts)}
                hint={
                  Object.entries(d.tripByType)
                    .map(([t, v]) => `${t} ${formatRs(v)}`)
                    .join(" · ") || "—"
                }
              />
              <StatCard
                label="Shop expenses"
                value={formatRs(s.expenses)}
                hint="From Expenses"
              />
              <StatCard
                label="Total spent"
                value={formatRs(s.totalSpent)}
                hint="Goods + trip costs + expenses"
              />
              <StatCard
                tone="bad"
                label="Money out so far"
                value={formatRs(s.cashOut)}
                hint="Paid + trip costs + expenses"
              />
            </div>
          )}

          {tab === "vendors" && (
            <Card
              title="By vendor"
              subtitle={`${d.vendors.length} vendors`}
              bodyClass="!p-0"
            >
              {d.vendors.length === 0 ? (
                <EmptyState title="No vendor bills or payments in this period" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500">
                      <tr>
                        <th className="px-3 py-2 text-right w-10">Sr#</th>
                        <th className="px-3 py-2 text-left">Vendor</th>
                        <th className="px-3 py-2 text-right">Bought</th>
                        <th className="px-3 py-2 text-right">Paid</th>
                        <th className="px-3 py-2 text-right hidden sm:table-cell">
                          Adjusted
                        </th>
                        <th className="px-3 py-2 text-right">Left</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {d.vendors.map((v, i) => (
                        <tr key={v.vendorId}>
                          <td className="px-3 py-2 text-right text-xs text-gray-500">
                            {i + 1}
                          </td>
                          <td className="px-3 py-2 text-gray-900">
                            {v.vendor}
                            {v.opening ? (
                              <span className="block text-[11px] text-amber-700">
                                incl. {formatRs(v.opening)} opening balance
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatRs(v.bought + v.opening)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-green-700">
                            {formatRs(v.paid)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-blue-700 hidden sm:table-cell">
                            {v.adjusted ? formatRs(v.adjusted) : "—"}
                          </td>
                          <td
                            className={`px-3 py-2 text-right tabular-nums font-medium ${v.left > 0 ? "text-red-600" : "text-green-700"}`}
                          >
                            {formatRs(v.left)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 font-semibold">
                      <tr>
                        <td />
                        <td className="px-3 py-2">Total</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatRs(
                            d.vendors.reduce(
                              (t, v) => t + v.bought + v.opening,
                              0,
                            ),
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-green-700">
                          {formatRs(d.vendors.reduce((t, v) => t + v.paid, 0))}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-blue-700 hidden sm:table-cell">
                          {formatRs(
                            d.vendors.reduce((t, v) => t + v.adjusted, 0),
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-red-600">
                          {formatRs(d.vendors.reduce((t, v) => t + v.left, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </Card>
          )}

          {tab === "trips" && (
            <Card
              title="Trip costs"
              subtitle={formatRs(s.tripCosts)}
              bodyClass="!p-0"
            >
              {d.tripCosts.length === 0 ? (
                <EmptyState title="No trip costs in this period" />
              ) : (
                <ul className="divide-y divide-gray-100">
                  {d.tripCosts.map((t, i) => (
                    <li
                      key={i}
                      className="flex items-start justify-between gap-3 px-4 py-2 text-sm"
                    >
                      <span className="min-w-0">
                        <span className="block text-gray-900 capitalize">
                          {t.type}
                          {t.note ? ` · ${t.note}` : ""}
                        </span>
                        <span className="block text-[11px] text-gray-500">
                          {fmtDate(t.date)} · {t.poNumber}
                        </span>
                      </span>
                      <span className="tabular-nums font-medium whitespace-nowrap">
                        {formatRs(t.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
          {tab === "payments" && (
            <Card
              title="Payments to vendors"
              subtitle={formatRs(s.paid)}
              bodyClass="!p-0"
            >
              {d.payments.length === 0 ? (
                <EmptyState title="No payments in this period" />
              ) : (
                <ul className="divide-y divide-gray-100">
                  {d.payments.map((p, i) => (
                    <li
                      key={i}
                      className="flex items-start justify-between gap-3 px-4 py-2 text-sm"
                    >
                      <span className="min-w-0">
                        <span className="block text-gray-900">{p.vendor}</span>
                        <span className="block text-[11px] text-gray-500">
                          {fmtDate(p.date)} · {p.refNo} ·{" "}
                          {METHOD[p.method] || p.method}
                        </span>
                      </span>
                      <span className="tabular-nums font-medium text-green-700 whitespace-nowrap">
                        {formatRs(p.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {tab === "expenses" && (
            <Card
              title="Shop expenses by category"
              subtitle={formatRs(s.expenses)}
              bodyClass="!p-0"
            >
              {d.expensesByCategory.length === 0 ? (
                <EmptyState title="No expenses in this period" />
              ) : (
                <ul className="divide-y divide-gray-100">
                  {d.expensesByCategory.map((x) => (
                    <li
                      key={x.category}
                      className="flex items-center justify-between gap-3 px-4 py-2 text-sm"
                    >
                      <span className="min-w-0">
                        <span className="block text-gray-900">
                          {x.category || "Other"}
                        </span>
                        <span className="block text-[11px] text-gray-500">
                          {x.count} {x.count === 1 ? "expense" : "expenses"} ·{" "}
                          {s.expenses
                            ? Math.round((x.total / s.expenses) * 100)
                            : 0}
                          %
                        </span>
                      </span>
                      <span className="tabular-nums font-medium whitespace-nowrap">
                        {formatRs(x.total)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
