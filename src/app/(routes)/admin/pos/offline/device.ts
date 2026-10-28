// This PC/browser: a stable device id, a short device code and the OFF- slip
// numbers ("OFF-7K2-0012"). The counter lives in IndexedDB (meta) and is
// bumped inside one transaction, so two tabs never get the same number.
'use client';

import { reqToPromise, tx, idbGet, idbPut } from './db';

const DEVICE_KEY = 'deviceId';
const COUNTER_KEY = 'offCounter';
const NAME_KEY = 'deviceName';
const LS_DEVICE_KEY = 'pos_device_id';

/** RFC 4122 v4 uuid (crypto.randomUUID when there is one). */
export function uuid(): string {
  const c = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const b = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

let cachedId: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (cachedId) return cachedId;
  let id = await idbGet<string>('meta', DEVICE_KEY).catch(() => undefined);
  if (!id) {
    try {
      id = localStorage.getItem(LS_DEVICE_KEY) || undefined;
    } catch {
      /* storage blocked */
    }
    if (!id) id = uuid();
    await idbPut('meta', id, DEVICE_KEY).catch(() => undefined);
  }
  try {
    localStorage.setItem(LS_DEVICE_KEY, id);
  } catch {
    /* storage blocked */
  }
  cachedId = id;
  return id;
}

// No 0/O/1/I so the code reads well on a slip.
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/** 3-character code made from the device id (same PC = same code). */
export function deviceCode(deviceId: string): string {
  let h = 2166136261;
  for (let i = 0; i < deviceId.length; i++) {
    h ^= deviceId.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  let out = '';
  for (let i = 0; i < 3; i++) {
    out += ALPHABET[h % ALPHABET.length];
    h = Math.floor(h / ALPHABET.length);
  }
  return out;
}

export function formatOfflineNumber(code: string, n: number): string {
  // 4 digits; after 9999 it simply grows (10000) so it never repeats.
  return `OFF-${code}-${String(n).padStart(4, '0')}`;
}

/** Next OFF- number for this PC (atomic across tabs). */
export async function nextOfflineNumber(): Promise<string> {
  const id = await getDeviceId();
  const n = await tx('meta', 'readwrite', async (t) => {
    const store = t.objectStore('meta');
    const current = Number(await reqToPromise(store.get(COUNTER_KEY))) || 0;
    const next = current + 1;
    await reqToPromise(store.put(next, COUNTER_KEY));
    return next;
  });
  return formatOfflineNumber(deviceCode(id), n);
}

export async function getDeviceName(): Promise<string> {
  const name = await idbGet<string>('meta', NAME_KEY).catch(() => undefined);
  return name || 'Counter PC';
}

export async function setDeviceName(name: string): Promise<void> {
  await idbPut('meta', name.trim().slice(0, 60) || 'Counter PC', NAME_KEY);
}
