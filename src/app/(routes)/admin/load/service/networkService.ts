import axios from 'axios';
import { getAuthHeader } from '@/helper/helper';
import { cleanParams, EMPTY_PAGINATION, type PagedResponse, type BasePagingParams } from '@/helper/pagination';
import type {
  Network,
  NetworkDay,
  CreateNetworkData,
  UpdateNetworkData,
  UpsertDayData,
  AddLoadData,
} from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

const jsonHeaders = () => ({ 'Content-Type': 'application/json', ...getAuthHeader() });

export interface NetworkListParams extends BasePagingParams {
  isActive?: boolean;
  /** 'YYYY-MM-DD' — which day's figures to attach to each network */
  date?: string;
}

export interface DayListParams {
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
}

export const networkService = {
  async getNetworks(
    params: NetworkListParams = {},
    signal?: AbortSignal
  ): Promise<PagedResponse<Network> & { date: string }> {
    try {
      const response = await axios.get(`${API_BASE_URL}/networks`, {
        headers: jsonHeaders(),
        params: cleanParams(params),
        signal,
      });
      return {
        items: response.data?.data ?? [],
        pagination: response.data?.pagination ?? EMPTY_PAGINATION,
        date: response.data?.date ?? '',
      };
    } catch (error) {
      if (axios.isCancel(error)) throw error;
      console.error('Error fetching networks:', error);
      throw error;
    }
  },

  async getNetwork(networkId: string, date?: string, signal?: AbortSignal): Promise<Network> {
    try {
      const response = await axios.get(`${API_BASE_URL}/networks/${networkId}`, {
        headers: jsonHeaders(),
        params: cleanParams({ date }),
        signal,
      });
      return response.data?.data;
    } catch (error) {
      if (axios.isCancel(error)) throw error;
      console.error('Error fetching network:', error);
      throw error;
    }
  },

  async createNetwork(data: CreateNetworkData) {
    try {
      const response = await axios.post(`${API_BASE_URL}/networks`, data, { headers: jsonHeaders() });
      return response.data;
    } catch (error) {
      console.error('Error creating network:', error);
      throw error;
    }
  },

  async updateNetwork(networkId: string, data: UpdateNetworkData) {
    try {
      const response = await axios.put(`${API_BASE_URL}/networks/${networkId}`, data, {
        headers: jsonHeaders(),
      });
      return response.data;
    } catch (error) {
      console.error('Error updating network:', error);
      throw error;
    }
  },

  async deleteNetwork(networkId: string) {
    try {
      const response = await axios.delete(`${API_BASE_URL}/networks/${networkId}`, {
        headers: getAuthHeader(),
      });
      return response.data;
    } catch (error) {
      console.error('Error deleting network:', error);
      throw error;
    }
  },

  // ---- daily register -------------------------------------------------

  async getDays(
    networkId: string,
    params: DayListParams = {},
    signal?: AbortSignal
  ): Promise<PagedResponse<NetworkDay>> {
    try {
      const response = await axios.get(`${API_BASE_URL}/networks/${networkId}/days`, {
        headers: jsonHeaders(),
        params: cleanParams(params),
        signal,
      });
      return {
        items: response.data?.data ?? [],
        pagination: response.data?.pagination ?? EMPTY_PAGINATION,
      };
    } catch (error) {
      if (axios.isCancel(error)) throw error;
      console.error('Error fetching network days:', error);
      throw error;
    }
  },

  async getDay(networkId: string, date: string, signal?: AbortSignal): Promise<NetworkDay> {
    try {
      const response = await axios.get(`${API_BASE_URL}/networks/${networkId}/days/${date}`, {
        headers: jsonHeaders(),
        signal,
      });
      return response.data?.data;
    } catch (error) {
      if (axios.isCancel(error)) throw error;
      console.error('Error fetching network day:', error);
      throw error;
    }
  },

  async saveDay(networkId: string, date: string, data: UpsertDayData): Promise<NetworkDay> {
    try {
      const response = await axios.put(`${API_BASE_URL}/networks/${networkId}/days/${date}`, data, {
        headers: jsonHeaders(),
      });
      return response.data?.data;
    } catch (error) {
      console.error('Error saving network day:', error);
      throw error;
    }
  },

  async addLoad(networkId: string, date: string, data: AddLoadData): Promise<NetworkDay> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/networks/${networkId}/days/${date}/loads`,
        data,
        { headers: jsonHeaders() }
      );
      return response.data?.data;
    } catch (error) {
      console.error('Error adding load:', error);
      throw error;
    }
  },

  async deleteLoad(networkId: string, date: string, loadId: string): Promise<NetworkDay> {
    try {
      const response = await axios.delete(
        `${API_BASE_URL}/networks/${networkId}/days/${date}/loads/${loadId}`,
        { headers: getAuthHeader() }
      );
      return response.data?.data;
    } catch (error) {
      console.error('Error deleting load:', error);
      throw error;
    }
  },
};
