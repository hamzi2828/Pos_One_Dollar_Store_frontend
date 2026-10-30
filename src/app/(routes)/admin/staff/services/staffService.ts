import axios from 'axios';
import { getAuthHeader } from '@/helper/helper';
import { cleanParams, EMPTY_PAGINATION, type Pagination } from '@/helper/pagination';
import type { AccessInfo } from '@/helper/access';
import type { Role } from '../../roles/rolesStore';

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
  lastLogin: string | null;
  createdAt?: string;
}

export interface StaffListParams {
  search?: string;
  isActive?: 'true' | 'false' | '';
  staffRole?: string;
  page?: number;
  limit?: number;
}

/** HR employee with no login yet (GET /admin/staff/employees). */
export interface LoginlessEmployee {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  employeeCode: string | null;
  position: string | null;
  phone: string | null;
  email: string | null;
}

export interface StaffPayload {
  /** New login: the HR employee it belongs to (name + phone come from HR). */
  employeeId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  phone?: string;
  staffRole?: string | null;
  isActive?: boolean;
  isSuperAdmin?: boolean;
}

const headers = () => ({ 'Content-Type': 'application/json', ...getAuthHeader() });

/** Permission keys only the super admin may hand out (managing logins and roles). */
const ESCALATION_KEYS = ['staff', 'roles'];

/**
 * Roles this user may give to a login (the backend checks again): the super admin
 * may give any role; others only custom roles that do not go beyond their own permissions.
 */
export function assignableRoles(roles: Role[], access: AccessInfo | null, isSuperAdmin: boolean): Role[] {
  if (isSuperAdmin) return roles;
  const mine = access?.permissions || {};
  return roles.filter((r) => {
    if (r.isSystem) return false;
    const perms = r.permissions || {};
    if (ESCALATION_KEYS.some((k) => (perms[k] || []).length > 0)) return false;
    return Object.entries(perms).every(([k, acts]) => (acts || []).every((a) => (mine[k] || []).includes(a)));
  });
}

export const staffService = {
  async list(params: StaffListParams = {}): Promise<{ items: StaffUser[]; pagination: Pagination }> {
    const response = await axios.get(STAFF_URL, { headers: headers(), params: cleanParams(params) });
    return {
      items: response.data?.data ?? [],
      pagination: response.data?.pagination ?? EMPTY_PAGINATION,
    };
  },

  async employeesWithoutLogin(): Promise<LoginlessEmployee[]> {
    const response = await axios.get(`${STAFF_URL}/employees`, { headers: headers() });
    return response.data?.data ?? [];
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
