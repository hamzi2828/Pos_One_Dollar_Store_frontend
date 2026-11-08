// POS activity log: every scan / click on the selling screen, grouped by cart.
//
//   logPos('scan', 'Scanned 59554 → Home Decor', { code: '59554' }, { itemCount: 3, total: 1200 });
//
// Events are queued here and sent to POST /api/pos/activity every 3 s (at once
// for 'completed' / 'failed' / 'hold' / 'clear'). The unsent queue is kept in
// localStorage so a reload or no internet does not lose it. This must never
// slow down or break a sale: every error is swallowed.
'use client';

import { getAuthHeader } from '@/helper/helper';
import { getDeviceName, uuid } from '../offline/device';

export type PosEventType =
  | 'scan'
  | 'scan_not_found'
  | 'add'
  | 'qty'
  | 'remove'
  | 'clear'
  | 'discount'
  | 'customer'
  | 'hold'
  | 'retrieve'
  | 'pay_open'
  | 'pay_close'
  | 'pay_submit'
  | 'completed'
  | 'failed'
  | 'offline_saved';

export interface PosEvent {
  at: string;
  type: PosEventType;
  label: string;
  data?: Record<string, unknown>;
}

interface QueuedEvent {
  cartId: string;
  startedAt: string;
  itemCount?: number;
  total?: number;
  event: PosEvent;
}

const API_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL || ''}/api/pos/activity`;
const LS_KEY = 'pos_activity_queue_v1';
const MAX_BATCH = 50;
const MAX_QUEUE = 3000; // oldest events are dropped after this
const FLUSH_MS = 3000;
const RETRY_MS = 30000;

// These events end the cart: the next event starts a new one.
const ENDS_CART: PosEventType[] = ['completed', 'offline_saved', 'clear', 'hold'];
// These events are sent straight away.
const SEND_NOW: PosEventType[] = ['completed', 'failed', 'hold', 'clear'];

let current: { cartId: string; startedAt: string } | null = null;
let queue: QueuedEvent[] | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let sending = false;
let retryAfter = 0;
let deviceName = '';
let started = false;

const isBrowser = () => typeof window !== 'undefined';

function loadQueue(): QueuedEvent[] {
  if (queue) return queue;
  queue = [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) queue = parsed.filter((q) => q && q.cartId && q.event);
  } catch {
    /* storage blocked or bad data */
  }
  return queue;
}

function saveQueue() {
  try {
    if (!queue || queue.length === 0) localStorage.removeItem(LS_KEY);
    else localStorage.setItem(LS_KEY, JSON.stringify(queue));
  } catch {
    /* storage full or blocked */
  }
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json', ...getAuthHeader() };
  if (deviceName) h['x-device-name'] = deviceName;
  return h;
}

/** Group the first events of the queue into one body per cart. */
function nextBatch(): { body: Record<string, unknown>; items: QueuedEvent[] } | null {
  const q = loadQueue();
  if (q.length === 0) return null;
  const cartId = q[0].cartId;
  const items = q.filter((x) => x.cartId === cartId).slice(0, MAX_BATCH);
  const last = items[items.length - 1];
  const body: Record<string, unknown> = {
    cartId,
    startedAt: items[0].startedAt,
    events: items.map((x) => x.event),
  };
  if (last.itemCount !== undefined) body.itemCount = last.itemCount;
  if (last.total !== undefined) body.total = last.total;
  return { body, items };
}

function drop(items: QueuedEvent[]) {
  const set = new Set(items);
  queue = loadQueue().filter((x) => !set.has(x));
  saveQueue();
}

async function flush(): Promise<void> {
  if (!isBrowser() || sending) return;
  if (Date.now() < retryAfter) return schedule(retryAfter - Date.now());
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return; // 'online' event flushes later
  sending = true;
  try {
    for (let i = 0; i < 20; i++) {
      const batch = nextBatch();
      if (!batch) break;
      let res: Response;
      try {
        res = await fetch(API_URL, { method: 'POST', headers: headers(), body: JSON.stringify(batch.body), keepalive: true });
      } catch {
        retryAfter = Date.now() + RETRY_MS; // network down: keep and try later
        break;
      }
      if (res.ok) {
        drop(batch.items);
        continue;
      }
      // 4xx (bad data, no access): drop so the queue never gets stuck. 5xx / 408 / 429: try later.
      if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
        drop(batch.items);
        continue;
      }
      retryAfter = Date.now() + RETRY_MS;
      break;
    }
  } catch {
    /* never throw */
  } finally {
    sending = false;
  }
  if (loadQueue().length > 0) schedule(Math.max(FLUSH_MS, retryAfter - Date.now()));
}

function schedule(ms = FLUSH_MS) {
  if (!isBrowser() || timer) return;
  timer = setTimeout(() => {
    timer = null;
    void flush();
  }, ms);
}

/** Send what is left when the page is closed (fetch keepalive survives the unload). */
function flushOnLeave() {
  try {
    // No internet: keep the queue saved, it goes on the next load.
    if (sending || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
    for (let i = 0; i < 3; i++) {
      const batch = nextBatch();
      if (!batch) break;
      void fetch(API_URL, { method: 'POST', headers: headers(), body: JSON.stringify(batch.body), keepalive: true }).catch(() => undefined);
      drop(batch.items);
    }
  } catch {
    /* ignore */
  }
}

function start() {
  if (started || !isBrowser()) return;
  started = true;
  getDeviceName()
    .then((n) => {
      deviceName = n;
    })
    .catch(() => undefined);
  window.addEventListener('online', () => {
    retryAfter = 0;
    void flush();
  });
  window.addEventListener('pagehide', flushOnLeave);
  if (loadQueue().length > 0) schedule(1000); // left over from last time
}

/**
 * Log one POS action. Never throws, never waits.
 * meta = cart size (pieces) and bill total right now, when known.
 */
export function logPos(
  type: PosEventType,
  label: string,
  data?: Record<string, unknown>,
  meta: { itemCount?: number; total?: number } = {}
): void {
  try {
    if (!isBrowser()) return;
    start();
    // A held cart coming back is a new cart in the log.
    if (type === 'retrieve') current = null;
    if (!current) current = { cartId: uuid(), startedAt: new Date().toISOString() };
    const q = loadQueue();
    const item: QueuedEvent = {
      cartId: current.cartId,
      startedAt: current.startedAt,
      event: { at: new Date().toISOString(), type, label: String(label).slice(0, 300), ...(data ? { data } : {}) },
    };
    if (Number.isFinite(meta.itemCount)) item.itemCount = meta.itemCount;
    if (Number.isFinite(meta.total)) item.total = meta.total;
    q.push(item);
    if (q.length > MAX_QUEUE) q.splice(0, q.length - MAX_QUEUE);
    saveQueue();
    if (ENDS_CART.includes(type)) current = null;
    if (SEND_NOW.includes(type)) {
      retryAfter = 0;
      void flush();
    } else {
      schedule();
    }
  } catch {
    /* logging must never break a sale */
  }
}
