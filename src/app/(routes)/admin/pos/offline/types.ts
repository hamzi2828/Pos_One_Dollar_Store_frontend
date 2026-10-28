// Offline sales: shapes shared by the IndexedDB store, the catalogue sync,
// offline pricing and the upload worker.
// Contract: pos_backend/docs/OFFLINE_SALES.md (sections 2, 3, 4).
import type { AppliedDiscount, AppliedTax, CustomerInfo, ManualDiscount, PaymentMethodType, POSOrder, POSOrderItem } from '../types';

/* ---------------- GET /api/pos/offline/catalog ---------------- */

export interface CatalogVariant {
  variantId: string;
  label?: string;
  regularPrice?: number;
  sku?: string;
  barcode?: string;
  /** Optional extras (used when the backend sends them). */
  barcodes?: string[];
  shortCode?: string;
  price: number;
  discountedPrice?: number;
  size?: string;
  color?: string;
  stock?: number;
}

/** What one scannable code means (server: helper/productCodes resolveScan). Codes are trimmed + UPPERCASE. */
export interface CatalogCode {
  code: string;
  variantId: string | null;
  qty: number;
  kind: string;
  batchNo?: string;
}

export interface CatalogBoxCode {
  code: string;
  pieces: number;
  /** Optional: the variant this box/pack code belongs to. */
  variantId?: string | null;
}

export interface CatalogProduct {
  _id: string;
  name: string;
  sku?: string;
  barcode?: string;
  barcodes?: string[];
  codes?: CatalogCode[];
  /** What the server charges per piece (already the sale price when lower). */
  price: number;
  /** List price (info only). */
  regularPrice?: number;
  /** Not sent by the server (price is already the sale price); kept for safety. */
  discountedPrice?: number;
  status?: string;
  category?: string;
  categoryName?: string;
  thumbnailUrl?: string;
  stock?: number;
  variants?: CatalogVariant[];
  priceTier?: { _id: string; name: string; price: number } | null;
  boxCodes?: CatalogBoxCode[];
  /** Optional extras. */
  productType?: 'single' | 'variant';
  shortCode?: string;
  piecesPerSale?: number;
  slug?: string;
}

/** A discount rule exactly as pricingService uses it. */
export interface CatalogDiscountRule {
  _id?: string;
  name: string;
  kind: 'overall' | 'threshold' | string;
  valueType: 'percentage' | 'fixed' | string;
  value: number;
  minSubtotal?: number;
  maxDiscount?: number;
  stackable?: boolean;
  priority?: number;
  isActive?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  createdAt?: string;
}

export interface CatalogTax {
  taxId: string;
  name: string;
  rate: number;
  isActive?: boolean;
  isDefault?: boolean;
  description?: string;
}

export interface CatalogCustomer {
  _id: string;
  name: string;
  phone?: string;
}

export interface CatalogLimits {
  maxManualDiscountPct?: number;
  unlimitedManualDiscount?: boolean;
  canGift?: boolean;
  canEditPrice?: boolean;
  canPriceBelowList?: boolean;
  /** desktop_pos create AND pos create. */
  canSellOffline?: boolean;
  maxLines?: number;
  [key: string]: unknown;
}

export interface CatalogSnapshot {
  version: string;
  serverTime?: string;
  branchId?: string;
  products: CatalogProduct[];
  discountRules: CatalogDiscountRule[];
  taxes: CatalogTax[];
  customers: CatalogCustomer[];
  limits?: CatalogLimits;
  shop?: { name?: string; currency?: string; logoUrl?: string; address?: string; phone?: string; timezone?: string; [key: string]: unknown };
  till?: { required?: boolean };
  /** Set on the PC when saved. */
  savedAt?: string;
}

/* ---------------- POST /api/pos/offline/orders ---------------- */

export interface OfflineBillLine {
  product: string;
  variantId?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  isGift?: boolean;
}

export interface OfflineBill {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  lines: OfflineBillLine[];
  /** Extra detail (not required by the contract). */
  appliedDiscounts?: AppliedDiscount[];
  appliedTaxes?: AppliedTax[];
}

export interface OfflineOrderPayload {
  clientId: string;
  offlineNumber: string;
  soldAt: string;
  cashier: string;
  items: POSOrderItem[];
  manualDiscount?: ManualDiscount | null;
  taxIds?: string[];
  paymentMethod: PaymentMethodType;
  cashAmount?: number;
  isPartialPayment?: boolean;
  paidAmount?: number;
  customer?: string;
  customerInfo?: CustomerInfo;
  notes?: string;
  bill: OfflineBill;
}

export type OfflineResultStatus = 'created' | 'duplicate' | 'failed';

export interface OfflineUploadWarning {
  code: 'STOCK_SHORT' | 'PRICE_DIFF' | 'NO_TILL' | 'NOT_ALLOWED' | string;
  [key: string]: unknown;
}

export interface OfflineUploadResult {
  clientId: string;
  status: OfflineResultStatus;
  orderId?: string;
  orderNumber?: string;
  warnings?: OfflineUploadWarning[];
  error?: { code?: string; message?: string; retry?: boolean };
}

/* ---------------- outbox (IndexedDB) ---------------- */

export type OutboxState = 'waiting' | 'failed';

export interface OutboxEntry {
  clientId: string;
  offlineNumber: string;
  /** ms since epoch; upload order (oldest first). */
  createdAt: number;
  state: OutboxState;
  attempts: number;
  lastError?: string;
  lastErrorCode?: string;
  lastTriedAt?: number;
  order: OfflineOrderPayload;
  /** What was printed (for the "needs attention" list / reprint). */
  receipt: POSOrder;
}
