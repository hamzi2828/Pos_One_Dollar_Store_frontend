// POS Cart Service (Hold/Retrieve carts via API)
import { getAuthHeader } from "@/helper/helper";
import { HeldCart, POSCart } from "../types";

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

interface ApiHeldItem {
  _id?: string;
  product?: string;
  productName?: string;
  productThumbnail?: string;
  unitPrice: number;
  originalPrice?: number;
  variantId?: string;
  quantity: number;
  discount?: number;
  subtotal: number;
  color?: string;
  size?: string;
  isLabour?: boolean;
  labourDescription?: string;
  isOutsource?: boolean;
  outsourceDescription?: string;
  costPrice?: number;
}

interface ApiHeldOrder {
  _id: string;
  items: ApiHeldItem[];
  subtotal: number;
  tax: number;
  taxRate?: number;
  appliedTaxes?: HeldCart['cart']['appliedTaxes'];
  discount: number;
  discountType?: 'fixed' | 'percentage' | null;
  discountReason?: string;
  total: number;
  customer?: string;
  customerInfo?: {
    _id?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    customerType?: 'online' | 'walk-in';
    source?: 'facebook' | 'tiktok' | 'instagram' | 'word-of-mouth' | '';
  };
  customerName?: string;
  heldByName?: string;
  createdAt: string;
}

/**
 * Transform API held order to frontend HeldCart format
 */
function transformToHeldCart(apiOrder: ApiHeldOrder): HeldCart {
  return {
    id: apiOrder._id,
    cart: {
      items: apiOrder.items.map((item): HeldCart['cart']['items'][number] => ({
        id: item._id || item.product || Date.now().toString(),
        product: {
          _id: item.product || '',
          name: item.productName || '',
          thumbnailUrl: item.productThumbnail,
          price: item.unitPrice,
          stock: 999,
          category: '',
          slug: '',
          productType: 'single' as const,
        },
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        originalPrice: item.originalPrice,
        discount: item.discount || 0,
        subtotal: item.subtotal,
        color: item.color,
        size: item.size,
        isLabour: item.isLabour,
        labourDescription: item.labourDescription,
        isOutsource: item.isOutsource,
        outsourceDescription: item.outsourceDescription,
        costPrice: item.costPrice,
      })),
      subtotal: apiOrder.subtotal,
      tax: apiOrder.tax,
      taxRate: apiOrder.taxRate || 0,
      appliedTaxes: apiOrder.appliedTaxes || [],
      discount: apiOrder.discount,
      discountType: apiOrder.discountType,
      discountReason: apiOrder.discountReason,
      total: apiOrder.total,
      customer: apiOrder.customerInfo ? {
        _id: apiOrder.customerInfo._id || apiOrder.customer || '',
        firstName: apiOrder.customerInfo.firstName || '',
        lastName: apiOrder.customerInfo.lastName || '',
        phone: apiOrder.customerInfo.phone,
        customerType: apiOrder.customerInfo.customerType,
        source: apiOrder.customerInfo.source,
      } : undefined,
    },
    heldAt: apiOrder.createdAt,
    heldBy: apiOrder.heldByName || 'Unknown',
    customerName: apiOrder.customerName,
  };
}

/**
 * Hold a cart (save to database)
 */
export async function holdCart(cart: POSCart, customerName?: string): Promise<HeldCart> {
  if (!API_BASE_URL) {
    throw new Error("Missing NEXT_PUBLIC_BACKEND_URL");
  }

  const response = await fetch(`${API_BASE_URL}/api/pos/held-orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify({
      cart,
      customerName,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to hold order' }));
    throw new Error(error.message || 'Failed to hold order');
  }

  const data = await response.json();
  return transformToHeldCart(data.data);
}

/**
 * Get all held carts
 */
export async function getHeldCarts(): Promise<HeldCart[]> {
  if (typeof window === 'undefined') {
    return [];
  }

  if (!API_BASE_URL) {
    console.error("Missing NEXT_PUBLIC_BACKEND_URL");
    return [];
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/pos/held-orders`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch held orders');
    }

    const data = await response.json();
    return (data.data || []).map(transformToHeldCart);
  } catch (error) {
    console.error('Error fetching held carts:', error);
    return [];
  }
}

/**
 * Retrieve and remove a held cart
 */
export async function retrieveHeldCart(id: string): Promise<HeldCart | null> {
  if (!API_BASE_URL) {
    throw new Error("Missing NEXT_PUBLIC_BACKEND_URL");
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/pos/held-orders/${id}/retrieve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
    });

    if (!response.ok) {
      throw new Error('Failed to retrieve held order');
    }

    const data = await response.json();
    return transformToHeldCart(data.data);
  } catch (error) {
    console.error('Error retrieving held cart:', error);
    return null;
  }
}

/**
 * Clear a specific held cart
 */
export async function clearHeldCart(id: string): Promise<void> {
  if (!API_BASE_URL) {
    throw new Error("Missing NEXT_PUBLIC_BACKEND_URL");
  }

  const response = await fetch(`${API_BASE_URL}/api/pos/held-orders/${id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to delete held order' }));
    throw new Error(error.message || 'Failed to delete held order');
  }
}

/**
 * Clear all held carts
 */
export async function clearAllHeldCarts(): Promise<void> {
  if (!API_BASE_URL) {
    throw new Error("Missing NEXT_PUBLIC_BACKEND_URL");
  }

  const response = await fetch(`${API_BASE_URL}/api/pos/held-orders`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to clear held orders' }));
    throw new Error(error.message || 'Failed to clear held orders');
  }
}
