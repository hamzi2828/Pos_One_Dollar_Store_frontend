// Cart -> request lines for POST /api/pos/quote and POST /api/pos/orders.
// The server prices every line itself (DB price, landed cost), so a price is
// only sent when the cashier typed one.
import { CartItem, ManualDiscount, POSOrderItem, POSProduct } from '../types';

/** Id prefix of the stand-in product of a manual item. */
export const MANUAL_ID_PREFIX = 'manual-';
export const MANUAL_NAME_MAX = 80;

/** Stand-in product for a manual item (typed name + price, not in the catalog). */
export function manualProduct(id: string, name: string, price: number): POSProduct {
  return {
    _id: `${MANUAL_ID_PREFIX}${id}`,
    name,
    slug: '',
    price,
    stock: 999999, // no stock check
    category: 'Manual',
    productType: 'single',
  };
}

export function cartToOrderItems(items: CartItem[]): POSOrderItem[] {
  return items.map((item) => {
    // Manual item: the server sells it at this price, no stock.
    if (item.isManual) return { manual: true, name: item.product.name, price: item.unitPrice, quantity: item.quantity, sku: '' };
    return {
      sku: item.variant?.sku || item.product.sku || '',
      quantity: item.quantity,
      size: item.size,
      color: item.color,
      product: item.product._id,
      variantId: item.variantId,
      ...(item.priceOverride && !item.isGift ? { priceOverride: true, price: item.unitPrice } : { price: 0 }),
      ...(item.isGift ? { isGift: true, giftReason: item.giftReason || '' } : {}),
      ...(item.scannedCode ? { scannedCode: item.scannedCode } : {}),
      ...(item.batchNo ? { batchNo: item.batchNo } : {}),
    };
  });
}

export interface QuoteInput {
  items: POSOrderItem[];
  manualDiscount: ManualDiscount | null;
  taxIds: string[];
}

/** Everything that changes the bill, in one stable object (drives the debounced quote). */
export function quoteInput(items: CartItem[], manualDiscount: ManualDiscount | null | undefined, taxIds: string[]): QuoteInput {
  return {
    items: cartToOrderItems(items),
    manualDiscount: manualDiscount && manualDiscount.value > 0 ? manualDiscount : null,
    taxIds: [...taxIds].sort(),
  };
}

/** Cart line id for a gift line of the same unit (kept apart from the paid line). */
export const giftLineId = (id: string) => (id.endsWith(':gift') ? id : `${id}:gift`);
export const paidLineId = (id: string) => id.replace(/:gift$/, '');
