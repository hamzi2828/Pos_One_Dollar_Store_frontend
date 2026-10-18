// Server-priced cart: POST /api/pos/quote (debounced) whenever anything that
// changes the bill changes. `ready` = the quote on screen belongs to the cart
// as it is now — the POS only lets the cashier pay when it is.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CartItem, CartQuote, ManualDiscount } from '../types';
import { quoteInput } from '../utils/cartPayload';
import { POSApiError, quoteCart } from '../services/posOrderService';

const DEBOUNCE_MS = 250;

export interface QuoteError {
  message: string;
  code?: string;
}

export function useCartQuote(items: CartItem[], manualDiscount: ManualDiscount | null | undefined, taxIds: string[]) {
  const input = useMemo(() => quoteInput(items, manualDiscount, taxIds), [items, manualDiscount, taxIds]);
  // Stable key: re-pricing that only changes display fields does not re-quote.
  const signature = useMemo(() => JSON.stringify(input), [input]);
  const [quote, setQuote] = useState<CartQuote | null>(null);
  const [quotedFor, setQuotedFor] = useState('');
  const [error, setError] = useState<QuoteError | null>(null);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const latest = useRef(signature);
  latest.current = signature;

  useEffect(() => {
    const body = JSON.parse(signature);
    if (!body.items.length) {
      setQuote(null);
      setError(null);
      setLoading(false);
      setQuotedFor(signature);
      return undefined;
    }
    const ctl = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const q = await quoteCart(body, ctl.signal);
        if (ctl.signal.aborted) return;
        setQuote(q);
        setError(null);
        setQuotedFor(signature);
      } catch (e) {
        if (ctl.signal.aborted) return;
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
  }, [signature, tick]);

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
