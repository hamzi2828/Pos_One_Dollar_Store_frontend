import axios from 'axios';
import { getAuthHeader } from '@/helper/helper';
import { cleanParams, EMPTY_PAGINATION, type PagedResponse, type BasePagingParams } from '@/helper/pagination';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export type AssetStatus = 'active' | 'maintenance' | 'sold' | 'disposed';
export type AssetType = 'vehicle' | 'equipment' | 'property' | 'furniture' | 'electronics' | 'other';

export interface AssetDTO {
  _id: string;
  name: string;
  type: AssetType;
  description?: string;
  purchasePrice: number;
  currentValue?: number;
  purchaseDate: string;
  vendor?: string;
  location?: string;
  serialNumber?: string;
  status: AssetStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssetUI {
  id: string;
  name: string;
  type: AssetType;
  description?: string;
  purchasePrice: number;
  currentValue?: number;
  purchaseDate: string;
  vendor?: string;
  location?: string;
  serialNumber?: string;
  status: AssetStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAssetPayload {
  name: string;
  type: AssetType;
  description?: string;
  purchasePrice: number;
  currentValue?: number;
  purchaseDate: string;
  vendor?: string;
  location?: string;
  serialNumber?: string;
  status: AssetStatus;
  notes?: string;
}

function mapToUI(dto: AssetDTO): AssetUI {
  return {
    id: dto._id,
    name: dto.name,
    type: dto.type,
    description: dto.description,
    purchasePrice: dto.purchasePrice,
    currentValue: dto.currentValue,
    purchaseDate: dto.purchaseDate,
    vendor: dto.vendor,
    location: dto.location,
    serialNumber: dto.serialNumber,
    status: dto.status,
    notes: dto.notes,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

export interface AssetListParams extends BasePagingParams {
  type?: AssetType;
  status?: AssetStatus;
}

export const assetService = {
  async listAssets(params: AssetListParams = {}, signal?: AbortSignal): Promise<PagedResponse<AssetUI>> {
    try {
      const res = await axios.get(`${API_BASE_URL}/assets`, {
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        params: cleanParams(params),
        signal,
      });
      const data = res.data?.data ?? [];
      return {
        items: Array.isArray(data) ? (data as AssetDTO[]).map(mapToUI) : [],
        pagination: res.data?.pagination ?? EMPTY_PAGINATION,
      };
    } catch (err) {
      if (axios.isCancel(err)) throw err;
      console.error('Error fetching assets:', err);
      throw err;
    }
  },

  async getAssetById(id: string): Promise<AssetUI> {
    try {
      const res = await axios.get(`${API_BASE_URL}/assets/${id}`, {
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
      });
      const data = res.data?.data ?? res.data;
      if (!data || typeof data !== 'object') throw new Error('Unexpected getAssetById response');
      return mapToUI(data as AssetDTO);
    } catch (err) {
      console.error(`Error fetching asset ${id}:`, err);
      throw err;
    }
  },

  async createAsset(payload: CreateAssetPayload): Promise<AssetUI> {
    const res = await axios.post(`${API_BASE_URL}/assets`, payload, {
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
    });
    const data = res.data?.data ?? res.data;
    if (!data || typeof data !== 'object') throw new Error('Unexpected createAsset response');
    return mapToUI(data as AssetDTO);
  },

  async updateAsset(id: string, payload: Partial<CreateAssetPayload>): Promise<AssetUI> {
    const res = await axios.put(`${API_BASE_URL}/assets/${id}`, payload, {
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
    });
    const data = res.data?.data ?? res.data;
    if (!data || typeof data !== 'object') throw new Error('Unexpected updateAsset response');
    return mapToUI(data as AssetDTO);
  },

  async deleteAsset(id: string): Promise<void> {
    await axios.delete(`${API_BASE_URL}/assets/${id}`, {
      headers: {
        ...getAuthHeader(),
      },
    });
  },
};
