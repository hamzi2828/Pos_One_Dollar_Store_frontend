// Cart -> request lines for POST /api/pos/quote and POST /api/pos/orders.
// The server prices every line itself (DB price, landed cost), so a price is
// only sent when the cashier typed one.
import { CartItem, ManualDiscount, POSOrderItem } from '../types';

export function cartToOrderItems(items: CartItem[]): POSOrderItem[] {
  return items.map((item) => ({
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
  }));
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
