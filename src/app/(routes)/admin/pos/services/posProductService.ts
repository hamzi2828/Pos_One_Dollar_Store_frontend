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
  limit?: number
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

/**
 * Get product by barcode
 */
export async function getProductByBarcode(barcode: string): Promise<POSProduct | null> {
  if (!API_BASE_URL) {
    throw new Error("Missing NEXT_PUBLIC_BACKEND_URL");
  }

  const url = `${API_BASE_URL}/api/pos/products/barcode/${barcode}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
  });

  if (!res.ok) {
    return null;
  }

  const response = await res.json();
  return response.data || null;
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
