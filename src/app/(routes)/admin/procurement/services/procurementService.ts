import { getAuthHeader } from '@/helper/helper';

const API = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

export interface Vendor {
  _id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  category: string;
  address?: { street?: string; city?: string; state?: string; country?: string; postalCode?: string };
  notes: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  totalPurchases?: number;
  totalPaid?: number;
  totalPending?: number;
  purchaseCount?: number;
  overdueCount?: number;
}

export interface PurchaseItem {
  _id?: string;
  productId?: string | null;
  productName?: string;
  productSku?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Payment {
  _id?: string;
  amount: number;
  paymentMethod: 'cash' | 'bank' | 'card' | 'cheque' | 'other';
  paymentDate: string;
  reference?: string;
  notes?: string;
  createdAt?: string;
}

export interface Purchase {
  _id: string;
  vendorId: string;
  vendorName: string;
  invoiceNumber: string;
  purchaseDate: string;
  dueDate?: string | null;
  items: PurchaseItem[];
  subtotal: number;
  taxPercent: number;
  taxAmount: number;
  discount: number;
  total: number;
  paidAmount: number;
  pendingAmount: number;
  paymentStatus: 'pending' | 'partial' | 'paid' | 'overdue';
  payments?: Payment[];
  notes: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface ProcurementProduct {
  _id: string;
  name: string;
  slug?: string;
  sku?: string;
  category?: string;
  price?: number;
  discountedPrice?: number;
  costPrice?: number;
  stock?: number;
  thumbnailUrl?: string;
  productType?: 'single' | 'variant';
}

export interface Summary {
  vendorCount: number;
  purchaseCount: number;
  totalAmount: number;
  totalPaid: number;
  totalPending: number;
  byStatus: Record<'pending' | 'partial' | 'paid' | 'overdue', number>;
  pendingByStatus: Record<'pending' | 'partial' | 'paid' | 'overdue', number>;
}

const BASE = `${API}/admin/procurement`;

const json = async <T>(res: Response): Promise<T> => {
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      msg = body?.message || msg;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
};

const req = (path: string, init: RequestInit = {}) =>
  fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...getAuthHeader(),
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });

export const procurementService = {
  // Summary
  getSummary: () => req('/summary').then((r) => json<{ data: Summary }>(r)).then((j) => j.data),

  // Dedicated, lightweight product typeahead for line items.
  searchProducts: (q: string, limit = 8) => {
    const params = new URLSearchParams({ q, limit: String(limit) });
    return req(`/products/search?${params.toString()}`)
      .then((r) => json<{ data: ProcurementProduct[] }>(r))
      .then((j) => j.data);
  },

  // Vendors
  listVendors: (params: Record<string, string | number | undefined> = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '' && v !== null) q.set(k, String(v));
    });
    return req(`/vendors?${q.toString()}`)
      .then((r) => json<{ data: Vendor[]; pagination: Pagination }>(r));
  },
  getVendor: (id: string) => req(`/vendors/${id}`).then((r) => json<{ data: Vendor }>(r)).then((j) => j.data),
  createVendor: (payload: Partial<Vendor>) =>
    req('/vendors', { method: 'POST', body: JSON.stringify(payload) }).then((r) => json<{ data: Vendor }>(r)).then((j) => j.data),
  updateVendor: (id: string, payload: Partial<Vendor>) =>
    req(`/vendors/${id}`, { method: 'PUT', body: JSON.stringify(payload) }).then((r) => json<{ data: Vendor }>(r)).then((j) => j.data),
  toggleVendorStatus: (id: string) =>
    req(`/vendors/${id}/status`, { method: 'PUT' }).then((r) => json<{ data: Vendor }>(r)).then((j) => j.data),
  deleteVendor: (id: string) =>
    req(`/vendors/${id}`, { method: 'DELETE' }).then((r) => json<{ message: string }>(r)),
  vendorLedger: (id: string) =>
    req(`/vendors/${id}/ledger`).then((r) => json<{ data: { vendor: Vendor; entries: Array<Record<string, unknown>>; balance: number } }>(r)).then((j) => j.data),

  // Purchases
  listPurchases: (params: Record<string, string | number | undefined> = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '' && v !== null) q.set(k, String(v));
    });
    return req(`/purchases?${q.toString()}`).then((r) =>
      json<{
        data: Purchase[];
        pagination: Pagination;
        totals: { amount: number; paid: number; pending: number };
      }>(r)
    );
  },
  getPurchase: (id: string) =>
    req(`/purchases/${id}`).then((r) => json<{ data: Purchase }>(r)).then((j) => j.data),
  createPurchase: (payload: Partial<Purchase>) =>
    req('/purchases', { method: 'POST', body: JSON.stringify(payload) }).then((r) => json<{ data: Purchase }>(r)).then((j) => j.data),
  updatePurchase: (id: string, payload: Partial<Purchase>) =>
    req(`/purchases/${id}`, { method: 'PUT', body: JSON.stringify(payload) }).then((r) => json<{ data: Purchase }>(r)).then((j) => j.data),
  deletePurchase: (id: string) =>
    req(`/purchases/${id}`, { method: 'DELETE' }).then((r) => json<{ message: string }>(r)),
  listTransactions: (params: Record<string, string | number | undefined> = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '' && v !== null) q.set(k, String(v));
    });
    return req(`/transactions?${q.toString()}`).then((r) =>
      json<{
        data: Array<{
          paymentId: string;
          purchaseId: string;
          invoiceNumber: string;
          vendorName: string;
          vendorId?: string;
          invoiceTotal: number;
          amount: number;
          paymentMethod: 'cash' | 'bank' | 'card' | 'cheque' | 'other';
          paymentDate: string;
          reference: string;
          notes: string;
        }>;
        summary: { count: number; total: number; cash: number; bank: number; other: number };
        pagination?: { page: number; limit: number; total: number; pages: number };
      }>(r)
    );
  },
  addPayment: (purchaseId: string, payment: Partial<Payment>) =>
    req(`/purchases/${purchaseId}/payments`, { method: 'POST', body: JSON.stringify(payment) }).then((r) =>
      json<{ data: Purchase }>(r)
    ).then((j) => j.data),
  removePayment: (purchaseId: string, paymentId: string) =>
    req(`/purchases/${purchaseId}/payments/${paymentId}`, { method: 'DELETE' }).then((r) =>
      json<{ data: Purchase }>(r)
    ).then((j) => j.data),
};
