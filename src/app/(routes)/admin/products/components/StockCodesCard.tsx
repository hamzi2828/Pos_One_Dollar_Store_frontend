"use client";
import React, { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Loader2, Printer, Tags } from "lucide-react";
import {
  errorMessage,
  labelService,
  openPrintWindow,
  printHtmlInHiddenFrame,
  showHtmlInWindow,
  type LabelStockCode,
  type StickerSize,
} from "../services/labelService";

// Edit page: every stock of this item has its own sticker code (first stock = the product code).
// Shows which vendor / bill / cost each code came from, with a re-print button.
const SIZE_KEY = "dollarco.receiving.tagSize"; // same size as Receive goods

type Row = LabelStockCode & { variantId: string | null; variantLabel: string };

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
const rs = (n: number) => `Rs ${Number(n || 0).toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;

export default function StockCodesCard({ productId }: { productId: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const lock = useRef(false);

  useEffect(() => {
    let alive = true;
    setRows(null);
    setError(false);
    labelService
      .getLabelData(productId)
      .then((d) => {
        if (!alive) return;
        const list: Row[] = [];
        for (const u of d.units) for (const c of u.stockCodes || []) list.push({ ...c, variantId: u.variantId, variantLabel: u.label });
        list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setRows(list);
      })
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [productId]);

  const reprint = async (r: Row) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(r.code);
    let size: StickerSize = "38x25";
    try {
      size = (window.localStorage.getItem(SIZE_KEY) as StickerSize) || size;
    } catch {
      /* no storage */
    }
    const w = openPrintWindow();
    try {
      const { html } = await labelService.getStickersHtml(
        [{ productId, ...(r.variantId ? { variantId: r.variantId } : {}), type: "barcode", code: r.code, copies: Math.max(1, r.qty || 1) }],
        { size, showPrice: true, autoPrint: true },
      );
      if (w && !w.closed) showHtmlInWindow(w, html);
      else await printHtmlInHiddenFrame(html);
    } catch (e) {
      if (w && !w.closed) w.close();
      toast.error(errorMessage(e, "Could not make the tags."));
    } finally {
      lock.current = false;
      setBusy(null);
    }
  };

  if (rows && rows.length === 0) return null; // nothing received through Receive goods yet

  return (
    <div className="rounded-lg border border-gray-200 p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h4 className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
          <Tags className="h-4 w-4 text-gray-500" />
          Stock codes
        </h4>
        {rows && <span className="text-xs text-gray-500">{rows.length} code{rows.length === 1 ? "" : "s"}</span>}
      </div>

      {error ? (
        <p className="text-xs text-red-600">Could not load the stock codes.</p>
      ) : !rows ? (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                <th className="py-1.5 pr-3 font-medium">Code</th>
                <th className="py-1.5 pr-3 font-medium">Date</th>
                <th className="py-1.5 pr-3 font-medium">Vendor</th>
                <th className="py-1.5 pr-3 font-medium">Bill</th>
                <th className="py-1.5 pr-3 font-medium text-right">Cost</th>
                <th className="py-1.5 pr-3 font-medium text-right">Pieces</th>
                <th className="py-1.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.code} className={`border-b border-gray-100 last:border-0 ${r.undone ? "text-gray-400" : ""}`}>
                  <td className="py-1.5 pr-3 whitespace-nowrap">
                    <span className={`font-mono ${r.undone ? "" : "text-gray-900"}`}>{r.code}</span>
                    {r.plain && <span className="ml-1 text-[11px] text-gray-500">(product code)</span>}
                    {r.variantLabel && <span className="ml-1 text-[11px] text-gray-500">{r.variantLabel}</span>}
                    {r.undone && <span className="ml-1 text-[11px]">entry undone</span>}
                  </td>
                  <td className="py-1.5 pr-3 whitespace-nowrap text-gray-600">{fmtDate(r.createdAt)}</td>
                  <td className="py-1.5 pr-3 text-gray-700">{r.vendorName || "—"}</td>
                  <td className="py-1.5 pr-3 whitespace-nowrap text-gray-600">{r.billNo || "—"}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums whitespace-nowrap" title={r.landedUnitCost ? `With trip costs: ${rs(r.landedUnitCost)}` : undefined}>
                    {rs(r.costPrice)}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{r.qty}</td>
                  <td className="py-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => reprint(r)}
                      disabled={busy !== null}
                      className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      title={`Print tags with code ${r.code}`}
                    >
                      {busy === r.code ? <Loader2 className="h-3 w-3 animate-spin" /> : <Printer className="h-3 w-3" />} Print
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-2 text-[11px] text-gray-400">
        Every new stock of this item gets its own code. All codes sell the same item; stock is one number. Scan a code to
        see which stock (vendor, bill, cost) a piece came from.
      </p>
    </div>
  );
}
