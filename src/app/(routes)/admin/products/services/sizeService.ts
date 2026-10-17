import axios from 'axios';
import { getAuthHeader } from '@/helper/helper';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export interface SizeDTO {
  _id: string;
  name: string;
  slug: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SizeInput {
  name: string;
  slug: string;
  active: boolean;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function isSizeDTO(v: unknown): v is SizeDTO {
  if (!isObject(v)) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o._id === 'string' &&
    typeof o.name === 'string' &&
    typeof o.slug === 'string' &&
    typeof o.active === 'boolean'
  );
}

export function mapSize(dto: SizeDTO) {
  return {
    id: dto._id,
    name: dto.name,
    slug: dto.slug,
    active: dto.active,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

export const sizeService = {
  async listSizes() {
    const res = await axios.get(`${API_BASE_URL}/sizes`, {
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    });
    const data = res.data?.data ?? res.data ?? [];
    if (Array.isArray(data)) {
      return (data as unknown[]).filter(isSizeDTO).map((s) => mapSize(s as SizeDTO));
    }
    return [] as ReturnType<typeof mapSize>[];
  },

  async createSize(payload: SizeInput) {
    const res = await axios.post(`${API_BASE_URL}/sizes`, payload, {
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    });
    const created = res.data?.data ?? res.data;
    if (isSizeDTO(created)) return mapSize(created);
    throw new Error('Unexpected createSize response shape');
  },

  async updateSize(id: string, payload: Partial<SizeInput>) {
    const res = await axios.put(`${API_BASE_URL}/sizes/${id}`, payload, {
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    });
    const updated = res.data?.data ?? res.data;
    if (isSizeDTO(updated)) return mapSize(updated);
    throw new Error('Unexpected updateSize response shape');
  },

  async deleteSize(id: string) {
    await axios.delete(`${API_BASE_URL}/sizes/${id}`, {
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    });
    return true;
  },

  async setActive(id: string, active: boolean) {
    return this.updateSize(id, { active });
  },
};
