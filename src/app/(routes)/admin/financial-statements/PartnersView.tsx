"use client";

// Financial Statements → Partners (owner, 2026-11-17): who owns what.
//   Money put in + share of the profit (by share %) − money taken (Profit Distribution)
//   = each partner's part of the company today.
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Pencil, Check, X, Users, HandCoins, FileText } from "lucide-react";
import toast from "react-hot-toast";
import { storeApi, apiErrorMessage } from "@/lib/storeApi";
import { useAccess } from "@/context/AccessContext";
import { Card, StatCard, ErrorState, LoadingBlock, useReport, formatRs, fmtDate, buildPdf } from "../reports/demand/_shared/reportKit";

interface Draw {
  _id: string;
  title: string;
  amount: number;
  date: string;
  paymentMethod?: string;
  counterName?: string;
}
interface PartnerRow {
  _id: string;
  name: string;
  sharePercent: number;
  capital: number;
  profitShare: number;
  taken: number;
  balance: number;
  profitLeft: number;
  draws: Draw[];
}
interface PartnersData {
  since: string;
  grossProfit?: number;
  grossMargin?: number | null;
  /** Gross profit − totalExpenses − otherCosts = net profit. */
  totalExpenses?: number;
  otherCosts?: number;
  netMargin?: number | null;
  netProfit: number;
  totalShare: number;
  rows: PartnerRow[];
  totals: { capital: number; profitShare: number; taken: number; balance: number; profitLeft: number };
  /** Where the owners' money is today (from the Balance Sheet). */
  worth?: { netWorth: number; totalAssets: number; totalLiabilities: number; stock: number; money: number; other: number } | null;
}

type Line =
  | { section: true; label: string }
  | { section?: false; label: string; strong?: boolean; center?: boolean; cell: (p: PartnerRow) => ReactNode; tone?: (p: PartnerRow) => string; total: ReactNode };

const money = (n: number) => (n < 0 ? `(${formatRs(-n)})` : formatRs(n));

function ShareEdit({ row, onSaved }: { row: PartnerRow; onSaved: (d: PartnersData) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(row.sharePercent));
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const r = await storeApi.put<PartnersData>(`/analytics/financial/partners/${row._id}/share`, { sharePercent: Number(val) });
      onSaved(r.data);
      setEditing(false);
      toast.success("Share saved");
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not save the share"));
    } finally {
      setBusy(false);
    }
  };
  if (!editing)
    return (
      <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 text-honey-700 hover:underline" title="Change share">
        {row.sharePercent}% <Pencil className="h-3 w-3" />
      </button>
    );
  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="number"
        min={0}
        max={100}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="w-16 rounded border border-gray-300 px-1.5 py-0.5 text-right text-sm"
        autoFocus
      />
      %
      <button type="button" onClick={save} disabled={busy} className="rounded p-0.5 text-green-700 hover:bg-green-50" aria-label="Save">
        <Check className="h-4 w-4" />
      </button>
      <button type="button" onClick={() => setEditing(false)} className="rounded p-0.5 text-gray-500 hover:bg-gray-100" aria-label="Cancel">
        <X className="h-4 w-4" />
      </button>
    </span>
  );
}

export default function PartnersView() {
  const { isSuperAdmin, can } = useAccess();
  // "Take profit": Add expense with Profit Distribution + this partner already picked.
  const canTake = can("expenses", "create");
  const takeHref = (id: string) => `/admin/expenses/create?category=${encodeURIComponent("Profit Distribution")}&partner=${id}`;
  const r = useReport<PartnersData>("/analytics/financial/partners", {});
  const d = r.data;

  if (r.error) return <ErrorState message={r.error} onRetry={r.reload} />;
  if (!d) return <LoadingBlock />;

  const td = "px-3 py-2.5 text-right tabular-nums whitespace-nowrap";
  const stockOf = (pct: number) => (d.worth ? (d.worth.stock * pct) / 100 : 0);
  const equityOf = (pct: number) => (d.worth ? (d.worth.netWorth * pct) / 100 : 0);
  // Everything between gross and net profit: expenses + damage / stock count / depreciation.
  const costs = d.grossProfit !== undefined ? d.grossProfit - d.netProfit : null;
  const other = d.otherCosts ?? 0;
  // Per partner (by share %): gross profit − profit expense = net profit.
  const grossOf = (pct: number) => (d.grossProfit !== undefined ? (d.grossProfit * pct) / 100 : null);
  const costOf = (pct: number) => (costs !== null ? (costs * pct) / 100 : null);
  const cell = (n: number | null) => (n === null ? "—" : money(n));
  const negCost = (pct: number) => {
    const c = costOf(pct);
    return c === null ? "—" : money(-c);
  };
  const signTone = (n: number, pos = "text-gray-900") => (n >= 0 ? pos : "text-red-700");

  // Vertical table: one column per partner (+ Total), one row per figure.
  const lines: Line[] = [
    { section: true, label: "Ownership" },
    {
      label: "Share",
      center: true,
      cell: (p) => (isSuperAdmin ? <ShareEdit row={p} onSaved={(nd) => r.setData(nd)} /> : `${p.sharePercent}%`),
      total: `${d.totalShare}%`,
    },
    { label: "In stock", cell: (p) => (d.worth ? formatRs(stockOf(p.sharePercent)) : "—"), total: d.worth ? formatRs(stockOf(d.totalShare)) : "—" },
    {
      label: "In equity",
      strong: true,
      cell: (p) => (d.worth ? money(equityOf(p.sharePercent)) : "—"),
      total: d.worth ? money(equityOf(d.totalShare)) : "—",
    },
    { section: true, label: "Profit" },
    { label: "Gross profit", cell: (p) => cell(grossOf(p.sharePercent)), total: cell(grossOf(d.totalShare)) },
    { label: "Profit expense", cell: (p) => negCost(p.sharePercent), tone: () => "text-red-700", total: negCost(d.totalShare) },
    {
      label: "Net profit",
      strong: true,
      cell: (p) => money(p.profitShare),
      tone: (p) => signTone(p.profitShare, "text-green-700"),
      total: money(d.totals.profitShare),
    },
    { label: "Taken", cell: (p) => (p.taken ? `(${formatRs(p.taken)})` : "—"), tone: () => "text-red-700", total: d.totals.taken ? `(${formatRs(d.totals.taken)})` : "—" },
    { label: "Left", strong: true, cell: (p) => money(p.profitLeft), tone: (p) => signTone(p.profitLeft), total: money(d.totals.profitLeft) },
  ];

  const exportPdf = () => {
    const rs = (n: number) => (n < 0 ? `(Rs ${Math.round(-n).toLocaleString("en-PK")})` : `Rs ${Math.round(n).toLocaleString("en-PK")}`);
    const rsOr = (n: number | null) => (n === null ? "—" : rs(n));
    const summary: [string, string][] = [];
    if (d.grossProfit !== undefined) summary.push(["Gross profit", rs(d.grossProfit)]);
    if (costs !== null) summary.push(["Expenses", rs(-costs)]);
    summary.push(["Net profit", rs(d.netProfit)], ["Taken by partners", rs(d.totals.taken)], ["Profit still in the company", rs(d.totals.profitLeft)]);
    if (d.worth)
      summary.push(
        ["Equity (net worth)", rs(d.worth.netWorth)],
        ["In goods / stock", rs(d.worth.stock)],
        ["In cash + bank + JazzCash", rs(d.worth.money)],
        ["Owed by the shop", rs(d.worth.totalLiabilities)]
      );
    buildPdf({
      title: "Partners",
      subtitle: `Since ${fmtDate(d.since)} · printed ${fmtDate(new Date().toISOString())}`,
      summary,
      tables: [
        {
          title: "Who owns what",
          head: ["Partner", "Share", "In stock", "In equity", "Gross profit", "Profit expense", "Net profit", "Taken", "Left"],
          widths: [44, 14, 30, 30, 30, 30, 30, 26, 26],
          rows: [
            ...d.rows.map((p) => [
              p.name,
              `${p.sharePercent}%`,
              rs(stockOf(p.sharePercent)),
              rs(equityOf(p.sharePercent)),
              rsOr(grossOf(p.sharePercent)),
              rsOr(costOf(p.sharePercent) === null ? null : -(costOf(p.sharePercent) as number)),
              rs(p.profitShare),
              rs(-p.taken),
              rs(p.profitLeft),
            ]),
            [
              "Total",
              `${d.totalShare}%`,
              rs(stockOf(d.totalShare)),
              rs(equityOf(d.totalShare)),
              rsOr(grossOf(d.totalShare)),
              rsOr(costOf(d.totalShare) === null ? null : -(costOf(d.totalShare) as number)),
              rs(d.totals.profitShare),
              rs(-d.totals.taken),
              rs(d.totals.profitLeft),
            ],
          ],
        },
        ...d.rows
          .filter((p) => p.draws.length)
          .map((p) => ({
            title: `Taken by ${p.name}`,
            head: ["Date", "What", "Amount"],
            widths: [30, 120, 30],
            rows: p.draws.map((x) => [fmtDate(x.date), x.title, rs(x.amount)]),
          })),
      ],
      fileName: `partners-${new Date().toISOString().slice(0, 10)}`,
      landscape: true,
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 sm:gap-3">
        {d.grossProfit !== undefined && (
          <StatCard
            label="Gross profit"
            value={money(d.grossProfit)}
            hint={`Sales − cost of goods${d.grossMargin != null ? ` · ${d.grossMargin}%` : ""}`}
            tone="info"
          />
        )}
        {costs !== null && (
          <StatCard
            label="Expenses"
            value={money(-costs)}
            hint={
              other
                ? `Expenses ${formatRs(d.totalExpenses ?? costs - other)} + damage / stock / depreciation ${formatRs(other)}`
                : "Gross profit − expenses = net profit"
            }
            tone="bad"
          />
        )}
        <StatCard
          label={`Net profit since ${fmtDate(d.since)}`}
          value={money(d.netProfit)}
          hint={`After all expenses${d.netMargin != null ? ` · ${d.netMargin}%` : ""}`}
          tone={d.netProfit >= 0 ? "good" : "bad"}
        />
        <StatCard label="Taken by partners" value={formatRs(d.totals.taken)} tone="warn" />
        <StatCard label="Profit still in the company" value={money(d.totals.profitLeft)} hint="Not taken yet (kept in the shop)" tone="info" />
        {d.worth && <StatCard label="Goods / stock (at cost)" value={formatRs(d.worth.stock)} hint="Split by share % below" />}
      </div>

      {d.worth && (
        <Card title="Equity (net worth) — where it is">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 p-3 sm:p-4 max-w-4xl mx-auto">
            <StatCard label="Equity (net worth)" value={money(d.worth.netWorth)} hint="Really yours: everything owned − owed to vendors, loans…" tone={d.worth.netWorth >= 0 ? "good" : "bad"} />
            <StatCard label="In goods / stock" value={formatRs(d.worth.stock)} />
            <StatCard label="In cash + bank + JazzCash" value={money(d.worth.money)} />
            <StatCard label="Owed by the shop" value={formatRs(d.worth.totalLiabilities)} hint="Vendors, loans, salaries…" tone="bad" />
          </div>
        </Card>
      )}

      {d.totalShare !== 100 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          The shares add up to {d.totalShare}%, not 100%. {isSuperAdmin ? "Click a share % to change it." : "Ask the super admin to fix the shares."}
        </div>
      )}

      <Card
        title="Who owns what"
        subtitle="In equity = net worth (after vendors, loans… are paid) × share % · Gross profit − profit expense = net profit · Left = net profit − taken"
        actions={
          <button
            type="button"
            onClick={exportPdf}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            <FileText className="h-4 w-4" /> PDF
          </button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-gray-500">Partner</th>
                {d.rows.map((p) => (
                  <th key={p._id} className="px-3 py-2.5 text-right font-semibold text-gray-900 capitalize">
                    {p.name}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-right font-semibold text-gray-900 bg-honey-50">Total</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) =>
                l.section ? (
                  <tr key={l.label} className="bg-gray-50 border-t border-gray-200">
                    <td colSpan={d.rows.length + 2} className="px-3 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      {l.label}
                    </td>
                  </tr>
                ) : (
                  <tr key={l.label} className="border-t border-gray-100">
                    <td className={`px-3 py-2.5 whitespace-nowrap ${l.strong ? "font-semibold text-gray-900" : "text-gray-600"}`}>{l.label}</td>
                    {d.rows.map((p) => (
                      <td key={p._id} className={`${td} ${l.center ? "!text-center" : ""} ${l.strong ? "font-semibold" : ""} ${l.tone ? l.tone(p) : "text-gray-900"}`}>
                        {l.cell(p)}
                      </td>
                    ))}
                    <td className={`${td} ${l.center ? "!text-center" : ""} bg-honey-50 font-semibold text-gray-900`}>{l.total}</td>
                  </tr>
                )
              )}
              {canTake && (
                <tr className="border-t border-gray-200">
                  <td />
                  {d.rows.map((p) => (
                    <td key={p._id} className="px-3 py-2.5 text-right">
                      <Link
                        href={takeHref(p._id)}
                        className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg bg-honey-500 px-2.5 py-1.5 text-xs font-semibold text-gray-900 hover:bg-honey-600"
                      >
                        <HandCoins className="h-3.5 w-3.5" /> Take profit
                      </Link>
                    </td>
                  ))}
                  <td className="bg-honey-50" />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Money taken by partners" subtitle="Add it from Expenses → category “Profit Distribution” and pick the partner">
        <div className="max-w-4xl mx-auto p-3 sm:p-4 space-y-3">
          {d.rows.every((p) => !p.draws.length) && <p className="text-sm text-gray-500">Nothing taken yet.</p>}
          {d.rows
            .filter((p) => p.draws.length)
            .map((p) => (
              <div key={p._id}>
                <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-gray-800 capitalize">
                  <Users className="h-4 w-4 text-honey-700" /> {p.name} · {formatRs(p.taken)}
                </p>
                <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                  {p.draws.map((x) => (
                    <li key={x._id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <span className="min-w-0 truncate text-gray-700">
                        {fmtDate(x.date)} · {x.title}
                        {x.counterName ? ` · ${x.counterName}` : ""}
                      </span>
                      <span className="font-semibold text-red-700 whitespace-nowrap">{formatRs(x.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
      </Card>

      <p className="text-center text-[11px] text-gray-400">
        Profit = net profit from the Income Statement since {fmtDate(d.since)}, split by share %. Money put in = investment bills each partner paid.
      </p>
    </div>
  );
}
