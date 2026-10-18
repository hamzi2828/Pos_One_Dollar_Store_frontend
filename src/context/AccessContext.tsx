'use client';

// Who is logged in and what they may do (single shop: everyone works on the
// same shop). Loaded from localStorage first (instant), then refreshed from
// GET /me/access when the admin layout mounts. See helper/access.ts.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  type AccessInfo,
  type PermissionActionKey,
  accessCan,
  getStoredAccess,
  setStoredAccess,
} from '@/helper/access';
import { clearAllAuth, getAuthToken } from '@/helper/helper';

interface AccessContextValue {
  /** null until we know (old login without an access block and /me/access not answered yet). */
  access: AccessInfo | null;
  loaded: boolean;
  isSuperAdmin: boolean;
  roleName: string | null;
  permissions: Record<string, string[]>;
  can: (key: string | string[], action?: PermissionActionKey) => boolean;
  refresh: () => Promise<void>;
}

const AccessContext = createContext<AccessContextValue | null>(null);

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

function buildValue(
  access: AccessInfo | null,
  loaded: boolean,
  refresh: () => Promise<void>,
): AccessContextValue {
  const isSuperAdmin = !!access?.isSuperAdmin;
  return {
    access,
    loaded,
    isSuperAdmin,
    roleName: isSuperAdmin ? access?.roleName || 'Super Admin' : access?.roleName ?? null,
    permissions: access?.permissions ?? {},
    // No access info at all (very old login) -> behave like before (show everything);
    // the server still answers 403 where needed.
    can: (key, action = 'view') => (access ? accessCan(access, key, action) : true),
    refresh,
  };
}

export function AccessProvider({ children }: { children: React.ReactNode }) {
  const [access, setAccess] = useState<AccessInfo | null>(() => getStoredAccess());
  const [loaded, setLoaded] = useState<boolean>(() => !!getStoredAccess());

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
    } catch (e) {
      console.error('Could not load access:', e);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(() => buildValue(access, loaded, refresh), [access, loaded, refresh]);

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

const noopRefresh = async () => {};

export function useAccess(): AccessContextValue {
  const ctx = useContext(AccessContext);
  if (ctx) return ctx;
  // Outside the admin layout: read-only fallback from storage.
  const access = getStoredAccess();
  return buildValue(access, !!access, noopRefresh);
}
