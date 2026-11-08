'use client';

// Cash closing, all counters together (owner, 2026-11-09): every day with
// Counter 1 + Counter 2 (+ any other) added up. Opened from the Cash Closing
// report's "Combined" button in a new tab; reads ?from=&to=&status=.

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Layers, RefreshCw } from 'lucide-react';
import { storeApi, apiErrorMessage } from '@/lib/storeApi';
import { useAccess } from '@/context/AccessContext';
import { LoadingCard, NoAccessCard, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { ByDayTable, dayString, type ReportRow } from '../closingBits';

function CombinedPage() {
  const { can, loaded } = useAccess();
  const canView = can('report_cash_closing', 'view');
  const router = useRouter();
  const sp = useSearchParams();
  const today = new Date();
  const [from, setFrom] = useState(() => sp.get('from') || dayString(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [to, setTo] = useState(() => sp.get('to') || dayString(today));
  const [status, setStatus] = useState(() => sp.get('status') || '');
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reqRef = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqRef.current;
    try {
      setLoading(true);
      setError(null);
      // Every till in the period (500 a page).
      const all: ReportRow[] = [];
      for (let page = 1; page <= 20; page += 1) {
        const res = await storeApi.get<ReportRow[]>('/till-sessions/report', { from, to, status, page, limit: 500 });
        all.push(...(res.data || []));
        const pages = (res.meta as { pages?: number } | undefined)?.pages || 1;
        if (page >= pages) break;
      }
      if (id === reqRef.current) setRows(all);
    } catch (e) {
      if (id === reqRef.current) setError(apiErrorMessage(e, 'Could not load the report.'));
    } finally {
      if (id === reqRef.current) setLoading(false);
    }
  }, [from, to, status]);

  useEffect(() => {
    if (canView) load();
  }, [canView, load]);

  // Keep the link shareable.
  useEffect(() => {
    const q = new URLSearchParams(Object.fromEntries(Object.entries({ from, to, status }).filter(([, v]) => v)));
    router.replace(`/admin/reports/cash-closing/combined?${q.toString()}`, { scroll: false });
  }, [from, to, status, router]);

  if (!loaded) return <div className="max-w-7xl mx-auto px-4 py-6"><LoadingCard text="Loading…" /></div>;
  if (!canView) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <NoAccessCard />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 flex items-center gap-2">
              <Layers className="h-6 w-6 text-honey-700" /> Cash Closing — all counters together
            </h1>
            <p className="mt-0.5 text-xs sm:text-sm text-gray-500">
              Each day with every counter added up. A till closed after midnight (up to 6 am) counts for the day before.
            </p>
          </div>
          <button type="button" onClick={load} disabled={loading} className={secondaryBtn} aria-label="Refresh">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} aria-label="From" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} aria-label="To" />
          <SearchSelect value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass} aria-label="Status">
            <option value="">All closed</option>
            <option value="closed">To verify</option>
            <option value="verified">Verified</option>
            <option value="disputed">Disputed</option>
          </SearchSelect>
        </div>

        {loading && rows.length === 0 ? (
          <LoadingCard text="Loading report…" />
        ) : error ? (
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-red-200 text-center py-10 px-4">
            <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
            <p className="text-sm text-red-700 mb-4">{error}</p>
            <button type="button" onClick={load} className={primaryBtn}>
              Try again
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 text-center py-12 text-sm text-gray-500">No closed tills in this period.</div>
        ) : (
          <div className={loading ? 'opacity-60' : ''}>
            <ByDayTable rows={rows} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-6"><LoadingCard text="Loading…" /></div>}>
      <CombinedPage />
    </Suspense>
  );
}
