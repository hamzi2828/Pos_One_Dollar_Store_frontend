import axios from 'axios';
import { getAuthHeader } from '@/helper/helper';
import { BRANCH_HEADER } from '@/helper/access';
import { cleanParams, EMPTY_PAGINATION, type Pagination } from '@/helper/pagination';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const STAFF_URL = `${API_BASE_URL}/admin/staff`;

export interface StaffUser {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  isSuperAdmin: boolean;
  staffRole: { id: string; name: string | null } | null;
  branch: { id: string; name: string | null; code: string | null } | null;
  lastLogin: string | null;
  createdAt?: string;
}

export interface StaffListParams {
  search?: string;
  isActive?: 'true' | 'false' | '';
  staffRole?: string;
  page?: number;
  limit?: number;
  /** Branch filter: a branch id, or 'all'. Sent as x-branch-id (super admin only; staff are fixed). */
  branchId?: string | null;
}

export interface StaffPayload {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  phone?: string;
  staffRole?: string | null;
  branch?: string | null;
  isActive?: boolean;
  isSuperAdmin?: boolean;
}

const headers = () => ({ 'Content-Type': 'application/json', ...getAuthHeader() });

export const staffService = {
  async list(params: StaffListParams = {}): Promise<{ items: StaffUser[]; pagination: Pagination }> {
    const { branchId, ...rest } = params;
    const h: Record<string, string> = headers();
    if (branchId) h[BRANCH_HEADER] = branchId; // 'all' = every branch
    const response = await axios.get(STAFF_URL, { headers: h, params: cleanParams(rest) });
    return {
      items: response.data?.data ?? [],
      pagination: response.data?.pagination ?? EMPTY_PAGINATION,
    };
  },

  async create(payload: StaffPayload): Promise<StaffUser> {
    const response = await axios.post(STAFF_URL, payload, { headers: headers() });
    return response.data?.data;
  },

  async update(id: string, payload: StaffPayload): Promise<StaffUser> {
    const response = await axios.put(`${STAFF_URL}/${id}`, payload, { headers: headers() });
    return response.data?.data;
  },

  async resetPassword(id: string, password: string): Promise<void> {
    await axios.post(`${STAFF_URL}/${id}/reset-password`, { password }, { headers: headers() });
  },

  async remove(id: string): Promise<void> {
    await axios.delete(`${STAFF_URL}/${id}`, { headers: headers() });
  },
};
