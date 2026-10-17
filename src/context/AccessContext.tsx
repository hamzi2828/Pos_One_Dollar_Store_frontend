'use client';

// Who is logged in, which branch they work in and what they may do.
// Loaded from localStorage first (instant), then refreshed from GET /me/access
// when the admin layout mounts. See helper/access.ts for the storage + the
// `x-branch-id` header.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  type AccessBranch,
  type AccessInfo,
  type PermissionActionKey,
  accessCan,
  getSelectedBranchId,
  getStoredAccess,
  setSelectedBranchId,
  setStoredAccess,
} from '@/helper/access';
import { clearAllAuth, getAuthToken } from '@/helper/helper';

interface AccessContextValue {
  /** null until we know (old login without an access block and /me/access not answered yet). */
  access: AccessInfo | null;
  loaded: boolean;
  isSuperAdmin: boolean;
  roleName: string | null;
  /** Staff: their own branch. Super admin: null. */
  branch: AccessBranch | null;
  permissions: Record<string, string[]>;
  /** Branches this user can switch to (super admin: all active; staff: own). */
  branches: AccessBranch[];
  /** Branch the data is for: staff -> own branch; super admin -> picked branch or null (all). */
  currentBranchId: string | null;
  currentBranch: AccessBranch | null;
  can: (key: string | string[], action?: PermissionActionKey) => boolean;
  /** Super admin only. Saves the choice and reloads the page so every screen refetches. */
  switchBranch: (branchId: string | null) => void;
  refresh: () => Promise<void>;
}

const AccessContext = createContext<AccessContextValue | null>(null);

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export function AccessProvider({ children }: { children: React.ReactNode }) {
  const [access, setAccess] = useState<AccessInfo | null>(() => getStoredAccess());
  const [loaded, setLoaded] = useState<boolean>(() => !!getStoredAccess());
  const [selectedId, setSelectedId] = useState<string | null>(() => getSelectedBranchId());

  const refresh = useCallback(async () => {
    const token = getAuthToken();
    if (!token || !BACKEND_URL) {
      setLoaded(true);
      return;
    }
    try {
      const res = await fetch(`${BACKEND_URL}/me/access`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401 || res.status === 403) {
        // Token no longer valid or account disabled -> back to sign in.
        let msg = '';
        try {
          msg = (await res.json())?.message || '';
        } catch {}
        if (res.status === 401 || /disabled/i.test(msg)) {
          clearAllAuth();
          window.location.replace('/authentication');
          return;
        }
      }
      if (!res.ok) return; // keep what we have (e.g. older backend without /me/access)
      const body = await res.json();
      const data = (body?.data || null) as AccessInfo | null;
      if (!data) return;
      setAccess(data);
      setStoredAccess(data);

      // Picked branch must still exist; staff never keep a pick.
      const picked = getSelectedBranchId();
      if (picked) {
        const ok = data.isSuperAdmin && (data.branches || []).some((b) => b.id === picked);
        if (!ok) {
          setSelectedBranchId(null);
          setSelectedId(null);
          // Requests already sent used the old branch: reload once with "All branches".
          window.location.reload();
        }
      }
    } catch (e) {
      console.error('Could not load access:', e);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo<AccessContextValue>(() => {
    const isSuperAdmin = !!access?.isSuperAdmin;
    const ownBranch = access?.branch ?? null;
    let branches = access?.branches ?? [];
    if (!branches.length && ownBranch) branches = [ownBranch];
    const currentBranchId = isSuperAdmin ? selectedId : ownBranch?.id ?? null;
    const currentBranch = currentBranchId
      ? branches.find((b) => b.id === currentBranchId) ?? (ownBranch?.id === currentBranchId ? ownBranch : null)
      : null;
    return {
      access,
      loaded,
      isSuperAdmin,
      roleName: isSuperAdmin ? access?.roleName || 'Super Admin' : access?.roleName ?? null,
      branch: ownBranch,
      permissions: access?.permissions ?? {},
      branches,
      currentBranchId,
      currentBranch,
      // No access info at all (very old login) -> behave like before (show everything);
      // the server still answers 403 where needed.
      can: (key, action = 'view') => (access ? accessCan(access, key, action) : true),
      switchBranch: (branchId) => {
        if (!isSuperAdmin) return;
        setSelectedBranchId(branchId);
        setSelectedId(branchId && branchId !== 'all' ? branchId : null);
        window.location.reload();
      },
      refresh,
    };
  }, [access, loaded, selectedId, refresh]);

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess(): AccessContextValue {
  const ctx = useContext(AccessContext);
  if (!ctx) {
    // Outside the admin layout: read-only fallback from storage.
    const access = getStoredAccess();
    const isSuperAdmin = !!access?.isSuperAdmin;
    const branch = access?.branch ?? null;
    const selected = getSelectedBranchId();
    const currentBranchId = isSuperAdmin ? selected : branch?.id ?? null;
    const branches = access?.branches ?? (branch ? [branch] : []);
    return {
      access,
      loaded: !!access,
      isSuperAdmin,
      roleName: access?.roleName ?? null,
      branch,
      permissions: access?.permissions ?? {},
      branches,
      currentBranchId,
      currentBranch: branches.find((b) => b.id === currentBranchId) ?? null,
      can: (key, action = 'view') => (access ? accessCan(access, key, action) : true),
      switchBranch: () => {},
      refresh: async () => {},
    };
  }
  return ctx;
}
