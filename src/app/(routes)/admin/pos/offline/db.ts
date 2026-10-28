// IndexedDB for offline sales (hand-written, no library).
//
//   db "dollarco-pos" v1
//     catalog  key "snapshot" -> CatalogSnapshot (last download)
//     outbox   keyPath clientId -> OutboxEntry (sales not uploaded yet)
//     meta     key -> any (deviceId, OFF counter, last sync times)
'use client';

export const DB_NAME = 'dollarco-pos';
const DB_VERSION = 1;
export type StoreName = 'catalog' | 'outbox' | 'meta';

let dbPromise: Promise<IDBDatabase> | null = null;

export function idbAvailable(): boolean {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

export function openDb(): Promise<IDBDatabase> {
  if (!idbAvailable()) return Promise.reject(new Error('This browser cannot save data on the PC (IndexedDB missing)'));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('catalog')) db.createObjectStore('catalog');
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
      if (!db.objectStoreNames.contains('outbox')) {
        const s = db.createObjectStore('outbox', { keyPath: 'clientId' });
        s.createIndex('createdAt', 'createdAt');
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      // Another tab upgraded the db: close so it can finish, reopen next time.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => {
      dbPromise = null;
      reject(req.error || new Error('Could not open the offline database'));
    };
    req.onblocked = () => {
      // Old tab still open; the open continues when it closes.
    };
  });
  return dbPromise;
}

const reqToPromise = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

/** Run `fn` in one transaction; resolves after the transaction commits. */
export async function tx<T>(stores: StoreName | StoreName[], mode: IDBTransactionMode, fn: (t: IDBTransaction) => Promise<T> | T): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(stores, mode);
    let result: T;
    let failed = false;
    t.oncomplete = () => resolve(result);
    t.onabort = () => reject(t.error || new Error('Offline database: transaction aborted'));
    t.onerror = () => {
      failed = true;
    };
    Promise.resolve()
      .then(() => fn(t))
      .then((r) => {
        result = r;
      })
      .catch((e) => {
        if (!failed) {
          try {
            t.abort();
          } catch {
            /* already finished */
          }
        }
        reject(e);
      });
  });
}

export function idbGet<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
  return tx(store, 'readonly', (t) => reqToPromise(t.objectStore(store).get(key)) as Promise<T | undefined>);
}

export function idbPut(store: StoreName, value: unknown, key?: IDBValidKey): Promise<void> {
  return tx(store, 'readwrite', async (t) => {
    await reqToPromise(key === undefined ? t.objectStore(store).put(value) : t.objectStore(store).put(value, key));
  });
}

export function idbDelete(store: StoreName, key: IDBValidKey): Promise<void> {
  return tx(store, 'readwrite', async (t) => {
    await reqToPromise(t.objectStore(store).delete(key));
  });
}

export function idbGetAll<T>(store: StoreName): Promise<T[]> {
  return tx(store, 'readonly', (t) => reqToPromise(t.objectStore(store).getAll()) as Promise<T[]>);
}

export { reqToPromise };
