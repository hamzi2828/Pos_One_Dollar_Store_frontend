import axios from 'axios';
import { getAuthHeader } from '@/helper/helper';
import { cleanParams, EMPTY_PAGINATION, type PagedResponse, type BasePagingParams } from '@/helper/pagination';
import type { Bank, CreateBankData, UpdateBankData } from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export interface BankListParams extends BasePagingParams {
  isActive?: boolean;
}

export const bankService = {
  async getBanks(params: BankListParams = {}, signal?: AbortSignal): Promise<PagedResponse<Bank>> {
    try {
      const response = await axios.get(`${API_BASE_URL}/banks`, {
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        params: cleanParams(params),
        signal,
      });
      return {
        items: response.data?.data ?? [],
        pagination: response.data?.pagination ?? EMPTY_PAGINATION,
      };
    } catch (error) {
      if (axios.isCancel(error)) throw error;
      console.error('Error fetching banks:', error);
      throw error;
    }
  },

  // Get single bank
  async getBank(bankId: string) {
    try {
      const response = await axios.get(`${API_BASE_URL}/banks/${bankId}`, {
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
      });
      return response.data?.data ?? response.data;
    } catch (error) {
      console.error('Error fetching bank:', error);
      throw error;
    }
  },

  // Create bank
  async createBank(bankData: CreateBankData) {
    try {
      const response = await axios.post(`${API_BASE_URL}/banks`, bankData, {
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error creating bank:', error);
      throw error;
    }
  },

  // Update bank
  async updateBank(bankId: string, bankData: UpdateBankData) {
    try {
      const response = await axios.put(`${API_BASE_URL}/banks/${bankId}`, bankData, {
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error updating bank:', error);
      throw error;
    }
  },

  // Delete bank
  async deleteBank(bankId: string) {
    try {
      const response = await axios.delete(`${API_BASE_URL}/banks/${bankId}`, {
        headers: {
          ...getAuthHeader(),
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error deleting bank:', error);
      throw error;
    }
  },

  // Update bank status
  async updateBankStatus(bankId: string, isActive: boolean) {
    try {
      const response = await axios.put(
        `${API_BASE_URL}/banks/${bankId}/status`,
        { isActive },
        {
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeader(),
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error updating bank status:', error);
      throw error;
    }
  },
};
