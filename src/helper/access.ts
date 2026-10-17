// src/helper/access.ts
// Branches & permissions on the client.
//
// - The login response (and GET /me/access) carries an `access` block:
//   { isSuperAdmin, roleName, branch, permissions }. We keep it in
//   localStorage (`auth_access`) so the sidebar/header can render instantly.
// - The super admin picks a branch in the header. The choice lives in
//   localStorage (`selected_branch`) and is sent on EVERY backend request as
//   the `x-branch-id` header (axios interceptor + fetch wrapper installed once
//   by the admin layout). No choice = "All branches" (no header).
//   Branch staff never have a choice: the server always uses their own branch.

import axios, { AxiosHeaders } from 'axios';

export type PermissionActionKey = 'view' | 'create' | 'edit' | 'delete' | 'export';

export interface AccessBranch {
  id: string;
  name: string | null;
  code: string | null;
  isMain?: boolean;
}

export interface AccessInfo {
  isSuperAdmin: boolean;
  roleName: string | null;
  branch: AccessBranch | null;
  permissions: Record<string, string[]>;
  user?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    role?: string;
    avatarUrl?: string | null;
  };
  currentBranchId?: string | null;
  branches?: AccessBranch[];
}

export const ACCESS_KEY = 'auth_access';
export const SELECTED_BRANCH_KEY = 'selected_branch';
export const BRANCH_HEADER = 'x-branch-id';

const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || '').replace(/\/$/, '');

/* ---------------- storage ---------------- */

export function getStoredAccess(): AccessInfo | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ACCESS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as AccessInfo) : null;
  } catch {
    return null;
  }
}

export function setStoredAccess(access: AccessInfo | null | undefined) {
  if (typeof window === 'undefined') return;
  try {
    if (!access) localStorage.removeItem(ACCESS_KEY);
    else localStorage.setItem(ACCESS_KEY, JSON.stringify(access));
  } catch {}
}

export function clearStoredAccess() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(SELECTED_BRANCH_KEY);
  } catch {}
}

/** Branch picked by the super admin in the header (null = all branches). */
export function getSelectedBranchId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = localStorage.getItem(SELECTED_BRANCH_KEY);
    return v && v !== 'all' ? v : null;
  } catch {
    return null;
  }
}

export function setSelectedBranchId(id: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (!id || id === 'all') localStorage.removeItem(SELECTED_BRANCH_KEY);
    else localStorage.setItem(SELECTED_BRANCH_KEY, id);
  } catch {}
}

/** Can this access block do `action` on `key`? Super admin can do everything. */
export function accessCan(
  access: AccessInfo | null | undefined,
  key: string | string[],
  action: PermissionActionKey = 'view',
): boolean {
  if (!access) return false;
  if (access.isSuperAdmin) return true;
  const keys = Array.isArray(key) ? key : [key];
  return keys.some((k) => {
    const list = access.permissions?.[k];
    return Array.isArray(list) && list.includes(action);
  });
}

/** "Cashier · Branch 2" / "Super Admin · All branches". */
export function describeAccess(access: AccessInfo | null | undefined, selectedBranchName?: string | null): string {
  if (!access) return 'Administrator';
  if (access.isSuperAdmin) return `Super Admin · ${selectedBranchName || 'All branches'}`;
  const role = access.roleName || 'Staff';
  return access.branch?.name ? `${role} · ${access.branch.name}` : role;
}

/** Read a backend error message from an axios/fetch error. */
export function apiErrorMessage(e: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (axios.isAxiosError(e)) {
    const data = e.response?.data as { message?: string; error?: string } | undefined;
    return data?.message || data?.error || e.message || fallback;
  }
  if (e instanceof Error) return e.message || fallback;
  return fallback;
}

/* ---------------- x-branch-id on every request ---------------- */

const isBackendUrl = (url: string | undefined | null): boolean => {
  if (!url) return false;
  if (!BACKEND_URL) return false;
  return url.startsWith(BACKEND_URL);
};

let installed = false;

/**
 * Register once (admin layout): adds `x-branch-id` to every request that goes
 * to NEXT_PUBLIC_BACKEND_URL when the super admin picked a branch. A header
 * set explicitly on a request (e.g. the transfer form's FROM branch) wins.
 */
export function installBranchHeader() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  // 1) axios (global instance — every service uses `axios.get/post...`)
  axios.interceptors.request.use((config) => {
    const id = getSelectedBranchId();
    if (!id) return config;
    const full = config.baseURL && config.url && !/^https?:\/\//i.test(config.url)
      ? `${config.baseURL.replace(/\/$/, '')}/${config.url.replace(/^\//, '')}`
      : config.url;
    if (!isBackendUrl(full)) return config;
    const headers = AxiosHeaders.from(config.headers);
    if (!headers.has(BRANCH_HEADER)) headers.set(BRANCH_HEADER, id);
    config.headers = headers;
    return config;
  });

  // 2) fetch (some services use fetch directly)
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const id = getSelectedBranchId();
      if (id) {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
        if (isBackendUrl(url)) {
          const headers = new Headers(
            init?.headers ?? (typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined),
          );
          if (!headers.has(BRANCH_HEADER)) headers.set(BRANCH_HEADER, id);
          return originalFetch(input, { ...(init || {}), headers });
        }
      }
    } catch {
      // never break a request because of the branch header
    }
    return originalFetch(input, init);
  };
}
