// Asset register API (backend: routes/modules/hrRoutes.js -> services/hr/assetService.js).
import axios from 'axios';
import { API_URL, BACKEND_URL, storeApi } from '@/lib/storeApi';
import { getAuthHeader } from '@/helper/helper';

export type AssetStatus = 'active' | 'maintenance' | 'sold' | 'disposed';
export type DepMethod = 'straight_line' | 'none';

export interface AssetCategory {
  _id: string;
  name: string;
  code: string;
  description?: string;
  depreciationMethod: DepMethod;
  usefulLifeYears: number;
  isActive: boolean;
  sortOrder?: number;
  assetCount?: number;
}

export interface MaintenanceEntry {
  _id: string;
  date: string;
  cost: number;
  note: string;
}

export interface Asset {
  _id: string;
  assetCode?: string;
  name: string;
  category?: { _id: string; name: string; code: string; depreciationMethod: DepMethod; usefulLifeYears: number } | null;
  location?: string;
  assignedTo?: { _id: string; firstName: string; lastName: string; employeeCode?: string; designation?: string } | null;
  quantity: number;
  purchasePrice: number;
  purchaseDate: string;
  vendor?: string;
  vendorRef?: { _id: string; name: string; phone?: string } | null;
  invoiceNo?: string;
  serialNumber?: string;
  warrantyUntil?: string | null;
  depreciationMethod?: DepMethod | null;
  usefulLifeYears?: number | null;
  salvageValue?: number;
  status: AssetStatus;
  photos: string[];
  maintenanceLog: MaintenanceEntry[];
  disposal?: { date?: string | null; amount?: number | null; note?: string; bookValue?: number | null };
  description?: string;
  notes?: string;
  // computed by the server
  totalCost: number;
  salvageTotal: number;
  effectiveMethod: DepMethod;
  effectiveLifeYears: number | null;
  monthsUsed: number;
  monthlyDepreciation: number;
  accumulatedDepreciation: number;
  currentValue: number;
  fullyDepreciated: boolean;
  maintenanceCost: number;
  gainOnDisposal: number | null;
  warrantyActive: boolean;
}

export interface AssetPayload {
  name: string;
  category: string;
  location?: string;
  assignedTo?: string | null;
  quantity: number;
  purchasePrice: number;
  purchaseDate: string;
  vendor?: string;
  vendorRef?: string | null;
  invoiceNo?: string;
  serialNumber?: string;
  warrantyUntil?: string | null;
  depreciationMethod?: DepMethod | null;
  usefulLifeYears?: number | null;
  salvageValue?: number;
  status?: AssetStatus;
  description?: string;
  notes?: string;
  photos?: string[];
}

export interface SummaryGroup {
  categoryId: string | null;
  name: string;
  code: string;
  count: number;
  quantity: number;
  cost: number;
  currentValue: number;
  accumulatedDepreciation: number;
  maintenanceCost: number;
}

export interface AssetSummary {
  categories: SummaryGroup[];
  totals: Omit<SummaryGroup, 'categoryId' | 'name' | 'code'>;
  soldOrDisposed: { count: number; cost: number; received: number };
}

export const STATUS_LABEL: Record<AssetStatus, string> = {
  active: 'In use',
  maintenance: 'Maintenance',
  sold: 'Sold',
  disposed: 'Disposed',
};
export const STATUS_STYLE: Record<AssetStatus, string> = {
  active: 'bg-green-100 text-green-700',
  maintenance: 'bg-amber-100 text-amber-700',
  sold: 'bg-blue-100 text-blue-700',
  disposed: 'bg-gray-200 text-gray-600',
};

export const fileUrl = (url?: string | null) => (!url ? '' : /^https?:\/\//.test(url) ? url : `${BACKEND_URL}${url}`);
export const dateInput = (v?: string | null) => (v ? new Date(v).toISOString().slice(0, 10) : '');

/** Same straight-line rule as the server (for the form preview only). */
export function previewDepreciation(cost: number, salvage: number, lifeYears: number | null, method: DepMethod, purchaseDate: string) {
  if (method !== 'straight_line' || !lifeYears || lifeYears <= 0 || !purchaseDate) return { monthly: 0, currentValue: cost };
  const a = new Date(purchaseDate);
  const b = new Date();
  let months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) months -= 1;
  const lifeMonths = Math.round(lifeYears * 12);
  const s = Math.min(cost, Math.max(0, salvage));
  const monthly = (cost - s) / lifeMonths;
  const acc = Math.min(cost - s, monthly * Math.min(Math.max(0, months), lifeMonths));
  return { monthly: Math.round(monthly * 100) / 100, currentValue: Math.round((cost - acc) * 100) / 100 };
}

type ListParams = Record<string, string | number | undefined>;

export const assetApi = {
  list: (params: ListParams) => storeApi.get<Asset[]>('/assets', params),
  summary: async () => (await storeApi.get<AssetSummary>('/assets/summary')).data,
  get: async (id: string) => (await storeApi.get<Asset>(`/assets/${id}`)).data,
  create: async (body: AssetPayload) => (await storeApi.post<Asset>('/assets', body)).data,
  update: async (id: string, body: Partial<AssetPayload>) => (await storeApi.put<Asset>(`/assets/${id}`, body)).data,
  remove: (id: string) => storeApi.del(`/assets/${id}`),
  uploadPhotos: async (id: string, files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append('photos', f));
    return (await storeApi.upload<Asset>(`/assets/${id}/photos`, form)).data;
  },
  addMaintenance: async (id: string, body: { date?: string; cost?: number; note: string; status?: 'active' | 'maintenance' }) =>
    (await storeApi.post<Asset>(`/assets/${id}/maintenance`, body)).data,
  dispose: async (id: string, body: { type: 'sold' | 'disposed'; date?: string; amount?: number; note?: string }) =>
    (await storeApi.post<Asset>(`/assets/${id}/dispose`, body)).data,
  setStatus: async (id: string, status: 'active' | 'maintenance', note?: string) =>
    (await storeApi.post<Asset>(`/assets/${id}/status`, { status, note })).data,

  categories: async () => (await storeApi.get<AssetCategory[]>('/asset-categories')).data,
  createCategory: async (body: Partial<AssetCategory>) => (await storeApi.post<AssetCategory>('/asset-categories', body)).data,
  updateCategory: async (id: string, body: Partial<AssetCategory>) => (await storeApi.put<AssetCategory>(`/asset-categories/${id}`, body)).data,
  removeCategory: (id: string) => storeApi.del(`/asset-categories/${id}`),

  /** Download the CSV with the same filters as the list. */
  async exportCsv(params: ListParams) {
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
    let res;
    try {
      res = await axios.get(`${API_URL}/assets/export`, { params: clean, headers: getAuthHeader(), responseType: 'blob' });
    } catch (e) {
      // Error bodies arrive as a Blob too: read the JSON message out of it.
      const data = axios.isAxiosError(e) ? e.response?.data : null;
      if (data instanceof Blob) {
        let message = 'Export failed';
        try {
          message = JSON.parse(await data.text()).message || message;
        } catch {}
        throw new Error(message);
      }
      throw e;
    }
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `assets-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
