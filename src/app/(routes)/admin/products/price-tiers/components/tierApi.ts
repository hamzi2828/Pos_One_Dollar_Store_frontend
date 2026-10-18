// Price tiers API (/api/price-tiers) — dollar-store price points like "Rs 280".
import { storeApi } from '@/lib/storeApi';

export interface PriceTier {
  _id: string;
  name: string;
  price: number;
  color: string;
  sortOrder: number;
  isActive: boolean;
  description: string;
  productCount?: number;
}

export type MarginFlag = 'negative' | 'low' | 'ok' | 'no_cost';

export interface TierProduct {
  _id: string;
  name: string;
  category: string;
  productType: 'single' | 'variant';
  shortCode?: string;
  sku?: string;
  thumbnailUrl?: string;
  status?: string;
  stock: number;
  variantCount: number;
  priceMatchesTier: boolean;
  price: number;
  /** Average landed cost per piece. */
  cost: number | null;
  margin: number | null;
  marginPct: number | null;
  flag: MarginFlag;
}

export interface TierDetail {
  tier: PriceTier;
  summary: { productCount: number; negative: number; low: number; ok: number; noCost: number; avgMarginPct: number | null; lowMarginPct: number };
  products: TierProduct[];
}

export interface Candidate {
  _id: string;
  name: string;
  category: string;
  productType: 'single' | 'variant';
  shortCode?: string;
  sku?: string;
  stock: number;
  variantCount: number;
  priceTier: { _id: string; name: string; price: number; color: string } | null;
  price: number;
  cost: number | null;
  marginPct: number | null;
  atTier: { price: number; margin: number | null; marginPct: number | null; flag: MarginFlag } | null;
}

export const tierApi = {
  list: (params?: { search?: string; isActive?: string }) => storeApi.get<PriceTier[]>('/price-tiers', { limit: 200, ...params }),
  detail: (id: string, params: { search?: string; flag?: string; page?: number; limit?: number }) => storeApi.get<TierDetail>(`/price-tiers/${id}`, params),
  create: (body: Partial<PriceTier>) => storeApi.post<PriceTier>('/price-tiers', body),
  update: (id: string, body: Partial<PriceTier>) => storeApi.put<PriceTier>(`/price-tiers/${id}`, body),
  remove: (id: string) => storeApi.del<{ unlinked: number }>(`/price-tiers/${id}`),
  assign: (id: string, productIds: string[]) => storeApi.post<{ updated: number; movedFromOtherTier: number }>(`/price-tiers/${id}/assign`, { productIds }),
  unassign: (productIds: string[], tierId?: string) => storeApi.post<{ updated: number }>('/price-tiers/unassign', { productIds, tierId }),
  candidates: (params: { search?: string; tierId?: string; notInTier?: boolean; page?: number; limit?: number }) =>
    storeApi.get<Candidate[]>('/price-tiers/candidates', params),
  ofProduct: (productId: string) => storeApi.get<PriceTier | null>(`/price-tiers/product/${productId}`),
};

export const FLAG_STYLE: Record<MarginFlag, { label: string; className: string }> = {
  negative: { label: 'Loss', className: 'bg-red-50 text-red-700 border-red-200' },
  low: { label: 'Low margin', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  ok: { label: 'OK', className: 'bg-green-50 text-green-700 border-green-200' },
  no_cost: { label: 'No cost yet', className: 'bg-gray-50 text-gray-500 border-gray-200' },
};

export const TIER_COLORS = ['#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#EF4444', '#14B8A6', '#6B7280'];
