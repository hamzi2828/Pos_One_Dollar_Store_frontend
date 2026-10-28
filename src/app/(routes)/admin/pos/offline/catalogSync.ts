// Offline catalogue: GET /api/pos/offline/catalog on load and every 5 min
// while online (only for users with desktop_pos view + pos create), saved in
// IndexedDB. While offline, product list / search / barcode lookup and
// customers come from this copy.
'use client';

import { getAuthHeader } from '@/helper/helper';
import { accessCan, type AccessInfo } from '@/helper/access';
import type { POSCustomer, POSProduct, POSVariant } from '../types';
import type { ScanMatch } from '../services/posProductService';
import { idbGet, idbPut } from './db';
import { isNetworkError, isOnline, reportNetworkFailure, reportNetworkOk } from './connectivity';
import type { CatalogProduct, CatalogSnapshot } from './types';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';
const REFRESH_MS = 5 * 60 * 1000;
const SNAPSHOT_KEY = 'snapshot';

/**
 * Offline selling is on for: desktop_pos view (catalogue download) + desktop_pos
 * create (upload) + pos create. Once a catalogue is saved, its limits.canSellOffline
 * (worked out by the server) can switch it off too.
 */
export function canSellOffline(access: AccessInfo | null | undefined): boolean {
  const byRole =
    accessCan(access, 'desktop_pos', 'view') && accessCan(access, 'desktop_pos', 'create') && accessCan(access, 'pos', 'create');
  if (!byRole) return false;
  return current?.snapshot.limits?.canSellOffline !== false;
}

/* ---------------- in-memory copy + listeners ---------------- */

interface Indexed {
  snapshot: CatalogSnapshot;
  products: POSProduct[];
  byId: Map<string, POSProduct>;
  raw: Map<string, CatalogProduct>;
  codes: Map<string, { productId: string; variantId: string | null; qty: number; kind: string }>;
  batchOf: Map<string, string>;
}

let current: Indexed | null = null;
let loadPromise: Promise<Indexed | null> | null = null;
const listeners = new Set<() => void>();
let syncing = false;
let lastError: string | null = null;

const emit = () => listeners.forEach((l) => l());

export function subscribeCatalog(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function catalogInfo(): { version: string | null; savedAt: string | null; products: number; syncing: boolean; error: string | null } {
  return {
    version: current?.snapshot.version ?? null,
    savedAt: current?.snapshot.savedAt ?? null,
    products: current?.products.length ?? 0,
    syncing,
    error: lastError,
  };
}

const norm = (v: unknown) => String(v ?? '').trim().toUpperCase();

function toPOSProduct(p: CatalogProduct): POSProduct {
  const variants: POSVariant[] = (p.variants || []).map((v) => ({
    _id: v.variantId,
    variantId: v.variantId,
    color: v.color || '',
    size: v.size || '',
    price: Number(v.price) || 0,
    discountedPrice: v.discountedPrice,
    stock: Number(v.stock) || 0,
    sku: v.sku || '',
  }));
  const productType = p.productType || (variants.length > 0 ? 'variant' : 'single');
  return {
    _id: p._id,
    name: p.name,
    slug: p.slug || p._id,
    sku: p.sku,
    barcode: p.barcode,
    price: Number(p.price) || 0,
    discountedPrice: p.discountedPrice,
    stock: Number(p.stock) || 0,
    piecesPerSale: p.piecesPerSale,
    category: p.categoryName || p.category || '',
    thumbnailUrl: p.thumbnailUrl,
    productType,
    variants: productType === 'variant' ? variants : undefined,
    shortCode: p.shortCode,
    priceTier: p.priceTier?._id ?? null,
  };
}

function buildIndex(snapshot: CatalogSnapshot): Indexed {
  const products: POSProduct[] = [];
  const byId = new Map<string, POSProduct>();
  const raw = new Map<string, CatalogProduct>();
  const codes: Indexed['codes'] = new Map();
  const batchOf = new Map<string, string>();
  const add = (code: unknown, productId: string, variantId: string | null, qty: number, kind: string, force = false) => {
    const c = norm(code);
    if (!c) return;
    if (!force && codes.has(c)) return;
    codes.set(c, { productId, variantId, qty: Math.max(1, Math.floor(Number(qty) || 1)), kind });
  };
  for (const p of snapshot.products || []) {
    if (!p || !p._id) continue;
    const pos = toPOSProduct(p);
    products.push(pos);
    byId.set(p._id, pos);
    raw.set(p._id, p);
  }
  // The server's own code list first (exactly what resolveScan answers).
  for (const p of raw.values()) {
    for (const c of p.codes || []) {
      add(c.code, p._id, c.variantId || null, c.qty, c.kind);
      if (c.batchNo) batchOf.set(norm(c.code), norm(c.batchNo));
    }
  }
  // Fallbacks (older catalogue): box/pack codes, then variant codes, then product codes.
  for (const p of raw.values()) {
    for (const b of p.boxCodes || []) add(b.code, p._id, b.variantId || null, b.pieces, 'box');
  }
  for (const p of raw.values()) {
    for (const v of p.variants || []) {
      add(v.sku, p._id, v.variantId, 1, 'sku');
      add(v.barcode, p._id, v.variantId, 1, 'barcode');
      add(v.shortCode, p._id, v.variantId, 1, 'shortCode');
      for (const c of v.barcodes || []) add(c, p._id, v.variantId, 1, 'barcode');
    }
  }
  for (const p of raw.values()) {
    add(p.shortCode, p._id, null, 1, 'shortCode');
    add(p.sku, p._id, null, 1, 'sku');
    add(p.barcode, p._id, null, 1, 'barcode');
    for (const c of p.barcodes || []) add(c, p._id, null, 1, 'barcode');
  }
  products.sort((a, b) => a.name.localeCompare(b.name));
  return { snapshot, products, byId, raw, codes, batchOf };
}

/** Load the saved copy from IndexedDB into memory (once). */
export function loadCatalog(): Promise<Indexed | null> {
  if (current) return Promise.resolve(current);
  if (!loadPromise) {
    loadPromise = idbGet<CatalogSnapshot>('catalog', SNAPSHOT_KEY)
      .then((s) => {
        if (s && !current) {
          current = buildIndex(s);
          emit();
        }
        return current;
      })
      .catch(() => null)
      .finally(() => {
        loadPromise = null;
      });
  }
  return loadPromise;
}

export function getCatalogSnapshot(): CatalogSnapshot | null {
  return current?.snapshot ?? null;
}

/** Download a fresh catalogue. Returns true when saved. */
export async function syncCatalog(): Promise<boolean> {
  if (syncing || !BACKEND_URL || !isOnline()) return false;
  syncing = true;
  emit();
  try {
    const res = await fetch(`${BACKEND_URL}/api/pos/offline/catalog`, {
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      cache: 'no-store',
    });
    if (res.status === 502 || res.status === 503 || res.status === 504) throw Object.assign(new Error('Server not reachable'), { status: res.status });
    reportNetworkOk();
    if (!res.ok) {
      lastError = res.status === 403 ? 'No permission to download the offline catalogue' : `Catalogue download failed (${res.status})`;
      return false;
    }
    const body = await res.json();
    const data = (body?.data || null) as CatalogSnapshot | null;
    if (!data || !Array.isArray(data.products)) {
      lastError = 'Catalogue download was empty';
      return false;
    }
    const snapshot: CatalogSnapshot = {
      version: String(data.version || new Date().toISOString()),
      serverTime: data.serverTime,
      branchId: data.branchId,
      products: data.products,
      discountRules: Array.isArray(data.discountRules) ? data.discountRules : [],
      taxes: Array.isArray(data.taxes) ? data.taxes : [],
      customers: Array.isArray(data.customers) ? data.customers : [],
      limits: data.limits,
      shop: data.shop,
      till: data.till,
      savedAt: new Date().toISOString(),
    };
    await idbPut('catalog', snapshot, SNAPSHOT_KEY);
    current = buildIndex(snapshot);
    lastError = null;
    return true;
  } catch (e) {
    if (isNetworkError(e)) reportNetworkFailure();
    lastError = 'Could not download the catalogue';
    return false;
  } finally {
    syncing = false;
    emit();
  }
}

let timer: ReturnType<typeof setInterval> | null = null;
let users = 0;

/** Start the 5-minute refresh (call from the POS page; returns stop). */
export function startCatalogSync(): () => void {
  users++;
  void loadCatalog().then(() => syncCatalog());
  if (!timer && typeof window !== 'undefined') {
    timer = setInterval(() => {
      if (isOnline()) void syncCatalog();
    }, REFRESH_MS);
  }
  return () => {
    users--;
    if (users <= 0 && timer) {
      clearInterval(timer);
      timer = null;
      users = 0;
    }
  };
}

/* ---------------- offline lookups ---------------- */

/** Product list / search from the catalogue (name, code, category). */
export function searchCatalog(query: string, limit = 60): POSProduct[] {
  if (!current) return [];
  const q = query.trim().toLowerCase();
  if (!q) return current.products.slice(0, limit);
  const words = q.split(/\s+/).filter(Boolean);
  const exact = current.codes.get(norm(query));
  const out: POSProduct[] = [];
  if (exact) {
    const p = current.byId.get(exact.productId);
    if (p) out.push(p);
  }
  for (const p of current.products) {
    if (out.length >= limit) break;
    if (exact && p._id === exact.productId) continue;
    const r = current.raw.get(p._id);
    const hay = [p.name, p.sku, p.barcode, p.shortCode, p.category, ...(r?.barcodes || []), ...(p.variants || []).map((v) => v.sku)]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (words.every((w) => hay.includes(w))) out.push(p);
  }
  return out;
}

export type CatalogScan = { ok: true; product: POSProduct; match: ScanMatch } | { ok: false; status: 404; message: string };

/** Scanned / typed code from the catalogue (same answer shape as the barcode API). */
export function lookupCatalogCode(code: string): CatalogScan {
  const hit = current?.codes.get(norm(code));
  const product = hit ? current?.byId.get(hit.productId) : undefined;
  if (!hit || !product) return { ok: false, status: 404, message: 'Product not found' };
  const variant = hit.variantId ? product.variants?.find((v) => v.variantId === hit.variantId) : undefined;
  return {
    ok: true,
    product,
    match: {
      variantId: hit.variantId,
      batchNo: current?.batchOf.get(norm(code)) || null,
      qty: hit.qty,
      kind: hit.kind,
      code: norm(code),
      variantLabel: variant ? [variant.color, variant.size].filter(Boolean).join(' / ') : '',
      available: Number(variant ? variant.stock : product.stock) || 0,
      price: Number(variant ? variant.price : product.price) || 0,
      shelfCodes: [],
      location: null,
    },
  };
}

/** Product / variant price fields from the catalogue (null = not in it). */
export function catalogUnit(productId: string, variantId?: string | null): { price: number; discountedPrice?: number; stock?: number; name: string; variantLabel: string } | null {
  const p = current?.raw.get(productId);
  if (!p) return null;
  if (variantId) {
    const v = (p.variants || []).find((x) => String(x.variantId) === String(variantId));
    if (!v) return null;
    const label = v.label || [v.color, v.size].filter(Boolean).join(' / ');
    return { price: Number(v.price) || 0, discountedPrice: v.discountedPrice, stock: v.stock, name: label ? `${p.name} (${label})` : p.name, variantLabel: label };
  }
  return { price: Number(p.price) || 0, discountedPrice: p.discountedPrice, stock: p.stock, name: p.name, variantLabel: '' };
}

/** Customers from the catalogue (offline customer search). */
export function searchCatalogCustomers(query: string, limit = 50): POSCustomer[] {
  const list = current?.snapshot.customers || [];
  const q = query.trim().toLowerCase();
  const digits = q.replace(/\D/g, '');
  const hits = q
    ? list.filter((c) => (c.name || '').toLowerCase().includes(q) || (digits.length >= 3 && (c.phone || '').replace(/\D/g, '').includes(digits)))
    : list;
  return hits.slice(0, limit).map((c) => {
    const parts = String(c.name || '').trim().split(/\s+/);
    return { _id: c._id, firstName: parts[0] || 'Customer', lastName: parts.slice(1).join(' '), phone: c.phone, customerType: 'walk-in' as const };
  });
}
