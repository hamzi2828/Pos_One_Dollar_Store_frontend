import axios from 'axios';
import { getAuthHeader } from '@/helper/helper';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

// ───────────────── Types ─────────────────

export interface CarMakeDTO {
  _id: string;
  name: string;
  slug?: string;
  logoUrl?: string;
  active: boolean;
  featuredOnHome?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CarModelDTO {
  _id: string;
  makeId: string;
  name: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CarVariantDTO {
  _id: string;
  modelId: string;
  name: string;
  yearStart?: number | null;
  yearEnd?: number | null;
  imageUrl?: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CarMakeUI {
  id: string;
  name: string;
  slug: string;
  logoUrl: string;
  active: boolean;
  featuredOnHome: boolean;
}
export interface CarModelUI {
  id: string;
  makeId: string;
  name: string;
  active: boolean;
}
export interface CarVariantUI {
  id: string;
  modelId: string;
  name: string;
  yearStart: number | null;
  yearEnd: number | null;
  imageUrl: string;
  active: boolean;
}

export function mapMake(dto: CarMakeDTO): CarMakeUI {
  return {
    id: dto._id,
    name: dto.name,
    slug: dto.slug || dto.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
    logoUrl: dto.logoUrl || '',
    active: dto.active,
    featuredOnHome: dto.featuredOnHome ?? false,
  };
}
export function mapModel(dto: CarModelDTO): CarModelUI {
  return {
    id: dto._id,
    makeId: dto.makeId,
    name: dto.name,
    active: dto.active,
  };
}
export function mapVariant(dto: CarVariantDTO): CarVariantUI {
  return {
    id: dto._id,
    modelId: dto.modelId,
    name: dto.name || '',
    yearStart: dto.yearStart ?? null,
    yearEnd: dto.yearEnd ?? null,
    imageUrl: dto.imageUrl || '',
    active: dto.active,
  };
}

// ───────────────── Service ─────────────────

const jsonHeaders = () => ({
  'Content-Type': 'application/json',
  ...getAuthHeader(),
});

const fdHeaders = () => ({
  ...getAuthHeader(),
});

export const carService = {
  // Makes
  async listMakes(): Promise<CarMakeUI[]> {
    const res = await axios.get(`${API_BASE_URL}/car-makes`, { headers: jsonHeaders() });
    const data = res.data?.data ?? [];
    return Array.isArray(data) ? (data as CarMakeDTO[]).map(mapMake) : [];
  },

  async createMake(payload: {
    name: string;
    active: boolean;
    logo?: File | null;
    logoUrl?: string;
  }): Promise<CarMakeUI> {
    const fd = new FormData();
    fd.append('name', payload.name);
    fd.append('active', String(payload.active));
    if (payload.logo) fd.append('logo', payload.logo);
    else if (typeof payload.logoUrl !== 'undefined') fd.append('logoUrl', payload.logoUrl);
    const res = await axios.post(`${API_BASE_URL}/car-makes`, fd, { headers: fdHeaders() });
    return mapMake(res.data?.data);
  },

  async updateMake(
    id: string,
    payload: { name?: string; active?: boolean; logo?: File | null; logoUrl?: string }
  ): Promise<CarMakeUI> {
    const fd = new FormData();
    if (typeof payload.name !== 'undefined') fd.append('name', payload.name);
    if (typeof payload.active !== 'undefined') fd.append('active', String(payload.active));
    if (payload.logo) fd.append('logo', payload.logo);
    if (typeof payload.logoUrl !== 'undefined') fd.append('logoUrl', payload.logoUrl);
    const res = await axios.put(`${API_BASE_URL}/car-makes/${id}`, fd, { headers: fdHeaders() });
    return mapMake(res.data?.data);
  },

  async deleteMake(id: string): Promise<void> {
    await axios.delete(`${API_BASE_URL}/car-makes/${id}`, { headers: jsonHeaders() });
  },

  async toggleFeatured(id: string): Promise<CarMakeUI> {
    const res = await axios.patch(`${API_BASE_URL}/car-makes/${id}/featured`, {}, { headers: jsonHeaders() });
    return mapMake(res.data?.data);
  },

  // Models
  async listModels(makeId?: string): Promise<CarModelUI[]> {
    const url = makeId
      ? `${API_BASE_URL}/car-models?makeId=${encodeURIComponent(makeId)}`
      : `${API_BASE_URL}/car-models`;
    const res = await axios.get(url, { headers: jsonHeaders() });
    const data = res.data?.data ?? [];
    return Array.isArray(data) ? (data as CarModelDTO[]).map(mapModel) : [];
  },

  async createModel(payload: { makeId: string; name: string; active: boolean }): Promise<CarModelUI> {
    const res = await axios.post(`${API_BASE_URL}/car-models`, payload, { headers: jsonHeaders() });
    return mapModel(res.data?.data);
  },

  async updateModel(
    id: string,
    payload: { name?: string; active?: boolean }
  ): Promise<CarModelUI> {
    const res = await axios.put(`${API_BASE_URL}/car-models/${id}`, payload, { headers: jsonHeaders() });
    return mapModel(res.data?.data);
  },

  async deleteModel(id: string): Promise<void> {
    await axios.delete(`${API_BASE_URL}/car-models/${id}`, { headers: jsonHeaders() });
  },

  // Variants
  async listVariants(modelId?: string): Promise<CarVariantUI[]> {
    const url = modelId
      ? `${API_BASE_URL}/car-variants?modelId=${encodeURIComponent(modelId)}`
      : `${API_BASE_URL}/car-variants`;
    const res = await axios.get(url, { headers: jsonHeaders() });
    const data = res.data?.data ?? [];
    return Array.isArray(data) ? (data as CarVariantDTO[]).map(mapVariant) : [];
  },

  async createVariant(payload: {
    modelId: string;
    name?: string;
    yearStart?: number | null;
    yearEnd?: number | null;
    active: boolean;
    image?: File | null;
    imageUrl?: string;
  }): Promise<CarVariantUI> {
    const fd = new FormData();
    fd.append('modelId', payload.modelId);
    if (payload.name) fd.append('name', payload.name);
    if (payload.yearStart != null) fd.append('yearStart', String(payload.yearStart));
    if (payload.yearEnd != null) fd.append('yearEnd', String(payload.yearEnd));
    fd.append('active', String(payload.active));
    if (payload.image) fd.append('image', payload.image);
    else if (typeof payload.imageUrl !== 'undefined') fd.append('imageUrl', payload.imageUrl);
    const res = await axios.post(`${API_BASE_URL}/car-variants`, fd, { headers: fdHeaders() });
    return mapVariant(res.data?.data);
  },

  async updateVariant(
    id: string,
    payload: {
      name?: string;
      yearStart?: number | null;
      yearEnd?: number | null;
      active?: boolean;
      image?: File | null;
      imageUrl?: string;
    }
  ): Promise<CarVariantUI> {
    const fd = new FormData();
    if (typeof payload.name !== 'undefined') fd.append('name', payload.name);
    if (typeof payload.yearStart !== 'undefined')
      fd.append('yearStart', payload.yearStart != null ? String(payload.yearStart) : '');
    if (typeof payload.yearEnd !== 'undefined')
      fd.append('yearEnd', payload.yearEnd != null ? String(payload.yearEnd) : '');
    if (typeof payload.active !== 'undefined') fd.append('active', String(payload.active));
    if (payload.image) fd.append('image', payload.image);
    else if (typeof payload.imageUrl !== 'undefined') fd.append('imageUrl', payload.imageUrl);
    const res = await axios.put(`${API_BASE_URL}/car-variants/${id}`, fd, { headers: fdHeaders() });
    return mapVariant(res.data?.data);
  },

  async deleteVariant(id: string): Promise<void> {
    await axios.delete(`${API_BASE_URL}/car-variants/${id}`, { headers: jsonHeaders() });
  },
};
