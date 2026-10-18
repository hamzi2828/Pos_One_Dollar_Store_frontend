// Shared types + API helpers for the stock-operations pages
// (movements, damages, shop use, adjustments, stock timeline).
// Backend: pos_backend/src/routes/modules/stockOpsRoutes.js
import axios from 'axios';
import { getAuthHeader } from '@/helper/helper';
import { API_URL, storeApi } from '@/lib/storeApi';

/* ---------------- units (scan / search) ---------------- */

export interface ShelfQty {
  shelfId?: string;
  code: string;
  qty: number;
  isHome?: boolean;
}

export interface StockUnit {
  productId: string;
  variantId: string | null;
  name: string;
  variantLabel: string;
  category: string;
  code: string;
  thumbnailUrl: string | null;
  price: number;
  costPrice: number;
  vendorId: string | null;
  vendorName: string;
  available: number;
  shelves: ShelfQty[];
  warehouse: number;
}

export interface LookupResult extends Partial<StockUnit> {
  scannedCode: string;
  batchNo: string | null;
  packQty: number;
  needsVariant: boolean;
  productId: string;
  name: string;
  variants?: StockUnit[];
}

export const unitTitle = (u: { name: string; variantLabel?: string }) => (u.variantLabel ? `${u.name} (${u.variantLabel})` : u.name);
export const unitKey = (u: { productId: string; variantId?: string | null }) => `${u.productId}:${u.variantId || ''}`;

export async function lookupCode(code: string): Promise<LookupResult> {
  const res = await storeApi.get<LookupResult>(`/stock-ops/lookup/${encodeURIComponent(code.trim())}`);
  return res.data;
}

export async function searchUnits(search: string, limit = 12): Promise<StockUnit[]> {
  const res = await storeApi.get<StockUnit[]>('/stock-ops/products', { search, limit });
  return res.data || [];
}

/* ---------------- movements ---------------- */

export type MovementType =
  | 'opening'
  | 'purchase_receipt'
  | 'receive'
  | 'consignment_in'
  | 'consignment_return'
  | 'putaway'
  | 'location_move'
  | 'sale'
  | 'gift'
  | 'sale_return'
  | 'damage'
  | 'internal_use'
  | 'vendor_return'
  | 'adjustment_in'
  | 'adjustment_out';

export const MOVEMENT_TYPES: { value: MovementType; label: string }[] = [
  { value: 'purchase_receipt', label: 'Purchase receipt' },
  { value: 'receive', label: 'Received' },
  { value: 'opening', label: 'Opening stock' },
  { value: 'consignment_in', label: 'Consignment in' },
  { value: 'consignment_return', label: 'Consignment return' },
  { value: 'putaway', label: 'Put on shelf' },
  { value: 'location_move', label: 'Moved' },
  { value: 'sale', label: 'Sold' },
  { value: 'gift', label: 'Gift' },
  { value: 'sale_return', label: 'Sale return' },
  { value: 'damage', label: 'Damaged' },
  { value: 'internal_use', label: 'Shop use' },
  { value: 'vendor_return', label: 'Returned to vendor' },
  { value: 'adjustment_in', label: 'Adjustment +' },
  { value: 'adjustment_out', label: 'Adjustment −' },
];

export interface MovementRow {
  _id: string;
  occurredAt: string;
  type: MovementType;
  typeLabel: string;
  direction: 'in' | 'out' | 'move';
  quantity: number;
  qtyChange: number;
  balanceAfter: number | null;
  productId: string;
  variantId: string | null;
  productName: string;
  code: string;
  category: string;
  from: string;
  to: string;
  shelves: { code: string; qty: number }[];
  unitCost: number | null;
  totalCost: number | null;
  unitPrice: number | null;
  purchasePrice: number | null;
  vendorId: string | null;
  vendorName: string;
  refType: string;
  refId: string | null;
  refNo: string;
  userId: string | null;
  userName: string;
  note: string;
}

export interface MovementSummary {
  piecesIn: number;
  piecesOut: number;
  piecesMoved: number;
  valueIn: number;
  valueOut: number;
}

/* ---------------- damages ---------------- */

export type DamageReason = 'broken' | 'expired' | 'defective' | 'water_damage' | 'rodent' | 'missing' | 'other';
export type DamageStatus = 'pending' | 'approved' | 'rejected';

export const DAMAGE_REASONS: { value: DamageReason; label: string }[] = [
  { value: 'broken', label: 'Broken' },
  { value: 'expired', label: 'Expired' },
  { value: 'defective', label: 'Defective' },
  { value: 'water_damage', label: 'Water damage' },
  { value: 'rodent', label: 'Rodent / pest' },
  { value: 'missing', label: 'Missing' },
  { value: 'other', label: 'Other' },
];
export const reasonLabel = (r: string) => DAMAGE_REASONS.find((x) => x.value === r)?.label || r;

export interface DamageRecord {
  _id: string;
  damageNo: string;
  date: string;
  product: string;
  variantId: string | null;
  productName: string;
  variantLabel: string;
  category: string;
  code: string;
  scannedCode: string;
  batchNo: string;
  qty: number;
  location: 'shelf' | 'warehouse';
  shelfCode: string;
  reason: DamageReason;
  description: string;
  photos: string[];
  unitCost: number;
  totalLoss: number;
  salePrice: number;
  vendorName: string;
  claimable: boolean;
  status: DamageStatus;
  reportedByName: string;
  approvedByName: string;
  approvedAt: string | null;
  rejectedByName: string;
  rejectReason: string;
  barcodeSvg?: string | null;
  createdAt: string;
}

export interface DamageDay {
  date: string;
  rows: DamageRecord[];
  totals: {
    reports: number;
    pieces: number;
    loss: number;
    saleValue: number;
    pending: number;
    approved: number;
    rejected: number;
    claimableLoss: number;
  };
  byReason: { reason: DamageReason; label: string; pieces: number; loss: number }[];
}

/* ---------------- shop use ---------------- */

export interface ShopUseLine {
  _id: string;
  product: string;
  variantId: string | null;
  productName: string;
  variantLabel: string;
  code: string;
  qty: number;
  unitCost: number;
  total: number;
  restored: boolean;
}

export interface ShopUseRecord {
  _id: string;
  shopUseNo: string;
  date: string;
  lines: ShopUseLine[];
  purpose: string;
  takenByName: string;
  takenByUserName: string;
  totalCost: number;
  totalQty: number;
  expense: string | null;
  status: 'active' | 'voided';
  createdByName: string;
  voidedByName: string;
  voidedAt: string | null;
  voidReason: string;
}

/* ---------------- adjustments ---------------- */

export type AdjustmentReason = 'count_correction' | 'found' | 'lost' | 'opening' | 'other';

export const ADJUSTMENT_REASONS: { value: AdjustmentReason; label: string; hint: string }[] = [
  { value: 'count_correction', label: 'Stock count', hint: 'Type the counted qty; the difference is corrected.' },
  { value: 'found', label: 'Found stock', hint: 'Pieces found — adds stock.' },
  { value: 'lost', label: 'Lost stock', hint: 'Pieces lost — removes stock.' },
  { value: 'opening', label: 'Opening stock', hint: 'First stock of an item — adds stock.' },
  { value: 'other', label: 'Other', hint: 'Add (+) or remove (−) pieces.' },
];
export const adjustmentReasonLabel = (r: string) => ADJUSTMENT_REASONS.find((x) => x.value === r)?.label || r;

export interface AdjustmentLine {
  _id: string;
  product: string;
  variantId: string | null;
  productName: string;
  variantLabel: string;
  code: string;
  systemQty: number;
  countedQty: number | null;
  diff: number;
  unitCost: number;
  applied: boolean;
  error: string;
}

export interface StockAdjustment {
  _id: string;
  adjNo: string;
  reason: AdjustmentReason;
  lines: AdjustmentLine[];
  notes: string;
  status: 'draft' | 'applied' | 'cancelled';
  totals: { lines: number; piecesIn: number; piecesOut: number; valueIn: number; valueOut: number };
  createdByName: string;
  appliedByName: string;
  appliedAt: string | null;
  createdAt: string;
}

/* ---------------- helpers ---------------- */

/** Today in Pakistan (YYYY-MM-DD). */
export const todayPKT = () => new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);

/** Random id for retry-safe create calls (same id = same document). */
export const newRequestId = () => {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

type Params = Record<string, string | number | boolean | undefined | null>;

/** GET a CSV endpoint with auth and save it as a file. */
export async function downloadCsv(path: string, params: Params, fallbackName: string) {
  const clean: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') clean[k] = v;
  const res = await axios.get(`${API_URL}${path}`, { params: clean, headers: getAuthHeader(), responseType: 'blob' });
  const disposition = String(res.headers['content-disposition'] || '');
  const match = /filename="?([^"]+)"?/.exec(disposition);
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = match ? match[1] : fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Absolute URL for an uploaded photo (local /uploads paths live on the backend). */
export const photoUrl = (u: string) => (u.startsWith('/') ? `${process.env.NEXT_PUBLIC_BACKEND_URL || ''}${u}` : u);
