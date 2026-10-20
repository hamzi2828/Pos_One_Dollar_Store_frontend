// Types for the Purchasing module (backend: pos_backend/src/models/purchaseOrder.js, goodsReceipt.js).

export type POStatus = 'open' | 'closed' | 'receiving' | 'received' | 'cancelled';
export type GRNStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type ChargeType = 'car_rent' | 'transport' | 'builty_freight' | 'loading' | 'unloading' | 'landing' | 'labour' | 'misc';
export type AllocationMethod = 'value' | 'quantity' | 'carton';

export interface HistoryEntry {
  at: string;
  byName: string;
  action: string;
  note: string;
}

export interface POItem {
  _id: string;
  product: string;
  variantId: string | null;
  productName: string;
  code: string;
  piecesPerBox: number;
  boxes: number;
  qty: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
  salePrice: number;
  note: string;
}

export interface POBill {
  _id: string;
  vendor: string;
  vendorName: string;
  billNo: string;
  billDate: string | null;
  cartons: number;
  photos: string[];
  items: POItem[];
  subtotal: number;
  discount: number;
  /** What we owe: billAmount when > 0, else items total (subtotal − discount). */
  billTotal: number;
  notes: string;
  ledgerEntry: string | null;
  /** Total written on the vendor's paper bill (0 = not typed; the items total is used). */
  billAmount?: number;
  /** Paid to the vendor at the market (0 = nothing). */
  paidNow?: number;
  paidMethod?: string;
  paidBank?: string | null;
  /** VendorPayment id, set when the trip is sent to the warehouse. */
  payment?: string | null;
}

export interface POCharge {
  _id: string;
  type: ChargeType;
  amount: number;
  note: string;
  paidTo: string;
  source: 'manual' | 'builty';
}

export interface Builty {
  builtyNo: string;
  transporter: string;
  date: string | null;
  cartons: number;
  freight: number;
  photos: string[];
  submittedAt: string | null;
}

export interface POTotals {
  goods: number;
  charges: number;
  grand: number;
  cartons: number;
  pieces: number;
  bills: number;
  lines: number;
}

export interface PurchaseOrder {
  _id: string;
  poNumber: string;
  status: POStatus;
  buyerName: string;
  notes: string;
  expectedArrival: string | null;
  allocationMethod: AllocationMethod;
  bills: POBill[];
  charges: POCharge[];
  builty: Builty;
  totals: POTotals;
  goodsReceipt: string | null;
  grnNumber: string;
  grn?: { _id: string; grnNumber: string; status: GRNStatus; receiverName: string; completedAt: string | null } | null;
  closedAt: string | null;
  receivedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string;
  history: HistoryEntry[];
  createdAt: string;
  vendors?: string[]; // list rows only
}

export interface POListMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
  counts: Record<string, number>;
  totals: { goods: number; charges: number; grand: number };
}

export type CostWarning = 'loss' | 'low_margin' | 'no_price' | null;

export interface CostingLine {
  billId: string;
  itemId: string;
  vendorName: string;
  billNo: string;
  product: string;
  variantId: string | null;
  productName: string;
  code: string;
  qty: number;
  vendorPrice: number;
  netUnitPrice: number;
  lineValue: number;
  allocatedCharges: number;
  chargePerPiece: number;
  landedUnitCost: number;
  landedTotal: number;
  salePrice: number;
  profitPerPiece: number;
  marginPct: number;
  currentCost: number | null;
  lastPurchasePrice: number | null;
  newAverageCost: number;
  warning: CostWarning;
}

export interface Costing {
  method: AllocationMethod;
  minMarginPct: number;
  lines: CostingLine[];
  totals: {
    goods: number;
    charges: number;
    landed: number;
    chargesPct: number;
    saleValue: number;
    expectedProfit: number;
    marginPct: number;
    pieces: number;
    warnings: number;
  };
}

export interface ProductUnit {
  productId: string;
  variantId: string | null;
  name: string;
  variantLabel: string;
  productName: string;
  code: string;
  sku: string;
  category: string;
  thumbnailUrl: string | null;
  price: number;
  salePrice: number;
  costPrice: number | null;
  lastPurchasePrice: number | null;
  lastLandedCost: number | null;
  lastVendorName: string;
  piecesPerBox: number;
  stockTotal: number;
  /** Pieces in the shop (API field name). */
  branchStock: number;
}

export interface POMeta {
  statuses: POStatus[];
  chargeTypes: { value: ChargeType; label: string }[];
  allocationMethods: { value: AllocationMethod; label: string; hint: string }[];
  minMarginPct: number;
  requireDifferentReceiver: boolean;
  categories: string[];
}

export interface VendorOption {
  _id: string;
  name: string;
  phone?: string;
  city?: string;
  contactPerson?: string;
  balance?: number;
}

// ---------------- goods receipt

export interface GRNLine {
  _id: string;
  lineNo: number;
  bill: string;
  vendor: string;
  vendorName: string;
  billNo: string;
  product: string;
  variantId: string | null;
  productName: string;
  code: string;
  piecesPerBox: number;
  expectedQty: number;
  unitPrice: number;
  receivedQty: number;
  damagedQty: number;
  shortQty: number;
  acceptedQty: number;
  note: string;
  allocatedCharges: number;
  landedUnitCost: number;
  claimAmount: number;
  posted: boolean;
  salePrice?: number | null;
  productDeleted?: boolean;
}

export interface GRNSummaryLine {
  lineId: string;
  lineNo: number;
  vendorName: string;
  billNo: string;
  productName: string;
  expected: number;
  received: number;
  damaged: number;
  short: number;
  accepted: number;
  unitPrice: number;
  claimQty: number;
  claimAmount: number;
  allocatedCharges: number;
  landedUnitCost: number;
  stockValue: number;
}

export interface GRNClaim {
  bill: string;
  vendor: string;
  vendorName: string;
  billNo: string;
  shortQty: number;
  damagedQty: number;
  amount: number;
}

export interface GRNSummary {
  claimFromVendor: boolean;
  lines: GRNSummaryLine[];
  claims: GRNClaim[];
  totals: {
    expected: number;
    received: number;
    damaged: number;
    short: number;
    accepted: number;
    stockValue: number;
    claimed: number;
    charges: number;
    unallocatedCharges: number;
  };
}

export interface GoodsReceipt {
  _id: string;
  grnNumber: string;
  poNumber: string;
  purchaseOrder: {
    _id: string;
    poNumber: string;
    status?: POStatus;
    buyerName?: string;
    totals?: POTotals;
    bills?: { _id: string; vendorName: string; billNo: string; cartons: number; billTotal: number; photos: string[] }[];
  };
  status: GRNStatus;
  buyerName: string;
  receiverName: string;
  builty: { builtyNo: string; transporter: string; date: string | null; cartons: number; photos: string[] };
  allocationMethod: AllocationMethod;
  chargesTotal: number;
  expectedCartons: number;
  lines: GRNLine[];
  cartonsReceived: number;
  photos: string[];
  notes: string;
  claimFromVendor: boolean;
  claims: (GRNClaim & { ledgerEntry: string | null })[];
  startedAt: string | null;
  completedAt: string | null;
  history: HistoryEntry[];
  createdAt: string;
  summary: GRNSummary;
  canVerify: boolean;
  // ---- simple buying flow (Oct 2026). Missing / empty `boxes` = old receipt (counted the old way).
  boxes?: GRNBox[];
  boxesCheckedAt?: string | null;
  boxesNote?: string;
  /** Boxes fully unpacked ("Box 3 done"), per bill. */
  boxesDone?: { bill: string; boxNo: number; at?: string; byName?: string }[];
  chargeRate?: number;
  entries?: GRNEntry[];
  progress?: GRNProgress;
  /** 'entries' = new flow, 'lines' = counted on the old screen. */
  mode?: 'entries' | 'lines';
  /** Preview of Finish (new flow). */
  closing?: GRNClosing;
}

export interface GRNClosingBill {
  bill: string;
  vendorName: string;
  billNo: string;
  billTotal: number;
  entered: number;
  difference: number;
  claim: boolean;
  claimAmount: number;
  damaged: number;
  damagedValue: number;
  shortQty: number;
  warning?: string | null;
}

export interface GRNClosing {
  byBill: GRNClosingBill[];
  shortLines?: { lineId?: string; productName: string; vendorName?: string; expectedQty?: number; receivedQty?: number; shortQty?: number }[];
  warnings?: string[];
  totals?: Record<string, number>;
}

/** One vendor's boxes on a receipt. */
export interface GRNBox {
  _id?: string;
  bill: string;
  vendor: string;
  vendorName: string;
  billNo: string;
  expected: number;
  received: number;
}

/** One "unpack & enter" row: pieces of one product from one vendor bill, already in the warehouse. */
export interface GRNEntry {
  _id: string;
  entryNo: number;
  bill: string;
  vendor: string;
  vendorName: string;
  billNo: string;
  product: string;
  variantId: string | null;
  productName: string;
  code: string;
  salePrice: number;
  qty: number;
  /** Box of this bill it came out of (1..n); 0 / missing = not said. */
  boxNo?: number;
  damagedQty: number;
  costPrice: number;
  landedUnitCost: number;
  value: number;
  stockQty: number;
  line: string | null;
  movement: string | null;
  shelved: number;
  createdBy?: string;
  createdByName: string;
  createdAt: string;
  undone?: boolean;
  undoneAt?: string | null;
}

export interface GRNBillProgress {
  bill: string;
  vendorName: string;
  billNo: string;
  billTotal: number;
  /** Σ good pieces × cost price */
  entered: number;
  left: number;
  boxesExpected: number;
  boxesReceived: number;
  entries?: number;
  pieces?: number;
  damaged?: number;
}

export interface GRNProgress {
  byBill: GRNBillProgress[];
  entered: number;
  billTotal: number;
  left: number;
  /** pieces entered, damaged included */
  pieces: number;
  damaged: number;
  /** good pieces put in the warehouse */
  stocked?: number;
  entries?: number;
  boxesExpected?: number;
  boxesReceived?: number;
}

/** Product found while unpacking (GET /receiving/:id/lookup, POST /receiving/:id/new-product). */
export interface ReceivingUnit {
  productId: string;
  variantId: string | null;
  name: string;
  code: string;
  salePrice: number;
  lastCost: number | null;
  /** Sales in one box/pack (stock counts sales). */
  piecesPerBox: number;
  /** Pieces handed over in one sale (2 = sold in twos). Missing = 1. */
  piecesPerSale?: number;
  expected: { lineId: string; qtyLeft: number; unitPrice: number; bill?: string; vendorName?: string; billNo?: string; expectedQty?: number } | null;
  // extras the lookup may also send (same as purchasing product search)
  productName?: string;
  variantLabel?: string;
  thumbnailUrl?: string | null;
  sku?: string;
  branchStock?: number;
  category?: string;
  costPrice?: number | null;
  lastLandedCost?: number | null;
  lastVendorName?: string;
  stockTotal?: number;
}

export interface GRNListRow {
  _id: string;
  grnNumber: string;
  poNumber: string;
  purchaseOrder: string;
  status: GRNStatus;
  buyerName: string;
  receiverName: string;
  builty: { builtyNo: string; transporter: string; cartons: number };
  expectedCartons: number;
  cartonsReceived: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  lineCount: number;
  expectedPieces: number;
  receivedPieces: number;
  vendors: string[];
  totals: { accepted: number; stockValue: number; claimed: number };
  // optional (simple flow) — shown when the list sends them
  boxesCheckedAt?: string | null;
  entryCount?: number;
  enteredPieces?: number;
}
