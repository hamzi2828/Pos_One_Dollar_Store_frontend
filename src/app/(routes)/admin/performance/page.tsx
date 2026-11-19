'use client';

// Connection & speed (super admin only). What the counter PCs measured
// (see admin/pos/offline/perfLog.ts) so the owner can tell whether a slow
// POS is the server or the shop's internet:
//   total time (ms) - server time (serverMs) ~ time spent on the internet.
// Data: GET /api/perf/summary and /api/perf/recent. Refreshes every 60 s.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Gauge, RefreshCw, Wifi, Server, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { storeApi, apiErrorMessage } from '@/lib/storeApi';
import { NoAccessCard, LoadingCard, HelpBox } from '@/components/admin/FormBits';
import {
  PageHeader,
  FilterBar,
  Card,
  EmptyState,
  ErrorState,
  LineChart,
  selectClass,
  fmtNum,
  fmtPct,
} from '@/app/(routes)/admin/reports/demand/_shared/reportKit';

/* ------------------------------------------------------------------ */
/* Types (shape of /api/perf/summary)                                  */
/* ------------------------------------------------------------------ */

type Kind = 'page_load' | 'ping' | 'scan' | 'scan_fallback' | 'search' | 'catalog' | 'api_error';

interface Stats {
  count: number;
  failed: number;
  failedPct: number;
  p50: number | null;
  p90: number | null;
  p99: number | null;
  max: number | null;
  serverP50: number | null;
  serverP90: number | null;
  outcomes: Record<string, number>;
}

interface DeviceRow {
  device: string;
  lastSeen: string | null;
  ip: string | null;
  user: string | null;
  kinds: Partial<Record<Kind, Stats>>;
}

interface HourRow {
  hour: string;
  kind: 'ping' | 'scan';
  count: number;
  p50: number | null;
  p90: number | null;
  failedPct: number;
}

type Detail = Record<string, string | number | boolean | null | undefined>;

interface EventRow {
  _id?: string;
  at: string;
  kind: Kind;
  ms: number | null;
  serverMs: number | null;
  ok: boolean;
  outcome?: string;
  path?: string;
  detail?: Detail | null;
  device?: string;
  page?: string;
  userId?: string | null;
  userName?: string | null;
  ip?: string | null;
}

interface Summary {
  success: boolean;
  hours: number;
  since: string;
  total: number;
  kinds: Partial<Record<Kind, Stats>>;
  devices: DeviceRow[];
  hourly: HourRow[];
  slowest: EventRow[];
  pageLoads: EventRow[];
}

/* ------------------------------------------------------------------ */
/* Labels & formatting                                                 */
/* ------------------------------------------------------------------ */

const KIND_INFO: Record<Kind, { label: string; hint: string }> = {
  ping: { label: 'Connection check', hint: 'Each counter asks the server "are you there?" every 2 minutes.' },
  scan: { label: 'Barcode scan', hint: 'Time from scanning a barcode to the item showing in the bill.' },
  scan_fallback: { label: 'Scan not on this PC', hint: 'The item was not in the PC copy, so the server was asked.' },
  search: { label: 'Product search', hint: 'Typing a name or code in the POS search box.' },
  catalog: { label: 'Product list download', hint: 'The counter downloading the product list to work offline.' },
  page_load: { label: 'Opening the POS page', hint: 'Loading the POS screen (page and its files).' },
  api_error: { label: 'Errors', hint: 'Requests that the server refused or that never arrived.' },
};
const KIND_ORDER: Kind[] = ['ping', 'scan', 'scan_fallback', 'search', 'catalog', 'page_load', 'api_error'];

const RANGES = [
  { hours: 1, label: 'Last hour' },
  { hours: 6, label: 'Last 6 hours' },
  { hours: 24, label: 'Last 24 hours' },
  { hours: 24 * 7, label: 'Last 7 days' },
];

const REFRESH_MS = 60_000;

/** 25 ms / 1.8 s / 2.1 min */
function fmtMs(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '—';
  const n = Number(v);
  if (n < 1000) return `${Math.round(n)} ms`;
  if (n < 60_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)} s`;
  return `${(n / 60_000).toFixed(1)} min`;
}

function fmtWhen(v: string | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
}

function fmtAgo(v: string | null | undefined): string {
  if (!v) return '—';
  const s = Math.round((Date.now() - new Date(v).getTime()) / 1000);
  if (!Number.isFinite(s)) return '—';
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
}

function hourLabel(iso: string, withDay: boolean): string {
  const d = new Date(iso);
  const h = d.getHours();
  const hh = `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'am' : 'pm'}`;
  return withDay ? `${d.getDate()} ${d.toLocaleString('en-GB', { month: 'short' })} ${hh}` : hh;
}

/** Network part of a typical request: total p50 minus server p50. */
function split(s: Stats | undefined): { server: number | null; network: number | null } {
  if (!s || s.p50 == null || s.serverP50 == null) return { server: null, network: null };
  return { server: s.serverP50, network: Math.max(0, s.p50 - s.serverP50) };
}

const tone = (ms: number | null | undefined, good: number, bad: number) =>
  ms == null ? 'text-gray-900' : ms <= good ? 'text-emerald-700' : ms >= bad ? 'text-red-700' : 'text-amber-700';
const failTone = (p: number | null | undefined) => (!p ? 'text-emerald-700' : p >= 5 ? 'text-red-700' : 'text-amber-700');

/* ------------------------------------------------------------------ */
/* Verdict                                                             */
/* ------------------------------------------------------------------ */

interface Verdict {
  level: 'good' | 'network' | 'server' | 'none';
  title: string;
  lines: string[];
}

function buildVerdict(kinds: Partial<Record<Kind, Stats>>): Verdict {
  const ping = kinds.ping;
  const scan = kinds.scan;
  const search = kinds.search;
  // What the cashier feels most: barcode scans; otherwise searches; otherwise the ping.
  const candidates: [Kind, Stats | undefined][] = [
    ['scan', scan],
    ['search', search],
    ['ping', ping],
  ];
  const found = candidates.find(([, s]) => s && s.count > 0 && s.p50 != null);
  const lines: string[] = [];

  if (!found || !found[1]) {
    if (ping && ping.count > 0 && ping.failedPct > 0) {
      return {
        level: 'network',
        title: `${fmtPct(ping.failedPct)} of connection checks failed`,
        lines: ['Counters could not reach the server at times. That points to the shop internet (or the server being down).'],
      };
    }
    return { level: 'none', title: 'No measurements in this period', lines: ['Open the POS on a counter PC; it sends its speed log every 30 seconds.'] };
  }

  const [mainKind, main] = found;
  const name = KIND_INFO[mainKind].label.toLowerCase();
  const { server, network } = split(main);
  let level: Verdict['level'] = 'good';
  let title: string;

  // Barcode scans are mostly answered from the PC copy, so only call it slow above ~0.7 s.
  const slowAt = mainKind === 'ping' ? 400 : 700;
  const slow = (main.p50 ?? 0) >= slowAt;
  if (server != null && network != null) {
    const head = `Typical ${name}: ${fmtMs(main.p50)} in total — server ${fmtMs(server)}, internet ${fmtMs(network)}.`;
    if (!slow) {
      title = 'Everything is fast';
      lines.push(head);
    } else if (server >= network) {
      level = 'server';
      title = 'The delay is the server, not the internet';
      lines.push(head, 'The server itself is taking most of the time. Tell the developer.');
    } else {
      level = 'network';
      title = 'The delay is the internet connection, not the server';
      lines.push(head, 'The server answers quickly; the time is lost between the shop and the server.');
    }
  } else {
    title = slow ? `Typical ${name} takes ${fmtMs(main.p50)}` : 'Everything is fast';
    if (slow) level = 'network';
    lines.push(`Typical ${name}: ${fmtMs(main.p50)}; slow ones ${fmtMs(main.p90)}. (The server did not report its own time for these.)`);
  }

  // Connection-check line: the clearest sign of internet trouble.
  if (ping && ping.count > 0) {
    const ps = split(ping);
    lines.push(
      `Connection check: typical ${fmtMs(ping.p50)}` +
        (ps.server != null ? ` (server ${fmtMs(ps.server)})` : '') +
        `, ${fmtPct(ping.failedPct)} failed (${fmtNum(ping.failed)} of ${fmtNum(ping.count)}).`,
    );
    if (ping.failedPct >= 5 && level !== 'server') {
      level = 'network';
      if (title === 'Everything is fast') title = 'Speed is fine, but the internet keeps dropping';
    }
  }
  const fb = kinds.scan_fallback;
  if (fb && fb.count > 0 && scan && scan.count > 0) {
    const share = (fb.count / (scan.count + fb.count)) * 100;
    if (share >= 10) lines.push(`${fmtPct(share)} of scans were not found on the PC and had to ask the server (typical ${fmtMs(fb.p50)}).`);
  }
  return { level, title, lines };
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function PerformancePage() {
  const { access, loaded, isSuperAdmin } = useAccess();
  const allowed = isSuperAdmin || (loaded && !access); // old login without access info: let the server decide

  const [hours, setHours] = useState(24);
  const [device, setDevice] = useState('');
  const [data, setData] = useState<Summary | null>(null);
  const [failures, setFailures] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [knownDevices, setKnownDevices] = useState<string[]>([]);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const id = ++seq.current;
    setLoading(true);
    try {
      const [sum, rec] = await Promise.all([
        storeApi.get<unknown>('/perf/summary', { hours, device }),
        storeApi.get<EventRow[]>('/perf/recent', { limit: 50, failed: 1, device }),
      ]);
      if (id !== seq.current) return;
      // /perf/summary answers with its fields at the top level (not under `data`).
      const s = sum as unknown as Summary;
      setData(s);
      setFailures(Array.isArray(rec.data) ? rec.data : []);
      setError(null);
      setUpdatedAt(new Date());
      setKnownDevices((prev) => Array.from(new Set([...prev, ...(s.devices || []).map((d) => d.device).filter(Boolean)])).sort());
    } catch (e) {
      if (id !== seq.current) return;
      setError(apiErrorMessage(e, 'Could not load the speed log.'));
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [hours, device]);

  useEffect(() => {
    if (!allowed) return;
    void load();
    const t = setInterval(() => {
      if (typeof document === 'undefined' || !document.hidden) void load();
    }, REFRESH_MS);
    return () => clearInterval(t);
  }, [allowed, load]);

  const verdict = useMemo(() => (data ? buildVerdict(data.kinds || {}) : null), [data]);

  if (!loaded && !isSuperAdmin) return <LoadingCard text="Checking access…" />;
  if (!allowed) return <NoAccessCard text="Only the super admin can see the connection & speed log." />;

  const rangeLabel = RANGES.find((r) => r.hours === hours)?.label || `Last ${hours} h`;

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        icon={<Gauge className="h-6 w-6" />}
        title="Connection & speed"
        subtitle="Is the POS slow because of the server or the shop's internet? Measured on each counter PC."
        actions={
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        }
      />

      <FilterBar>
        <div className="flex flex-wrap gap-1">
          {RANGES.map((r) => (
            <button
              key={r.hours}
              type="button"
              onClick={() => setHours(r.hours)}
              className={`px-3 py-1.5 text-sm rounded-lg border ${
                hours === r.hours ? 'bg-honey-500 border-honey-500 text-gray-900 font-semibold' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <select value={device} onChange={(e) => setDevice(e.target.value)} className={selectClass} aria-label="Counter PC">
          <option value="">All counter PCs</option>
          {knownDevices.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <span className="text-xs text-gray-500 sm:ml-auto">
          {updatedAt
            ? `Updated ${updatedAt.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })} · refreshes every minute`
            : ''}
        </span>
      </FilterBar>

      {error && <ErrorState message={error} onRetry={() => void load()} />}
      {!data && !error && <LoadingCard text="Loading the speed log…" />}

      {data && verdict && (
        <>
          <VerdictBox verdict={verdict} total={data.total} rangeLabel={rangeLabel} />
          <KindCards kinds={data.kinds || {}} />
          <DevicesTable devices={data.devices || []} onPick={setDevice} selected={device} />
          <HourlySection hourly={data.hourly || []} hours={hours} />
          <SlowestTable rows={(data.slowest || []).slice(0, 40)} />
          <PageLoadsTable rows={data.pageLoads || []} />
          <FailuresTable rows={failures} />
          <HelpBox>
            <b>How to read this:</b> &ldquo;Typical&rdquo; is what half of the requests beat (p50); &ldquo;slow&rdquo; is what 9 out of 10 beat (p90).
            &ldquo;Server&rdquo; is the time the server itself worked; the rest (&ldquo;internet&rdquo;) is the trip between the shop and the server. If the
            internet part is large or connection checks fail, check the shop router / internet package; if the server part is large, tell the developer.
          </HelpBox>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

function VerdictBox({ verdict, total, rangeLabel }: { verdict: Verdict; total: number; rangeLabel: string }) {
  const style = {
    good: { box: 'bg-emerald-50 border-emerald-200', title: 'text-emerald-800', icon: <CheckCircle2 className="h-6 w-6 text-emerald-600" /> },
    network: { box: 'bg-amber-50 border-amber-200', title: 'text-amber-900', icon: <Wifi className="h-6 w-6 text-amber-600" /> },
    server: { box: 'bg-red-50 border-red-200', title: 'text-red-800', icon: <Server className="h-6 w-6 text-red-600" /> },
    none: { box: 'bg-gray-50 border-gray-200', title: 'text-gray-800', icon: <AlertTriangle className="h-6 w-6 text-gray-400" /> },
  }[verdict.level];
  return (
    <div className={`rounded-lg border p-4 flex gap-3 ${style.box}`}>
      <div className="flex-shrink-0 mt-0.5">{style.icon}</div>
      <div className="min-w-0">
        <h2 className={`text-base sm:text-lg font-semibold ${style.title}`}>{verdict.title}</h2>
        {verdict.lines.map((l, i) => (
          <p key={i} className="text-sm text-gray-700 mt-0.5">
            {l}
          </p>
        ))}
        <p className="text-[11px] text-gray-500 mt-1">
          {rangeLabel} · {fmtNum(total)} measurements
        </p>
      </div>
    </div>
  );
}

const SERVER_COLOR = '#2a78d6';
const NET_COLOR = '#eb6834';

function KindCards({ kinds }: { kinds: Partial<Record<Kind, Stats>> }) {
  const list = KIND_ORDER.filter((k) => (kinds[k]?.count ?? 0) > 0);
  if (!list.length) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {list.map((k) => {
        const s = kinds[k] as Stats;
        const { server, network } = split(s);
        const totalSplit = (server ?? 0) + (network ?? 0);
        const outcomes = Object.entries(s.outcomes || {})
          .filter(([o]) => o && o !== 'ok')
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4);
        const good = k === 'page_load' || k === 'catalog' ? 3000 : k === 'ping' ? 400 : 700;
        const bad = good * 3;
        return (
          <div key={k} className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold text-gray-900">{KIND_INFO[k].label}</h3>
              <span className="text-xs text-gray-500">{fmtNum(s.count)} times</span>
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">{KIND_INFO[k].hint}</p>
            <div className="grid grid-cols-4 gap-2 mt-3">
              <Mini label="Typical" value={fmtMs(s.p50)} className={tone(s.p50, good, bad)} />
              <Mini label="Slow" value={fmtMs(s.p90)} className={tone(s.p90, good, bad)} />
              <Mini label="Worst" value={fmtMs(s.max)} />
              <Mini label="Failed" value={fmtPct(s.failedPct)} className={failTone(s.failedPct)} />
            </div>
            {server != null && network != null && totalSplit > 0 ? (
              <div className="mt-3">
                <div className="flex h-2 rounded-full overflow-hidden bg-gray-100" aria-hidden>
                  <span style={{ width: `${(server / totalSplit) * 100}%`, background: SERVER_COLOR }} />
                  <span style={{ width: `${(network / totalSplit) * 100}%`, background: NET_COLOR }} />
                </div>
                <div className="flex justify-between text-[11px] text-gray-600 mt-1">
                  <span>
                    <span className="inline-block h-2 w-2 rounded-sm mr-1" style={{ background: SERVER_COLOR }} />
                    Server {fmtMs(server)}
                  </span>
                  <span>
                    <span className="inline-block h-2 w-2 rounded-sm mr-1" style={{ background: NET_COLOR }} />
                    Internet {fmtMs(network)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-gray-400 mt-3">No server time reported for these (measured on the PC only).</p>
            )}
            {outcomes.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {outcomes.map(([o, n]) => (
                  <span key={o} className="px-1.5 py-0.5 rounded bg-gray-100 text-[11px] text-gray-700">
                    {o.replace(/_/g, ' ')}: {fmtNum(n)}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Mini({ label, value, className = 'text-gray-900' }: { label: string; value: string; className?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`text-sm font-semibold truncate ${className}`}>{value}</div>
    </div>
  );
}

const th = 'px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap';
const td = 'px-3 py-2 text-sm text-gray-800 whitespace-nowrap';

function DevicesTable({ devices, onPick, selected }: { devices: DeviceRow[]; onPick: (d: string) => void; selected: string }) {
  return (
    <Card title="Counter PCs" subtitle="Click a row to see only that PC (click again for all).">
      {devices.length === 0 ? (
        <EmptyState title="No counter PC reported in this period" />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                {['PC', 'Internet address', 'Logged in', 'Last seen', 'Connection check', 'Checks failed', 'Scan typical / slow', 'Not on PC', 'Errors'].map((h) => (
                  <th key={h} className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {devices.map((d) => {
                const p = d.kinds?.ping;
                const s = d.kinds?.scan;
                const errors = d.kinds?.api_error?.count ?? 0;
                return (
                  <tr
                    key={d.device}
                    onClick={() => onPick(selected === d.device ? '' : d.device)}
                    className={`cursor-pointer ${selected === d.device ? 'bg-honey-50' : 'hover:bg-gray-50'}`}
                  >
                    <td className={`${td} font-medium`}>{d.device || '—'}</td>
                    <td className={td}>{d.ip || '—'}</td>
                    <td className={td}>{d.user || '—'}</td>
                    <td className={td} title={fmtWhen(d.lastSeen)}>
                      {fmtAgo(d.lastSeen)}
                    </td>
                    <td className={`${td} ${tone(p?.p50, 400, 1200)}`}>{fmtMs(p?.p50)}</td>
                    <td className={`${td} ${p ? failTone(p.failedPct) : ''}`}>{p ? fmtPct(p.failedPct) : '—'}</td>
                    <td className={td}>
                      <span className={tone(s?.p50, 700, 2100)}>{fmtMs(s?.p50)}</span> / <span className={tone(s?.p90, 700, 2100)}>{fmtMs(s?.p90)}</span>
                    </td>
                    <td className={td}>{fmtNum(d.kinds?.scan_fallback?.count ?? 0)}</td>
                    <td className={`${td} ${errors > 0 ? 'text-red-700' : ''}`}>{fmtNum(errors)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function HourlySection({ hourly, hours }: { hourly: HourRow[]; hours: number }) {
  const rows = useMemo(() => {
    const map = new Map<string, { hour: string; ping?: HourRow; scan?: HourRow }>();
    for (const h of hourly) {
      const r = map.get(h.hour) || { hour: h.hour };
      r[h.kind] = h;
      map.set(h.hour, r);
    }
    return Array.from(map.values()).sort((a, b) => a.hour.localeCompare(b.hour));
  }, [hourly]);

  if (!rows.length) {
    return (
      <Card title="Hour by hour">
        <EmptyState title="No connection checks or scans in this period" />
      </Card>
    );
  }
  const labels = rows.map((r) => hourLabel(r.hour, hours > 6));
  const hasScan = rows.some((r) => r.scan);
  return (
    <Card title="Hour by hour" subtitle="Typical (p50) and slow (p90) times per hour, and how many failed." bodyClass="p-3 sm:p-4 space-y-5">
      <div>
        <h3 className="text-xs font-semibold text-gray-700 mb-1">Connection check</h3>
        <LineChart
          labels={labels}
          series={[
            { name: 'Typical', values: rows.map((r) => r.ping?.p50 ?? null) },
            { name: 'Slow (p90)', values: rows.map((r) => r.ping?.p90 ?? null) },
          ]}
          format={fmtMs}
          height={180}
        />
      </div>
      {hasScan && (
        <div>
          <h3 className="text-xs font-semibold text-gray-700 mb-1">Barcode scan</h3>
          <LineChart
            labels={labels}
            series={[
              { name: 'Typical', values: rows.map((r) => r.scan?.p50 ?? null) },
              { name: 'Slow (p90)', values: rows.map((r) => r.scan?.p90 ?? null) },
            ]}
            format={fmtMs}
            height={180}
          />
        </div>
      )}
      <div className="overflow-x-auto max-h-80 overflow-y-auto border border-gray-100 rounded-lg">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              {['Hour', 'Checks', 'Check typical / slow', 'Checks failed', 'Scans', 'Scan typical / slow', 'Scans failed'].map((h) => (
                <th key={h} className={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {[...rows].reverse().map((r) => (
              <tr key={r.hour}>
                <td className={td}>{hourLabel(r.hour, true)}</td>
                <td className={td}>{fmtNum(r.ping?.count ?? 0)}</td>
                <td className={td}>
                  <span className={tone(r.ping?.p50, 400, 1200)}>{fmtMs(r.ping?.p50)}</span> / {fmtMs(r.ping?.p90)}
                </td>
                <td className={`${td} ${r.ping ? failTone(r.ping.failedPct) : ''}`}>{r.ping ? fmtPct(r.ping.failedPct) : '—'}</td>
                <td className={td}>{fmtNum(r.scan?.count ?? 0)}</td>
                <td className={td}>
                  <span className={tone(r.scan?.p50, 700, 2100)}>{fmtMs(r.scan?.p50)}</span> / {fmtMs(r.scan?.p90)}
                </td>
                <td className={`${td} ${r.scan ? failTone(r.scan.failedPct) : ''}`}>{r.scan ? fmtPct(r.scan.failedPct) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function describe(r: EventRow): string {
  const bits: string[] = [];
  if (r.path) bits.push(r.path);
  if (r.detail) {
    for (const [k, v] of Object.entries(r.detail)) {
      if (v === null || v === undefined || v === '') continue;
      bits.push(`${k}: ${v}`);
      if (bits.length >= 5) break;
    }
  }
  return bits.join(' · ') || '—';
}

const EVENT_HEAD = ['When', 'What', 'Total', 'Server', 'Internet', 'Result', 'PC', 'User', 'Details'];

function EventTable({ rows, empty, emptyIcon }: { rows: EventRow[]; empty: string; emptyIcon?: ReactNode }) {
  if (!rows.length) return <EmptyState title={empty} icon={emptyIcon} />;
  return (
    <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
      <table className="min-w-full divide-y divide-gray-100">
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            {EVENT_HEAD.map((h) => (
              <th key={h} className={th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r, i) => {
            const network = r.ms != null && r.serverMs != null ? Math.max(0, r.ms - r.serverMs) : null;
            const info = describe(r);
            return (
              <tr key={r._id || `${r.at}-${i}`}>
                <td className={td}>{fmtWhen(r.at)}</td>
                <td className={td}>{KIND_INFO[r.kind]?.label || r.kind}</td>
                <td className={`${td} font-semibold`}>{fmtMs(r.ms)}</td>
                <td className={td}>{fmtMs(r.serverMs)}</td>
                <td className={td}>{fmtMs(network)}</td>
                <td className={`${td} ${r.ok ? '' : 'text-red-700 font-medium'}`}>{(r.outcome || (r.ok ? 'ok' : 'failed')).replace(/_/g, ' ')}</td>
                <td className={td}>{r.device || '—'}</td>
                <td className={td}>{r.userName || '—'}</td>
                <td className={`${td} max-w-[260px] truncate`} title={info}>
                  {info}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SlowestTable({ rows }: { rows: EventRow[] }) {
  return (
    <Card title="Slowest 40" subtitle="The longest waits in this period (POS page openings are listed separately below).">
      <EventTable rows={rows} empty="Nothing slow to show" />
    </Card>
  );
}

function FailuresTable({ rows }: { rows: EventRow[] }) {
  return (
    <Card title="Latest failures" subtitle="The last 50 things that did not work (timeouts, no internet, server errors), any time.">
      <EventTable rows={rows} empty="No failures recorded" emptyIcon={<CheckCircle2 className="h-10 w-10 text-emerald-300" />} />
    </Card>
  );
}

const num = (v: unknown): number | null => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

function PageLoadsTable({ rows }: { rows: EventRow[] }) {
  return (
    <Card
      title="POS page openings"
      subtitle="Where the time goes when the POS screen opens: finding the server (DNS), connecting, secure handshake (TLS), first reply from the server, then the page files."
    >
      {rows.length === 0 ? (
        <EmptyState title="The POS page was not opened in this period" />
      ) : (
        <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                {['When', 'PC', 'Total', 'DNS', 'Connect', 'TLS', 'First reply', 'Page ready', 'Files', 'Files over 3 s', 'Slowest file', 'Network'].map((h) => (
                  <th key={h} className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r, i) => {
                const d = r.detail || {};
                const over = num(d.filesOver3s) ?? 0;
                const net = [d.netType, num(d.netRtt) != null ? `${d.netRtt} ms rtt` : null, num(d.netDownMbps) != null ? `${d.netDownMbps} Mbps` : null]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <tr key={r._id || `${r.at}-${i}`}>
                    <td className={td}>{fmtWhen(r.at)}</td>
                    <td className={td}>{r.device || '—'}</td>
                    <td className={`${td} font-semibold ${tone(r.ms, 3000, 9000)}`}>{fmtMs(r.ms)}</td>
                    <td className={td}>{fmtMs(num(d.dns))}</td>
                    <td className={td}>{fmtMs(num(d.connect))}</td>
                    <td className={td}>{fmtMs(num(d.tls))}</td>
                    <td className={`${td} ${tone(num(d.ttfb), 500, 1500)}`}>{fmtMs(num(d.ttfb))}</td>
                    <td className={td}>{fmtMs(num(d.domReady))}</td>
                    <td className={td}>{fmtNum(num(d.files))}</td>
                    <td className={`${td} ${over > 0 ? 'text-red-700 font-medium' : ''}`}>{fmtNum(over)}</td>
                    <td className={`${td} max-w-[220px] truncate`} title={String(d.slowestFile || '')}>
                      {d.slowestFile ? `${d.slowestFile} (${fmtMs(num(d.slowestFileMs))})` : '—'}
                    </td>
                    <td className={td}>{net || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
