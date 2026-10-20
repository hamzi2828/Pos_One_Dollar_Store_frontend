"use client";
import React, { useEffect, useState } from "react";
import { Info, Layers, LayoutGrid, Package, Plus, Trash2 } from "lucide-react";
import {
  type PackagingState,
  type SoldAs,
  batchStockOf,
  boxStockOf,
  emptyBatchRow,
  physicalPerBoxOf,
  piecesPerBoxOf,
  piecesPerSaleOf,
} from "./packagingUtils";

interface PackagingStockCardProps {
  value: PackagingState;
  onChange: (next: PackagingState) => void;
  mode: "create" | "edit";
  productId?: string;
  errors?: Record<string, string>;
  currencySymbol: string;
  // Product cost price: default cost for a new batch row
  defaultCostPrice?: number;
  // Stock currently saved (edit): kept as "Opening stock" when batches are turned on
  savedStock?: number;
  // Box items: prices are typed here, per piece (the top price fields are locked)
  salePrice?: number;
  costPrice?: number;
  onPricesChange?: (prices: { salePrice?: number; costPrice?: number }) => void;
  priceErrors?: { salePrice?: string; costPrice?: string };
  /** Receiving goods: no stock counts here (pieces come with the delivery entry). */
  hideStock?: boolean;
}

const inputClass = (hasError?: boolean) =>
  `block w-full rounded-lg border px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors ${
    hasError ? "border-red-300" : "border-gray-300"
  }`;

const cellInputClass =
  "block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:ring-1 focus:ring-gray-900";

export default function PackagingStockCard({
  value,
  onChange,
  mode,
  productId,
  errors = {},
  currencySymbol,
  defaultCostPrice,
  savedStock = 0,
  salePrice,
  costPrice,
  onPricesChange,
  priceErrors = {},
  hideStock = false,
}: PackagingStockCardProps) {
  const toNum = (v: string) => (v === "" ? undefined : Number(v));
  const round2 = (n: number) => Math.round(n * 100) / 100;
  // Full box/pack price being typed (kept as typed; the price per sale follows it).
  const [boxSaleText, setBoxSaleText] = useState<string | null>(null);
  const [boxCostText, setBoxCostText] = useState<string | null>(null);
  // Whole box/pack prices the user typed. They stay as typed; when the box/pack
  // size or pieces per sale change, the price per sale is worked out again from them.
  const [boxCost, setBoxCost] = useState<number | null>(null);
  const [boxSale, setBoxSale] = useState<number | null>(null);

  const set = (patch: Partial<PackagingState>) => onChange({ ...value, ...patch });
  const isBox = value.soldAs === "box";
  const hasSavedBatches = value.batches.some((b) => !!b.saved);
  const pps = piecesPerSaleOf(value); // pieces in one sale
  const ppb = piecesPerBoxOf(value); // sales in one box/pack
  const physical = physicalPerBoxOf(value); // pieces in one box/pack
  const unit = pps > 1 ? "sale" : "piece";
  useEffect(() => {
    if (!onPricesChange || ppb < 2 || (boxCost === null && boxSale === null)) return;
    onPricesChange({
      costPrice: boxCost !== null ? round2(boxCost / ppb) : costPrice,
      salePrice: boxSale !== null ? round2(boxSale / ppb) : salePrice,
    });
    // Only when the number of sales in one box/pack changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ppb]);
  const units = (n: number) => (pps > 1 ? `${n} sale${n === 1 ? "" : "s"} of ${pps}` : `${n} piece${n === 1 ? "" : "s"}`);

  const setSoldAs = (soldAs: SoldAs) => {
    if (soldAs === value.soldAs) return;
    set({ soldAs, addFullBoxBarcode: soldAs === "box" ? value.addFullBoxBarcode : false });
  };

  const toggleBatches = () => {
    if (value.trackBatches) {
      if (hasSavedBatches) return; // saved batches cannot be switched off here
      set({ trackBatches: false, batches: [] });
    } else {
      set({ trackBatches: true, batches: value.batches.length ? value.batches : [emptyBatchRow(defaultCostPrice)] });
    }
  };

  const updateBatch = (key: string, patch: Partial<PackagingState["batches"][number]>) =>
    set({ batches: value.batches.map((b) => (b.key === key ? { ...b, ...patch } : b)) });

  const removeBatch = (key: string) => {
    const row = value.batches.find((b) => b.key === key);
    if (row?.saved) {
      const label = row.saved.batchNo ? `batch ${row.saved.batchNo}` : "this batch";
      if (!window.confirm(`Remove ${label}? Its ${row.quantity || 0} pieces will be removed from stock.`)) return;
    }
    set({ batches: value.batches.filter((b) => b.key !== key) });
  };

  const batchTotal = batchStockOf(value);
  const boxTotal = boxStockOf(value);

  return (
    <div
      className="border-t border-gray-200 pt-3 sm:pt-4 md:pt-6"
      // A barcode scanner presses Enter after the code: never submit the form from here.
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") e.preventDefault();
      }}
    >
      <h4 className="text-xs sm:text-sm font-medium text-gray-900 mb-1">Packaging &amp; Stock</h4>
      <p className="text-xs text-gray-500 mb-3 sm:mb-4">Stock is counted in sales: one scan at the counter sells one.</p>

      {/* How is it sold? */}
      <label className="block text-sm font-medium text-gray-700 mb-2">How is it sold?</label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {([
          { key: "loose", title: "Loose pieces", desc: "Sold one by one (pens, cables, covers)", icon: LayoutGrid },
          { key: "box", title: "Box/pack", desc: "Comes in boxes/packs, sold by piece or full box/pack", icon: Package },
        ] as const).map((opt) => {
          const active = value.soldAs === opt.key;
          const Icon = opt.icon;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => setSoldAs(opt.key)}
              className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                active ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${active ? "bg-honey-50 text-honey-700" : "bg-gray-100 text-gray-400"}`}>
                <Icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-medium text-gray-900">{opt.title}</span>
                <span className="block text-xs text-gray-500">{opt.desc}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Pieces per sale */}
      <div className="mt-3 sm:mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[12rem_1fr] sm:items-center">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Pieces per sale</label>
          <input
            type="number"
            min="1"
            step="1"
            placeholder="1"
            className={inputClass(!!errors.piecesPerSale)}
            value={value.piecesPerSale}
            onChange={(e) => set({ piecesPerSale: e.target.value })}
          />
        </div>
        <p className="text-xs text-gray-500">
          {pps > 1
            ? `Sold ${pps} together: one scan sells ${pps} pieces for one sale price.`
            : "1 = sold one by one. 2 = two sold together (e.g. 2 plates for Rs 300)."}
        </p>
      </div>

      {/* Box/pack fields */}
      {isBox && (
        <div className="mt-3 sm:mt-4 rounded-lg border border-gray-200 bg-gray-50/60 p-3 sm:p-4">
          <div className={`grid grid-cols-1 gap-3 sm:gap-4 ${value.trackBatches || hideStock ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-4"}`}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pieces in one box/pack <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="2"
                step="1"
                placeholder="e.g., 12"
                className={inputClass(!!errors.piecesPerBox)}
                value={value.piecesPerBox}
                onChange={(e) => set({ piecesPerBox: e.target.value })}
              />
              {errors.piecesPerBox ? (
                <p className="mt-1 text-xs text-red-600">{errors.piecesPerBox}</p>
              ) : (
                pps > 1 && physical > 1 && <p className="mt-1 text-xs text-gray-500">= {units(ppb)}</p>
              )}
            </div>
            {!value.trackBatches && !hideStock && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Boxes/packs in stock</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    className={inputClass(!!errors.boxes)}
                    value={value.boxes}
                    onChange={(e) => set({ boxes: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{pps > 1 ? `Loose sales (${pps} pieces each)` : "Loose pieces"}</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    className={inputClass(!!errors.boxes)}
                    value={value.loosePieces}
                    onChange={(e) => set({ loosePieces: e.target.value })}
                  />
                  <p className="mt-1 text-xs text-gray-500">From an open box/pack</p>
                </div>
              </>
            )}
            {!hideStock && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total stock</label>
              <div className="flex h-[38px] items-center rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900">
                {units(value.trackBatches ? batchTotal : boxTotal)}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {value.trackBatches ? "From the batches below" : `${Number(value.boxes) || 0} × ${ppb} + ${Number(value.loosePieces) || 0}`}
              </p>
            </div>
            )}
          </div>
          {errors.boxes && <p className="mt-2 text-xs text-red-600">{errors.boxes}</p>}

          {/* Prices: cost first, then sale; per sale or for one full box/pack (split over its sales) */}
          {onPricesChange && (
            <div className="mt-3 sm:mt-4 grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {pps > 1 ? `Cost price per sale (${pps} pieces)` : "Cost price per piece"} ({currencySymbol}) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className={inputClass(!!priceErrors.costPrice)}
                  value={costPrice ?? ""}
                  onChange={(e) => {
                    setBoxCost(null);
                    onPricesChange({ salePrice, costPrice: toNum(e.target.value) });
                  }}
                />
                {priceErrors.costPrice && <p className="mt-1 text-xs text-red-600">{priceErrors.costPrice}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">One full box/pack: cost price ({currencySymbol})</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={ppb > 1 ? "What the whole box/pack cost" : "Enter pieces in one box/pack first"}
                  disabled={ppb < 2}
                  className={`${inputClass(false)} disabled:bg-gray-50 disabled:text-gray-400`}
                  value={boxCostText ?? (ppb > 1 ? (boxCost !== null ? String(boxCost) : costPrice ? String(round2(costPrice * ppb)) : "") : "")}
                  onFocus={(e) => setBoxCostText(e.target.value)}
                  onBlur={() => setBoxCostText(null)}
                  onChange={(e) => {
                    setBoxCostText(e.target.value);
                    const box = toNum(e.target.value);
                    setBoxCost(box === undefined ? null : box);
                    if (ppb > 1) onPricesChange({ salePrice, costPrice: box === undefined ? undefined : round2(box / ppb) });
                  }}
                />
                <p className="mt-1 text-xs text-gray-500">
                  {ppb > 1 ? `Split over ${units(ppb)}${costPrice ? ` = ${currencySymbol}${costPrice.toLocaleString()} per ${unit}${pps > 1 ? ` (${currencySymbol}${round2(boxCost !== null && physical > 0 ? boxCost / physical : costPrice / pps).toLocaleString()} per piece)` : ""}` : ""}` : "Type it here or the cost per piece"}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {pps > 1 ? `One sale price (${pps} pieces)` : "Sale price per piece"} ({currencySymbol}) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className={inputClass(!!priceErrors.salePrice)}
                  value={salePrice ?? ""}
                  onChange={(e) => {
                    setBoxSale(null);
                    onPricesChange({ salePrice: toNum(e.target.value), costPrice });
                  }}
                />
                {priceErrors.salePrice && <p className="mt-1 text-xs text-red-600">{priceErrors.salePrice}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">One full box/pack: sale price ({currencySymbol})</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={ppb > 1 ? "Price of the whole box/pack" : "Enter pieces in one box/pack first"}
                  disabled={ppb < 2}
                  className={`${inputClass(false)} disabled:bg-gray-50 disabled:text-gray-400`}
                  value={boxSaleText ?? (ppb > 1 ? (boxSale !== null ? String(boxSale) : salePrice ? String(round2(salePrice * ppb)) : "") : "")}
                  onFocus={(e) => setBoxSaleText(e.target.value)}
                  onBlur={() => setBoxSaleText(null)}
                  onChange={(e) => {
                    setBoxSaleText(e.target.value);
                    const box = toNum(e.target.value);
                    setBoxSale(box === undefined ? null : box);
                    if (ppb > 1) onPricesChange({ salePrice: box === undefined ? undefined : round2(box / ppb), costPrice });
                  }}
                />
                <p className="mt-1 text-xs text-gray-500">
                  {ppb > 1 ? `Split over ${units(ppb)}${salePrice ? ` = ${currencySymbol}${salePrice.toLocaleString()} per ${unit}${pps > 1 ? ` (${currencySymbol}${round2(boxSale !== null && physical > 0 ? boxSale / physical : salePrice / pps).toLocaleString()} per piece)` : ""}` : ""}` : "Type it here or the price per piece"}
                </p>
              </div>
            </div>
          )}

          <label className="mt-3 sm:mt-4 flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-honey-700 focus:ring-honey-500"
              checked={value.addFullBoxBarcode}
              onChange={(e) => set({ addFullBoxBarcode: e.target.checked })}
            />
            <span>
              <span className="block text-sm font-medium text-gray-800">One tag for the whole box/pack</span>
              <span className="block text-xs text-gray-500">
                Stick it on the box/pack: one scan sells all {physical > 1 ? `${physical} pieces` : "the pieces"} at once
                {value.shortCode ? ` (code ${value.shortCode}-BOX)` : ""}. Print it from Stickers after saving.
              </span>
            </span>
          </label>
        </div>
      )}

    </div>
  );
}
