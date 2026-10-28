// Upload worker: sends outbox sales to POST /api/pos/offline/orders.
//
// - Runs on the `online` event, on page load and every 30 s while sales wait.
// - Oldest first, 20 per call (the server takes up to 50; 20 keeps each call short on Vercel).
// - navigator.locks: only one tab uploads at a time (others skip).
// - created / duplicate -> removed from the outbox (the server has it, never twice:
//   the clientId is the idempotency key).
// - failed + retry:false -> kept under "Needs attention" (no endless retries).
// - network error / 5xx -> back off (10 s, 20 s, 40 s ... max 5 min) and retry.
'use client';

import { getAuthHeader } from '@/helper/helper';
import { browserOnline, isNetworkError, reportNetworkFailure, reportNetworkOk } from './connectivity';
import { getDeviceId, getDeviceName } from './device';
import { listOutbox, notifyOutboxChanged, removeFromOutbox, updateOutboxEntry } from './outbox';
import type { OfflineUploadResult, OfflineUploadWarning, OutboxEntry } from './types';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';
const BATCH = 20;
const TICK_MS = 30_000;
const LOCK_NAME = 'dollarco-pos-upload';
const MIN_BACKOFF = 10_000;
const MAX_BACKOFF = 5 * 60_000;

export interface UploadSummary {
  uploaded: { offlineNumber: string; orderNumber?: string; warnings: OfflineUploadWarning[] }[];
  failed: number;
}

type State = { uploading: boolean; problem: string | null };
let state: State = { uploading: false, problem: null };
const stateListeners = new Set<() => void>();
const doneListeners = new Set<(s: UploadSummary) => void>();

let backoff = 0;
let nextTryAt = 0;
let inFlight: Promise<void> | null = null;

function setState(patch: Partial<State>) {
  state = { ...state, ...patch };
  stateListeners.forEach((l) => l());
}

export function uploadState(): State {
  return state;
}

export function subscribeUpload(l: () => void): () => void {
  stateListeners.add(l);
  return () => stateListeners.delete(l);
}

/** Called after each upload run that sent something. */
export function onUploadDone(l: (s: UploadSummary) => void): () => void {
  doneListeners.add(l);
  return () => doneListeners.delete(l);
}

function backOff() {
  backoff = backoff ? Math.min(MAX_BACKOFF, backoff * 2) : MIN_BACKOFF;
  nextTryAt = Date.now() + backoff;
}

class UploadHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function postBatch(entries: OutboxEntry[]): Promise<OfflineUploadResult[]> {
  const [deviceId, deviceName] = await Promise.all([getDeviceId(), getDeviceName()]);
  const res = await fetch(`${BACKEND_URL}/api/pos/offline/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify({ deviceId, deviceName, orders: entries.map((e) => e.order) }),
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as Record<string, unknown>);
    throw new UploadHttpError(res.status, String((body as { message?: string }).message || `Upload failed (${res.status})`));
  }
  const body = await res.json();
  const results = body?.data?.results;
  if (!Array.isArray(results)) throw new UploadHttpError(500, 'Upload answer had no results');
  return results as OfflineUploadResult[];
}

async function uploadAll(): Promise<void> {
  const summary: UploadSummary = { uploaded: [], failed: 0 };
  let sentSomething = false;
  try {
    for (let round = 0; round < 40; round++) {
      const waiting = (await listOutbox()).filter((e) => e.state !== 'failed');
      if (!waiting.length) break;
      const batch = waiting.slice(0, BATCH);
      setState({ uploading: true });
      let results: OfflineUploadResult[];
      try {
        results = await postBatch(batch);
      } catch (e) {
        if (e instanceof UploadHttpError) {
          if (e.status === 502 || e.status === 503 || e.status === 504) reportNetworkFailure();
          else reportNetworkOk();
          if (e.status === 401) setState({ problem: 'Sign in again to upload offline sales' });
          else if (e.status === 403) setState({ problem: 'This user may not upload offline sales (Desktop app → Sales on the counter PC: create)' });
          else if (e.status === 404) setState({ problem: 'The server cannot take offline sales yet' });
          else setState({ problem: e.message });
          // Remember the error on each sale (shown in the panel); keep them waiting.
          for (const entry of batch) {
            await updateOutboxEntry(entry.clientId, { attempts: entry.attempts + 1, lastTriedAt: Date.now(), lastError: e.message }, false);
          }
          notifyOutboxChanged();
        } else if (isNetworkError(e)) {
          reportNetworkFailure();
        }
        backOff();
        break;
      }
      reportNetworkOk();
      sentSomething = true;
      setState({ problem: null });
      const byId = new Map(results.map((r) => [r.clientId, r]));
      let retryLater = false;
      for (const entry of batch) {
        const r = byId.get(entry.clientId);
        if (!r) {
          retryLater = true;
          continue;
        }
        if (r.status === 'created' || r.status === 'duplicate') {
          await removeFromOutbox(entry.clientId, false);
          summary.uploaded.push({ offlineNumber: entry.offlineNumber, orderNumber: r.orderNumber, warnings: r.warnings || [] });
        } else if (r.error?.retry === false) {
          await updateOutboxEntry(
            entry.clientId,
            { state: 'failed', attempts: entry.attempts + 1, lastTriedAt: Date.now(), lastError: r.error?.message || 'The server could not save this sale', lastErrorCode: r.error?.code },
            false
          );
          summary.failed++;
        } else {
          retryLater = true;
          await updateOutboxEntry(
            entry.clientId,
            { attempts: entry.attempts + 1, lastTriedAt: Date.now(), lastError: r.error?.message, lastErrorCode: r.error?.code },
            false
          );
        }
      }
      notifyOutboxChanged();
      if (retryLater) {
        backOff();
        break;
      }
      backoff = 0;
      nextTryAt = 0;
      if (batch.length < BATCH) break;
    }
  } finally {
    setState({ uploading: false });
    if (sentSomething && (summary.uploaded.length || summary.failed)) doneListeners.forEach((l) => l(summary));
  }
}

/** Upload now (skips when another tab is uploading or we are backing off). */
export function uploadNow(opts: { force?: boolean } = {}): Promise<void> {
  if (!BACKEND_URL || !browserOnline()) return Promise.resolve();
  if (!opts.force && Date.now() < nextTryAt) return Promise.resolve();
  if (opts.force) {
    backoff = 0;
    nextTryAt = 0;
  }
  if (inFlight) return inFlight;
  const run = async () => {
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    if (locks && typeof locks.request === 'function') {
      await locks.request(LOCK_NAME, { ifAvailable: true }, async (lock) => {
        if (!lock) return; // another tab is uploading
        await uploadAll();
      });
    } else {
      await uploadAll();
    }
  };
  inFlight = run()
    .catch((e) => console.error('Offline upload failed:', e))
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

let timer: ReturnType<typeof setInterval> | null = null;
let users = 0;

/** Start the worker (POS page mount). Returns stop. */
export function startSyncWorker(): () => void {
  users++;
  if (users === 1 && typeof window !== 'undefined') {
    const onOnline = () => void uploadNow({ force: true });
    window.addEventListener('online', onOnline);
    timer = setInterval(async () => {
      const waiting = (await listOutbox().catch(() => [] as OutboxEntry[])).some((e) => e.state !== 'failed');
      if (waiting) void uploadNow();
    }, TICK_MS);
    void uploadNow({ force: true });
    stopFn = () => {
      window.removeEventListener('online', onOnline);
      if (timer) clearInterval(timer);
      timer = null;
    };
  }
  return () => {
    users--;
    if (users <= 0) {
      users = 0;
      stopFn?.();
      stopFn = null;
    }
  };
}
let stopFn: (() => void) | null = null;
