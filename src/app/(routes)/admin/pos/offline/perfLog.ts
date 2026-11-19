// POS speed log: what THIS counter PC actually experiences, sent to the server
// (POST /api/perf, read on /admin/performance). It answers "is it the server or
// the internet?":
//   ms        = total time the counter waited
//   serverMs  = time the server itself spent (Server-Timing header)
//   ms - serverMs ~ network time (shop internet -> server and back)
// Events: page_load, ping (every 2 min), scan, scan_fallback, search, catalog,
// api_error. Queued in memory, sent every 30 s and when the page is closed.
// Never throws and never slows the POS down.
'use client';

import { getAuthHeader } from '@/helper/helper';
import { deviceCode, getDeviceId, getDeviceName } from './device';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';
const FLUSH_MS = 30_000;
const PING_MS = 120_000;
const PING_TIMEOUT_MS = 20_000;
const MAX_QUEUE = 300;
const BATCH = 100;

export type PerfKind = 'page_load' | 'ping' | 'scan' | 'scan_fallback' | 'search' | 'catalog' | 'api_error';

export interface PerfEvent {
  kind: PerfKind;
  ms?: number | null;
  serverMs?: number | null;
  ok?: boolean;
  outcome?: string;
  path?: string;
  detail?: Record<string, string | number | boolean | null | undefined>;
}

type Queued = PerfEvent & { at: number };

const queue: Queued[] = [];
let device = '';
let started = false;
let flushing = false;

const round = (n: number) => Math.round(n * 10) / 10;

/** Record one measurement (cheap; sent later in a batch). */
export function perfEvent(e: PerfEvent): void {
  try {
    queue.push({ ...e, ms: e.ms == null ? e.ms : round(e.ms), at: Date.now() });
    if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE);
  } catch {
    /* never break the POS */
  }
}

/** The server's own time for this response (Server-Timing: app;dur=12.3). */
export function serverMsFrom(res: Response | undefined | null): number | null {
  try {
    const h = res?.headers.get('server-timing') || '';
    const m = /app;dur=([\d.]+)/.exec(h);
    return m ? Number(m[1]) : null;
  } catch {
    return null;
  }
}

/** 'timeout' | 'network' | 'error' for a failed fetch. */
export function failureKind(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/timeout/i.test(msg)) return 'timeout';
  if (e instanceof TypeError || /failed to fetch|network/i.test(msg)) return 'network';
  return 'error';
}

function connectionInfo(): Record<string, string | number | undefined> {
  const c = (typeof navigator !== 'undefined' ? (navigator as Navigator & { connection?: { effectiveType?: string; rtt?: number; downlink?: number } }).connection : undefined);
  return c ? { netType: c.effectiveType, netRtt: c.rtt, netDownMbps: c.downlink } : {};
}

async function flush(useKeepalive = false): Promise<void> {
  if (flushing || !queue.length || !BACKEND_URL) return;
  const auth = getAuthHeader();
  if (!auth.Authorization) return;
  flushing = true;
  const batch = queue.splice(0, BATCH);
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 15_000);
    const res = await fetch(`${BACKEND_URL}/api/perf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify({ device, page: typeof location !== 'undefined' ? location.pathname : '', events: batch }),
      keepalive: useKeepalive,
      signal: useKeepalive ? undefined : ctl.signal,
    });
    clearTimeout(t);
    if (!res.ok && res.status >= 500) throw new Error(`perf ${res.status}`);
  } catch {
    // Put them back (oldest first) so a bad minute is still reported later.
    queue.unshift(...batch);
    if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE);
  } finally {
    flushing = false;
  }
}

/** Round trip to the server (GET /health): network health of this counter. */
async function ping(): Promise<void> {
  if (!BACKEND_URL) return;
  const t0 = performance.now();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), PING_TIMEOUT_MS);
  try {
    const res = await fetch(`${BACKEND_URL}/health`, { cache: 'no-store', signal: ctl.signal });
    perfEvent({
      kind: 'ping',
      ms: performance.now() - t0,
      serverMs: serverMsFrom(res),
      ok: res.ok,
      outcome: res.ok ? 'ok' : `http_${res.status}`,
      detail: { online: navigator.onLine, ...connectionInfo() },
    });
  } catch (e) {
    const aborted = ctl.signal.aborted;
    perfEvent({
      kind: 'ping',
      ms: performance.now() - t0,
      ok: false,
      outcome: aborted ? 'timeout' : failureKind(e),
      detail: { online: navigator.onLine, ...connectionInfo() },
    });
  } finally {
    clearTimeout(timer);
  }
}

/** How the POS page itself loaded (HTML + scripts). */
function reportPageLoad(): void {
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (!nav) return;
    const res = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const scripts = res.filter((r) => r.initiatorType === 'script' || r.name.endsWith('.js') || r.name.endsWith('.css'));
    const slowest = scripts.reduce((m, r) => (r.duration > m.duration ? r : m), { duration: 0, name: '' } as { duration: number; name: string });
    perfEvent({
      kind: 'page_load',
      ms: nav.loadEventEnd > 0 ? nav.loadEventEnd : nav.duration,
      ok: true,
      outcome: nav.type,
      path: location.pathname,
      detail: {
        dns: round(nav.domainLookupEnd - nav.domainLookupStart),
        connect: round(nav.connectEnd - nav.connectStart),
        tls: nav.secureConnectionStart > 0 ? round(nav.connectEnd - nav.secureConnectionStart) : 0,
        ttfb: round(nav.responseStart - nav.requestStart),
        html: round(nav.responseEnd - nav.startTime),
        domReady: round(nav.domContentLoadedEventEnd),
        files: scripts.length,
        filesOver3s: scripts.filter((r) => r.duration > 3000).length,
        slowestFileMs: round(slowest.duration),
        slowestFile: slowest.name.split('/').pop() || '',
        ...connectionInfo(),
      },
    });
  } catch {
    /* ignore */
  }
}

/** Start logging on the POS page (safe to call more than once). */
export function startPerfLogging(): () => void {
  if (started || typeof window === 'undefined') return () => undefined;
  started = true;

  void (async () => {
    try {
      const [id, name] = await Promise.all([getDeviceId(), getDeviceName()]);
      device = `${name} (${deviceCode(id)})`;
    } catch {
      device = 'unknown PC';
    }
  })();

  if (document.readyState === 'complete') setTimeout(reportPageLoad, 0);
  else window.addEventListener('load', () => setTimeout(reportPageLoad, 0), { once: true });

  const firstPing = setTimeout(() => void ping(), 10_000);
  const pingTimer = setInterval(() => void ping(), PING_MS);
  const flushTimer = setInterval(() => void flush(), FLUSH_MS);
  const onHide = () => void flush(true);
  window.addEventListener('pagehide', onHide);

  return () => {
    clearTimeout(firstPing);
    clearInterval(pingTimer);
    clearInterval(flushTimer);
    window.removeEventListener('pagehide', onHide);
    void flush(true);
    started = false;
  };
}
