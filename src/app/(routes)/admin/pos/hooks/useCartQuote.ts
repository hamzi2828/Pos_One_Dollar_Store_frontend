// Server-priced cart: POST /api/pos/quote (debounced) whenever anything that
// changes the bill changes. `ready` = the quote on screen belongs to the cart
// as it is now — the POS only lets the cashier pay when it is.
//
// Offline (no connection, offline selling on): the same maths runs on this PC
// (offline/offlinePricing.ts) from the saved catalogue; the quote has `offline: true`.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CartItem, CartQuote, ManualDiscount } from '../types';
import { quoteInput } from '../utils/cartPayload';
import { POSApiError, quoteCart } from '../services/posOrderService';
import { isNetworkError, reportNetworkFailure, reportNetworkOk } from '../offline/connectivity';
import { OfflinePricingError } from '../offline/offlinePricing';

const DEBOUNCE_MS = 250;

export interface QuoteError {
  message: string;
  code?: string;
}

export type OfflinePricer = (items: CartItem[], manualDiscount: ManualDiscount | null | undefined, taxIds: string[]) => CartQuote;

export interface CartQuoteOptions {
  /** Price on this PC straight away (no connection). */
  offlineMode?: boolean;
  /** Offline pricer; null = offline selling is off (old behaviour: show the error). */
  offlinePricer?: OfflinePricer | null;
}

export function useCartQuote(
  items: CartItem[],
  manualDiscount: ManualDiscount | null | undefined,
  taxIds: string[],
  options: CartQuoteOptions = {}
) {
  const input = useMemo(() => quoteInput(items, manualDiscount, taxIds), [items, manualDiscount, taxIds]);
  const offlineMode = !!options.offlineMode && !!options.offlinePricer;
  // Stable key: re-pricing that only changes display fields does not re-quote.
  const signature = useMemo(() => JSON.stringify(input) + (offlineMode ? '|offline' : ''), [input, offlineMode]);
  const [quote, setQuote] = useState<CartQuote | null>(null);
  const [quotedFor, setQuotedFor] = useState('');
  const [error, setError] = useState<QuoteError | null>(null);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const latest = useRef(signature);
  latest.current = signature;
  // Latest cart + pricer for the offline path (the signature drives re-runs).
  const cartRef = useRef({ items, manualDiscount, taxIds });
  cartRef.current = { items, manualDiscount, taxIds };
  const pricerRef = useRef(options.offlinePricer);
  pricerRef.current = options.offlinePricer;

  useEffect(() => {
    const body = JSON.parse(signature.replace(/\|offline$/, ''));
    if (!body.items.length) {
      setQuote(null);
      setError(null);
      setLoading(false);
      setQuotedFor(signature);
      return undefined;
    }

    const priceHere = (): boolean => {
      const pricer = pricerRef.current;
      if (!pricer) return false;
      const c = cartRef.current;
      try {
        setQuote({ ...pricer(c.items, c.manualDiscount, c.taxIds), offline: true });
        setError(null);
      } catch (e) {
        setError(
          e instanceof OfflinePricingError ? { message: e.message, code: e.code } : { message: 'Could not price the cart on this PC.' }
        );
      }
      setQuotedFor(signature);
      setLoading(false);
      return true;
    };

    if (offlineMode) {
      priceHere();
      return undefined;
    }

    const ctl = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const q = await quoteCart(body, ctl.signal);
        if (ctl.signal.aborted) return;
        reportNetworkOk();
        setQuote(q);
        setError(null);
        setQuotedFor(signature);
      } catch (e) {
        if (ctl.signal.aborted) return;
        if (isNetworkError(e)) {
          reportNetworkFailure();
          if (priceHere()) return;
        }
        const err = e instanceof POSApiError ? { message: e.message, code: e.code } : { message: 'Could not price the cart. Check the connection.' };
        setError(err);
        setQuotedFor(signature);
      } finally {
        if (!ctl.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
  }, [signature, tick, offlineMode]);

  /** Use a quote the server sent back (e.g. 409 TOTAL_CHANGED) for the current cart. */
  const acceptQuote = useCallback((q: CartQuote) => {
    setQuote(q);
    setError(null);
    setQuotedFor(latest.current);
  }, []);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  const ready = !!quote && !error && !loading && quotedFor === signature;
  return { quote, error, loading: loading || quotedFor !== signature, ready, refresh, acceptQuote, input };
}
