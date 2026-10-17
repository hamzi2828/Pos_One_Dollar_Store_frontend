import axios from 'axios';
import { getAuthHeader } from '@/helper/helper';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export interface ColorDTO {
  _id: string;
  name: string;
  slug: string;
  hex?: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ColorInput {
  name: string;
  slug: string;
  hex?: string;
  active: boolean;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function isColorDTO(v: unknown): v is ColorDTO {
  if (!isObject(v)) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o._id === 'string' &&
    typeof o.name === 'string' &&
    typeof o.slug === 'string' &&
    typeof o.active === 'boolean'
  );
}

export function mapColor(dto: ColorDTO) {
  return {
    id: dto._id,
    name: dto.name,
    slug: dto.slug,
    hex: dto.hex ?? '',
    active: dto.active,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

export const colorService = {
  async listColors() {
    const res = await axios.get(`${API_BASE_URL}/colors`, {
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    });
    const data = res.data?.data ?? res.data ?? [];
    if (Array.isArray(data)) {
      return (data as unknown[]).filter(isColorDTO).map((c) => mapColor(c as ColorDTO));
    }
    return [] as ReturnType<typeof mapColor>[];
  },

  async createColor(payload: ColorInput) {
    const res = await axios.post(`${API_BASE_URL}/colors`, payload, {
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    });
    const created = res.data?.data ?? res.data;
    if (isColorDTO(created)) return mapColor(created);
    throw new Error('Unexpected createColor response shape');
  },

  async updateColor(id: string, payload: Partial<ColorInput>) {
    const res = await axios.put(`${API_BASE_URL}/colors/${id}`, payload, {
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    });
    const updated = res.data?.data ?? res.data;
    if (isColorDTO(updated)) return mapColor(updated);
    throw new Error('Unexpected updateColor response shape');
  },

  async deleteColor(id: string) {
    await axios.delete(`${API_BASE_URL}/colors/${id}`, {
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    });
    return true;
  },

  async setActive(id: string, active: boolean) {
    return this.updateColor(id, { active });
  },
};
