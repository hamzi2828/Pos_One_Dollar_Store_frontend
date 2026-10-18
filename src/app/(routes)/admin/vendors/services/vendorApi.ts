// Vendors module API (backend: pos_backend/src/routes/modules/vendorsRoutes.js).
// Money is always computed by the server; the screens only show it.
import axios from 'axios';
import { storeApi, API_URL, type PageMeta } from '@/lib/storeApi';
import { getAuthHeader } from '@/helper/helper';

/* ------------------------------------------------------------------ types */

export interface BankDetails {
  bankName?: string;
  accountTitle?: string;
  accountNumber?: string;
  iban?: string;
}

export interface Vendor {
  _id: string;
  name: string;
  code?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  cnic?: string;
  ntn?: string;
  city?: string;
  address?: { street?: string; city?: string; state?: string; country?: string; postalCode?: string };
  bankDetails?: BankDetails;
  categories?: string[];
  paymentTermsDays?: number;
  isConsignment?: boolean;
  isActive: boolean;
  notes?: string;
  /** > 0 we owe the vendor (payable), < 0 the vendor owes us (receivable). */
  balance: number;
  totalCredit?: number;
  totalDebit?: number;
  createdAt?: string;
}

export interface VendorTotals {
  opening: number;
  billed: number;
  consignment: number;
  paid: number;
  returned: number;
  discount: number;
  refunds: number;
  adjustments: number;
}

export interface VendorDetail extends Vendor {
  totals: VendorTotals;
  lastPayment: { date: string; amount: number; method: string } | null;
}

export interface VendorSummary {
  vendorCount: number;
  activeCount: number;
  consignmentCount: number;
  totalPayable: number;
  totalReceivable: number;
  payableCount: number;
  receivableCount: number;
}

export interface VendorPayload {
  name: string;
  code?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  cnic?: string;
  ntn?: string;
  city?: string;
  address?: { street?: string };
  bankDetails?: BankDetails;
  categories?: string[];
  paymentTermsDays?: number;
  isConsignment?: boolean;
  isActive?: boolean;
  notes?: string;
  openingBalance?: number;
  openingBalanceDate?: string;
}

export type LedgerType =
  | 'opening_balance'
  | 'bill'
  | 'payment'
  | 'debit_note'
  | 'credit_note'
  | 'consignment_settlement'
  | 'discount'
  | 'refund_received'
  | 'adjustment';

export interface LedgerRow {
  _id: string;
  date: string;
  type: LedgerType;
  typeLabel: string;
  description: string;
  refType: string;
  refId: string | null;
  refNo: string;
  method: string;
  reference: string;
  attachments: string[];
  credit: number;
  debit: number;
  balance: number;
  isVoided: boolean;
  voidReason: string;
  createdByName: string;
}

export interface Statement {
  vendor: { _id: string; name: string; code?: string; phone?: string; city?: string };
  from: string | null;
  to: string | null;
  opening: number;
  closing: number;
  rows: LedgerRow[];
  totals: { credit: number; debit: number; byType: Record<string, { credit: number; debit: number; count: number }> };
  truncated: boolean;
}

export interface BoughtProduct {
  product: string;
  variantId: string | null;
  productName: string;
  code: string;
  category: string;
  isDeleted: boolean;
  isConsignment: boolean;
  salePrice: number | null;
  currentCost: number | null;
  currentStock: number | null;
  qtyIn: number;
  qtyReturned: number;
  receiptCount: number;
  totalValue: number;
  firstPrice: number | null;
  firstDate: string | null;
  lastPrice: number | null;
  lastLandedCost: number | null;
  lastDate: string | null;
  lastQty: number | null;
  minPrice: number | null;
  maxPrice: number | null;
}

export type PaymentMethod = 'cash' | 'bank' | 'cheque' | 'easypaisa' | 'jazzcash' | 'other';

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'easypaisa', label: 'Easypaisa' },
  { value: 'jazzcash', label: 'JazzCash' },
  { value: 'other', label: 'Other' },
];

export interface VendorPayment {
  _id: string;
  paymentNo: string;
  vendor: string;
  vendorName: string;
  amount: number;
  method: PaymentMethod;
  methodLabel: string;
  bank: string | null;
  bankName: string;
  reference: string;
  date: string;
  attachments: string[];
  notes: string;
  settlement: string | null;
  status: 'active' | 'voided';
  voidReason: string;
  voidedAt: string | null;
  voidedByName: string;
  createdByName: string;
  createdAt: string;
}

export interface PaymentSummary {
  total: number;
  count: number;
  voidedCount: number;
  voidedAmount: number;
  byMethod: Record<string, { amount: number; count: number }>;
}

export interface BankOption {
  _id: string;
  name: string;
  accountTitle: string;
  accountNumber: string;
}

export type ReturnReason = 'slow_moving' | 'damaged' | 'expired' | 'wrong_item' | 'excess' | 'other';

export const RETURN_REASONS: { value: ReturnReason; label: string }[] = [
  { value: 'slow_moving', label: 'Slow moving' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'expired', label: 'Expired' },
  { value: 'wrong_item', label: 'Wrong item' },
  { value: 'excess', label: 'Excess stock' },
  { value: 'other', label: 'Other' },
];

export interface ReturnLine {
  _id: string;
  product: string;
  variantId: string | null;
  productName: string;
  variantLabel: string;
  code: string;
  qty: number;
  unitCost: number;
  amount: number;
  reason: ReturnReason;
  reasonLabel: string;
  note: string;
  posted: boolean;
}

export interface VendorReturn {
  _id: string;
  returnNo: string;
  vendor: string;
  vendorName: string;
  status: 'draft' | 'completed' | 'cancelled';
  date: string;
  lines: ReturnLine[];
  totalQty: number;
  total: number;
  notes: string;
  completedAt: string | null;
  completedByName: string;
  cancelReason: string;
  createdByName: string;
  createdAt: string;
}

export interface ReturnLineInput {
  productId: string;
  variantId: string | null;
  qty: number;
  unitCost?: number;
  reason: ReturnReason;
  note?: string;
  fromShelfId?: string | null;
}

export interface LookupUnit {
  variantId: string | null;
  label: string;
  code: string;
  price: number;
  costPrice: number | null;
  stock: number;
  vendorLastPrice: number | null;
  defaultUnitCost: number;
  defaultCostSource: 'vendor_last_price' | 'cost_price' | 'none';
  shelves: { shelfId: string; code: string; qty: number }[];
}

export interface LookupProduct {
  _id: string;
  name: string;
  category: string;
  productType: 'single' | 'variant';
  thumbnailUrl: string | null;
  isConsignment: boolean;
  consignmentVendor: string | null;
  consignmentRate: number | null;
  lastVendor: string | null;
  lastVendorName: string;
  match: { variantId: string | null; kind: string } | null;
  units: LookupUnit[];
}

export interface ConsignmentVendorRow {
  _id: string;
  name: string;
  code?: string;
  phone?: string;
  whatsapp?: string;
  city?: string;
  isActive: boolean;
  balance: number;
  products: number;
  placed: number;
  sold: number;
  unsold: number;
  unsoldValue: number;
  unsettledQty: number;
  unsettledAmount: number;
  settledAmount: number;
  lastIntakeAt: string | null;
  lastSettledAt: string | null;
}

export interface ConsignmentTotals {
  vendors: number;
  placed: number;
  sold: number;
  unsold: number;
  unsoldValue: number;
  unsettledAmount: number;
}

export interface ConsignmentPosition {
  _id: string;
  product: string;
  variantId: string | null;
  productName: string;
  variantLabel: string;
  code: string;
  rate: number;
  qtyIn: number;
  qtyReturned: number;
  qtySettled: number;
  placed: number;
  sold: number;
  unsettled: number;
  unsettledAmount: number;
  overSettled: number;
  unsold: number;
  unsoldValue: number;
  currentStock: number | null;
  firstIntakeAt: string;
  lastIntakeAt: string | null;
  lastSettledAt: string | null;
}

export interface VendorStockSheet {
  vendor: { _id: string; name: string; code?: string; phone?: string; whatsapp?: string; balance: number };
  items: ConsignmentPosition[];
  totals: { placed: number; sold: number; unsold: number; unsoldValue: number; unsettledQty: number; unsettledAmount: number };
  lastSettlement: { settlementNo: string; total: number; createdAt: string } | null;
}

export interface ConsignmentItem {
  _id: string;
  product: string;
  variantId: string | null;
  productName: string;
  variantLabel: string;
  code: string;
  rate: number;
  qty: number;
  amount: number;
  posted: boolean;
}

export interface ConsignmentDoc {
  _id: string;
  consignmentNo: string;
  kind: 'intake' | 'return';
  vendor: string;
  vendorName: string;
  status: 'pending' | 'completed';
  date: string;
  items: ConsignmentItem[];
  totalQty: number;
  totalValue: number;
  notes: string;
  createdByName: string;
  createdAt: string;
}

export interface Settlement {
  _id: string;
  settlementNo: string;
  vendor: string;
  vendorName: string;
  periodFrom: string | null;
  periodTo: string;
  lines: { _id: string; product: string; variantId: string | null; productName: string; variantLabel: string; soldQty: number; rate: number; amount: number }[];
  totalQty: number;
  total: number;
  paidAmount: number;
  payment: string | null;
  paymentDoc?: { paymentNo: string; amount: number; method: string; status: string } | null;
  paymentError?: string;
  status: 'active' | 'voided';
  voidReason: string;
  notes: string;
  createdByName: string;
  createdAt: string;
}

export interface PayNowInput {
  amount: number;
  method: PaymentMethod;
  bankId?: string | null;
  reference?: string;
}

type ListParams = Record<string, string | number | boolean | undefined | null>;

export interface Paged<T, S = undefined> {
  data: T;
  meta: PageMeta & { summary?: S };
}

const paged = <T, S = undefined>(res: { data: T; meta?: PageMeta & Record<string, unknown> }): Paged<T, S> => ({
  data: res.data,
  meta: (res.meta || { page: 1, limit: 25, total: 0, pages: 1 }) as PageMeta & { summary?: S },
});

/* ------------------------------------------------------------------ calls */

export const vendorApi = {
  // Vendors
  async list(params: ListParams) {
    return paged<Vendor[], VendorSummary>(await storeApi.get<Vendor[]>('/vendors', params));
  },
  async get(id: string) {
    return (await storeApi.get<VendorDetail>(`/vendors/${id}`)).data;
  },
  async create(body: VendorPayload) {
    return (await storeApi.post<VendorDetail>('/vendors', body)).data;
  },
  async update(id: string, body: Partial<VendorPayload>) {
    return (await storeApi.put<VendorDetail>(`/vendors/${id}`, body)).data;
  },
  async setActive(id: string, isActive: boolean) {
    return (await storeApi.patch<VendorDetail>(`/vendors/${id}/status`, { isActive })).data;
  },
  async remove(id: string) {
    await storeApi.del(`/vendors/${id}`);
  },
  async statement(id: string, params: { from?: string; to?: string }) {
    return (await storeApi.get<Statement>(`/vendors/${id}/ledger`, params)).data;
  },
  /** Downloads the statement CSV (needs vendors → export). */
  async downloadStatement(id: string, params: { from?: string; to?: string }, filename = 'vendor-ledger.csv') {
    const res = await axios.get(`${API_URL}/vendors/${id}/ledger/export`, {
      params: Object.fromEntries(Object.entries(params).filter(([, v]) => v)),
      headers: getAuthHeader(),
      responseType: 'blob',
    });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    const disposition = String(res.headers['content-disposition'] || '');
    const m = /filename="([^"]+)"/.exec(disposition);
    a.href = url;
    a.download = m ? m[1] : filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  async products(id: string, params: ListParams) {
    return paged<BoughtProduct[], { products: number; pieces: number; value: number }>(
      await storeApi.get<BoughtProduct[]>(`/vendors/${id}/products`, params),
    );
  },
  async adjust(id: string, body: { direction: 'credit' | 'debit'; amount: number; reason: string; date?: string }) {
    return (await storeApi.post(`/vendors/${id}/adjustments`, body)).data;
  },
  async voidEntry(id: string, entryId: string, reason: string) {
    return (await storeApi.post(`/vendors/${id}/ledger/${entryId}/void`, { reason })).data;
  },
  async searchProducts(params: { search?: string; productId?: string; vendorId?: string | null; consignmentOnly?: boolean; limit?: number }) {
    return (await storeApi.get<LookupProduct[]>('/vendor-products/search', params)).data;
  },

  // Payments
  async payments(params: ListParams) {
    return paged<VendorPayment[], PaymentSummary>(await storeApi.get<VendorPayment[]>('/vendor-payments', params));
  },
  async recordPayment(body: {
    vendorId: string;
    amount: number;
    method: PaymentMethod;
    bankId?: string | null;
    reference?: string;
    date?: string;
    notes?: string;
    photos?: File[];
  }) {
    const form = new FormData();
    form.append('vendorId', body.vendorId);
    form.append('amount', String(body.amount));
    form.append('method', body.method);
    if (body.bankId) form.append('bankId', body.bankId);
    if (body.reference) form.append('reference', body.reference);
    if (body.date) form.append('date', body.date);
    if (body.notes) form.append('notes', body.notes);
    (body.photos || []).forEach((f) => form.append('attachments', f));
    return (await storeApi.upload<VendorPayment>('/vendor-payments', form)).data;
  },
  async voidPayment(id: string, reason: string) {
    return (await storeApi.post<VendorPayment>(`/vendor-payments/${id}/void`, { reason })).data;
  },
  async banks() {
    return (await storeApi.get<BankOption[]>('/vendor-payments/banks')).data;
  },

  // Returns
  async returns(params: ListParams) {
    return paged<VendorReturn[], Record<'completed' | 'draft' | 'cancelled', { count: number; total: number; qty: number }>>(
      await storeApi.get<VendorReturn[]>('/vendor-returns', params),
    );
  },
  async getReturn(id: string) {
    return (await storeApi.get<VendorReturn>(`/vendor-returns/${id}`)).data;
  },
  async createReturn(body: { vendorId: string; lines: ReturnLineInput[]; notes?: string; date?: string }) {
    return (await storeApi.post<VendorReturn>('/vendor-returns', body)).data;
  },
  async updateReturn(id: string, body: { vendorId?: string; lines?: ReturnLineInput[]; notes?: string }) {
    return (await storeApi.put<VendorReturn>(`/vendor-returns/${id}`, body)).data;
  },
  async completeReturn(id: string) {
    return (await storeApi.post<VendorReturn>(`/vendor-returns/${id}/complete`)).data;
  },
  async cancelReturn(id: string, reason: string) {
    return (await storeApi.post<VendorReturn>(`/vendor-returns/${id}/cancel`, { reason })).data;
  },

  // Consignment
  async consignmentSummary() {
    const res = await storeApi.get<ConsignmentVendorRow[]>('/consignments/summary');
    return { data: res.data, totals: (res.meta as unknown as { totals: ConsignmentTotals })?.totals };
  },
  async vendorStock(vendorId: string) {
    return (await storeApi.get<VendorStockSheet>(`/consignments/vendors/${vendorId}/stock`)).data;
  },
  async consignments(params: ListParams) {
    return paged<ConsignmentDoc[]>(await storeApi.get<ConsignmentDoc[]>('/consignments', params));
  },
  async intake(body: { vendorId: string; items: { productId: string; variantId: string | null; rate: number; qty: number }[]; notes?: string }) {
    return (await storeApi.post<ConsignmentDoc>('/consignments', body)).data;
  },
  async giveBack(body: { vendorId: string; items: { productId: string; variantId: string | null; qty: number }[]; notes?: string }) {
    return (await storeApi.post<ConsignmentDoc>('/consignments/returns', body)).data;
  },
  async retryConsignment(id: string) {
    return (await storeApi.post<ConsignmentDoc>(`/consignments/${id}/post`)).data;
  },
  async settlements(params: ListParams) {
    return paged<Settlement[], { total: number; paid: number; count: number }>(await storeApi.get<Settlement[]>('/consignments/settlements', params));
  },
  async settle(body: { vendorId: string; lines?: { productId: string; variantId: string | null; soldQty: number }[]; notes?: string; payNow?: PayNowInput | null }) {
    return (await storeApi.post<Settlement>('/consignments/settlements', body)).data;
  },
  async voidSettlement(id: string, reason: string) {
    return (await storeApi.post<Settlement>(`/consignments/settlements/${id}/void`, { reason })).data;
  },
};

/** Today's date as YYYY-MM-DD in the shop's time zone (Pakistan, UTC+5). */
export function pkToday(offsetDays = 0): string {
  return new Date(Date.now() + 5 * 3600 * 1000 + offsetDays * 86400000).toISOString().slice(0, 10);
}
