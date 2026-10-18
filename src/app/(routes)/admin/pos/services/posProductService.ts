// POS Product Service
import { getAuthHeader } from "@/helper/helper";
import { GetProductsResponse, POSProduct } from "../types";

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

/**
 * Get all products for POS (published products with stock)
 */
export async function getPOSProducts(
  search?: string,
  category?: string,
  limit?: number,
  signal?: AbortSignal
): Promise<POSProduct[]> {
  if (!API_BASE_URL) {
    throw new Error("Missing NEXT_PUBLIC_BACKEND_URL");
  }

  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (category) params.append('category', category);
  if (limit) params.append('limit', limit.toString());

  const url = `${API_BASE_URL}/api/pos/products${params.toString() ? `?${params.toString()}` : ''}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    cache: 'no-store',
    signal,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Failed to fetch products' }));
    throw new Error(error.message || 'Failed to fetch products');
  }

  const response: GetProductsResponse = await res.json();
  return response.data || [];
}

/**
 * Search products by name, SKU, or barcode
 */
export async function searchProducts(searchTerm: string): Promise<POSProduct[]> {
  return getPOSProducts(searchTerm);
}

/** What a scanned / typed code means (GET /api/pos/products/barcode/:code `match`). */
export interface ScanMatch {
  variantId: string | null;
  batchNo: string | null;
  /** Pieces one scan sells (a full-box code = pieces per box). */
  qty: number;
  kind: string;
  code: string;
  variantLabel: string;
  available: number;
  price: number;
  shelfCodes: string[];
  location?: { shelves: { code: string; qty: number; isHome: boolean }[]; shelved: number; warehouse: number } | null;
}

export type ScanResult =
  | { ok: true; product: POSProduct; match: ScanMatch }
  | { ok: false; status: number; message: string; product?: POSProduct; match?: ScanMatch };

/**
 * Look up a scanned / typed code (barcode, short code, box code, batch code, SKU).
 * 404 = no such code; 400 = found but out of stock (message says so).
 */
export async function getProductByBarcode(barcode: string, signal?: AbortSignal): Promise<ScanResult> {
  if (!API_BASE_URL) {
    throw new Error("Missing NEXT_PUBLIC_BACKEND_URL");
  }

  const url = `${API_BASE_URL}/api/pos/products/barcode/${encodeURIComponent(barcode)}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    cache: 'no-store',
    signal,
  });

  const body = await res.json().catch(() => ({}));
  if (res.ok && body.data) return { ok: true, product: body.data, match: body.match };
  return {
    ok: false,
    status: res.status,
    message: body.message || (res.status === 404 ? 'Product not found' : 'Could not read this code'),
    product: body.data,
    match: body.match,
  };
}

/**
 * Get all categories
 */
export async function getCategories(): Promise<string[]> {
  if (!API_BASE_URL) {
    throw new Error("Missing NEXT_PUBLIC_BACKEND_URL");
  }

  const url = `${API_BASE_URL}/api/pos/categories`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
  });

  if (!res.ok) {
    return [];
  }

  const response = await res.json();
  return response.data || [];
}
