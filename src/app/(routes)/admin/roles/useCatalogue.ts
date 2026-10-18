'use client';

// Live permission catalogue from GET /admin/roles/catalogue, so new backend keys
// (staff, stock_receive, ...) show up automatically.
// Falls back to the copy in rolesStore.ts if the call fails.

import { useEffect, useState } from 'react';
import {
  PERMISSION_SECTIONS,
  PERMISSION_GROUPS,
  type PermissionGroup,
  type PermissionSection,
} from './rolesStore';
import { roleService } from './service/roleService';

let cached: { sections: PermissionSection[]; groups: PermissionGroup[] } | null = null;

export function usePermissionCatalogue() {
  const [catalogue, setCatalogue] = useState<{ sections: PermissionSection[]; groups: PermissionGroup[] }>(
    () => cached ?? { sections: PERMISSION_SECTIONS, groups: PERMISSION_GROUPS },
  );
  const [loaded, setLoaded] = useState<boolean>(!!cached);

  useEffect(() => {
    if (cached) return;
    const controller = new AbortController();
    roleService
      .getCatalogue(controller.signal)
      .then((data) => {
        if (data.sections.length) {
          cached = data;
          setCatalogue(data);
        }
      })
      .catch(() => {
        // keep the fallback copy
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoaded(true);
      });
    return () => controller.abort();
  }, []);

  return { ...catalogue, loaded };
}
