import axios from 'axios';
import { getAuthHeader } from '@/helper/helper';
import { cleanParams, EMPTY_PAGINATION, type PagedResponse, type BasePagingParams } from '@/helper/pagination';
import type { Expense, CreateExpenseData, UpdateExpenseData, PaymentMethod } from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export interface ExpenseListParams extends BasePagingParams {
  category?: string;
  paymentMethod?: PaymentMethod;
  isActive?: boolean;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
}

export const expenseService = {
  async getExpenses(params: ExpenseListParams = {}, signal?: AbortSignal): Promise<PagedResponse<Expense>> {
    try {
      const response = await axios.get(`${API_BASE_URL}/expenses`, {
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
      console.error('Error fetching expenses:', error);
      throw error;
    }
  },

  // Get single expense
  async getExpense(expenseId: string) {
    try {
      const response = await axios.get(`${API_BASE_URL}/expenses/${expenseId}`, {
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
      });
      return response.data?.data ?? response.data;
    } catch (error) {
      console.error('Error fetching expense:', error);
      throw error;
    }
  },

  // Get expense summary
  async getExpenseSummary(startDate?: string, endDate?: string) {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await axios.get(
        `${API_BASE_URL}/expenses/summary${params.toString() ? `?${params.toString()}` : ''}`,
        {
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeader(),
          },
        }
      );
      return response.data?.data ?? response.data;
    } catch (error) {
      console.error('Error fetching expense summary:', error);
      throw error;
    }
  },

  // Create expense
  async createExpense(expenseData: CreateExpenseData, receiptFile?: File) {
    try {
      const formData = new FormData();
      formData.append('title', expenseData.title);
      formData.append('amount', String(expenseData.amount));
      // Support both single category and multiple categories
      if (expenseData.categories && expenseData.categories.length > 0) {
        formData.append('categories', JSON.stringify(expenseData.categories));
        formData.append('category', expenseData.categories.join(', ')); // For backward compatibility
      } else if (expenseData.category) {
        formData.append('category', expenseData.category);
      }
      if (expenseData.date) formData.append('date', expenseData.date);
      if (expenseData.paymentMethod) formData.append('paymentMethod', expenseData.paymentMethod);
      if (expenseData.reference) formData.append('reference', expenseData.reference);
      if (expenseData.notes) formData.append('notes', expenseData.notes);
      if (receiptFile) formData.append('receipt', receiptFile);

      const response = await axios.post(`${API_BASE_URL}/expenses`, formData, {
        headers: {
          ...getAuthHeader(),
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error creating expense:', error);
      throw error;
    }
  },

  // Update expense
  async updateExpense(expenseId: string, expenseData: UpdateExpenseData, receiptFile?: File, removeReceipt?: boolean) {
    try {
      const formData = new FormData();
      if (expenseData.title !== undefined) formData.append('title', expenseData.title);
      if (expenseData.amount !== undefined) formData.append('amount', String(expenseData.amount));
      if (expenseData.category !== undefined) formData.append('category', expenseData.category);
      if (expenseData.date !== undefined) formData.append('date', expenseData.date);
      if (expenseData.paymentMethod !== undefined) formData.append('paymentMethod', expenseData.paymentMethod);
      if (expenseData.reference !== undefined) formData.append('reference', expenseData.reference);
      if (expenseData.notes !== undefined) formData.append('notes', expenseData.notes);
      if (expenseData.isActive !== undefined) formData.append('isActive', String(expenseData.isActive));
      if (receiptFile) formData.append('receipt', receiptFile);
      if (removeReceipt) formData.append('removeReceipt', 'true');

      const response = await axios.put(`${API_BASE_URL}/expenses/${expenseId}`, formData, {
        headers: {
          ...getAuthHeader(),
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error updating expense:', error);
      throw error;
    }
  },

  // Delete expense
  async deleteExpense(expenseId: string) {
    try {
      const response = await axios.delete(`${API_BASE_URL}/expenses/${expenseId}`, {
        headers: {
          ...getAuthHeader(),
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error deleting expense:', error);
      throw error;
    }
  },

  // Update expense status
  async updateExpenseStatus(expenseId: string, isActive: boolean) {
    try {
      const response = await axios.put(
        `${API_BASE_URL}/expenses/${expenseId}/status`,
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
      console.error('Error updating expense status:', error);
      throw error;
    }
  },

  // ============ Expense Categories ============

  // Get all expense categories
  async getCategories() {
    try {
      const response = await axios.get(`${API_BASE_URL}/expenses/categories`, {
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
      });
      return response.data?.data ?? response.data ?? [];
    } catch (error) {
      console.error('Error fetching expense categories:', error);
      // Return empty array on error (API might not exist yet)
      return [];
    }
  },

  // Create expense category
  async createCategory(name: string, description?: string) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/expenses/categories`,
        { name, description },
        {
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeader(),
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error creating expense category:', error);
      throw error;
    }
  },

  // Delete expense category
  async deleteCategory(categoryId: string) {
    try {
      const response = await axios.delete(`${API_BASE_URL}/expenses/categories/${categoryId}`, {
        headers: {
          ...getAuthHeader(),
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error deleting expense category:', error);
      throw error;
    }
  },
};
