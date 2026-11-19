// Are we online? = the browser says so AND the last server call did not fail
// with a network error. After a network failure we ping the server every 15 s
// (GET /settings/public, tiny and public) until it answers again.
'use client';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';
const PROBE_MS = 15_000;

type Listener = () => void;
const listeners = new Set<Listener>();

let serverReachable = true;
let probeTimer: ReturnType<typeof setTimeout> | null = null;
let probing = false;
let started = false;

function emit() {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* listener error */
    }
  });
}

export function browserOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
}

/** True when the POS can talk to the server right now. */
export function isOnline(): boolean {
  return browserOnline() && serverReachable;
}

export function subscribeConnectivity(l: Listener): () => void {
  ensureStarted();
  listeners.add(l);
  return () => listeners.delete(l);
}

/**
 * A fetch that never reached the server: TypeError "Failed to fetch", or the
 * gateway saying the server is not there (502/503/504).
 */
export function isNetworkError(e: unknown): boolean {
  if (!e) return false;
  if (typeof e === 'object' && e !== null && 'name' in e && (e as { name?: string }).name === 'AbortError') return false;
  if (e instanceof TypeError) return true;
  const status = typeof e === 'object' && e !== null ? Number((e as { status?: number }).status) : NaN;
  if (status === 502 || status === 503 || status === 504) return true;
  const msg = e instanceof Error ? e.message : String(e);
  return /failed to fetch|network ?error|load failed|networkerror|err_internet_disconnected/i.test(msg);
}

export function reportNetworkFailure() {
  if (serverReachable) {
    serverReachable = false;
    emit();
  }
  scheduleProbe(PROBE_MS);
}

export function reportNetworkOk() {
  if (!serverReachable) {
    serverReachable = true;
    emit();
  }
}

function scheduleProbe(ms: number) {
  if (probeTimer || typeof window === 'undefined') return;
  probeTimer = setTimeout(() => {
    probeTimer = null;
    void probe();
  }, ms);
}

/** Ping the server once. Any HTTP answer = reachable. */
export async function probe(): Promise<boolean> {
  if (probing || !BACKEND_URL) return serverReachable;
  if (!browserOnline()) {
    scheduleProbe(PROBE_MS);
    return false;
  }
  probing = true;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    const res = await fetch(`${BACKEND_URL}/settings/public`, { cache: 'no-store', signal: ctl.signal });
    clearTimeout(t);
    if (res.status === 502 || res.status === 503 || res.status === 504) throw new Error('gateway');
    reportNetworkOk();
    return true;
  } catch {
    if (serverReachable) {
      serverReachable = false;
      emit();
    }
    scheduleProbe(PROBE_MS);
    return false;
  } finally {
    probing = false;
  }
}

function ensureStarted() {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('online', () => {
    emit();
    void probe();
  });
  window.addEventListener('offline', () => emit());
}

/**
 * fetch() with a time limit. A slow or stalled connection (shop -> server) used
 * to leave a scan waiting for minutes. After `ms` the request is cancelled and a
 * TypeError('Network timeout') is thrown, which isNetworkError() treats as a
 * network failure (so callers fall back to the saved catalogue). If the caller's
 * own `signal` aborts, the normal AbortError is thrown instead.
 */
export async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 6000): Promise<Response> {
  const ctl = new AbortController();
  const outer = init.signal;
  let timedOut = false;
  const onOuterAbort = () => ctl.abort();
  if (outer) {
    if (outer.aborted) ctl.abort();
    else outer.addEventListener('abort', onOuterAbort, { once: true });
  }
  const timer = setTimeout(() => {
    timedOut = true;
    ctl.abort();
  }, ms);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } catch (e) {
    if (timedOut && !outer?.aborted) throw new TypeError('Network timeout');
    throw e;
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener('abort', onOuterAbort);
  }
}
