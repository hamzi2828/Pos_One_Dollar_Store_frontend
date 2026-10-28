// Turn the POS cart into (a) an offline quote and (b) an outbox sale + slip.
'use client';

import type { CartItem, CartQuote, CustomerInfo, ManualDiscount, PaymentMethodType, POSCustomer, POSOrder } from '../types';
import { cartToOrderItems } from '../utils/cartPayload';
import { catalogUnit, getCatalogSnapshot } from './catalogSync';
import { computeOfflineBill, type OfflinePermissions } from './offlinePricing';
import { nextOfflineNumber } from './device';
import { addToOutbox } from './outbox';
import type { OfflineOrderPayload, OutboxEntry } from './types';

/** Cart typed with name/phone only while offline (no customer record yet). */
export const TYPED_CUSTOMER_PREFIX = 'typed-';
export const isTypedCustomer = (c?: POSCustomer | null) => !!c && c._id.startsWith(TYPED_CUSTOMER_PREFIX);

/** Price the cart on this PC with the saved catalogue (same maths as the server). */
export function priceCartOffline(
  items: CartItem[],
  manualDiscount: ManualDiscount | null | undefined,
  taxIds: string[],
  perms: OfflinePermissions
): CartQuote {
  const snap = getCatalogSnapshot();
  const limits = snap?.limits || {};
  return computeOfflineBill({
    lines: items.map((item) => {
      const unit = catalogUnit(item.product._id, item.variantId);
      // Not in the catalogue (e.g. added online just now): use the price the cart got from the server.
      const fallbackUnit = item.variant
        ? { price: item.variant.price, discountedPrice: item.variant.discountedPrice }
        : { price: item.product.price, discountedPrice: item.product.discountedPrice };
      const label = [item.color, item.size].filter(Boolean).join(' / ');
      return {
        product: item.product._id,
        variantId: item.variantId,
        name: unit?.name || (label ? `${item.product.name} (${label})` : item.product.name),
        quantity: item.quantity,
        unit: unit ? { price: unit.price, discountedPrice: unit.discountedPrice } : fallbackUnit,
        priceOverride: !!item.priceOverride && !item.isGift,
        price: item.unitPrice,
        isGift: item.isGift,
        giftReason: item.giftReason,
        available: unit?.stock ?? (item.variant ? item.variant.stock : item.product.stock),
      };
    }),
    rules: snap?.discountRules || [],
    taxes: snap?.taxes || [],
    manualDiscount,
    taxIds,
    // The server's view of this user's rights (catalogue limits) wins over the cached role.
    perms: {
      canEditPrice: typeof limits.canEditPrice === 'boolean' ? limits.canEditPrice : perms.canEditPrice,
      canGoBelowList: typeof limits.canPriceBelowList === 'boolean' ? limits.canPriceBelowList : perms.canGoBelowList,
      canGift: typeof limits.canGift === 'boolean' ? limits.canGift : perms.canGift,
      maxManualDiscountPct: typeof limits.maxManualDiscountPct === 'number' ? limits.maxManualDiscountPct : perms.maxManualDiscountPct,
      unlimitedManualDiscount: typeof limits.unlimitedManualDiscount === 'boolean' ? limits.unlimitedManualDiscount : perms.unlimitedManualDiscount,
      maxLines: typeof limits.maxLines === 'number' ? limits.maxLines : undefined,
    },
  });
}

export interface OfflineSaleInput {
  clientId: string;
  items: CartItem[];
  quote: CartQuote;
  manualDiscount?: ManualDiscount | null;
  taxIds: string[];
  paymentMethod: PaymentMethodType;
  cashAmount?: number;
  isPartialPayment?: boolean;
  paidAmount?: number;
  customer?: POSCustomer | null;
  customerInfo?: CustomerInfo;
  cashier: { id: string; firstName?: string; lastName?: string; email?: string };
  soldAt?: Date;
}

/** Save the sale in the outbox; returns the slip (POSOrder shape, OFF- number). */
export async function saveOfflineSale(input: OfflineSaleInput): Promise<POSOrder> {
  const { quote } = input;
  const offlineNumber = await nextOfflineNumber();
  const soldAt = (input.soldAt || new Date()).toISOString();
  const realCustomer = input.customer && !isTypedCustomer(input.customer) ? input.customer : null;
  const total = quote.total;
  const paid = input.isPartialPayment ? Number(input.paidAmount) || 0 : total;
  const takesCash = input.paymentMethod === 'cash' || input.paymentMethod === 'bank_transfer';

  const order: OfflineOrderPayload = {
    clientId: input.clientId,
    offlineNumber,
    soldAt,
    cashier: input.cashier.id,
    items: cartToOrderItems(input.items),
    manualDiscount: input.manualDiscount && input.manualDiscount.value > 0 ? input.manualDiscount : null,
    taxIds: input.taxIds,
    paymentMethod: input.paymentMethod,
    cashAmount: takesCash ? input.cashAmount : undefined,
    isPartialPayment: input.isPartialPayment || undefined,
    paidAmount: input.isPartialPayment ? input.paidAmount : undefined,
    customer: realCustomer?._id,
    customerInfo: input.customerInfo,
    bill: {
      subtotal: quote.subtotal,
      discount: quote.discount,
      tax: quote.tax,
      total,
      lines: quote.lines.map((l) => ({
        product: l.product || '',
        variantId: l.variantId,
        quantity: l.quantity,
        unitPrice: l.price,
        lineTotal: l.lineTotal,
        ...(l.isGift ? { isGift: true } : {}),
      })),
      appliedDiscounts: quote.appliedDiscounts,
      appliedTaxes: quote.appliedTaxes,
    },
  };

  const receipt: POSOrder = {
    _id: input.clientId,
    orderNumber: offlineNumber,
    items: quote.lines.map((l, i) => {
      const item = input.items[i];
      return {
        product: { _id: l.product || '', name: item?.product.name || l.name },
        variantId: l.variantId,
        sku: item?.variant?.sku || item?.product.sku || '',
        quantity: l.quantity,
        price: l.price,
        size: item?.size,
        color: item?.color,
        isGift: l.isGift,
        giftReason: l.giftReason,
      };
    }),
    customer: realCustomer || undefined,
    customerInfo: input.customerInfo,
    paymentMethod: input.paymentMethod,
    cashAmount: takesCash ? input.cashAmount : undefined,
    changeGiven: takesCash && input.cashAmount && input.cashAmount > total ? Math.round((input.cashAmount - total) * 100) / 100 : undefined,
    subtotal: quote.subtotal,
    tax: quote.tax,
    appliedTaxes: quote.appliedTaxes,
    discount: quote.discount,
    appliedDiscounts: quote.appliedDiscounts,
    total,
    paidAmount: paid,
    pendingAmount: Math.max(0, Math.round((total - paid) * 100) / 100),
    cashier: {
      _id: input.cashier.id,
      firstName: input.cashier.firstName || '',
      lastName: input.cashier.lastName || '',
      email: input.cashier.email || '',
    },
    createdAt: soldAt,
    updatedAt: soldAt,
    orderStatus: 'completed',
    paymentStatus: paid >= total ? 'completed' : paid > 0 ? 'partial' : 'pending',
    offline: { clientId: input.clientId, number: offlineNumber, soldAt, pending: true },
  };

  const entry: OutboxEntry = {
    clientId: input.clientId,
    offlineNumber,
    createdAt: Date.now(),
    state: 'waiting',
    attempts: 0,
    order,
    receipt,
  };
  await addToOutbox(entry);
  return receipt;
}
