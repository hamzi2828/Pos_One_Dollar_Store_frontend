"use client";
import React from "react";
import { Hash, Layers } from "lucide-react";
import { type VariantCodeFields } from "./packagingUtils";

interface VariantCodesRowProps {
  variant: VariantCodeFields;
  onChange: (patch: Partial<VariantCodeFields>) => void;
  colSpan: number;
  productId?: string;
  // Codes of the other variants in this form (a code can be on one variant only)
  otherCodesInForm?: string[];
  error?: string;
}

const optionInputClass =
  "block w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:ring-1 focus:ring-gray-900";

/**
 * Extra row under a variant in the "Variant Pricing & Stock" table:
 * free options (Storage / RAM / Other, sent as `attributes`), extra barcodes, short code.
 */
export default function VariantCodesRow({ variant, onChange, colSpan, error }: VariantCodesRowProps) {
  const attrs = variant.attributes || {};
  const batchCount = (variant.batches || []).length;

  const setAttr = (key: string, val: string) => onChange({ attributes: { ...attrs, [key]: val } });

  return (
    <tr className="bg-gray-50/60">
      <td colSpan={colSpan} className="px-3 pb-3 pt-1">
        {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
        <div
          className="grid grid-cols-1 md:grid-cols-12 gap-3 rounded-lg border border-gray-200 bg-white p-3"
          // A barcode scanner presses Enter after the code: never submit the form from here.
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") e.preventDefault();
          }}
        >
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Storage</label>
            <input
              type="text"
              placeholder="e.g., 128GB"
              className={optionInputClass}
              value={attrs.Storage || ""}
              onChange={(e) => setAttr("Storage", e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">RAM</label>
            <input
              type="text"
              placeholder="e.g., 8GB"
              className={optionInputClass}
              value={attrs.RAM || ""}
              onChange={(e) => setAttr("RAM", e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Other option</label>
            <input
              type="text"
              placeholder="e.g., PTA approved"
              className={optionInputClass}
              value={attrs.Option || ""}
              onChange={(e) => setAttr("Option", e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Short code</label>
            {variant.shortCode ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-honey-200 bg-honey-50 px-2 py-1 text-xs font-mono font-semibold text-honey-700">
                <Hash className="h-3 w-3" />
                {variant.shortCode}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-500">Auto on save</span>
            )}
            {batchCount > 0 && (
              <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                <Layers className="h-3 w-3" />
                {batchCount} batch{batchCount > 1 ? "es" : ""}
              </p>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}
