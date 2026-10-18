"use client";
import React, { useRef, useState } from "react";
import { Barcode, Loader2, X } from "lucide-react";
import { productService } from "../../services/productService";
import { normalizeCode } from "./packagingUtils";

interface BarcodeChipsInputProps {
  codes: string[];
  onAdd: (code: string) => void;
  onRemove: (code: string) => void;
  // Product being edited (its own codes are not "used by another product")
  excludeId?: string;
  // Codes already used elsewhere in this form (short code, other variants...)
  otherCodesInForm?: string[];
  placeholder?: string;
  error?: string;
  compact?: boolean;
}

/**
 * Type or scan a barcode and press Enter to add it as a chip.
 * A barcode scanner types the code and presses Enter, so Enter never submits the form here.
 * Each new code is checked with GET /products/codes/check before it is added.
 */
export default function BarcodeChipsInput({
  codes,
  onAdd,
  onRemove,
  excludeId,
  otherCodesInForm = [],
  placeholder = "Scan or type a barcode, then press Enter",
  error,
  compact = false,
}: BarcodeChipsInputProps) {
  const [text, setText] = useState("");
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");
  // Synchronous lock: a scanner's Enter followed by blur must not check/add the same code twice
  const checkingRef = useRef(false);

  const tryAdd = async () => {
    if (checkingRef.current) return;
    const code = normalizeCode(text);
    if (!code) return;
    if (codes.map(normalizeCode).includes(code)) {
      setMessage(`"${code}" is already in the list`);
      setText("");
      return;
    }
    if (otherCodesInForm.map(normalizeCode).includes(code)) {
      setMessage(`"${code}" is already used in this product`);
      return;
    }
    checkingRef.current = true;
    setChecking(true);
    try {
      const res = await productService.checkCode(code, excludeId);
      if (!res.available) {
        setMessage(`"${code}" is already used by ${res.usedBy?.name ? `"${res.usedBy.name}"` : "another product"}`);
        return;
      }
    } catch {
      // Check failed (offline / no permission): add it, the save will check again.
    } finally {
      checkingRef.current = false;
      setChecking(false);
    }
    onAdd(code);
    setText("");
    setMessage("");
  };

  const shownError = error || message;

  return (
    <div>
      <div
        className={`flex flex-wrap items-center gap-1.5 w-full rounded-lg border bg-white px-2 ${compact ? "py-1" : "py-1.5"} transition-colors focus-within:border-gray-900 focus-within:ring-1 focus-within:ring-gray-900 ${
          shownError ? "border-red-300" : "border-gray-300"
        }`}
      >
        {codes.map((code) => (
          <span
            key={code}
            className="inline-flex items-center gap-1 rounded-md bg-gray-100 border border-gray-200 px-2 py-0.5 text-xs font-mono text-gray-800"
          >
            <Barcode className="h-3 w-3 text-gray-500" />
            {code}
            <button
              type="button"
              onClick={() => onRemove(code)}
              className="ml-0.5 rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
              aria-label={`Remove ${code}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={text}
          placeholder={codes.length ? "Add another..." : placeholder}
          onChange={(e) => {
            setText(e.target.value);
            if (message) setMessage("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              void tryAdd();
            } else if (e.key === "Backspace" && !text && codes.length) {
              onRemove(codes[codes.length - 1]);
            }
          }}
          onBlur={() => {
            if (text.trim()) void tryAdd();
          }}
          aria-busy={checking}
          className={`flex-1 min-w-[140px] border-0 bg-transparent px-1 ${compact ? "py-0.5" : "py-1"} text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-0`}
        />
        {checking && (
          <span className="inline-flex items-center gap-1 text-xs text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking…
          </span>
        )}
      </div>
      {shownError && <p className="mt-1 text-xs text-red-600">{shownError}</p>}
    </div>
  );
}
