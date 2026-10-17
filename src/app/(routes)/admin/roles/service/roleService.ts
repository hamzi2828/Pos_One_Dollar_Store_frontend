import axios from 'axios';
import { getAuthHeader } from '@/helper/helper';
import { cleanParams, EMPTY_PAGINATION, type PagedResponse, type BasePagingParams } from '@/helper/pagination';
import type { Role, PermissionAction, PermissionSection, PermissionGroup } from '../rolesStore';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const ROLES_URL = `${API_BASE_URL}/admin/roles`;

export interface RoleListParams extends BasePagingParams {}

export interface CreateRolePayload {
  name: string;
  description?: string;
  permissions?: Record<string, PermissionAction[]>;
}

export interface UpdateRolePayload {
  name?: string;
  description?: string;
}

const headers = () => ({ 'Content-Type': 'application/json', ...getAuthHeader() });

export const roleService = {
  /** Permission catalogue (sections -> groups -> allowed actions) from the backend. */
  async getCatalogue(signal?: AbortSignal): Promise<{ sections: PermissionSection[]; groups: PermissionGroup[] }> {
    const response = await axios.get(`${ROLES_URL}/catalogue`, { headers: headers(), signal });
    const sections: PermissionSection[] = response.data?.data?.sections ?? [];
    const groups: PermissionGroup[] = response.data?.data?.groups ?? sections.flatMap((s) => s.groups);
    return { sections, groups };
  },

  async getRoles(params: RoleListParams = {}, signal?: AbortSignal): Promise<PagedResponse<Role>> {
    const response = await axios.get(ROLES_URL, {
      headers: headers(),
      params: cleanParams(params),
      signal,
    });
    return {
      items: response.data?.data ?? [],
      pagination: response.data?.pagination ?? EMPTY_PAGINATION,
    };
  },

  async getRole(roleId: string, signal?: AbortSignal): Promise<Role> {
    const response = await axios.get(`${ROLES_URL}/${roleId}`, { headers: headers(), signal });
    return response.data?.data;
  },

  async createRole(payload: CreateRolePayload): Promise<Role> {
    const response = await axios.post(ROLES_URL, payload, { headers: headers() });
    return response.data?.data;
  },

  async updateRole(roleId: string, payload: UpdateRolePayload): Promise<Role> {
    const response = await axios.put(`${ROLES_URL}/${roleId}`, payload, { headers: headers() });
    return response.data?.data;
  },

  async updatePermissions(
    roleId: string,
    permissions: Record<string, PermissionAction[]>,
  ): Promise<Role> {
    const response = await axios.put(
      `${ROLES_URL}/${roleId}/permissions`,
      { permissions },
      { headers: headers() },
    );
    return response.data?.data;
  },

  async deleteRole(roleId: string): Promise<void> {
    await axios.delete(`${ROLES_URL}/${roleId}`, { headers: headers() });
  },
};
