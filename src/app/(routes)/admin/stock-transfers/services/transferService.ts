import axios from 'axios';
import { getAuthHeader } from '@/helper/helper';
import { BRANCH_HEADER } from '@/helper/access';
import { cleanParams } from '@/helper/pagination';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const TRANSFERS_URL = `${API_BASE_URL}/admin/stock-transfers`;

export interface TransferBranchRef {
  _id: string;
  name: string;
  code?: string;
  isMain?: boolean;
}

export interface TransferItem {
  product: string;
  productName: string;
  variantId?: string | null;
  variantLabel?: string;
  sku?: string;
  quantity: number;
  batchNo?: string | null;
  allocations?: { batchNo?: string; quantity?: number }[];
  status?: 'done' | 'failed';
  error?: string;
}

export interface StockTransfer {
  _id: string;
  transferNo: string;
  fromBranch: TransferBranchRef | null;
  toBranch: TransferBranchRef | null;
  items: TransferItem[];
  note?: string;
  status: 'completed' | 'partial' | 'failed';
  totalQuantity?: number;
  createdBy?: { _id: string; firstName?: string; lastName?: string; email?: string } | null;
  createdAt: string;
}

export interface TransferListParams {
  search?: string;
  status?: string;
  from?: string;
  to?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface TransferListResult {
  items: StockTransfer[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}

export interface CreateTransferPayload {
  fromBranchId: string;
  toBranchId: string;
  note?: string;
  items: { productId: string; variantId?: string; quantity: number; batchNo?: string }[];
}

export interface CreateTransferResult {
  success: boolean;
  message: string;
  data?: StockTransfer;
  errors?: { index: number; productId: string; variantId?: string | null; message: string }[];
}

/* ---- product lookups (stock as seen from one branch) ---- */

export interface BranchBatch {
  _id?: string;
  batchNo: string;
  quantity: number;
  expiryDate?: string;
  branch?: string | null;
}

export interface BranchVariant {
  _id?: string;
  variantId: string;
  color?: string;
  size?: string;
  attributes?: Record<string, string>;
  sku?: string;
  stock: number;
  batches?: BranchBatch[];
}

export interface BranchProduct {
  _id: string;
  name: string;
  sku?: string;
  productType?: 'single' | 'variant';
  stock: number;
  totalStock?: number;
  images?: string[];
  variants?: BranchVariant[];
  batches?: BranchBatch[];
}

export const variantText = (v: BranchVariant | null | undefined): string => {
  if (!v) return '';
  const parts: string[] = [];
  if (v.color) parts.push(v.color);
  if (v.size) parts.push(v.size);
  if (v.attributes && typeof v.attributes === 'object') parts.push(...Object.values(v.attributes).filter(Boolean));
  return parts.join(' / ') || v.sku || v.variantId;
};

const headers = (branchId?: string | null): Record<string, string> => {
  const h: Record<string, string> = { 'Content-Type': 'application/json', ...getAuthHeader() };
  if (branchId) h[BRANCH_HEADER] = branchId;
  return h;
};

export const transferService = {
  async list(params: TransferListParams = {}): Promise<TransferListResult> {
    const response = await axios.get(TRANSFERS_URL, { headers: headers(), params: cleanParams(params) });
    const p = response.data?.pagination || {};
    return {
      items: response.data?.data ?? [],
      pagination: { total: p.total || 0, page: p.page || 1, limit: p.limit || 20, totalPages: p.totalPages || 1 },
    };
  },

  async getById(id: string): Promise<StockTransfer> {
    const response = await axios.get(`${TRANSFERS_URL}/${id}`, { headers: headers() });
    return response.data?.data;
  },

  /** Returns the backend answer for 201 (completed / partial) AND 400 "Nothing was transferred". */
  async create(payload: CreateTransferPayload): Promise<CreateTransferResult> {
    try {
      const response = await axios.post(TRANSFERS_URL, payload, { headers: headers() });
      return response.data;
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.data?.data && Array.isArray(e.response.data.errors)) {
        return e.response.data as CreateTransferResult;
      }
      throw e;
    }
  },

  /**
   * Search products with the stock of `branchId` (the FROM branch).
   * Uses the POS search (only products with stock there); staff without the POS
   * permission fall back to the catalogue search (stock is loaded on pick).
   */
  async searchProducts(search: string, branchId: string): Promise<{ items: BranchProduct[]; branchStock: boolean }> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/pos/products`, {
        headers: headers(branchId),
        params: { search, limit: 20 },
      });
      return { items: response.data?.data ?? [], branchStock: true };
    } catch (e) {
      if (!(axios.isAxiosError(e) && e.response?.status === 403)) throw e;
      const response = await axios.get(`${API_BASE_URL}/products`, {
        headers: headers(branchId),
        params: { search, limit: 20 },
      });
      return { items: response.data?.data ?? [], branchStock: false };
    }
  },

  /** One product with `stock` / variants / batches of `branchId`. */
  async getProduct(productId: string, branchId: string): Promise<BranchProduct> {
    const response = await axios.get(`${API_BASE_URL}/products/${productId}`, { headers: headers(branchId) });
    return response.data?.data;
  },

  /** Scanned code (barcode / short code / batch code) -> product + which variant/batch it means. */
  async lookupCode(
    code: string,
    branchId: string,
  ): Promise<{ product: BranchProduct; match: { variantId?: string | null; batchNo?: string | null; qty?: number } } | null> {
    try {
      const response = await axios.get(`${API_BASE_URL}/products/codes/lookup/${encodeURIComponent(code)}`, {
        headers: headers(branchId),
      });
      if (!response.data?.data) return null;
      return { product: response.data.data, match: response.data.match || {} };
    } catch (e) {
      if (axios.isAxiosError(e) && (e.response?.status === 404 || e.response?.status === 403)) return null;
      throw e;
    }
  },
};
