"use client";
import React, { useRef, useState } from "react";
import { Barcode, CircleAlert, Loader2, Pencil, Printer, PackagePlus, X } from "lucide-react";
import { labelService, errorMessage, type CodeLookupResult } from "../../services/labelService";

interface CodeFinderProps {
  onStickers: (productId: string, opts: { variantId?: string | null; batchNo?: string | null }) => void;
  onEdit: (productId: string) => void;
  onReceiveStock?: (productId: string, variantId?: string | null) => void;
}

const KIND_LABEL: Record<string, string> = {
  sku: "SKU",
  shortCode: "Short code",
  barcode: "Barcode",
  batch: "Batch code",
};

/** Type or scan any code (short code, barcode, batch code, SKU) to find its product. */
export default function CodeFinder({ onStickers, onEdit, onReceiveStock }: CodeFinderProps) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<CodeLookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Synchronous lock so Enter + click (or a double click) can't start two lookups
  const busyRef = useRef(false);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busyRef.current) return;
    const c = code.trim();
    if (!c) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    setFound(null);
    try {
      const r = await labelService.lookupCode(c);
      if (!r.product?._id) throw new Error("No product uses this code");
      setFound(r);
    } catch (err) {
      setError(errorMessage(err, "No product uses this code"));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const clear = () => {
    setCode("");
    setFound(null);
    setError(null);
  };

  return (
    <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 p-2 sm:p-3">
      <form onSubmit={search} className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Barcode className="pointer-events-none absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400" />
          <input
            type="text"
            aria-label="Find by code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Find by code (type or scan)"
            className="h-8 sm:h-10 w-full rounded-lg border border-gray-300 bg-white pl-8 sm:pl-10 pr-8 text-xs sm:text-sm placeholder:text-gray-400 focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
          />
          {(code || found || error) && (
            <button
              type="button"
              onClick={clear}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              aria-label="Clear"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={busy || !code.trim()}
          aria-busy={busy}
          className="inline-flex items-center justify-center gap-1.5 h-8 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {busy ? (
            <>
              <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
              Finding…
            </>
          ) : (
            "Find"
          )}
        </button>
      </form>

      {error && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-red-600">
          <CircleAlert className="h-3.5 w-3.5" /> {error}
        </p>
      )}

      {found && (
        <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900 truncate">
              {found.product.name}
              {found.match?.variantLabel && <span className="text-gray-500"> · {found.match.variantLabel}</span>}
            </p>
            <p className="text-xs text-gray-500">
              {KIND_LABEL[found.match?.kind] || "Code"} <span className="font-mono">{found.match?.code}</span>
              {found.match?.batchNo && <> · batch {found.match.batchNo}</>}
              {found.match?.qty > 1 && <> · one scan = {found.match.qty} pieces</>}
              {typeof found.match?.available === "number" && <> · {found.match.available} in stock</>}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() =>
                onStickers(found.product._id, { variantId: found.match?.variantId, batchNo: found.match?.batchNo })
              }
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-honey-500 rounded-lg hover:bg-honey-600"
            >
              <Printer className="h-3.5 w-3.5" /> Stickers
            </button>
            {onReceiveStock && (
              <button
                onClick={() => onReceiveStock(found.product._id, found.match?.variantId)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <PackagePlus className="h-3.5 w-3.5" /> Receive
              </button>
            )}
            <button
              onClick={() => onEdit(found.product._id)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
