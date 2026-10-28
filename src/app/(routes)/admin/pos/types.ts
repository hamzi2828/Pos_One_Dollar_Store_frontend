// POS Types and Interfaces

export interface POSProduct {
  _id: string;
  name: string;
  slug: string;
  sku?: string;
  barcode?: string;
  price: number;
  costPrice?: number; // Cost price for profit calculation
  discountedPrice?: number;
  stock: number;
  /** Pieces handed over in one sale (2 = sold 2 together). Missing = 1. */
  piecesPerSale?: number;
  category: string;
  thumbnailUrl?: string;
  bannerUrls?: string[];
  productType: 'single' | 'variant';
  variants?: POSVariant[];
  colorMedia?: Record<string, ColorMedia>;
  /** Shelves holding this item (e.g. ['A1-S2']). */
  shelfCodes?: string[];
  shortCode?: string;
  priceTier?: string | null;
}

export interface POSVariant {
  _id: string;
  variantId: string;
  color: string;
  size: string;
  price: number;
  stock: number;
  sku: string;
  discountedPrice?: number;
  shelfCodes?: string[];
}

export interface ColorMedia {
  thumbnailUrl?: string;
  bannerUrls?: string[];
}

export interface CartItem {
  id: string; // Unique cart item ID (generated client-side)
  product: POSProduct;
  variantId?: string;
  variant?: POSVariant;
  quantity: number;
  unitPrice: number;
  originalPrice?: number; // Original price (minimum price - can't go below this)
  discount: number;
  subtotal: number;
  color?: string;
  size?: string;
  /** Free gift: sold at 0, its cost goes to cost of sales (needs pos_gifts). */
  isGift?: boolean;
  giftReason?: string;
  /** Cashier typed this price (needs pos edit; the server checks). */
  priceOverride?: boolean;
  /** Barcode / batch the cashier scanned (stock comes from that batch first). */
  scannedCode?: string;
  batchNo?: string;
}

// Tax type for POS
export interface POSTax {
  taxId: string;
  name: string;
  rate: number;
  description?: string;
  isActive: boolean;
  isDefault?: boolean;
}

// Applied tax in cart
export interface AppliedTax {
  taxId: string;
  name: string;
  rate: number;
  amount: number;
}

export interface POSCart {
  items: CartItem[];
  subtotal: number;
  tax: number;
  taxRate: number; // Legacy: Total combined tax rate
  appliedTaxes: AppliedTax[]; // New: Individual applied taxes
  discount: number;
  discountType?: 'fixed' | 'percentage' | null;
  discountReason?: string;
  total: number;
  customer?: POSCustomer;
  /** Cashier's own discount (the server checks the limit). */
  manualDiscount?: ManualDiscount | null;
}

export interface ManualDiscount {
  type: 'fixed' | 'percentage';
  value: number;
  reason?: string;
}

/** One discount on a bill (rule or manual), as the server applied it. */
export interface AppliedDiscount {
  rule?: string | null;
  name: string;
  kind: 'overall' | 'threshold' | 'manual' | string;
  valueType: 'percentage' | 'fixed' | string;
  value: number;
  amount: number;
  label?: string;
}

/** POST /api/pos/quote line (server prices). */
export interface QuoteLine {
  index: number;
  product?: string;
  variantId?: string;
  name: string;
  quantity: number;
  price: number;
  listPrice: number;
  priceOverride: boolean;
  lineTotal: number;
  isGift: boolean;
  giftReason?: string;
  available?: number;
  costPrice?: number;
}

/** POST /api/pos/quote — the exact numbers the sale will use. */
export interface CartQuote {
  lines: QuoteLine[];
  itemCount: number;
  subtotal: number;
  appliedDiscounts: AppliedDiscount[];
  ruleDiscount: number;
  manualDiscount: number;
  discount: number;
  tax: number;
  appliedTaxes: AppliedTax[];
  total: number;
  giftCount: number;
  giftValue: number;
  cogs?: number;
  giftCost?: number;
  profit?: number;
  canSeeCost?: boolean;
  nextDiscount: { name: string; label: string; minSubtotal: number; missing: number; message: string } | null;
  limits: { maxManualDiscountPct: number; maxManualDiscount: number; unlimitedManualDiscount: boolean };
  /** Priced on this PC from the saved catalogue (no connection to the server). */
  offline?: boolean;
}

export type WhatsAppStatus = 'none' | 'queued' | 'sent' | 'failed' | 'skipped';

export interface POSAddress {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

export interface POSCustomer {
  _id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: POSAddress;
  customerType?: 'online' | 'walk-in';
  source?: 'facebook' | 'tiktok' | 'instagram' | 'word-of-mouth' | '';
}

export type PaymentMethodType = 'cash' | 'card' | 'split' | 'bank_transfer';

export interface PaymentMethod {
  type: PaymentMethodType;
  cashAmount?: number;
  cardAmount?: number;
  change?: number;
  bankTransferScreenshot?: string; // URL of uploaded screenshot
}

// Payment Status Types
export type PaymentStatusType = 'completed' | 'pending' | 'partial' | 'refunded' | 'full';

// Payment History Entry
export interface PaymentHistoryEntry {
  _id?: string;
  amount: number;
  paymentMethod: PaymentMethodType;
  paidAt: string;
  receivedBy?: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  note?: string;
  paymentStatus?: PaymentStatusType;
  bankTransferScreenshot?: string;
}

// Bank transfer screenshot upload result
export interface BankTransferScreenshot {
  url: string;
  originalFilename: string;
  uploadedAt: string;
}

export interface POSOrderItem {
  product?: string | { _id: string; name: string }; // Product ID or populated product
  variantId?: string;
  sku: string;
  quantity: number;
  price: number;
  size?: string;
  color?: string;
  discount?: number;
  /** Cost per piece at the time of sale (cost viewers only). */
  costPrice?: number;
  isGift?: boolean;
  giftReason?: string;
  priceOverride?: boolean;
  scannedCode?: string;
  batchNo?: string;
  category?: string;
}

export interface CustomerInfo {
  name: string;
  phone: string;
  customerType?: 'online' | 'walk-in';
  source?: 'facebook' | 'tiktok' | 'instagram' | 'word-of-mouth' | '';
}

export interface POSOrderData {
  items: POSOrderItem[];
  customer?: string; // User ID or undefined for guest
  customerInfo?: CustomerInfo; // Customer info for invoice display
  subtotal: number;
  tax: number;
  appliedTaxes?: AppliedTax[]; // Tax breakdown when multiple taxes applied
  discount: number;
  discountType?: 'fixed' | 'percentage' | null;
  discountReason?: string;
  total: number;
  paymentMethod: PaymentMethodType;
  cashAmount?: number;
  cardAmount?: number;
  change?: number;
  bankTransferScreenshot?: string; // URL of bank transfer screenshot
  isPOS: true;
  notes?: string;
  // Partial Payment Fields
  isPartialPayment?: boolean;
  paidAmount?: number;
  /** Server-priced fields (the server ignores client prices / totals). */
  manualDiscount?: ManualDiscount | null;
  taxIds?: string[];
  /** Total the cashier saw; the server answers 409 TOTAL_CHANGED if it differs. */
  expectedTotal?: number;
  /** Idempotency key made on the PC. If this request is lost and the sale is
   *  saved offline instead, the upload uses the same key (never counted twice). */
  clientId?: string;
}

/** Offline-sale info on an order (POSOrder.offline on the server; `pending` = still on this PC). */
export interface POSOrderOffline {
  clientId?: string;
  number?: string;
  deviceId?: string;
  deviceName?: string;
  soldAt?: string;
  uploadedAt?: string;
  offlineTotal?: number;
  serverTotal?: number;
  warnings?: { code: string; [key: string]: unknown }[];
  /** Only on this PC: saved in the outbox, not uploaded yet. */
  pending?: boolean;
}

export interface POSOrder {
  _id: string;
  orderNumber: string;
  items: POSOrderItem[];
  customer?: POSCustomer;
  customerInfo?: CustomerInfo; // Customer info stored at time of order
  paymentMethod: PaymentMethodType;
  cashAmount?: number;
  cardAmount?: number;
  changeGiven?: number;
  bankTransferScreenshot?: string;
  subtotal: number;
  tax: number;
  appliedTaxes?: AppliedTax[]; // Tax breakdown when multiple taxes applied
  discount: number;
  total: number;
  // Partial Payment Fields
  paidAmount?: number;
  pendingAmount?: number;
  paymentHistory?: PaymentHistoryEntry[];
  appliedDiscounts?: AppliedDiscount[];
  discountReason?: string;
  /** Cost of sales (dashboard viewers only). */
  cogs?: number;
  giftCost?: number;
  profit?: number;
  whatsappStatus?: WhatsAppStatus;
  cashier?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
  orderStatus: string;
  paymentStatus: PaymentStatusType;
  completedAt?: string;
  offline?: POSOrderOffline;
}

// Pending Orders Response
export interface PendingOrdersResponse {
  success: boolean;
  data: POSOrder[];
  summary: {
    totalOrders: number;
    totalPending: number;
    totalPaid: number;
    totalAmount: number;
  };
  message?: string;
}

// Add Payment Request
export interface AddPaymentRequest {
  amount: number;
  paymentMethod: PaymentMethodType;
  note?: string;
  bankTransferScreenshot?: string;
  discount?: number;
}

export interface HeldCart {
  id: string;
  cart: POSCart;
  heldAt: string;
  heldBy: string;
  customerName?: string;
}

export type DiscountType = 'percentage' | 'fixed';

export interface Discount {
  type: DiscountType;
  value: number;
  reason?: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface GetProductsResponse {
  success: boolean;
  data: POSProduct[];
  message?: string;
}

export interface GetUsersResponse {
  success: boolean;
  data: POSCustomer[];
  message?: string;
}

export interface CreateOrderResponse {
  success: boolean;
  data: POSOrder;
  message?: string;
}

export interface GetOrdersResponse {
  success: boolean;
  data: POSOrder[];
  pagination?: {
    total: number;
    page: number;
    pages: number;
    limit: number;
  };
  message?: string;
}
