// Outbox: sales made while offline, kept in IndexedDB until the server has them.
// Every change is announced to this tab and (BroadcastChannel) to other tabs.
'use client';

import { idbDelete, idbGet, idbGetAll, idbPut } from './db';
import type { OutboxEntry } from './types';

const CHANNEL = 'dollarco-pos-outbox';
const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (channel || typeof BroadcastChannel === 'undefined') return channel;
  channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = () => listeners.forEach((l) => l());
  return channel;
}

export function notifyOutboxChanged() {
  listeners.forEach((l) => l());
  try {
    getChannel()?.postMessage('changed');
  } catch {
    /* channel closed */
  }
}

export function subscribeOutbox(l: () => void): () => void {
  getChannel();
  listeners.add(l);
  return () => listeners.delete(l);
}

/** All entries, oldest first. */
export async function listOutbox(): Promise<OutboxEntry[]> {
  const all = await idbGetAll<OutboxEntry>('outbox');
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function addToOutbox(entry: OutboxEntry): Promise<void> {
  // Same clientId twice (double click) just overwrites itself: still one sale.
  await idbPut('outbox', entry);
  notifyOutboxChanged();
}

export async function getOutboxEntry(clientId: string): Promise<OutboxEntry | undefined> {
  return idbGet<OutboxEntry>('outbox', clientId);
}

export async function removeFromOutbox(clientId: string, notify = true): Promise<void> {
  await idbDelete('outbox', clientId);
  if (notify) notifyOutboxChanged();
}

export async function updateOutboxEntry(clientId: string, patch: Partial<OutboxEntry>, notify = true): Promise<void> {
  const e = await getOutboxEntry(clientId);
  if (!e) return;
  await idbPut('outbox', { ...e, ...patch, clientId });
  if (notify) notifyOutboxChanged();
}

/** "Retry" in the needs-attention list: back to the upload queue. */
export async function retryOutboxEntry(clientId: string): Promise<void> {
  await updateOutboxEntry(clientId, { state: 'waiting', lastError: undefined, lastErrorCode: undefined });
}

export async function outboxCounts(): Promise<{ waiting: number; failed: number }> {
  const all = await idbGetAll<OutboxEntry>('outbox').catch(() => [] as OutboxEntry[]);
  return {
    waiting: all.filter((e) => e.state !== 'failed').length,
    failed: all.filter((e) => e.state === 'failed').length,
  };
}
