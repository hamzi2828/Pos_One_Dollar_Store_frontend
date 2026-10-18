// API calls of the Purchasing module (backend routes: pos_backend/src/routes/modules/purchasingRoutes.js).
import { storeApi, BACKEND_URL } from '@/lib/storeApi';
import type {
  Costing,
  GoodsReceipt,
  GRNListRow,
  POListMeta,
  POMeta,
  ProductUnit,
  PurchaseOrder,
  VendorOption,
} from './types';

const PO = '/purchase-orders';
const GRN = '/receiving';

export interface ItemInput {
  productId: string;
  variantId?: string | null;
  qty?: number;
  boxes?: number;
  loosePieces?: number;
  unitPrice?: number;
  boxPrice?: number; // price per box (server divides by pieces per box)
  discount?: number;
}

export interface BillFields {
  vendorId?: string;
  billNo?: string;
  billDate?: string;
  cartons?: number;
  discount?: number;
  notes?: string;
}

/** FormData for bill / builty uploads (arrays sent as JSON). */
const toForm = (fields: Record<string, unknown>, photos: File[] = []) => {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null) continue;
    form.append(k, Array.isArray(v) || typeof v === 'object' ? JSON.stringify(v) : String(v));
  }
  photos.forEach((f) => form.append('photos', f));
  return form;
};

export const purchasingApi = {
  meta: () => storeApi.get<POMeta>(`${PO}/meta`).then((r) => r.data),
  searchProducts: (search: string) => storeApi.get<ProductUnit[]>(`${PO}/product-search`, { search, limit: 15 }).then((r) => r.data),
  productsByIds: (ids: string[]) => storeApi.get<ProductUnit[]>(`${PO}/product-search`, { ids: ids.join(',') }).then((r) => r.data),
  /** Vendors module contract (§6): GET /api/vendors?search=&isActive=true */
  searchVendors: (search: string) =>
    storeApi.get<VendorOption[]>('/vendors', { search, isActive: true, limit: 15 }).then((r) => r.data || []),

  list: (params: Record<string, string | number | undefined>) =>
    storeApi.get<PurchaseOrder[]>(PO, params).then((r) => ({ data: r.data, meta: r.meta as unknown as POListMeta })),
  get: (id: string) => storeApi.get<PurchaseOrder>(`${PO}/${id}`).then((r) => r.data),
  costing: (id: string) => storeApi.get<Costing>(`${PO}/${id}/costing`).then((r) => r.data),
  create: (body: { notes?: string; expectedArrival?: string; buyerName?: string }) =>
    storeApi.post<PurchaseOrder>(PO, body).then((r) => r.data),
  update: (id: string, body: Record<string, unknown>) => storeApi.put<PurchaseOrder>(`${PO}/${id}`, body).then((r) => r.data),

  addBill: (id: string, fields: BillFields & { items?: ItemInput[] }, photos: File[]) =>
    storeApi.upload<PurchaseOrder>(`${PO}/${id}/bills`, toForm({ ...fields }, photos)).then((r) => r.data),
  updateBill: (id: string, billId: string, fields: BillFields & { removePhotos?: string[] }, photos: File[]) =>
    storeApi.upload<PurchaseOrder>(`${PO}/${id}/bills/${billId}`, toForm({ ...fields }, photos), 'put').then((r) => r.data),
  removeBill: (id: string, billId: string) => storeApi.del<PurchaseOrder>(`${PO}/${id}/bills/${billId}`).then((r) => r.data),
  addItems: (id: string, billId: string, items: ItemInput[]) =>
    storeApi.post<PurchaseOrder>(`${PO}/${id}/bills/${billId}/items`, { items }).then((r) => r.data),
  updateItem: (id: string, billId: string, itemId: string, body: Partial<ItemInput> & { note?: string }) =>
    storeApi.put<PurchaseOrder>(`${PO}/${id}/bills/${billId}/items/${itemId}`, body).then((r) => r.data),
  removeItem: (id: string, billId: string, itemId: string) =>
    storeApi.del<PurchaseOrder>(`${PO}/${id}/bills/${billId}/items/${itemId}`).then((r) => r.data),
  newProduct: (
    id: string,
    billId: string,
    body: { name: string; category: string; salePrice: number; piecesPerBox: number; qty?: number; boxes?: number; unitPrice: number },
  ) => storeApi.post<PurchaseOrder>(`${PO}/${id}/bills/${billId}/new-product`, body).then((r) => r.data),

  addCharge: (id: string, body: { type: string; amount: number; note?: string; paidTo?: string }) =>
    storeApi.post<PurchaseOrder>(`${PO}/${id}/charges`, body).then((r) => r.data),
  removeCharge: (id: string, chargeId: string) => storeApi.del<PurchaseOrder>(`${PO}/${id}/charges/${chargeId}`).then((r) => r.data),

  close: (id: string, fields: { builtyNo?: string; transporter?: string; date?: string; cartons?: number; freight?: number }, photos: File[]) =>
    storeApi.upload<PurchaseOrder>(`${PO}/${id}/close`, toForm(fields, photos)).then((r) => r as typeof r & { grn?: { _id: string; grnNumber: string }; warnings?: string[] }),
  cancel: (id: string, reason: string) => storeApi.post<PurchaseOrder>(`${PO}/${id}/cancel`, { reason }).then((r) => r.data),
  reopen: (id: string, reason: string) => storeApi.post<PurchaseOrder>(`${PO}/${id}/reopen`, { reason }).then((r) => r.data),

  // ----- goods receiving
  grnList: (params: Record<string, string | number | undefined>) =>
    storeApi.get<GRNListRow[]>(GRN, params).then((r) => ({ data: r.data, meta: r.meta as unknown as POListMeta })),
  grnGet: (id: string) => storeApi.get<GoodsReceipt>(`${GRN}/${id}`).then((r) => r.data),
  grnStart: (id: string) => storeApi.post<GoodsReceipt>(`${GRN}/${id}/start`).then((r) => r.data),
  grnSave: (
    id: string,
    body: {
      lines?: { lineId: string; receivedQty?: number; damagedQty?: number; note?: string }[];
      cartonsReceived?: number;
      notes?: string;
      claimFromVendor?: boolean;
    },
  ) => storeApi.put<GoodsReceipt>(`${GRN}/${id}/lines`, body).then((r) => r.data),
  grnScan: (id: string, code: string, damaged: boolean) =>
    storeApi
      .post<GoodsReceipt>(`${GRN}/${id}/scan`, { code, damaged })
      .then((r) => r as typeof r & { scanned?: { productName: string; added: number; receivedQty: number; expectedQty: number }[] }),
  grnPhotos: (id: string, photos: File[]) => storeApi.upload<GoodsReceipt>(`${GRN}/${id}/photos`, toForm({}, photos)).then((r) => r.data),
  grnComplete: (id: string) => storeApi.post<GoodsReceipt>(`${GRN}/${id}/complete`).then((r) => r.data),
};

/** Uploaded file path (/uploads/x.jpg) or blob URL -> absolute URL. */
export const fileUrl = (u: string) => (/^https?:\/\//.test(u) ? u : `${BACKEND_URL.replace(/\/$/, '')}${u}`);

/** "5" -> 5, "" -> 0; never NaN. */
export const toNum = (v: string | number | null | undefined) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
