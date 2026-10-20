// Packaging / barcode helpers for the product form.
// Backend rules: pos_backend/docs/BARCODES_BOXES_BATCHES.md
//   - stock is counted in SALES (one sale = piecesPerSale pieces; usually 1)
//   - box:     stock = boxes * piecesPerBox + loosePieces (piecesPerBox saved = sales in one box/pack)
//   - the form types "pieces in one box/pack" (physical) and divides by piecesPerSale
//   - batches: stock = sum of batch quantities (oldest / expiring sells first)
//   - full-box code "<shortCode>-BOX" lives in `barcodes` with label "full-box"

import type { ProductBarcodeDTO, ProductBatchDTO } from "../../services/productService";

export type SoldAs = "loose" | "box";

export interface BatchRow {
  key: string; // React key only, never sent
  quantity: string;
  costPrice: string;
  expiryDate: string; // YYYY-MM-DD or ""
  note: string;
  // Saved batch (edit mode): everything the backend sent, sent back unchanged
  // except the fields above, so batchNo / barcode / receivedAt stay.
  saved?: ProductBatchDTO;
}

export interface PackagingState {
  soldAs: SoldAs;
  /** Physical pieces in one box/pack (as typed). */
  piecesPerBox: string;
  /** Pieces handed over in one sale (e.g. 2 plates for Rs 300). "" / 1 = one by one. */
  piecesPerSale: string;
  boxes: string;
  loosePieces: string;
  addFullBoxBarcode: boolean;
  trackBatches: boolean;
  batches: BatchRow[];
  // Extra barcodes typed / scanned by the user (not the full-box code)
  barcodes: ProductBarcodeDTO[];
  // Full-box code already saved on the product (kept while "full-box" is ticked)
  savedFullBoxBarcodes: ProductBarcodeDTO[];
  shortCode: string;
}

// Code fields the backend returns on a product (single products)
export interface ProductCodeFields {
  shortCode?: string;
  barcodes?: ProductBarcodeDTO[];
  batches?: ProductBatchDTO[];
  piecesPerBox?: number;
  piecesPerSale?: number;
  stock?: number;
  productType?: "single" | "variant";
}

// Code fields on a variant
export interface VariantCodeFields {
  variantId?: string;
  attributes?: Record<string, string>;
  shortCode?: string;
  barcodes?: ProductBarcodeDTO[];
  batches?: ProductBatchDTO[];
  totalStock?: number;
}

export const normalizeCode = (value: string | undefined | null) => String(value ?? "").trim().toUpperCase();

let rowCounter = 0;
export const newRowKey = () => `row-${Date.now()}-${rowCounter++}`;

export const isFullBoxBarcode = (b: ProductBarcodeDTO, shortCode?: string) =>
  b.label === "full-box" || (!!shortCode && normalizeCode(b.code) === `${normalizeCode(shortCode)}-BOX`);

const toInt = (value: string | number | undefined) => {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export const emptyBatchRow = (costPrice?: number): BatchRow => ({
  key: newRowKey(),
  quantity: "",
  costPrice: costPrice !== undefined && costPrice !== null ? String(costPrice) : "",
  expiryDate: "",
  note: "",
});

export function initPackaging(product?: ProductCodeFields | null): PackagingState {
  const ppb = Math.max(1, Math.floor(Number(product?.piecesPerBox) || 1)); // sales in one box/pack
  const pps = Math.max(1, Math.floor(Number(product?.piecesPerSale) || 1));
  const stock = Math.max(0, Math.floor(Number(product?.stock) || 0));
  const shortCode = product?.shortCode || "";
  const allBarcodes = Array.isArray(product?.barcodes) ? product!.barcodes! : [];
  const savedBatches = Array.isArray(product?.batches) ? product!.batches! : [];
  const savedFullBox = allBarcodes.filter((b) => isFullBoxBarcode(b, shortCode));
  return {
    soldAs: ppb > 1 ? "box" : "loose",
    piecesPerBox: ppb > 1 ? String(ppb * pps) : "",
    piecesPerSale: String(pps),
    boxes: ppb > 1 ? String(Math.floor(stock / ppb)) : "",
    loosePieces: ppb > 1 ? String(stock % ppb) : "",
    addFullBoxBarcode: savedFullBox.length > 0,
    trackBatches: savedBatches.length > 0,
    batches: savedBatches.map((b) => ({
      key: b._id ? String(b._id) : newRowKey(),
      quantity: String(b.quantity ?? 0),
      costPrice: b.costPrice !== undefined && b.costPrice !== null ? String(b.costPrice) : "",
      expiryDate: b.expiryDate ? String(b.expiryDate).slice(0, 10) : "",
      note: b.note || "",
      saved: b,
    })),
    barcodes: allBarcodes.filter((b) => !isFullBoxBarcode(b, shortCode)),
    savedFullBoxBarcodes: savedFullBox,
    shortCode,
  };
}

/** Pieces handed over in one sale (1 = one by one). */
export const piecesPerSaleOf = (p: PackagingState) => Math.max(1, toInt(p.piecesPerSale));
/** Physical pieces in one box/pack, as typed. */
export const physicalPerBoxOf = (p: PackagingState) => (p.soldAs === "box" ? Math.max(1, toInt(p.piecesPerBox)) : 1);
/** Sales in one box/pack (what is saved as piecesPerBox; stock counts sales). */
export const piecesPerBoxOf = (p: PackagingState) =>
  p.soldAs === "box" ? Math.max(1, Math.floor(physicalPerBoxOf(p) / piecesPerSaleOf(p))) : 1;

export const boxStockOf = (p: PackagingState) => toInt(p.boxes) * piecesPerBoxOf(p) + toInt(p.loosePieces);

export const batchStockOf = (p: PackagingState) => p.batches.reduce((sum, b) => sum + toInt(b.quantity), 0);

// Stock in pieces the form will save, or null when the normal Stock field is used.
export function computedStock(p: PackagingState): number | null {
  if (p.trackBatches) return batchStockOf(p);
  if (p.soldAs === "box") return boxStockOf(p);
  return null;
}

// Client-side checks. Keys: piecesPerBox, boxes, batches, shortCode.
export function validatePackaging(p: PackagingState, mode: "create" | "edit"): Record<string, string> {
  const e: Record<string, string> = {};
  if (p.piecesPerSale.trim() !== "") {
    const s = Number(p.piecesPerSale);
    if (!Number.isInteger(s) || s < 1 || s > 1000) e.piecesPerSale = "Pieces per sale must be a whole number (1 or more)";
  }
  if (p.soldAs === "box") {
    const n = Number(p.piecesPerBox);
    const pps = piecesPerSaleOf(p);
    if (!p.piecesPerBox || !Number.isInteger(n) || n < 2) e.piecesPerBox = "Enter how many pieces are in one box/pack (2 or more)";
    else if (n % pps !== 0) e.piecesPerBox = `${n} pieces cannot be split into sales of ${pps}. Check the pieces in one box/pack.`;
    else if (n / pps < 2) e.piecesPerBox = `A box/pack of ${n} is only 1 sale of ${pps}: choose "Loose pieces" instead.`;
    if (!p.trackBatches) {
      const boxes = p.boxes === "" ? 0 : Number(p.boxes);
      const loose = p.loosePieces === "" ? 0 : Number(p.loosePieces);
      if (!Number.isInteger(boxes) || boxes < 0 || !Number.isInteger(loose) || loose < 0) {
        e.boxes = "Boxes/packs and loose pieces must be whole numbers (0 or more)";
      }
    }
  }
  if (p.trackBatches) {
    if (p.batches.length === 0) e.batches = "Add at least one batch, or turn off batch tracking";
    for (const b of p.batches) {
      const q = Number(b.quantity);
      const min = b.saved ? 0 : 1;
      if (b.quantity === "" || !Number.isInteger(q) || q < min) {
        e.batches = b.saved ? "Batch quantity must be a whole number (0 or more)" : "Each new batch needs a quantity of 1 or more";
        break;
      }
      if (b.costPrice !== "" && (!Number.isFinite(Number(b.costPrice)) || Number(b.costPrice) < 0)) {
        e.batches = "Batch cost price cannot be negative";
        break;
      }
    }
  }
  if (mode === "create" && p.shortCode.trim() && !/^\d{3,8}$/.test(p.shortCode.trim())) {
    e.shortCode = "Short code must be 3 to 8 digits (numbers only)";
  }
  return e;
}

// Barcodes list to send: extra codes + the saved full-box code (only while ticked
// and sold by the box; the backend adds a new one when addFullBoxBarcode=true).
export function barcodesPayload(p: PackagingState): ProductBarcodeDTO[] {
  const extra = p.barcodes.map((b) => ({ code: normalizeCode(b.code), qty: b.qty || 1, label: b.label || "manufacturer" }));
  const keepFullBox = p.soldAs === "box" && p.addFullBoxBarcode ? p.savedFullBoxBarcodes : [];
  return [...extra, ...keepFullBox];
}

export function batchesPayload(p: PackagingState) {
  return p.batches.map((b) => {
    const base: Record<string, unknown> = b.saved ? { ...b.saved } : {};
    base.quantity = toInt(b.quantity);
    if (b.costPrice !== "") base.costPrice = Number(b.costPrice);
    else delete base.costPrice;
    if (b.expiryDate) base.expiryDate = b.expiryDate;
    else delete base.expiryDate;
    base.note = b.note.trim();
    return base;
  });
}

/**
 * Append the packaging fields of a SINGLE product to the form data.
 * Sets `stock` too when it is computed from boxes or batches.
 */
export function appendPackagingFields(fd: FormData, p: PackagingState, mode: "create" | "edit") {
  const ppb = piecesPerBoxOf(p);
  fd.set("piecesPerBox", String(ppb));
  fd.set("piecesPerSale", String(piecesPerSaleOf(p)));
  fd.set("addFullBoxBarcode", String(p.soldAs === "box" && p.addFullBoxBarcode));

  if (p.trackBatches) {
    fd.set("batches", JSON.stringify(batchesPayload(p)));
    fd.set("stock", String(batchStockOf(p)));
  } else if (p.soldAs === "box") {
    fd.set("boxes", String(toInt(p.boxes)));
    fd.set("loosePieces", String(toInt(p.loosePieces)));
    fd.set("stock", String(boxStockOf(p)));
  }

  const barcodes = barcodesPayload(p);
  // Always send on edit so removed codes are removed; on create only when used.
  if (mode === "edit" || barcodes.length > 0) fd.set("barcodes", JSON.stringify(barcodes));

  // Short code: only on create and only when typed (empty = auto). On edit the
  // saved code stays (printed stickers keep working).
  if (mode === "create" && p.shortCode.trim()) fd.set("shortCode", p.shortCode.trim());
}

// Variant attributes: the form edits Storage / RAM / Option, other keys are kept.
export const VARIANT_OPTION_KEYS = ["Storage", "RAM", "Option"] as const;

export function cleanAttributes(attrs: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!attrs) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(attrs)) {
    const val = String(v ?? "").trim();
    if (k && val) out[k] = val;
  }
  return Object.keys(out).length ? out : undefined;
}

// Variant ready to send: drop view-only fields the GET returned, normalise codes and options.
export function variantPayload<T extends Record<string, unknown>>(v: T): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { totalStock, ...rest } = v as Record<string, unknown>;
  const out: Record<string, unknown> = { ...rest };
  const attrs = cleanAttributes(rest.attributes as Record<string, string> | undefined);
  if (attrs) out.attributes = attrs;
  // All options cleared on a saved variant: send {} so the backend removes them
  // (leaving the key out would keep the old ones).
  else if (rest.attributes !== undefined && rest.attributes !== null) out.attributes = {};
  else delete out.attributes;
  if (Array.isArray(rest.barcodes)) {
    out.barcodes = (rest.barcodes as ProductBarcodeDTO[])
      .filter((b) => b && b.code)
      .map((b) => ({ ...b, code: normalizeCode(b.code), qty: b.qty || 1 }));
  }
  return out;
}

// Pull a readable message out of an axios error (409 duplicate code, 400 invalid short code...)
export interface BackendCodeError {
  message: string;
  duplicateCode?: string;
  code?: string;
  status?: number;
}

export function readBackendError(error: unknown): BackendCodeError | null {
  const resp = (error as { response?: { status?: number; data?: Record<string, unknown> } })?.response;
  if (!resp) return null;
  const data = resp.data || {};
  const message =
    (typeof data.error === "string" && data.error) ||
    (typeof data.message === "string" && data.message) ||
    "";
  return {
    message: String(message),
    duplicateCode: typeof data.duplicateCode === "string" ? data.duplicateCode : undefined,
    code: typeof data.code === "string" ? data.code : undefined,
    status: resp.status,
  };
}
