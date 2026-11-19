// POS Product Service
import { getAuthHeader } from "@/helper/helper";
import { GetProductsResponse, POSProduct } from "../types";
import { fetchWithTimeout, isNetworkError } from "../offline/connectivity";
import { failureKind, perfEvent, serverMsFrom } from "../offline/perfLog";

/** Scan: wait this long, retry once with the longer limit, then give up (offline catalogue takes over). */
const SCAN_TIMEOUTS_MS = [6000, 9000];
/** Product search box: one try. */
const SEARCH_TIMEOUT_MS = 12000;

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

  const t0 = performance.now();
  let res: Response;
  try {
    res = await fetchWithTimeout(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      cache: 'no-store',
      signal,
    }, SEARCH_TIMEOUT_MS);
  } catch (e) {
    if (!signal?.aborted) perfEvent({ kind: 'search', ms: performance.now() - t0, ok: false, outcome: failureKind(e), path: '/api/pos/products' });
    throw e;
  }
  perfEvent({ kind: 'search', ms: performance.now() - t0, serverMs: serverMsFrom(res), ok: res.ok, outcome: res.ok ? 'ok' : `http_${res.status}`, path: '/api/pos/products' });

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
  | { ok: true; product: POSProduct; match: ScanMatch; stockWarning?: string }
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

  const init: RequestInit = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    cache: 'no-store',
    signal,
  };
  // A lookup only reads, so retrying is safe. Stalled connection -> retry once,
  // then throw a network error (the POS page then uses the saved catalogue).
  let res: Response | undefined;
  for (let i = 0; i < SCAN_TIMEOUTS_MS.length; i++) {
    const t0 = performance.now();
    try {
      res = await fetchWithTimeout(url, init, SCAN_TIMEOUTS_MS[i]);
      perfEvent({
        kind: 'scan',
        ms: performance.now() - t0,
        serverMs: serverMsFrom(res),
        ok: res.status < 500,
        outcome: res.status < 500 ? (i > 0 ? 'ok_after_retry' : 'ok') : `http_${res.status}`,
        path: '/api/pos/products/barcode',
        detail: { attempt: i + 1, status: res.status },
      });
      break;
    } catch (e) {
      if (!signal?.aborted) {
        perfEvent({ kind: 'scan', ms: performance.now() - t0, ok: false, outcome: failureKind(e), path: '/api/pos/products/barcode', detail: { attempt: i + 1 } });
      }
      if (i === SCAN_TIMEOUTS_MS.length - 1 || !isNetworkError(e) || signal?.aborted) throw e;
    }
  }
  if (!res) throw new TypeError('Network timeout');

  const body = await res.json().catch(() => ({}));
  if (res.ok && body.data) return { ok: true, product: body.data, match: body.match, stockWarning: body.stockWarning };
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
