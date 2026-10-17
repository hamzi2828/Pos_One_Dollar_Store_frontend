import axios from 'axios';
import { getAuthHeader } from '@/helper/helper';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export interface GuidelineDTO {
  _id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  active: boolean;
  order: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Guideline {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  active: boolean;
  order: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface GuidelineInput {
  name: string;
  slug: string;
  active?: boolean;
  order?: number;
}

function mapGuideline(dto: GuidelineDTO): Guideline {
  return {
    id: dto._id,
    name: dto.name,
    slug: dto.slug,
    imageUrl: dto.imageUrl,
    active: dto.active,
    order: dto.order,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

export const guidelineService = {
  async listGuidelines(): Promise<Guideline[]> {
    const res = await axios.get(`${API_BASE_URL}/guidelines`, {
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    });
    const data = res.data?.data ?? res.data ?? [];
    if (Array.isArray(data)) {
      return data.map((g: GuidelineDTO) => mapGuideline(g));
    }
    return [];
  },

  async getGuidelineById(id: string): Promise<Guideline> {
    const res = await axios.get(`${API_BASE_URL}/guidelines/${id}`, {
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    });
    const data = res.data?.data ?? res.data;
    return mapGuideline(data);
  },

  async createGuideline(formData: FormData): Promise<Guideline> {
    const res = await axios.post(`${API_BASE_URL}/guidelines`, formData, {
      headers: { ...getAuthHeader() },
    });
    const data = res.data?.data ?? res.data;
    return mapGuideline(data);
  },

  async updateGuideline(id: string, formData: FormData): Promise<Guideline> {
    const res = await axios.put(`${API_BASE_URL}/guidelines/${id}`, formData, {
      headers: { ...getAuthHeader() },
    });
    const data = res.data?.data ?? res.data;
    return mapGuideline(data);
  },

  async toggleActive(id: string): Promise<Guideline> {
    const res = await axios.patch(`${API_BASE_URL}/guidelines/${id}/toggle-active`, {}, {
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    });
    const data = res.data?.data ?? res.data;
    return mapGuideline(data);
  },

  async deleteGuideline(id: string): Promise<boolean> {
    await axios.delete(`${API_BASE_URL}/guidelines/${id}`, {
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    });
    return true;
  },
};
