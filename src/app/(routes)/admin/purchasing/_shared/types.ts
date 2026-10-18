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
  billTotal: number;
  notes: string;
  ledgerEntry: string | null;
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
}
