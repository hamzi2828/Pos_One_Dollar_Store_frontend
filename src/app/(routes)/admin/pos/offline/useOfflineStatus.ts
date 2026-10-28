// One hook for the POS: online/offline, sales waiting, uploading, needs attention.
// Also starts the catalogue refresh (when offline selling is allowed) and the
// upload worker while the POS page is open.
'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { isOnline, subscribeConnectivity } from './connectivity';
import { catalogInfo, loadCatalog, startCatalogSync, subscribeCatalog, syncCatalog } from './catalogSync';
import { listOutbox, subscribeOutbox } from './outbox';
import { startSyncWorker, subscribeUpload, uploadNow, uploadState } from './syncWorker';
import type { OutboxEntry } from './types';

const serverSnapshot = () => true;

export function useOnline(): boolean {
  return useSyncExternalStore(subscribeConnectivity, isOnline, serverSnapshot);
}

export interface OfflineStatus {
  /** Server reachable. */
  online: boolean;
  /** Offline selling allowed for this user. */
  enabled: boolean;
  /** Not online AND offline selling is on: the POS works from the PC copy. */
  offlineMode: boolean;
  waiting: number;
  failed: number;
  uploading: boolean;
  problem: string | null;
  entries: OutboxEntry[];
  catalog: ReturnType<typeof catalogInfo>;
  uploadNow: () => void;
  refreshCatalog: () => void;
}

export function useOfflineStatus(enabled: boolean): OfflineStatus {
  const online = useOnline();
  const [entries, setEntries] = useState<OutboxEntry[]>([]);
  const [upload, setUpload] = useState(uploadState);
  const [catalog, setCatalog] = useState(catalogInfo);

  const reload = useCallback(() => {
    listOutbox()
      .then(setEntries)
      .catch(() => setEntries([]));
  }, []);

  useEffect(() => {
    reload();
    const offOutbox = subscribeOutbox(reload);
    const offUpload = subscribeUpload(() => setUpload(uploadState()));
    const offCatalog = subscribeCatalog(() => setCatalog(catalogInfo()));
    const stopWorker = startSyncWorker();
    void loadCatalog();
    return () => {
      offOutbox();
      offUpload();
      offCatalog();
      stopWorker();
    };
  }, [reload]);

  useEffect(() => {
    if (!enabled) return undefined;
    return startCatalogSync();
  }, [enabled]);

  // Server back (also when only the server was down): upload and refresh at once.
  useEffect(() => {
    if (!online) return;
    void uploadNow({ force: true });
    if (enabled) void syncCatalog();
  }, [online, enabled]);

  return {
    online,
    enabled,
    offlineMode: enabled && !online,
    waiting: entries.filter((e) => e.state !== 'failed').length,
    failed: entries.filter((e) => e.state === 'failed').length,
    uploading: upload.uploading,
    problem: upload.problem,
    entries,
    catalog,
    uploadNow: () => void uploadNow({ force: true }),
    refreshCatalog: () => void syncCatalog(),
  };
}
