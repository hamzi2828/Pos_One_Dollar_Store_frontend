// Racks, shelves & stock locations API (backend: routes/modules/racksRoutes.js).
// Used by /admin/inventory/racks, /admin/inventory/putaway and components/store/ShelfPicker.
import { storeApi, API_URL, type PageMeta } from '@/lib/storeApi';
import { getAuthHeader } from '@/helper/helper';

// ---------- types ----------

export interface ShelfView {
  _id: string;
  rack: string;
  rackCode: string;
  code: string;
  level: number;
  name: string;
  capacity: number | null;
  isActive: boolean;
  /** pieces on the shelf */
  pieces: number;
  /** different products on the shelf */
  products: number;
  units: number;
}

export interface RackView {
  _id: string;
  zone: string;
  number: number;
  code: string;
  name: string;
  description: string;
  categories: string[];
  shelfCount: number;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  shelves: ShelfView[];
  pieces: number;
  products: number;
  usedShelves: number;
}

export interface ZoneSummary {
  zone: string;
  racks: number;
  shelves: number;
}

export interface RackListMeta extends PageMeta {
  zones: ZoneSummary[];
}

export interface GenerateResult {
  zones: string[];
  racksPerZone: number;
  shelvesPerRack: number;
  racksCreated: number;
  racksSkipped: number;
  shelvesCreated: number;
  shelvesSkipped: number;
}

/** Shelf picker row (GET /locations/shelves). */
export interface ShelfOption {
  _id: string;
  code: string;
  rackCode: string;
  rackId: string;
  level: number;
  name: string;
  rackName: string;
  capacity: number | null;
  isActive: boolean;
  pieces: number;
  products: number;
}

export interface ShelfItem {
  productId: string;
  variantId: string | null;
  name: string;
  variantLabel: string;
  category: string;
  code: string;
  price: number | null;
  thumbnailUrl: string | null;
  qty: number;
  isHome: boolean;
  firstPlacedAt: string | null;
  lastMovedAt: string | null;
  daysOnShelf: number | null;
}

export interface ShelfDetail {
  shelf: ShelfOption & { rackCategories: string[] };
  items: ShelfItem[];
}

export interface UnitShelf {
  shelfId: string;
  code: string;
  qty: number;
  isHome: boolean;
  firstPlacedAt?: string | null;
  daysOnShelf?: number | null;
}

/** One sellable unit (product or variant) with its stock split (warehouse / shelves). */
export interface UnitLocation {
  productId: string;
  variantId: string | null;
  name: string;
  variantLabel: string;
  category: string;
  code: string;
  price: number | null;
  thumbnailUrl: string | null;
  total: number;
  shelved: number;
  warehouse: number;
  lastReceivedAt: string | null;
  shelves: UnitShelf[];
}

export interface WarehouseItem extends UnitLocation {
  costPrice: number | null;
  homeShelf: UnitShelf | null;
  daysSinceReceived: number | null;
}

export interface WarehouseMeta extends PageMeta {
  totalPieces: number;
}

export interface ProductBrief {
  _id: string;
  name: string;
  category: string;
  productType: 'single' | 'variant';
  thumbnailUrl: string | null;
}

export type ScanResult =
  | ({ kind: 'shelf'; code: string } & ShelfDetail)
  | {
      kind: 'product';
      code: string;
      match: { variantId: string | null; kind: string; qty: number; batchNo: string | null };
      product: ProductBrief;
      /** null when the product has several variants and none was scanned */
      unit: UnitLocation | null;
      units: UnitLocation[];
    }
  | { kind: 'rack'; code: string; rack: RackView };

export interface ActivityRow {
  _id: string;
  type: 'putaway' | 'location_move';
  productId: string;
  variantId: string | null;
  name: string;
  code: string;
  quantity: number;
  from: string;
  to: string;
  user: string;
  note: string;
  occurredAt: string;
}

export interface PutawayLine {
  productId: string;
  variantId?: string | null;
  shelfId?: string;
  shelfCode?: string;
  qty: number;
  note?: string;
}

export interface PutawayResult {
  productId: string;
  variantId: string | null;
  shelf: { _id: string; code: string };
  qty: number;
  split: { total: number; shelved: number; warehouse: number };
}

export interface MoveBody {
  productId: string;
  variantId?: string | null;
  fromShelfId?: string;
  fromShelfCode?: string;
  /** null / missing = back to the warehouse */
  toShelfId?: string | null;
  toShelfCode?: string;
  qty: number;
  note?: string;
}

export type LabelSize = '50x30' | '60x40' | '100x50' | 'a4';
export type LabelType = 'shelf' | 'rack' | 'both';

export const LABEL_SIZES: { key: LabelSize; label: string }[] = [
  { key: '50x30', label: '50 × 30 mm (label roll)' },
  { key: '60x40', label: '60 × 40 mm (label roll)' },
  { key: '100x50', label: '100 × 50 mm (big shelf strip)' },
  { key: 'a4', label: 'A4 sheet (24 labels per page)' },
];

// ---------- helpers ----------

/** "Kids Cup · Red" */
export const unitName = (u: { name: string; variantLabel?: string }) => (u.variantLabel ? `${u.name} · ${u.variantLabel}` : u.name);

/** Stable key of a unit. */
export const unitKey = (u: { productId: string; variantId: string | null }) => `${u.productId}|${u.variantId || ''}`;

/** "today" / "1 day" / "12 days" */
export function daysText(days: number | null | undefined): string {
  if (days === null || days === undefined) return '—';
  if (days <= 0) return 'today';
  return `${days} day${days === 1 ? '' : 's'}`;
}

// ---------- API ----------

export const racksApi = {
  list(params?: { zone?: string; search?: string; isActive?: boolean }) {
    return storeApi.get<RackView[]>('/racks', params) as Promise<{ data: RackView[]; meta?: RackListMeta; success: boolean }>;
  },
  async get(id: string) {
    return (await storeApi.get<RackView>(`/racks/${id}`)).data;
  },
  async generate(body: { zones: string[]; racksPerZone: number; shelvesPerRack: number }) {
    const res = await storeApi.post<GenerateResult>('/racks/generate', body);
    return { result: res.data, message: res.message || '' };
  },
  async create(body: { zone: string; number: number; name?: string; description?: string; categories?: string[]; shelves?: number }) {
    return (await storeApi.post<RackView>('/racks', body)).data;
  },
  async update(id: string, body: Partial<Pick<RackView, 'name' | 'description' | 'categories' | 'sortOrder' | 'isActive'>>) {
    return (await storeApi.put<RackView>(`/racks/${id}`, body)).data;
  },
  async remove(id: string) {
    await storeApi.del(`/racks/${id}`);
  },
  async addShelf(rackId: string, body: { name?: string; capacity?: number | null } = {}) {
    return (await storeApi.post<RackView>(`/racks/${rackId}/shelves`, body)).data;
  },
  async updateShelf(id: string, body: { name?: string; capacity?: number | null; isActive?: boolean }) {
    return (await storeApi.put<ShelfView>(`/racks/shelves/${id}`, body)).data;
  },
  async deleteShelf(id: string) {
    await storeApi.del(`/racks/shelves/${id}`);
  },

  /** Printable label page (HTML). */
  async labelsHtml(params: { rackId?: string; zone?: string; type: LabelType; size: LabelSize; copies?: number }): Promise<string> {
    const q = new URLSearchParams();
    if (params.rackId) q.set('rackId', params.rackId);
    if (params.zone) q.set('zone', params.zone);
    q.set('type', params.type);
    q.set('size', params.size);
    if (params.copies && params.copies > 1) q.set('copies', String(params.copies));
    const res = await fetch(`${API_URL}/racks/labels?${q.toString()}`, { headers: getAuthHeader(), cache: 'no-store' });
    if (!res.ok) {
      let msg = '';
      try {
        msg = ((await res.json()) as { message?: string }).message || '';
      } catch {
        /* not JSON */
      }
      throw new Error(msg || 'Could not make the labels');
    }
    return res.text();
  },

  // ----- locations -----
  async shelves(params?: { search?: string; rackId?: string; includeInactive?: boolean; limit?: number }) {
    return (await storeApi.get<ShelfOption[]>('/locations/shelves', params)).data;
  },
  async shelf(id: string) {
    return (await storeApi.get<ShelfDetail>(`/locations/shelves/${id}`)).data;
  },
  async scan(code: string) {
    return (await storeApi.get<ScanResult>(`/locations/scan/${encodeURIComponent(code.trim())}`)).data;
  },
  async searchProducts(search: string, limit = 20) {
    return (await storeApi.get<UnitLocation[]>('/locations/products', { search, limit })).data;
  },
  async product(productId: string) {
    return (await storeApi.get<{ product: ProductBrief; units: UnitLocation[] }>(`/locations/products/${productId}`)).data;
  },
  warehouse(params: { search?: string; sort?: string; page?: number; limit?: number }) {
    return storeApi.get<WarehouseItem[]>('/locations/warehouse', params) as Promise<{ data: WarehouseItem[]; meta?: WarehouseMeta; success: boolean }>;
  },
  async activity(limit = 15) {
    return (await storeApi.get<ActivityRow[]>('/locations/activity', { limit })).data;
  },
  async putaway(line: PutawayLine) {
    const res = await storeApi.post<PutawayResult>('/locations/putaway', line);
    return { result: res.data, message: res.message || '' };
  },
  async move(body: MoveBody) {
    const res = await storeApi.post<{ qty: number }>('/locations/move', body);
    return res.message || 'Moved';
  },
  async homeShelf(body: { productId: string; variantId?: string | null; shelfId: string; isHome: boolean }) {
    const res = await storeApi.post('/locations/home-shelf', body);
    return res.message || 'Saved';
  },
};
