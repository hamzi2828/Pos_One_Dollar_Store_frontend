"use client";
import React, { useEffect, useState } from "react";
import { Loader2, ScanBarcode } from "lucide-react";
import { productService, type SoldByBarcodeRow } from "../services/productService";

// Edit page, single products: how many pieces were sold through each barcode.
export default function SoldByBarcodeCard({ productId }: { productId: string }) {
  const [rows, setRows] = useState<SoldByBarcodeRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    setRows(null);
    setError(false);
    productService
      .getSoldByBarcode(productId)
      .then((r) => {
        if (!alive) return;
        setRows(r.data);
        setTotal(r.meta.totalQty);
      })
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [productId]);

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

  return (
    <div className="rounded-lg border border-gray-200 p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h4 className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
          <ScanBarcode className="h-4 w-4 text-gray-500" />
          Sold by barcode
        </h4>
        {rows && <span className="text-xs text-gray-500">{total} pcs in total</span>}
      </div>

      {error ? (
        <p className="text-xs text-red-600">Could not load sales by barcode.</p>
      ) : !rows ? (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                <th className="py-1.5 pr-3 font-medium">Barcode</th>
                <th className="py-1.5 pr-3 font-medium text-right">Sold (qty)</th>
                <th className="py-1.5 pr-3 font-medium text-right">Sales</th>
                <th className="py-1.5 font-medium text-right">Last sold</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.code || "__none"} className="border-b border-gray-100 last:border-0">
                  <td className="py-1.5 pr-3">
                    {r.code ? (
                      <span className="font-mono text-gray-900">{r.code}</span>
                    ) : (
                      <span className="text-gray-500">No barcode (searched)</span>
                    )}
                  </td>
                  <td className={`py-1.5 pr-3 text-right tabular-nums ${r.qty ? "text-gray-900 font-medium" : "text-gray-400"}`}>{r.qty}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-gray-600">{r.sales}</td>
                  <td className="py-1.5 text-right text-gray-600 whitespace-nowrap">{fmtDate(r.lastSoldAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-2 text-[11px] text-gray-400">
        Refunded and cancelled sales are not counted. Sales made before this report was added did not record the barcode, so
        they show under &quot;No barcode&quot;.
      </p>
    </div>
  );
}
