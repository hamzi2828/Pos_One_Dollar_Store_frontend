// Roles & permissions on the client.
//
// - The login response (and GET /me/access) carries an `access` block:
//   { isSuperAdmin, roleName, permissions, user }. We keep it in
//   localStorage (`auth_access`) so the sidebar/header can render instantly.
// - DOLLAR & Co is a single shop: every login works on the same shop, so
//   there is nothing to pick and no extra header to send.

import axios from 'axios';

export type PermissionActionKey = 'view' | 'create' | 'edit' | 'delete' | 'export';

export interface AccessInfo {
  isSuperAdmin: boolean;
  roleName: string | null;
  permissions: Record<string, string[]>;
  user?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    role?: string;
    avatarUrl?: string | null;
  };
}

export const ACCESS_KEY = 'auth_access';

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

/** "Super Admin" / "Cashier". */
export function describeAccess(access: AccessInfo | null | undefined): string {
  if (!access) return 'Administrator';
  if (access.isSuperAdmin) return access.roleName || 'Super Admin';
  return access.roleName || 'Staff';
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
