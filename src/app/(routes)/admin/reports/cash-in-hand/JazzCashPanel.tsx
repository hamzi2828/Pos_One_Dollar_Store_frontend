"use client";

// Cash in Hand → JazzCash: the JazzCash wallet for the chosen period. Every movement
// recorded as JazzCash (sales / split parts / instalments in; expenses, refunds, part refunds,
// vendor payments and trip costs out) with a running balance. GET /analytics/jazzcash.
import { Card, EmptyState, ErrorState, LoadingBlock, StatCard, formatRs, useReport } from "../demand/_shared/reportKit";

interface JazzRow {
  date: string;
  kind: "sale" | "split_part" | "refund" | "part_refund" | "expense" | "vendor_payment" | "trip_cost";
  ref: string;
  label: string;
  in: number;
  out: number;
  balance: number;
}
interface JazzData {
  from: string;
  to: string;
  totals: { in: number; out: number; net: number; bills: number };
  rows: JazzRow[];
}

const when = (d: string) =>
  new Date(d).toLocaleString("en-PK", { timeZone: "Asia/Karachi", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export default function JazzCashPanel({ from, to }: { from: string; to: string }) {
  const r = useReport<JazzData>("/analytics/jazzcash", { from, to });
  if (r.error) return <ErrorState message={r.error} onRetry={r.reload} />;
  if (!r.data) return <LoadingBlock />;
  const { totals, rows } = r.data;
  const shown = [...rows].reverse(); // newest first

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <StatCard label="Received by JazzCash" value={formatRs(totals.in)} hint={`${totals.bills} bill${totals.bills === 1 ? "" : "s"}`} tone="good" />
        <StatCard label="Paid out by JazzCash" value={formatRs(totals.out)} hint="expenses, refunds, vendors, trip costs" tone={totals.out > 0 ? "bad" : "default"} />
        <StatCard label="Net in the wallet" value={formatRs(totals.net)} hint="received − paid out" tone={totals.net >= 0 ? "info" : "bad"} />
        <StatCard label="Movements" value={String(rows.length)} />
      </div>

      <Card title="JazzCash movements" subtitle="Newest first · balance = running total over this period" bodyClass="!p-0">
        {shown.length === 0 ? (
          <EmptyState title="No JazzCash money in this period" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">When</th>
                  <th className="px-2 py-2 text-left font-medium">What</th>
                  <th className="px-2 py-2 text-right font-medium">In</th>
                  <th className="px-2 py-2 text-right font-medium">Out</th>
                  <th className="px-4 py-2 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 tabular-nums">
                {shown.map((x, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2 whitespace-nowrap text-gray-600">{when(x.date)}</td>
                    <td className="px-2 py-2 min-w-[12rem]">
                      <span className="block text-gray-900">{x.label}</span>
                      {x.ref && <span className="block text-[11px] text-gray-500">{x.ref}</span>}
                    </td>
                    <td className="px-2 py-2 text-right text-emerald-700 whitespace-nowrap">{x.in > 0 ? formatRs(x.in) : ""}</td>
                    <td className="px-2 py-2 text-right text-red-700 whitespace-nowrap">{x.out > 0 ? formatRs(x.out) : ""}</td>
                    <td className="px-4 py-2 text-right font-medium text-gray-900 whitespace-nowrap">{formatRs(x.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
