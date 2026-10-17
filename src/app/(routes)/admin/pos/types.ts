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
  category: string;
  thumbnailUrl?: string;
  bannerUrls?: string[];
  productType: 'single' | 'variant';
  variants?: POSVariant[];
  colorMedia?: Record<string, ColorMedia>;
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
  isLabour?: boolean;
  labourDescription?: string;
  isOutsource?: boolean;
  outsourceDescription?: string;
  costPrice?: number; // Cost price for outsource products (saved for records)
  performedBy?: string; // Employee ID who performed the labour/outsource work
  performedByName?: string; // Employee display name snapshot
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
}

export interface POSCarDetails {
  brand: string;
  model: string;
  numberPlate: string;
}

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
  carDetails?: POSCarDetails | POSCarDetails[];
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
  stripePaymentIntentId?: string;
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
  isLabour?: boolean;
  labourDescription?: string;
  isOutsource?: boolean;
  outsourceDescription?: string;
  costPrice?: number; // Cost price for outsource products (saved for records)
  performedBy?: string;
  performedByName?: string;
}

export interface CustomerInfo {
  name: string;
  phone: string;
  vehicleName: string;
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
