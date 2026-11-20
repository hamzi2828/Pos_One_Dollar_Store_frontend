'use client';

// Shared bits of the Advertisements pages: types, formatting, the per-ad analytics body.

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Eye, Users, Clock, CalendarDays } from 'lucide-react';
import { storeApi, apiErrorMessage, formatRs } from '@/lib/storeApi';
import { ErrorBox } from '@/components/admin/FormBits';
import { ColumnChart, compactRs } from '../adminComponents/charts';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface Stats {
  spend: number;
  impressions: number;
  reach: number;
  frequency: number;
  clicks: number;
  ctr: number;
  cpm: number;
  linkClicks: number;
  engagement: number;
  messages: number;
  videoPlays: number;
  plays2s: number;
  plays3s: number;
  thruplays: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
  p100: number;
  avgWatchSec: number;
}

export interface AdRow {
  id: string;
  name: string;
  status: string;
  effectiveStatus: string;
  createdTime: string;
  thumbnail: string;
  campaign: { id: string; name: string; objective: string } | null;
  adset: { id: string; name: string; status: string; dailyBudget: number | null; lifetimeBudget: number | null; endTime: string | null } | null;
  stats: Stats | null;
}

export interface AdsSettings {
  adAccountId: string;
  apiVersion: string;
  hasToken: boolean;
  token: string;
}

export interface BreakdownRow extends Stats {
  label: { platform?: string; position?: string; age?: string; gender?: string; region?: string; device?: string };
}

export interface AdInsights {
  total: Stats | null;
  daily: (Stats & { date: string })[];
  /** 24 rows (hour 0-23, ad account time zone), totals across the range. Empty if Meta gave none. */
  hourly?: (Stats & { hour: number })[];
  breakdown: string;
  rows: BreakdownRow[];
}

export const RANGES = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_7d', label: 'Last 7 days' },
  { value: 'last_14d', label: 'Last 14 days' },
  { value: 'last_30d', label: 'Last 30 days' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'maximum', label: 'All time' },
];

export const BREAKDOWNS = [
  { value: 'platform', label: 'Facebook / Instagram' },
  { value: 'placement', label: 'Placement' },
  { value: 'age_gender', label: 'Age & gender' },
  { value: 'region', label: 'Region' },
  { value: 'device', label: 'Device' },
];

// What the hourly / daily graphs show.
const CHART_METRICS: { value: keyof Stats; label: string; money?: boolean }[] = [
  { value: 'thruplays', label: '15-sec plays' },
  { value: 'plays3s', label: '3-sec plays' },
  { value: 'spend', label: 'Spent', money: true },
  { value: 'impressions', label: 'Impressions' },
  { value: 'linkClicks', label: 'Link clicks' },
];

const hourLabel = (h: number) => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export const n0 = (v: number | null | undefined) => (Number(v) || 0).toLocaleString('en-PK');
export const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—');
export const rs = (v: number | null | undefined) => formatRs(v, { decimals: 2 });
export const per = (spend: number, count: number) => (count > 0 ? rs(spend / count) : '—');
export const cap = (s?: string) => (s ? s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '');

export function rowLabel(r: BreakdownRow, kind: string): string {
  const l = r.label;
  if (kind === 'platform') return cap(l.platform);
  if (kind === 'placement') return `${cap(l.platform)} · ${cap(l.position)}`;
  if (kind === 'age_gender') return `${l.age} · ${cap(l.gender)}`;
  if (kind === 'region') return l.region || 'Unknown';
  if (kind === 'device') return cap(l.device);
  return '';
}

export function StatusBadge({ s }: { s: string }) {
  const map: Record<string, string> = {
    ACTIVE: 'bg-green-50 text-green-700 border-green-200',
    PAUSED: 'bg-gray-50 text-gray-600 border-gray-200',
    CAMPAIGN_PAUSED: 'bg-gray-50 text-gray-600 border-gray-200',
    ADSET_PAUSED: 'bg-gray-50 text-gray-600 border-gray-200',
    IN_PROCESS: 'bg-blue-50 text-blue-700 border-blue-200',
    PENDING_REVIEW: 'bg-amber-50 text-amber-700 border-amber-200',
    DISAPPROVED: 'bg-red-50 text-red-700 border-red-200',
    WITH_ISSUES: 'bg-red-50 text-red-700 border-red-200',
  };
  const label: Record<string, string> = {
    ACTIVE: 'Running',
    PAUSED: 'Off',
    CAMPAIGN_PAUSED: 'Campaign off',
    ADSET_PAUSED: 'Ad set off',
    PENDING_REVIEW: 'In review',
    IN_PROCESS: 'Processing',
    DISAPPROVED: 'Rejected',
    WITH_ISSUES: 'Has issues',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium ${map[s] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
      {label[s] || cap(s.toLowerCase())}
    </span>
  );
}

export function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-lg sm:text-xl font-semibold text-gray-900 tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-gray-500">{sub}</p>}
    </div>
  );
}

export function sumStats(list: (Stats | null)[]): Stats {
  const keys: (keyof Stats)[] = ['spend', 'impressions', 'reach', 'clicks', 'linkClicks', 'engagement', 'messages', 'videoPlays', 'plays2s', 'plays3s', 'thruplays', 'p25', 'p50', 'p75', 'p95', 'p100'];
  const out = { frequency: 0, ctr: 0, cpm: 0, avgWatchSec: 0 } as Stats;
  for (const k of keys) out[k] = 0;
  for (const s of list) if (s) for (const k of keys) out[k] += s[k] || 0;
  return out;
}

/* ------------------------------------------------------------------ */
/* One ad: analytics                                                   */
/* ------------------------------------------------------------------ */

export function AdAnalytics({ adId, range }: { adId: string; range: string }) {
  const [breakdown, setBreakdown] = useState('platform');
  const [metric, setMetric] = useState<keyof Stats>('thruplays');
  const [data, setData] = useState<AdInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr(null);
    storeApi
      .get<AdInsights>(`/ads/${adId}/insights`, { preset: range, breakdown })
      .then((res) => alive && setData(res.data))
      .catch((e) => alive && setErr(apiErrorMessage(e, 'Could not load analytics.')))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [adId, range, breakdown]);

  const t = data?.total;
  const rows = useMemo(() => [...(data?.rows || [])].sort((a, b) => b.thruplays - a.thruplays || b.spend - a.spend), [data]);
  const m = CHART_METRICS.find((x) => x.value === metric) || CHART_METRICS[0];
  const fmt = m.money ? compactRs : (v: number) => n0(v);
  const hourCols = useMemo(
    () =>
      (data?.hourly || []).map((h) => ({
        key: String(h.hour),
        label: hourLabel(h.hour),
        value: Number(h[metric]) || 0,
        extra: [
          { label: '15-sec plays', value: n0(h.thruplays) },
          { label: 'spent', value: rs(h.spend) },
        ],
      })),
    [data, metric]
  );
  const dayCols = useMemo(
    () =>
      (data?.daily || []).map((d) => ({
        key: d.date,
        label: new Date(d.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        value: Number(d[metric]) || 0,
        extra: [
          { label: '15-sec plays', value: n0(d.thruplays) },
          { label: 'spent', value: rs(d.spend) },
        ],
      })),
    [data, metric]
  );
  const peakHour = hourCols.reduce((best, c) => (c.value > (best?.value ?? 0) ? c : best), null as (typeof hourCols)[number] | null);

  return (
    <>
      {loading && !data ? (
        <div className="py-14 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-honey-700" /></div>
      ) : err ? (
        <ErrorBox message={err} />
      ) : !t ? (
        <p className="py-10 text-center text-sm text-gray-500">No results in this period.</p>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            <Tile label="Spent" value={rs(t.spend)} />
            <Tile label="Reach" value={n0(t.reach)} sub={`${t.frequency.toFixed(2)}× each`} />
            <Tile label="Impressions" value={n0(t.impressions)} />
            <Tile label="Video plays" value={n0(t.videoPlays)} />
            <Tile label="3-sec plays" value={n0(t.plays3s)} sub={per(t.spend, t.plays3s)} />
            <Tile label="15-sec plays" value={n0(t.thruplays)} sub={per(t.spend, t.thruplays)} />
            <Tile label="Watched to end" value={n0(t.p100)} sub={`${pct(t.p100, t.thruplays)} of 15-sec`} />
            <Tile label="Avg watch" value={`${t.avgWatchSec || 0}s`} sub={`${n0(t.linkClicks)} link clicks`} />
          </div>

          {/* Watch funnel */}
          <div>
            <h3 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> How far people watched</h3>
            <div className="space-y-1.5">
              {([
                ['3 seconds', t.plays3s],
                ['15 seconds', t.thruplays],
                ['25%', t.p25],
                ['50%', t.p50],
                ['75%', t.p75],
                ['95%', t.p95],
                ['100%', t.p100],
              ] as [string, number][]).map(([label, v]) => (
                <div key={label} className="flex items-center gap-2 text-xs">
                  <span className="w-20 text-gray-600">{label}</span>
                  <div className="flex-1 h-4 bg-gray-100 rounded">
                    <div className="h-4 bg-honey-500 rounded" style={{ width: `${t.plays3s ? Math.min(100, (v / t.plays3s) * 100) : 0}%` }} />
                  </div>
                  <span className="w-24 text-right tabular-nums">{n0(v)} <span className="text-gray-400">({pct(v, t.plays3s)})</span></span>
                </div>
              ))}
            </div>
          </div>

          {/* Breakdown */}
          <div>
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              <Users className="h-3.5 w-3.5 text-gray-600" />
              {BREAKDOWNS.map((b) => (
                <button
                  key={b.value}
                  onClick={() => setBreakdown(b.value)}
                  className={`px-2.5 py-1 rounded-full text-xs border ${breakdown === b.value ? 'bg-honey-500 border-honey-500 text-gray-900 font-medium' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  {b.label}
                </button>
              ))}
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />}
            </div>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left">{BREAKDOWNS.find((b) => b.value === breakdown)?.label}</th>
                    <th className="px-3 py-2 text-right">Spent</th>
                    <th className="px-3 py-2 text-right">Reach</th>
                    <th className="px-3 py-2 text-right">3-sec</th>
                    <th className="px-3 py-2 text-right">15-sec</th>
                    <th className="px-3 py-2 text-right">Share</th>
                    <th className="px-3 py-2 text-right">50%</th>
                    <th className="px-3 py-2 text-right">To end</th>
                    <th className="px-3 py-2 text-right">Per 15-sec</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5 font-medium text-gray-800">{rowLabel(r, data?.breakdown || breakdown)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{rs(r.spend)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{n0(r.reach)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{n0(r.plays3s)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{n0(r.thruplays)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{pct(r.thruplays, t.thruplays)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{n0(r.p50)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{n0(r.p100)} <span className="text-gray-400">({pct(r.p100, r.thruplays)})</span></td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{per(r.spend, r.thruplays)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Graphs: metric picker shared by hourly + daily */}
          {(hourCols.length > 0 || dayCols.length > 1) && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-gray-600 mr-1">Graph:</span>
              {CHART_METRICS.map((x) => (
                <button
                  key={x.value}
                  onClick={() => setMetric(x.value)}
                  className={`px-2.5 py-1 rounded-full text-xs border ${metric === x.value ? 'bg-honey-500 border-honey-500 text-gray-900 font-medium' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  {x.label}
                </button>
              ))}
            </div>
          )}

          {/* Hour of day */}
          {hourCols.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-700 mb-2 flex flex-wrap items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> By hour of day ({m.label})
                {peakHour && peakHour.value > 0 && (
                  <span className="font-normal text-gray-500">· best hour {peakHour.label} ({fmt(peakHour.value)})</span>
                )}
              </h3>
              <ColumnChart
                data={hourCols}
                format={fmt}
                emphasis="peak"
                maxLabels={8}
                showAverage
                averageLabel="Avg"
                ariaLabel={`${m.label} by hour of day`}
                emptyText="No results by hour in this period"
              />
              <p className="mt-1 text-[11px] text-gray-400">Totals for each hour across the selected days, in the ad account&apos;s time zone.</p>
            </div>
          )}

          {/* Day by day */}
          {dayCols.length > 1 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> Day by day ({m.label})</h3>
              <ColumnChart
                data={dayCols}
                format={fmt}
                maxLabels={10}
                showAverage
                averageLabel="Avg"
                ariaLabel={`${m.label} day by day`}
                emptyText="No results in this period"
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}
