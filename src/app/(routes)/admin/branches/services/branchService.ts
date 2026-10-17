import axios from 'axios';
import { getAuthHeader } from '@/helper/helper';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const BRANCHES_URL = `${API_BASE_URL}/admin/branches`;

export interface Branch {
  id: string;
  _id?: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  isActive: boolean;
  isMain: boolean;
  /** Only returned to the super admin. */
  staffCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface BranchPayload {
  name: string;
  code: string;
  address?: string;
  phone?: string;
  isActive?: boolean;
  isMain?: boolean;
}

const headers = () => ({ 'Content-Type': 'application/json', ...getAuthHeader() });

export const branchService = {
  /** Super admin: all branches (also inactive). Staff: what they may see. */
  async list(params: { search?: string; isActive?: 'true' | 'false' } = {}): Promise<Branch[]> {
    const response = await axios.get(BRANCHES_URL, { headers: headers(), params });
    return response.data?.data ?? [];
  },

  async create(payload: BranchPayload): Promise<Branch> {
    const response = await axios.post(BRANCHES_URL, payload, { headers: headers() });
    return response.data?.data;
  },

  async update(id: string, payload: Partial<BranchPayload>): Promise<Branch> {
    const response = await axios.put(`${BRANCHES_URL}/${id}`, payload, { headers: headers() });
    return response.data?.data;
  },

  async setMain(id: string): Promise<Branch> {
    const response = await axios.post(`${BRANCHES_URL}/${id}/set-main`, {}, { headers: headers() });
    return response.data?.data;
  },

  async remove(id: string): Promise<void> {
    await axios.delete(`${BRANCHES_URL}/${id}`, { headers: headers() });
  },
};
