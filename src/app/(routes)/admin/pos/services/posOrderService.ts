// POS Order Service
import { getAuthHeader } from "@/helper/helper";
import { CreateOrderResponse, POSOrder, POSOrderData, PendingOrdersResponse, AddPaymentRequest, CartQuote, ManualDiscount, WhatsAppStatus } from "../types";

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

/** API error with the server's `code` (e.g. TILL_NOT_OPEN, DISCOUNT_LIMIT, TOTAL_CHANGED) and body data. */
export class POSApiError extends Error {
  status: number;
  code?: string;
  data?: unknown;
  constructor(message: string, status: number, code?: string, data?: unknown) {
    super(message);
    this.name = 'POSApiError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

async function readError(res: Response, fallback: string): Promise<POSApiError> {
  const body = await res.json().catch(() => ({} as Record<string, unknown>));
  const message = (body && (body.message as string)) || fallback;
  return new POSApiError(message, res.status, body?.code as string | undefined, body?.data);
}

/** Cart lines as the server wants them for /quote and /orders (it prices them itself). */
export interface QuoteRequest {
  items: POSOrderData['items'];
  manualDiscount?: ManualDiscount | null;
  taxIds?: string[];
}

/**
 * Price the cart on the server (same maths as the sale).
 * Throws POSApiError (403 DISCOUNT_LIMIT / PRICE_EDIT_NOT_ALLOWED / GIFT_NOT_ALLOWED ...).
 */
export async function quoteCart(body: QuoteRequest, signal?: AbortSignal): Promise<CartQuote> {
  if (!API_BASE_URL) throw new Error("Missing NEXT_PUBLIC_BACKEND_URL");
  const res = await fetch(`${API_BASE_URL}/api/pos/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw await readError(res, 'Could not price the cart');
  const json = await res.json();
  return json.data as CartQuote;
}

/** Send the order's slip to the WhatsApp group again. */
export async function resendOrderWhatsapp(orderId: string): Promise<{ queued: boolean; reason?: string; whatsappStatus: WhatsAppStatus; message: string }> {
  if (!API_BASE_URL) throw new Error("Missing NEXT_PUBLIC_BACKEND_URL");
  const res = await fetch(`${API_BASE_URL}/api/pos/orders/${orderId}/whatsapp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
  });
  if (!res.ok) throw await readError(res, 'Could not send the slip');
  const json = await res.json();
  return { ...json.data, message: json.message };
}

/** Refund an order (stock goes back once). */
export async function refundPOSOrder(orderId: string, reason?: string): Promise<POSOrder> {
  if (!API_BASE_URL) throw new Error("Missing NEXT_PUBLIC_BACKEND_URL");
  const res = await fetch(`${API_BASE_URL}/api/pos/orders/${orderId}/refund`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw await readError(res, 'Could not refund the order');
  const json = await res.json();
  return json.data as POSOrder;
}

/**
 * Create a POS order
 */
export async function createPOSOrder(orderData: POSOrderData): Promise<POSOrder> {
  if (!API_BASE_URL) {
    throw new Error("Missing NEXT_PUBLIC_BACKEND_URL");
  }

  const url = `${API_BASE_URL}/api/pos/orders`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify(orderData),
  });

  if (!res.ok) throw await readError(res, 'Failed to create order');

  const response: CreateOrderResponse = await res.json();
  if (!response.data) {
    throw new Error('Invalid response from server');
  }
  return response.data;
}

/**
 * Get POS orders (today's orders by default)
 * Supports server-side pagination + AbortSignal for canceling stale requests.
 */
export async function getPOSOrders(
  date?: string,
  limit?: number,
  startDate?: string,
  endDate?: string,
  paymentMethod?: string,
  orderType?: string,
  page?: number,
  search?: string,
  signal?: AbortSignal,
): Promise<{
  orders: POSOrder[];
  total: number;
  pages: number;
  page: number;
  limit: number;
  summary?: { totalOrders: number; totalSales: number; totalPaid: number; totalPending: number };
}> {
  if (!API_BASE_URL) {
    throw new Error("Missing NEXT_PUBLIC_BACKEND_URL");
  }

  const params = new URLSearchParams();
  if (date) params.append('date', date);
  if (limit) params.append('limit', limit.toString());
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  if (paymentMethod) params.append('paymentMethod', paymentMethod);
  if (orderType) params.append('orderType', orderType);
  if (page) params.append('page', page.toString());
  if (search) params.append('search', search);

  const url = `${API_BASE_URL}/api/pos/orders${params.toString() ? `?${params.toString()}` : ''}`;

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
    const error = await res.json().catch(() => ({ message: 'Failed to fetch orders' }));
    throw new Error(error.message || 'Failed to fetch orders');
  }

  const response = await res.json();
  const pg = response.pagination || {};
  return {
    orders: response.data || [],
    total: pg.total ?? (response.data?.length || 0),
    pages: pg.pages ?? 1,
    page: pg.page ?? 1,
    limit: pg.limit ?? (limit || 25),
    summary: response.summary,
  };
}

/**
 * Get order by ID
 */
export async function getOrderById(orderId: string): Promise<POSOrder | null> {
  if (!API_BASE_URL) {
    throw new Error("Missing NEXT_PUBLIC_BACKEND_URL");
  }

  const url = `${API_BASE_URL}/api/pos/orders/${orderId}`;

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

// Alias for clarity
export const getPOSOrderById = getOrderById;

/**
 * Soft-delete a POS order
 */
export async function deletePOSOrder(orderId: string): Promise<void> {
  if (!API_BASE_URL) throw new Error("Missing NEXT_PUBLIC_BACKEND_URL");
  const res = await fetch(`${API_BASE_URL}/api/pos/orders/${orderId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to delete order' }));
    throw new Error(err.message || 'Failed to delete order');
  }
}

/**
 * Get store settings
 */
export async function getSettings(): Promise<{ currency: string; storeName: string } | null> {
  if (!API_BASE_URL) {
    return null;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/settings`, {
      headers: getAuthHeader(),
    });

    if (res.ok) {
      const data = await res.json();
      return data.data || null;
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }

  return null;
}

/**
 * Get pending payment orders
 */
export async function getPendingOrders(customerId?: string): Promise<PendingOrdersResponse> {
  if (!API_BASE_URL) {
    throw new Error("Missing NEXT_PUBLIC_BACKEND_URL");
  }

  const params = new URLSearchParams();
  if (customerId) params.append('customerId', customerId);

  const url = `${API_BASE_URL}/api/pos/orders/pending${params.toString() ? `?${params.toString()}` : ''}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Failed to fetch pending orders' }));
    throw new Error(error.message || 'Failed to fetch pending orders');
  }

  const response: PendingOrdersResponse = await res.json();
  return response;
}

/**
 * Add payment to an existing order
 */
export async function addPaymentToOrder(
  orderId: string,
  paymentData: AddPaymentRequest
): Promise<POSOrder> {
  if (!API_BASE_URL) {
    throw new Error("Missing NEXT_PUBLIC_BACKEND_URL");
  }

  const url = `${API_BASE_URL}/api/pos/orders/${orderId}/payment`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify(paymentData),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Failed to add payment' }));
    throw new Error(error.message || 'Failed to add payment');
  }

  const response = await res.json();
  if (!response.data) {
    throw new Error('Invalid response from server');
  }
  return response.data;
}
