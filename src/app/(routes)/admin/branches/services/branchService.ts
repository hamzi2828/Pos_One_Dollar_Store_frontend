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

type RawBranch = Partial<Branch> & { _id?: string; id?: string };

/** Same shape whatever the backend sends (`id` or `_id`, missing `isActive` = active). */
export const normalizeBranch = (b: RawBranch): Branch => ({
  ...b,
  id: String(b.id ?? b._id ?? ''),
  name: b.name || b.code || 'Branch',
  code: b.code || '',
  address: b.address || '',
  phone: b.phone || '',
  isActive: b.isActive !== false,
  isMain: !!b.isMain,
});

/** `data: [...]`, `data: { branches: [...] }` or `branches: [...]` -> Branch[]. */
const branchesFrom = (body: unknown): Branch[] => {
  const b = body as { data?: unknown; branches?: unknown } | null | undefined;
  const raw = Array.isArray(b?.data)
    ? b?.data
    : Array.isArray((b?.data as { branches?: unknown } | undefined)?.branches)
    ? (b?.data as { branches: unknown[] }).branches
    : Array.isArray(b?.branches)
    ? b?.branches
    : [];
  return (raw as RawBranch[]).filter((x) => x && (x.id || x._id)).map(normalizeBranch);
};

export const branchService = {
  /** Super admin: all branches (also inactive). Staff: what they may see. */
  async list(params: { search?: string; isActive?: 'true' | 'false' } = {}): Promise<Branch[]> {
    const response = await axios.get(BRANCHES_URL, { headers: headers(), params });
    return branchesFrom(response.data);
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
