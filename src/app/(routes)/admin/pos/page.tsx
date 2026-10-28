// POS Page - Point of Sale System
// Scanner first: scan (or type a short code) + Enter adds the item. Every
// amount comes from the server (POST /api/pos/quote) — rule discounts, manual
// discount, tax and total are exactly what the sale will charge.
// Keyboard: F2 = search box, F9 = take payment.
// Offline (no internet, user has desktop_pos view + pos create): products and
// codes come from the catalogue saved on this PC, the bill is priced here
// (offline/offlinePricing.ts) and "Complete sale" saves to the outbox with an
// OFF- slip number; offline/syncWorker.ts uploads it when the internet is back.
'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { POSProduct, POSCart, CartItem, POSCustomer, POSVariant, PaymentMethodType, POSOrderData, POSOrder, POSTax, CustomerInfo, CartQuote, ManualDiscount } from './types';
import ProductSearch from './components/ProductSearch';
import ProductGrid from './components/ProductGrid';
import CartPanel from './components/CartPanel';
import CustomerSelector from './components/CustomerSelector';
import VariantSelector from './components/VariantSelector';
import PaymentModal from './components/PaymentModal';
import HeldOrders from './components/HeldOrders';
import PendingPaymentsTab from './components/PendingPaymentsTab';
import LastSaleBar from './components/LastSaleBar';
import { getPOSProducts, getProductByBarcode } from './services/posProductService';
import { createPOSOrder, POSApiError } from './services/posOrderService';
import { createOrFindCustomer } from './services/posCustomerService';
import { holdCart, getHeldCarts, retrieveHeldCart, clearHeldCart } from './services/posCartService';
import { useCartQuote } from './hooks/useCartQuote';
import { cartToOrderItems, giftLineId, paidLineId } from './utils/cartPayload';
import { getCurrencySymbol } from './utils/currency';
import { HeldCart } from './types';
import { Archive, Filter, AlertCircle, ShoppingCart, LayoutGrid } from 'lucide-react';
import { decodeJwt, getAuthHeader, getAuthToken, type UserPayload } from '@/helper/helper';
import { useAccess } from '@/context/AccessContext';
import OfflineBadge from './offline/OfflineBadge';
import { useOfflineStatus } from './offline/useOfflineStatus';
import { canSellOffline, getCatalogSnapshot, loadCatalog, lookupCatalogCode, searchCatalog } from './offline/catalogSync';
import { isNetworkError, reportNetworkFailure, reportNetworkOk } from './offline/connectivity';
import { isTypedCustomer, priceCartOffline, saveOfflineSale } from './offline/offlineSale';
import { onUploadDone } from './offline/syncWorker';
import { uuid } from './offline/device';
import { registerPosServiceWorker } from './offline/registerSw';
import { printReceipt } from './utils/receipt';
import TillStatusBar, { type TillStatus } from '@/components/store/TillStatusBar';
import ProductInsightPanel from '@/components/store/ProductInsightPanel';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

type POSTab = 'products' | 'held' | 'history' | 'pending';

const emptyCart = (): POSCart => ({
  items: [],
  subtotal: 0,
  tax: 0,
  taxRate: 0,
  appliedTaxes: [],
  discount: 0,
  total: 0,
  manualDiscount: null,
});

// Same rule as the server: the sale price when set and lower, else the price.
const salePrice = (u: { price: number; discountedPrice?: number }) =>
  u.discountedPrice && u.discountedPrice > 0 && u.discountedPrice < u.price ? u.discountedPrice : u.price;

export default function POSPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { can, access } = useAccess();
  const symbol = getCurrencySymbol('PKR');

  const canEditPrice = can('pos', 'edit');
  const canGoBelowList = can('discounts', 'edit');
  const canGift = can('pos_gifts', 'create');

  // ---------- offline selling
  const offlineEnabled = canSellOffline(access);
  const offline = useOfflineStatus(offlineEnabled);
  const offlineMode = offline.offlineMode;
  const offlineModeRef = useRef(offlineMode);
  offlineModeRef.current = offlineMode;
  const NEEDS_INTERNET = 'Needs internet';
  const offlinePricer = useMemo(
    () =>
      offlineEnabled
        ? (items: CartItem[], md: ManualDiscount | null | undefined, taxIds: string[]) =>
            priceCartOffline(items, md, taxIds, { canEditPrice, canGoBelowList, canGift })
        : null,
    [offlineEnabled, canEditPrice, canGoBelowList, canGift]
  );

  const urlTab = searchParams.get('tab') as POSTab | null;
  const initialTab: POSTab = urlTab && ['products', 'held', 'history', 'pending'].includes(urlTab) ? urlTab : 'products';

  // State
  const [products, setProducts] = useState<POSProduct[]>([]);
  const [availableTaxes, setAvailableTaxes] = useState<POSTax[]>([]);
  const [selectedTaxIds, setSelectedTaxIds] = useState<string[]>([]);
  const [cart, setCart] = useState<POSCart>(emptyCart);
  const cartRef = useRef(cart);
  cartRef.current = cart;
  const [customer, setCustomer] = useState<POSCustomer | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<POSProduct | null>(null);
  const [loading, setLoading] = useState(true);
  // Search text whose results are on screen (null = nothing loaded yet).
  const [loadedQuery, setLoadedQuery] = useState<string | null>(null);
  const [heldCarts, setHeldCarts] = useState<HeldCart[]>([]);
  const [activeTab, setActiveTab] = useState<POSTab>(initialTab);
  // "Today's Sales" moved to POS Orders (Date: Today): an old link to it opens Products.
  const tab: POSTab = activeTab === 'history' ? 'products' : activeTab;
  const [storeName, setStoreName] = useState<string>('DOLLAR & Co');
  // Button busy states: show a spinner and block a second click while saving.
  const [holding, setHolding] = useState(false);
  const [paying, setPaying] = useState(false);
  const payLock = useRef(false);
  const [heldBusy, setHeldBusy] = useState<{ id: string; action: 'retrieve' | 'delete' } | null>(null);
  const actionLock = useRef(false);
  const [scanning, setScanning] = useState(false);
  const scanLock = useRef(false);
  // Items sold in sets (e.g. 2 plates for one price): the last one added, to catch a 2nd scan of the same set.
  const lastSet = useRef<{ id: string; at: number } | null>(null);
  /** Tell the cashier how a set item is sold; warn when it is scanned again right away. Returns true when it showed a message. */
  const noteSet = (product: POSProduct): boolean => {
    const pps = Math.max(1, Math.floor(Number(product.piecesPerSale) || 1));
    if (pps < 2) return false;
    const now = Date.now();
    const again = !!lastSet.current && lastSet.current.id === product._id && now - lastSet.current.at < 20000;
    lastSet.current = { id: product._id, at: now };
    if (again) {
      toast(`${product.name} scanned again = ANOTHER set of ${pps}. If it was a piece of the same set, press − on the line.`, {
        icon: '⚠️',
        duration: 7000,
        id: 'pos-scan',
      });
    } else {
      toast.success(`${product.name}: sold ${pps} together. Give the customer ${pps} pieces.`, { duration: 4000, id: 'pos-scan' });
    }
    return true;
  };
  const searchRef = useRef<HTMLInputElement>(null);
  const [till, setTill] = useState<TillStatus | null>(null);
  const [tillMessage, setTillMessage] = useState<string | null>(null);
  const [insight, setInsight] = useState<{ productId: string; variantId: string | null } | null>(null);
  const [lastOrder, setLastOrder] = useState<POSOrder | null>(null);
  // Phones / small tablets: show either the products or the cart.
  const [mobileView, setMobileView] = useState<'products' | 'cart'>('products');

  // Modals
  const [showCustomerSelector, setShowCustomerSelector] = useState(false);
  const [showVariantSelector, setShowVariantSelector] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // ---------- server-priced cart
  const { quote, error: quoteError, loading: quoteLoading, ready: quoteReady, acceptQuote } = useCartQuote(
    cart.items,
    cart.manualDiscount,
    selectedTaxIds,
    { offlineMode, offlinePricer }
  );
  const pricedCart = useMemo<POSCart>(() => {
    if (!quote || !quoteReady) return cart;
    return {
      ...cart,
      subtotal: quote.subtotal,
      tax: quote.tax,
      taxRate: quote.appliedTaxes.reduce((s, t) => s + t.rate, 0),
      appliedTaxes: quote.appliedTaxes,
      discount: quote.discount,
      total: quote.total,
    };
  }, [cart, quote, quoteReady]);

  // Keep the cart lines' prices in step with the server (held orders, line totals).
  useEffect(() => {
    if (!quote || !quoteReady) return;
    setCart((prev) => {
      if (prev.items.length !== quote.lines.length) return prev;
      let changed = false;
      const items = prev.items.map((it, i) => {
        const line = quote.lines[i];
        if (!line) return it;
        if (it.unitPrice === line.price && it.subtotal === line.lineTotal) return it;
        changed = true;
        return { ...it, unitPrice: line.price, subtotal: line.lineTotal, originalPrice: line.listPrice };
      });
      return changed ? { ...prev, items } : prev;
    });
  }, [quote, quoteReady]);

  // Offline sales are never refused for the till (the server attaches it or warns NO_TILL).
  const tillBlocked =
    !offlineMode && !quote?.offline && till && till.required && !till.open ? 'Open your till (cash drawer) before selling' : null;
  useEffect(() => {
    if (till?.open) setTillMessage(null);
  }, [till]);

  // ---------- tabs
  const handleTabChange = useCallback(
    (next: POSTab) => {
      setActiveTab(next);
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', next);
      router.push(`/admin/pos?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  // ---------- loaders
  const loadSettings = useCallback(async () => {
    // No connection: store name and taxes from the saved catalogue.
    const fromCatalog = async () => {
      await loadCatalog();
      const snap = getCatalogSnapshot();
      if (!snap) return;
      if (snap.shop?.name) setStoreName(snap.shop.name);
      const activeTaxes = (snap.taxes || []).filter((t) => t.isActive !== false) as POSTax[];
      if (activeTaxes.length) {
        setAvailableTaxes(activeTaxes);
        const defaultTax = activeTaxes.find((t) => t.isDefault);
        if (defaultTax) setSelectedTaxIds([defaultTax.taxId]);
      }
    };
    try {
      const response = await fetch(`${API_BASE_URL}/settings`, { headers: getAuthHeader() });
      if (!response.ok && [502, 503, 504].includes(response.status)) await fromCatalog();
      if (response.ok) {
        const data = await response.json();
        if (data.data?.storeName) setStoreName(data.data.storeName);
        if (data.data?.taxes && Array.isArray(data.data.taxes)) {
          const activeTaxes = data.data.taxes.filter((t: POSTax) => t.isActive);
          setAvailableTaxes(activeTaxes);
          const defaultTax = activeTaxes.find((t: POSTax) => t.isDefault);
          if (defaultTax) setSelectedTaxIds([defaultTax.taxId]);
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      if (isNetworkError(error)) {
        reportNetworkFailure();
        await fromCatalog();
      }
    }
  }, []);

  // Only the newest product request may update the list.
  const productsRequest = useRef<AbortController | null>(null);
  const offlineEnabledRef = useRef(offlineEnabled);
  offlineEnabledRef.current = offlineEnabled;
  const loadProducts = useCallback(async (query: string) => {
    productsRequest.current?.abort();
    const controller = new AbortController();
    productsRequest.current = controller;
    const fromCatalog = async () => {
      await loadCatalog();
      if (controller.signal.aborted) return;
      setProducts(searchCatalog(query));
      setLoadedQuery(query);
    };
    try {
      setLoading(true);
      if (offlineModeRef.current) {
        await fromCatalog();
        return;
      }
      const data = await getPOSProducts(query, undefined, undefined, controller.signal);
      if (controller.signal.aborted) return;
      reportNetworkOk();
      setProducts(data);
      setLoadedQuery(query);
    } catch (error) {
      if (controller.signal.aborted) return;
      if (isNetworkError(error)) {
        reportNetworkFailure();
        if (offlineEnabledRef.current) {
          await fromCatalog();
          return;
        }
      }
      console.error('Failed to load products:', error);
      toast.error('Failed to load products');
      setLoadedQuery(query);
    } finally {
      if (productsRequest.current === controller) setLoading(false);
    }
  }, []);

  const loadHeldCarts = useCallback(async () => {
    try {
      setHeldCarts(await getHeldCarts());
    } catch (error) {
      console.error('Failed to load held carts:', error);
    }
  }, []);

  useEffect(() => {
    loadSettings();
    loadHeldCarts();
  }, [loadSettings, loadHeldCarts]);

  // Offline <-> online: reload the list from the right place.
  const firstMode = useRef(true);
  useEffect(() => {
    if (firstMode.current) {
      firstMode.current = false;
      return;
    }
    loadProducts(searchQuery.trim());
    if (!offlineMode) loadHeldCarts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offlineMode]);

  // Search products (debounced; first load runs straight away; same text = no reload)
  const trimmedQuery = searchQuery.trim();
  useEffect(() => {
    if (loadedQuery !== null && trimmedQuery === loadedQuery) return undefined;
    const delay = loadedQuery === null ? 0 : 300;
    const debounce = setTimeout(() => loadProducts(trimmedQuery), delay);
    return () => clearTimeout(debounce);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmedQuery, loadProducts]);

  useEffect(() => () => productsRequest.current?.abort(), []);

  const isSearching = loading || trimmedQuery !== (loadedQuery ?? '');

  // ---------- cart actions
  /** Add pieces of a unit. Returns false when nothing could be added (no stock). */
  const addToCart = useCallback(
    (product: POSProduct, variant?: POSVariant, opts: { qty?: number; scannedCode?: string; batchNo?: string } = {}) => {
      const qty = Math.max(1, Math.floor(opts.qty || 1));
      const baseId = variant ? `${product._id}-${variant.variantId}` : product._id;
      const itemId = opts.batchNo ? `${baseId}@${opts.batchNo}` : baseId;
      // Offline: stock in the saved list may be old; the sale is allowed (server warns STOCK_SHORT).
      const max = offlineModeRef.current ? 0 : Number(variant ? variant.stock : product.stock) || 0;
      const inCart = cartRef.current.items.find((i) => i.id === itemId)?.quantity || 0;
      if (max > 0 && inCart + qty > max) {
        toast.error(inCart >= max ? `No more ${product.name} in stock` : `Only ${max} of ${product.name} in stock`);
        if (inCart >= max) return false;
      }
      const price = salePrice(variant || product);
      setCart((prev) => {
        const existing = prev.items.find((i) => i.id === itemId);
        if (existing) {
          const quantity = max > 0 ? Math.min(max, existing.quantity + qty) : existing.quantity + qty;
          return { ...prev, items: prev.items.map((i) => (i.id === itemId ? { ...i, quantity, subtotal: i.unitPrice * quantity } : i)) };
        }
        const quantity = max > 0 ? Math.min(max, qty) : qty;
        const newItem: CartItem = {
          id: itemId,
          product,
          variantId: variant?.variantId,
          variant,
          quantity,
          unitPrice: price,
          originalPrice: price,
          discount: 0,
          subtotal: price * quantity,
          color: variant?.color,
          size: variant?.size,
          scannedCode: opts.scannedCode,
          batchNo: opts.batchNo,
        };
        return { ...prev, items: [...prev.items, newItem] };
      });
      return true;
    },
    []
  );

  const handleProductSelect = useCallback(
    (product: POSProduct) => {
      if (product.productType === 'variant') {
        setSelectedProduct(product);
        setShowVariantSelector(true);
      } else {
        if (addToCart(product)) noteSet(product);
      }
    },
    [addToCart]
  );

  const handleVariantSelect = (variant: POSVariant) => {
    if (selectedProduct) addToCart(selectedProduct, variant);
  };

  /** Code lookup: server, or the saved catalogue when offline / the server cannot be reached. */
  const lookupCode = async (code: string) => {
    if (offlineModeRef.current) {
      await loadCatalog();
      return lookupCatalogCode(code);
    }
    try {
      const r = await getProductByBarcode(code);
      reportNetworkOk();
      return r;
    } catch (e) {
      if (isNetworkError(e)) {
        reportNetworkFailure();
        if (offlineEnabledRef.current) {
          await loadCatalog();
          return lookupCatalogCode(code);
        }
      }
      throw e;
    }
  };

  /** Enter in the search box: barcode / short code / box code / batch code. */
  const handleScan = async (code: string): Promise<boolean> => {
    if (scanLock.current) return false;
    scanLock.current = true;
    setScanning(true);
    try {
      const r = await lookupCode(code);
      if (r.ok) {
        const { product, match } = r;
        if (product.productType === 'variant' && !match.variantId) {
          setSelectedProduct(product);
          setShowVariantSelector(true);
          return true;
        }
        const variant = match.variantId ? product.variants?.find((v) => v.variantId === match.variantId) : undefined;
        const added = addToCart(product, variant, { qty: match.qty || 1, scannedCode: match.code, batchNo: match.batchNo || undefined });
        if (added && !variant && match.qty <= 1 && noteSet(product)) return true;
        if (added) {
          const shelf = match.shelfCodes?.[0] ? ` · ${match.shelfCodes[0]}` : '';
          toast.success(`${product.name}${match.qty > 1 ? ` × ${match.qty}` : ''}${shelf}`, { duration: 1200, id: 'pos-scan' });
        }
        return true;
      }
      if (r.status === 404) {
        // Not a code: a typed name with exactly one result adds that product.
        if (!isSearching && loadedQuery === code && products.length === 1) {
          handleProductSelect(products[0]);
          return true;
        }
        if (!isSearching && loadedQuery === code && products.length > 1) return false; // pick from the list
        toast.error(`No product with code "${code}"`, { id: 'pos-scan' });
        return false;
      }
      toast.error(r.message, { id: 'pos-scan' }); // e.g. out of stock
      return true;
    } catch {
      toast.error('Could not look up the code. Check the connection.', { id: 'pos-scan' });
      return false;
    } finally {
      scanLock.current = false;
      setScanning(false);
    }
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    setCart((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === itemId ? { ...item, quantity, subtotal: item.unitPrice * quantity } : item)),
    }));
  };

  // Typed price (the server checks pos edit / discounts edit).
  const updateUnitPrice = (itemId: string, newPrice: number, minPrice: number) => {
    if (newPrice < minPrice) {
      toast.error('Price cannot be less than the original price');
      return;
    }
    setCart((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === itemId ? { ...item, unitPrice: newPrice, priceOverride: true, subtotal: newPrice * item.quantity } : item
      ),
    }));
  };

  // Gift on/off. Gift lines get their own id so the next scan adds a paid piece.
  const toggleGift = (itemId: string, isGift: boolean, reason?: string) => {
    setCart((prev) => {
      const item = prev.items.find((i) => i.id === itemId);
      if (!item) return prev;
      const targetId = isGift ? giftLineId(itemId) : paidLineId(itemId);
      const other = prev.items.find((i) => i.id === targetId);
      const items = other
        ? prev.items.filter((i) => i.id !== itemId).map((i) => (i.id === targetId ? { ...i, quantity: i.quantity + item.quantity } : i))
        : prev.items.map((i) =>
            i.id === itemId
              ? { ...i, id: targetId, isGift, giftReason: isGift ? reason : undefined, priceOverride: isGift ? false : i.priceOverride }
              : i
          );
      return { ...prev, items };
    });
  };

  const removeItem = (itemId: string) => {
    setCart((prev) => ({ ...prev, items: prev.items.filter((item) => item.id !== itemId) }));
  };

  const resetSale = () => {
    setCart(emptyCart());
    setCustomer(null);
  };

  const clearCart = () => {
    if (confirm('Are you sure you want to clear the cart?')) resetSale();
  };

  const handleHoldCart = async () => {
    if (actionLock.current) return;
    if (cart.items.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    if (offlineMode) {
      toast.error('Holding an order needs internet');
      return;
    }
    actionLock.current = true;
    setHolding(true);
    try {
      const customerName = customer ? `${customer.firstName} ${customer.lastName}` : undefined;
      // Only the manual discount is saved (rules are applied again on retrieve).
      const manualAmount = quote?.manualDiscount || 0;
      await holdCart(
        {
          ...pricedCart,
          discount: manualAmount,
          discountType: manualAmount > 0 ? 'fixed' : null,
          discountReason: cart.manualDiscount?.reason || '',
          customer: customer ?? undefined,
        },
        customerName
      );
      await loadHeldCarts();
      resetSale();
      toast.success('Order held successfully');
      handleTabChange('held');
    } catch (error) {
      console.error('Failed to hold cart:', error);
      toast.error('Failed to hold order. Please try again.');
    } finally {
      actionLock.current = false;
      setHolding(false);
    }
  };

  const handleRetrieveCart = async (cartId: string) => {
    if (actionLock.current) return;
    actionLock.current = true;
    setHeldBusy({ id: cartId, action: 'retrieve' });
    try {
      const held = await retrieveHeldCart(cartId);
      if (held) {
        const manual: ManualDiscount | null =
          held.cart.discount > 0 ? { type: 'fixed', value: held.cart.discount, reason: held.cart.discountReason || '' } : null;
        setCart({ ...held.cart, manualDiscount: manual });
        setCustomer(held.cart.customer || null);
        await loadHeldCarts();
        handleTabChange('products');
      }
    } catch (error) {
      console.error('Failed to retrieve cart:', error);
      toast.error('Failed to retrieve order. Please try again.');
    } finally {
      actionLock.current = false;
      setHeldBusy(null);
    }
  };

  const handleDeleteHeldCart = async (cartId: string) => {
    if (actionLock.current) return;
    if (confirm('Are you sure you want to delete this held order?')) {
      actionLock.current = true;
      setHeldBusy({ id: cartId, action: 'delete' });
      try {
        await clearHeldCart(cartId);
        await loadHeldCarts();
      } catch (error) {
        console.error('Failed to delete held cart:', error);
        toast.error('Failed to delete held order. Please try again.');
      } finally {
        actionLock.current = false;
        setHeldBusy(null);
      }
    }
  };

  const handleCheckout = () => {
    if (holding || paying) return;
    if (cart.items.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    if (tillBlocked) {
      toast.error(tillBlocked);
      return;
    }
    if (quoteError) {
      toast.error(quoteError.message);
      return;
    }
    if (!quoteReady) {
      toast('Prices are updating — try again in a second', { icon: '⏳', id: 'pos-wait' });
      return;
    }
    setShowPaymentModal(true);
  };
  const checkoutRef = useRef(handleCheckout);
  checkoutRef.current = handleCheckout;

  // Installable app + offline copy of this screen (production only).
  useEffect(() => {
    registerPosServiceWorker();
  }, []);

  // Tell the cashier when offline sales reach the server.
  useEffect(
    () =>
      onUploadDone((s) => {
        if (s.uploaded.length) {
          const warned = s.uploaded.filter((u) => u.warnings.some((w) => ['PRICE_DIFF', 'STOCK_SHORT', 'NOT_ALLOWED'].includes(w.code))).length;
          toast.success(
            `${s.uploaded.length} offline sale${s.uploaded.length === 1 ? '' : 's'} uploaded${warned ? ` (${warned} with notes for the manager)` : ''}`,
            { id: 'offline-upload', duration: 5000 }
          );
        }
        if (s.failed) toast.error(`${s.failed} offline sale${s.failed === 1 ? '' : 's'} need attention (see the badge at the top)`, { duration: 7000 });
      }),
    []
  );

  // F2 = search, F9 = payment
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (e.key === 'F9') {
        e.preventDefault();
        checkoutRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handlePaymentConfirm = async (
    paymentMethod: PaymentMethodType,
    cashAmount?: number,
    bankTransferScreenshot?: string,
    isPartialPayment?: boolean,
    paidAmount?: number,
    customerInfo?: CustomerInfo
  ) => {
    // One payment at a time: a double click must never create two orders.
    if (payLock.current || !quote) return;
    payLock.current = true;
    setPaying(true);
    // One id for this sale: sent with the online order AND used for the offline
    // copy if the online call is lost, so the server never counts it twice.
    const clientId = uuid();
    const goOffline = async () => {
      const jwt = decodeJwt<UserPayload>(getAuthToken() || '');
      const me = access?.user;
      const order = await saveOfflineSale({
        clientId,
        items: cart.items,
        quote,
        manualDiscount: cart.manualDiscount,
        taxIds: selectedTaxIds,
        paymentMethod,
        cashAmount,
        isPartialPayment,
        paidAmount,
        customer,
        customerInfo,
        cashier: {
          id: me?.id || jwt?.id || '',
          firstName: me?.firstName || jwt?.firstName,
          lastName: me?.lastName || jwt?.lastName,
          email: me?.email || jwt?.email,
        },
      });
      toast.success(`Offline sale ${order.orderNumber} saved on this PC. It will upload by itself.`, { duration: 5000 });
      setLastOrder(order);
      resetSale();
      setShowPaymentModal(false);
      setMobileView('products');
      printReceipt(order, storeName, symbol);
      setTimeout(() => searchRef.current?.focus(), 50);
    };
    try {
      if (offlineModeRef.current || quote.offline) {
        if (!offlineEnabled) {
          toast.error('No internet. This user cannot sell offline.', { duration: 5000 });
          return;
        }
        await goOffline();
        return;
      }
      // A name typed while offline is not a customer record: send it as customerInfo.
      let customerId = customer && !isTypedCustomer(customer) ? customer._id : undefined;
      if (customerInfo && !customerId) {
        try {
          const nameParts = customerInfo.name.trim().split(' ');
          const customerResult = await createOrFindCustomer({
            firstName: nameParts[0] || customerInfo.name,
            lastName: nameParts.slice(1).join(' ') || '',
            phone: customerInfo.phone,
          });
          customerId = customerResult.data._id;
        } catch (customerError) {
          if (offlineEnabled && isNetworkError(customerError)) {
            reportNetworkFailure();
            await goOffline();
            return;
          }
          console.error('Failed to create/find customer:', customerError);
          toast.error(`Failed to save customer: ${customerError instanceof Error ? customerError.message : 'Unknown error'}`);
          return;
        }
      }

      const total = quote.total;
      const orderData: POSOrderData = {
        items: cartToOrderItems(cart.items),
        customer: customerId,
        customerInfo,
        // Informational only — the server prices the bill itself.
        subtotal: quote.subtotal,
        tax: quote.tax,
        appliedTaxes: quote.appliedTaxes,
        discount: quote.discount,
        total,
        manualDiscount: cart.manualDiscount || null,
        taxIds: selectedTaxIds,
        expectedTotal: total,
        paymentMethod,
        cashAmount: paymentMethod === 'cash' || paymentMethod === 'bank_transfer' ? cashAmount : undefined,
        cardAmount: paymentMethod === 'card' ? total : undefined,
        change: cashAmount && (paymentMethod === 'cash' || paymentMethod === 'bank_transfer') ? cashAmount - total : undefined,
        bankTransferScreenshot: paymentMethod === 'bank_transfer' ? bankTransferScreenshot : undefined,
        isPOS: true,
        isPartialPayment,
        paidAmount: isPartialPayment ? paidAmount : undefined,
        clientId,
      };

      let order: POSOrder;
      try {
        order = await createPOSOrder(orderData);
        reportNetworkOk();
      } catch (sendError) {
        if (isNetworkError(sendError)) {
          reportNetworkFailure();
          if (offlineEnabled) {
            await goOffline();
            return;
          }
          toast.error('No internet. The sale was not saved. Try again when the connection is back.', { duration: 6000 });
          return;
        }
        throw sendError;
      }

      const pendingAmount = order.pendingAmount || 0;
      if (pendingAmount > 0) {
        toast.success(`Order #${order.orderNumber} saved. Paid: ${(order.paidAmount || 0).toFixed(2)} / Pending: ${pendingAmount.toFixed(2)}`);
      } else {
        toast.success(`Order #${order.orderNumber} completed`);
      }
      setLastOrder(order);
      resetSale();
      setShowPaymentModal(false);
      setMobileView('products');
      setTimeout(() => searchRef.current?.focus(), 50);
    } catch (error) {
      console.error('Order creation failed:', error);
      if (error instanceof POSApiError) {
        if (error.code === 'TILL_NOT_OPEN') {
          setTillMessage(error.message || 'Your till is not open. Open it in the bar above, then take the payment.');
          setShowPaymentModal(false);
          toast.error(error.message || 'Open your till first', { duration: 6000 });
          return;
        }
        if (error.code === 'TOTAL_CHANGED' && error.data) {
          acceptQuote(error.data as CartQuote);
          toast.error(error.message, { duration: 6000 });
          return; // modal stays open with the new total
        }
        toast.error(error.message, { duration: 5000 });
        if (error.status === 403 || error.status === 400) setShowPaymentModal(false);
        return;
      }
      if (error instanceof Error && /offline database|indexeddb/i.test(error.message || '')) {
        toast.error(`Could not save the sale on this PC: ${error.message}`, { duration: 7000 });
        return;
      }
      toast.error(`Payment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      payLock.current = false;
      setPaying(false);
    }
  };

  const showInsight = (product: POSProduct, variantId?: string | null) => {
    if (!product._id || product._id.startsWith('custom-')) return;
    setInsight({ productId: product._id, variantId: variantId || null });
  };

  const tabButton = (key: POSTab, label: React.ReactNode, active: string, disabledReason?: string | null) => (
    <button
      onClick={() => handleTabChange(key)}
      disabled={!!disabledReason}
      title={disabledReason || undefined}
      className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors relative whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed ${
        tab === key ? `${active} text-white` : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {label}
    </button>
  );

  const cartCount = cart.items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-3rem)] sm:h-[calc(100vh-3.5rem)] md:h-[calc(100vh-4rem)] bg-gray-50 -m-2 sm:-m-4 lg:-m-6">
      {/* Left Panel - Products */}
      <div className={`flex-1 min-h-0 flex-col overflow-hidden ${mobileView === 'cart' ? 'hidden lg:flex' : 'flex'}`}>
        <div className="bg-white border-b border-gray-200 p-3 sm:p-4 space-y-3">
          <TillStatusBar onStatusChange={setTill} />

          <div className="flex items-center justify-between gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Point of Sale</h1>
            <div className="flex items-center gap-2 min-w-0">
              <OfflineBadge status={offline} symbol={symbol} />
              <div className="text-xs sm:text-sm text-gray-500 truncate">{storeName}</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {tabButton('products', <><Filter className="h-4 w-4 inline mr-1.5" />Products</>, 'bg-honey-500')}
            {tabButton(
              'held',
              <>
                <Archive className="h-4 w-4 inline mr-1.5" />
                Held Orders
                {heldCarts.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-honey-500 text-gray-900 text-xs rounded-full w-5 h-5 flex items-center justify-center">{heldCarts.length}</span>
                )}
              </>,
              'bg-honey-500',
              offlineMode ? `${NEEDS_INTERNET}: held orders are kept on the server` : null
            )}
            {tabButton(
              'pending',
              <><AlertCircle className="h-4 w-4 inline mr-1.5" />Pending Payments</>,
              'bg-orange-600',
              offlineMode ? `${NEEDS_INTERNET}: payments and sales history are on the server` : null
            )}
          </div>

          {tillMessage && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span className="flex-1">{tillMessage}</span>
              <button onClick={() => setTillMessage(null)} className="text-xs underline">OK</button>
            </div>
          )}
          {lastOrder && <LastSaleBar order={lastOrder} storeName={storeName} symbol={symbol} onClose={() => setLastOrder(null)} />}

          {tab === 'products' && (
            <ProductSearch
              value={searchQuery}
              onChange={setSearchQuery}
              onBarcodeScanned={handleScan}
              searching={isSearching && trimmedQuery !== ''}
              scanning={scanning}
              resultCount={!isSearching && trimmedQuery ? products.length : undefined}
              inputRef={searchRef}
            />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 pb-20 lg:pb-4">
          {tab === 'products' && (
            <ProductGrid
              products={products}
              onSelectProduct={handleProductSelect}
              onShowInsight={(p) => showInsight(p)}
              loading={isSearching}
              currency={'PKR'}
              searchQuery={trimmedQuery}
              resultsQuery={loadedQuery ?? ''}
            />
          )}
          {offlineMode && tab !== 'products' && (
            <div className="max-w-md mx-auto mt-10 p-4 text-center text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg">
              This needs internet. Go to Products to keep selling; it opens again when the connection is back.
            </div>
          )}
          {!offlineMode && tab === 'held' && (
            <HeldOrders heldCarts={heldCarts} onRetrieve={handleRetrieveCart} onDelete={handleDeleteHeldCart} busy={heldBusy} currency={'PKR'} />
          )}
          {!offlineMode && tab === 'pending' && <PendingPaymentsTab currency={'PKR'} onPaymentComplete={() => {}} />}
        </div>
      </div>

      {/* Right Panel - Cart */}
      <div className={`w-full lg:w-96 flex-shrink-0 min-h-0 flex-1 lg:flex-none pb-16 lg:pb-0 ${mobileView === 'products' ? 'hidden lg:block' : 'block'}`}>
        <CartPanel
          cart={cart}
          quote={quote}
          quoteLoading={quoteLoading}
          quoteError={quoteError}
          quoteReady={quoteReady}
          customer={customer}
          onUpdateQuantity={updateQuantity}
          onRemoveItem={removeItem}
          onUpdateUnitPrice={canEditPrice ? updateUnitPrice : undefined}
          canGoBelowList={canGoBelowList}
          onToggleGift={canGift ? toggleGift : undefined}
          onShowInsight={(item) => showInsight(item.product, item.variantId)}
          onClearCart={clearCart}
          onHoldCart={handleHoldCart}
          onCheckout={handleCheckout}
          holding={holding}
          paying={paying}
          blockedReason={tillBlocked}
          holdDisabledReason={offlineMode ? `${NEEDS_INTERNET}: held orders are kept on the server` : null}
          onSelectCustomer={() => setShowCustomerSelector(true)}
          currency={'PKR'}
          availableTaxes={availableTaxes}
          selectedTaxIds={selectedTaxIds}
          onTaxSelectionChange={setSelectedTaxIds}
          onApplyDiscount={(discount) => setCart((prev) => ({ ...prev, manualDiscount: discount }))}
        />
      </div>

      {/* Phones: switch between products and cart */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 p-2 bg-white border-t border-gray-200 shadow-lg">
        <button
          type="button"
          onClick={() => setMobileView(mobileView === 'products' ? 'cart' : 'products')}
          className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-lg bg-honey-500 text-gray-900 font-semibold"
        >
          {mobileView === 'products' ? (
            <>
              <span className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" /> Cart · {cartCount} pcs
              </span>
              <span>{symbol}{(quote?.total ?? 0).toFixed(2)}</span>
            </>
          ) : (
            <span className="flex items-center gap-2 mx-auto">
              <LayoutGrid className="h-5 w-5" /> Back to products
            </span>
          )}
        </button>
      </div>

      {/* Modals */}
      <CustomerSelector
        isOpen={showCustomerSelector}
        onClose={() => setShowCustomerSelector(false)}
        onSelect={setCustomer}
        currentCustomer={customer}
        offline={offlineMode}
      />

      <VariantSelector
        isOpen={showVariantSelector}
        product={selectedProduct}
        onClose={() => {
          setShowVariantSelector(false);
          setSelectedProduct(null);
        }}
        onSelect={handleVariantSelect}
      />

      <PaymentModal
        isOpen={showPaymentModal}
        cart={pricedCart}
        customer={customer}
        onClose={() => {
          if (!paying) setShowPaymentModal(false);
        }}
        onConfirm={handlePaymentConfirm}
        processing={paying}
        currency={'PKR'}
        offline={offlineMode || !!quote?.offline}
      />

      <ProductInsightPanel productId={insight?.productId ?? null} variantId={insight?.variantId ?? null} open={!!insight} onClose={() => setInsight(null)} />
    </div>
  );
}
