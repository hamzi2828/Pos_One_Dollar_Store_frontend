import axios from 'axios';
import { getAuthHeader } from '@/helper/helper';
import { cleanParams, EMPTY_PAGINATION, type PagedResponse, type BasePagingParams } from '@/helper/pagination';
import type { Expense, CreateExpenseData, UpdateExpenseData, PaymentMethod, RefundBill, TillScope } from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

/**
 * Phone photos are big; the server takes at most ~4.5 MB per request. Shrink
 * each slip to 1600 px on the long side (JPEG) so 10 slips still fit and stay readable.
 * Small files and anything that cannot be drawn are sent as they are.
 */
async function shrinkImage(file: File): Promise<File> {
  if (typeof document === 'undefined' || !file.type.startsWith('image/') || file.type === 'image/gif' || file.size < 350 * 1024) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.8));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
const shrinkAll = (files: File[]) => Promise.all(files.map(shrinkImage));

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
  async getExpenses(params: ExpenseListParams = {}, signal?: AbortSignal): Promise<PagedResponse<Expense> & { tillScope: TillScope | null }> {
    try {
      const response = await axios.get(`${API_BASE_URL}/expenses`, {
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        params: cleanParams(params),
        signal,
      });
      return {
        items: response.data?.data ?? [],
        pagination: response.data?.pagination ?? EMPTY_PAGINATION,
        tillScope: response.data?.tillScope ?? null,
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

  /** Bills whose number contains q (at least 3 characters) for a Refund expense. */
  async searchRefundBills(q: string, signal?: AbortSignal): Promise<RefundBill[]> {
    const response = await axios.get(`${API_BASE_URL}/expenses/refund-bills`, {
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      params: { q },
      signal,
    });
    return response.data?.data ?? [];
  },

  // + / − adjustment of the amount (the amount itself is not edited).
  async adjustExpense(expenseId: string, amount: number, note: string) {
    const response = await axios.post(
      `${API_BASE_URL}/expenses/${expenseId}/adjust`,
      { amount, note },
      { headers: { 'Content-Type': 'application/json', ...getAuthHeader() } },
    );
    return response.data?.data ?? response.data;
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
  async createExpense(expenseData: CreateExpenseData, receiptFiles: File[] = []) {
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
      if (expenseData.bankId) formData.append('bankId', expenseData.bankId);
      if (expenseData.counter) formData.append('counter', expenseData.counter);
      if (expenseData.investmentId) formData.append('investmentId', expenseData.investmentId);
      if (expenseData.fromPersonal) {
        formData.append('fromPersonal', 'true');
        if (expenseData.lenderId) formData.append('lenderId', expenseData.lenderId);
      }
      if (expenseData.posOrderId) formData.append('posOrderId', expenseData.posOrderId);
      if (expenseData.reference) formData.append('reference', expenseData.reference);
      if (expenseData.notes) formData.append('notes', expenseData.notes);
      // Receipt images (up to 10)
      (await shrinkAll(receiptFiles)).forEach((f) => formData.append('receipts', f));

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
  // newFiles are added; removeReceipts are urls of saved images to drop.
  async updateExpense(expenseId: string, expenseData: UpdateExpenseData, newFiles: File[] = [], removeReceipts: string[] = []) {
    try {
      const formData = new FormData();
      if (expenseData.title !== undefined) formData.append('title', expenseData.title);
      if (expenseData.amount !== undefined) formData.append('amount', String(expenseData.amount));
      if (expenseData.category !== undefined) formData.append('category', expenseData.category);
      if (expenseData.date !== undefined) formData.append('date', expenseData.date);
      if (expenseData.paymentMethod !== undefined) formData.append('paymentMethod', expenseData.paymentMethod);
      if (expenseData.bankId !== undefined) formData.append('bankId', expenseData.bankId);
      if (expenseData.counter !== undefined) formData.append('counter', expenseData.counter);
      if (expenseData.investmentId !== undefined) formData.append('investmentId', expenseData.investmentId);
      if (expenseData.reference !== undefined) formData.append('reference', expenseData.reference);
      if (expenseData.notes !== undefined) formData.append('notes', expenseData.notes);
      if (expenseData.isActive !== undefined) formData.append('isActive', String(expenseData.isActive));
      (await shrinkAll(newFiles)).forEach((f) => formData.append('receipts', f));
      if (removeReceipts.length) formData.append('removeReceipts', JSON.stringify(removeReceipts));

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
