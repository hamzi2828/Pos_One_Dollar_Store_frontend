// src/lib/storeApi.ts
// Tiny client for the store-operations APIs (`${BACKEND}/api/...`).
//
//   import { storeApi, apiErrorMessage } from '@/lib/storeApi';
//   const res = await storeApi.get<Rack[]>('/racks', { zone: 'A' });   // res.data, res.meta
//   await storeApi.post('/racks/generate', { zones: ['A','B'], perZone: 20, shelvesPerRack: 4 });
//
// Backend response convention: { success, data, meta?, message? }.
import axios from 'axios';
import { getAuthHeader } from '@/helper/helper';

export { apiErrorMessage } from '@/helper/access';

export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';
export const API_URL = `${BACKEND_URL}/api`;

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: PageMeta & Record<string, unknown>;
  message?: string;
}

type Params = Record<string, string | number | boolean | undefined | null | string[]>;

const jsonHeaders = () => ({ 'Content-Type': 'application/json', ...getAuthHeader() });

const cleanParams = (params?: Params) => {
  if (!params) return undefined;
  const out: Record<string, string | number | boolean | string[]> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    out[k] = v;
  }
  return out;
};

export const storeApi = {
  async get<T>(path: string, params?: Params): Promise<ApiResponse<T>> {
    const res = await axios.get(`${API_URL}${path}`, { headers: jsonHeaders(), params: cleanParams(params) });
    return res.data;
  },
  async post<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    const res = await axios.post(`${API_URL}${path}`, body ?? {}, { headers: jsonHeaders() });
    return res.data;
  },
  async put<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    const res = await axios.put(`${API_URL}${path}`, body ?? {}, { headers: jsonHeaders() });
    return res.data;
  },
  async patch<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    const res = await axios.patch(`${API_URL}${path}`, body ?? {}, { headers: jsonHeaders() });
    return res.data;
  },
  async del<T>(path: string, params?: Params): Promise<ApiResponse<T>> {
    const res = await axios.delete(`${API_URL}${path}`, { headers: jsonHeaders(), params: cleanParams(params) });
    return res.data;
  },
  /** multipart/form-data (photo uploads). Do not set Content-Type: the browser adds the boundary. */
  async upload<T>(path: string, form: FormData, method: 'post' | 'put' = 'post'): Promise<ApiResponse<T>> {
    const res = await axios.request({ url: `${API_URL}${path}`, method, data: form, headers: { ...getAuthHeader() } });
    return res.data;
  },
};

/** Rs 1,234 (PKR, no decimals unless needed). */
export function formatRs(amount: number | null | undefined, { decimals }: { decimals?: number } = {}): string {
  const n = Number(amount) || 0;
  const d = decimals ?? (Number.isInteger(Math.round(n * 100) / 100) ? 0 : 2);
  return `Rs ${n.toLocaleString('en-PK', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
}

/** 18 Oct 2026 / 18 Oct 2026, 4:05 pm */
export function formatDate(value: string | Date | null | undefined, withTime = false): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  });
}
