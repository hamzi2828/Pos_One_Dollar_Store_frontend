// Offline bill pricing: a line-for-line port of
// pos_backend/src/services/sales/pricingService.js computeBill (+ applyRules,
// ruleAmount, ruleLabel, nextThreshold, manual discount, taxes).
// It MUST give the same bill as the server for the same inputs; keep the two in step.
//
// Pure: no browser APIs and no imports with side effects (a node script tests it).
import type { AppliedDiscount, AppliedTax, CartQuote, ManualDiscount, QuoteLine } from '../types';
import type { CatalogDiscountRule, CatalogTax } from './types';

export const round2 = (n: unknown) => Math.round((Number(n) || 0) * 100) / 100;
const isNum = (v: unknown) => v !== undefined && v !== null && v !== '' && Number.isFinite(Number(v));

const DEFAULT_MAX_MANUAL_PCT = 10;
const MAX_LINES = 300;

export class OfflinePricingError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'OfflinePricingError';
    this.code = code;
  }
}

/** "Rs 1,250" / "Rs 99.5" — same as the server's rs(). */
export const rs = (n: number) => `Rs ${Number(round2(n)).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;

/** Sale price of a unit: the discounted price when set and lower, else the price. */
export function unitSalePrice(unit: { price?: number; discountedPrice?: number } | null | undefined, fallback = 0): number {
  const price = isNum(unit?.price) ? Number(unit?.price) : Number(fallback) || 0;
  const dp = isNum(unit?.discountedPrice) ? Number(unit?.discountedPrice) : 0;
  return round2(dp > 0 && dp < price ? dp : price);
}

/* ---------------- rules ---------------- */

export function ruleLabel(rule: CatalogDiscountRule): string {
  const off = rule.valueType === 'percentage' ? `${Number(rule.value)}% off` : `${rs(rule.value)} off`;
  const cap = rule.valueType === 'percentage' && Number(rule.maxDiscount) > 0 ? ` (max ${rs(Number(rule.maxDiscount))})` : '';
  if (rule.kind === 'threshold') return `Spend ${rs(Number(rule.minSubtotal) || 0)} get ${off}${cap}`;
  return `${off} on every bill${cap}`;
}

export function ruleAmount(rule: CatalogDiscountRule, subtotal: number): number {
  const base = Number(subtotal) || 0;
  if (base <= 0) return 0;
  if (rule.kind === 'threshold' && base < (Number(rule.minSubtotal) || 0)) return 0;
  const value = Math.max(0, Number(rule.value) || 0);
  let amount = rule.valueType === 'percentage' ? (base * Math.min(100, value)) / 100 : value;
  if (Number(rule.maxDiscount) > 0) amount = Math.min(amount, Number(rule.maxDiscount));
  return round2(Math.max(0, Math.min(amount, base)));
}

export function applyRules(rules: CatalogDiscountRule[], subtotal: number): AppliedDiscount[] {
  const scored = (rules || []).map((rule) => ({ rule, amount: ruleAmount(rule, subtotal) })).filter((x) => x.amount > 0);
  const exclusive = scored
    .filter((x) => !x.rule.stackable)
    .sort((a, b) => b.amount - a.amount || (b.rule.priority || 0) - (a.rule.priority || 0));
  const chosen = [...exclusive.slice(0, 1), ...scored.filter((x) => x.rule.stackable)].sort(
    (a, b) => (b.rule.priority || 0) - (a.rule.priority || 0) || b.amount - a.amount
  );
  let left = round2(subtotal);
  const applied: AppliedDiscount[] = [];
  for (const x of chosen) {
    const amount = round2(Math.min(x.amount, left));
    if (amount <= 0) continue;
    left = round2(left - amount);
    applied.push({
      rule: x.rule._id || null,
      name: x.rule.name,
      kind: x.rule.kind,
      valueType: x.rule.valueType,
      value: Number(x.rule.value) || 0,
      amount,
      label: ruleLabel(x.rule),
    });
  }
  return applied;
}

export function nextThreshold(rules: CatalogDiscountRule[], subtotal: number, currentRuleDiscount = 0): CartQuote['nextDiscount'] {
  const sub = Number(subtotal) || 0;
  const best = (rules || [])
    .filter((r) => r.kind === 'threshold' && sub < (Number(r.minSubtotal) || 0))
    .map((r) => ({ r, missing: round2(Number(r.minSubtotal) - sub), reward: ruleAmount(r, Number(r.minSubtotal)) }))
    .filter((c) => c.reward > currentRuleDiscount)
    .sort((a, b) => a.missing - b.missing || b.reward - a.reward)[0];
  if (!best) return null;
  const off = best.r.valueType === 'percentage' ? `${Number(best.r.value)}% off` : `${rs(best.r.value)} off`;
  return {
    name: best.r.name,
    label: ruleLabel(best.r),
    minSubtotal: Number(best.r.minSubtotal) || 0,
    missing: best.missing,
    message: `Add ${rs(best.missing)} more to get ${off}`,
  };
}

/** Rules running at `at`, in the server's order (priority desc, then oldest first). */
export function activeRules(rules: CatalogDiscountRule[], at: Date = new Date()): CatalogDiscountRule[] {
  const t = at.getTime();
  return (rules || [])
    .filter((r) => r && r.isActive !== false)
    .filter((r) => !r.startsAt || new Date(r.startsAt).getTime() <= t)
    .filter((r) => !r.endsAt || new Date(r.endsAt).getTime() >= t)
    .map((r, i) => ({ r, i }))
    .sort(
      (a, b) =>
        (b.r.priority || 0) - (a.r.priority || 0) ||
        (a.r.createdAt && b.r.createdAt ? new Date(a.r.createdAt).getTime() - new Date(b.r.createdAt).getTime() : 0) ||
        a.i - b.i
    )
    .map((x) => x.r);
}

/* ---------------- manual discount ---------------- */

export function normalizeManualDiscount(input: ManualDiscount | null | undefined): { type: 'fixed' | 'percentage'; value: number; reason: string } | null {
  if (!input || typeof input !== 'object') return null;
  const type = input.type === 'percentage' ? 'percentage' : 'fixed';
  const value = Number(input.value);
  if (!Number.isFinite(value) || value <= 0) return null;
  if (type === 'percentage' && value > 100) throw new OfflinePricingError('Discount cannot be more than 100%', 'INVALID_DISCOUNT');
  return { type, value: round2(value), reason: String(input.reason || '').trim().slice(0, 200) };
}

/* ---------------- the bill ---------------- */

/** One cart line with its unit already found in the catalogue. */
export interface OfflineLineInput {
  product: string;
  variantId?: string;
  name: string;
  quantity: number;
  /** The unit (product or variant) price fields from the catalogue. */
  unit: { price: number; discountedPrice?: number };
  priceOverride?: boolean;
  price?: number;
  isGift?: boolean;
  giftReason?: string;
  available?: number;
}

export interface OfflinePermissions {
  /** pos edit: may type a price. */
  canEditPrice: boolean;
  /** discounts edit: may go below the list price and give any manual discount. */
  canGoBelowList: boolean;
  /** pos_gifts create. */
  canGift: boolean;
  maxManualDiscountPct?: number;
  unlimitedManualDiscount?: boolean;
  /** Most lines on one bill (server default 300). */
  maxLines?: number;
}

export interface OfflineBillInput {
  lines: OfflineLineInput[];
  rules: CatalogDiscountRule[];
  taxes: CatalogTax[];
  manualDiscount?: ManualDiscount | null;
  taxIds?: string[];
  perms: OfflinePermissions;
  at?: Date;
}

/** Same result shape as POST /api/pos/quote (no costs: the PC does not know them). */
export function computeOfflineBill(input: OfflineBillInput): CartQuote {
  const { perms } = input;
  const raw = input.lines || [];
  if (raw.length === 0) throw new OfflinePricingError('Order must have at least one item', 'EMPTY_CART');
  const maxLines = Number(perms.maxLines) > 0 ? Number(perms.maxLines) : MAX_LINES;
  if (raw.length > maxLines) throw new OfflinePricingError(`A bill can have at most ${maxLines} lines`, 'TOO_MANY_LINES');

  const lines: QuoteLine[] = raw.map((l, index) => {
    const quantity = Number(l.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new OfflinePricingError('Item quantity must be a whole number of at least 1', 'INVALID_QUANTITY');
    }
    const name = l.name;
    const listPrice = unitSalePrice(l.unit, l.unit?.price);
    let price = listPrice;
    let priceOverride = false;
    if (l.priceOverride === true && !l.isGift) {
      const typed = Number(l.price);
      if (!Number.isFinite(typed) || typed < 0) throw new OfflinePricingError(`Enter a valid price for ${name}`, 'INVALID_PRICE');
      if (round2(typed) !== listPrice) {
        if (!perms.canEditPrice) throw new OfflinePricingError(`You may not change the price of ${name}. Ask a manager.`, 'PRICE_EDIT_NOT_ALLOWED');
        if (typed < listPrice && !perms.canGoBelowList) {
          throw new OfflinePricingError(`${name} cannot be sold below ${rs(listPrice)}. Use a discount instead.`, 'PRICE_BELOW_LIST');
        }
        price = round2(typed);
        priceOverride = true;
      }
    }
    const isGift = !!l.isGift;
    let giftReason: string | undefined;
    if (isGift) {
      if (!perms.canGift) throw new OfflinePricingError('You may not give gifts. Ask a manager.', 'GIFT_NOT_ALLOWED');
      giftReason = String(l.giftReason || '').trim().slice(0, 200);
      if (!giftReason) throw new OfflinePricingError(`Write why ${name} is a gift`, 'GIFT_REASON_REQUIRED');
      price = 0;
    }
    return {
      index,
      product: l.product,
      variantId: l.variantId,
      name,
      quantity,
      price,
      listPrice,
      priceOverride,
      lineTotal: round2(price * quantity),
      isGift,
      giftReason,
      available: l.available,
    };
  });

  const saleLines = lines.filter((l) => !l.isGift);
  const giftLines = lines.filter((l) => l.isGift);
  const subtotal = round2(saleLines.reduce((s, l) => s + l.price * l.quantity, 0));

  const rules = activeRules(input.rules, input.at || new Date());
  const ruleDiscounts = applyRules(rules, subtotal);
  const ruleDiscount = round2(ruleDiscounts.reduce((s, d) => s + d.amount, 0));

  const pct = Number(perms.maxManualDiscountPct);
  const maxManualDiscountPct = Number.isFinite(pct) && pct >= 0 && perms.maxManualDiscountPct !== undefined ? pct : DEFAULT_MAX_MANUAL_PCT;
  const unlimitedManualDiscount = perms.unlimitedManualDiscount ?? perms.canGoBelowList;
  const maxManualDiscount = round2((subtotal * maxManualDiscountPct) / 100);
  const manual = normalizeManualDiscount(input.manualDiscount);
  let manualAmount = 0;
  if (manual) {
    const base = Math.max(0, round2(subtotal - ruleDiscount));
    manualAmount = round2(Math.min(base, manual.type === 'percentage' ? (base * manual.value) / 100 : manual.value));
    if (manualAmount > maxManualDiscount + 0.001 && !unlimitedManualDiscount) {
      throw new OfflinePricingError(
        `Manual discount is limited to ${maxManualDiscountPct}% of the bill (${rs(maxManualDiscount)}). Ask a manager.`,
        'DISCOUNT_LIMIT'
      );
    }
  }
  const appliedDiscounts: AppliedDiscount[] = [...ruleDiscounts];
  if (manual && manualAmount > 0) {
    appliedDiscounts.push({
      rule: null,
      name: manual.reason ? `Discount: ${manual.reason}` : 'Discount',
      kind: 'manual',
      valueType: manual.type,
      value: manual.value,
      amount: manualAmount,
      label: manual.type === 'percentage' ? `${manual.value}% discount` : `${rs(manual.value)} discount`,
    });
  }
  const discount = round2(ruleDiscount + manualAmount);

  const wanted = [...new Set((input.taxIds || []).filter(Boolean).map(String))];
  const taxable = Math.max(0, round2(subtotal - discount));
  let appliedTaxes: AppliedTax[] = [];
  if (wanted.length) {
    appliedTaxes = (input.taxes || [])
      .filter((t) => t && t.taxId && t.isActive !== false)
      .filter((t) => wanted.includes(String(t.taxId)))
      .map((t) => ({ taxId: String(t.taxId), name: t.name, rate: Number(t.rate) || 0, amount: round2((taxable * (Number(t.rate) || 0)) / 100) }));
  }
  const tax = round2(appliedTaxes.reduce((s, t) => s + t.amount, 0));
  const total = round2(Math.max(0, taxable + tax));

  return {
    lines,
    itemCount: lines.reduce((s, l) => s + l.quantity, 0),
    subtotal,
    appliedDiscounts,
    ruleDiscount,
    manualDiscount: manualAmount,
    discount,
    tax,
    appliedTaxes,
    total,
    giftCount: giftLines.reduce((s, l) => s + l.quantity, 0),
    giftValue: round2(giftLines.reduce((s, l) => s + l.listPrice * l.quantity, 0)),
    canSeeCost: false,
    nextDiscount: nextThreshold(rules, subtotal, ruleDiscount),
    limits: { maxManualDiscountPct, maxManualDiscount, unlimitedManualDiscount: !!unlimitedManualDiscount },
  };
}
