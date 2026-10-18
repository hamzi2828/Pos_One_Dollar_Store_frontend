// Cost Analysis report — revenue vs COGS vs expenses → profit estimate.
'use client';

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { LineChart, RefreshCw, Loader2, Calendar, TrendingUp, TrendingDown } from 'lucide-react';
import ReportsNav from '../components/ReportsNav';
import {
  fetchCostAnalysis,
  rangeFromFilter,
  type CostAnalysisReport,
  type DateFilter,
} from '../services/reportsService';
import { getCurrencySymbol } from '../../pos/utils/currency';

const CURRENCY = 'PKR';

export default function CostAnalysisPage() {
  const symbol = getCurrencySymbol(CURRENCY);
  const [filter, setFilter] = useState<DateFilter>('month');
  const [cs, setCs] = useState('');
  const [ce, setCe] = useState('');
  const [data, setData] = useState<CostAnalysisReport | null>(null);
  const [loading, setLoading] = useState(false);

  const range = useMemo(() => rangeFromFilter(filter, cs, ce), [filter, cs, ce]);
  // Counts in-flight fetches so Refresh can't be re-fired while one is running.
  const inFlightRef = useRef(0);
  const load = useCallback(async () => {
    if (!range) return;
    try {
      inFlightRef.current += 1;
      setLoading(true);
      setData(await fetchCostAnalysis(range.start, range.end));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load cost analysis');
    } finally {
      inFlightRef.current -= 1;
      if (inFlightRef.current === 0) setLoading(false);
    }
  }, [range]);
  useEffect(() => { load(); }, [load]);
  const handleRefresh = () => {
    if (inFlightRef.current > 0) return;
    load();
  };

  const fmt = (n: number) => `${symbol}${(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  const profitable = (data?.netProfit ?? 0) >= 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <LineChart className="h-6 w-6 text-[#DC2626]" />
            Cost Analysis
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-gray-500">
            Revenue vs COGS vs operating expenses. Product cost uses <code>product.costPrice</code> where available; outsource items use their saved cost.
          </p>
        </div>
        <button
            onClick={handleRefresh}
            disabled={loading}
            aria-busy={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Loading…</>
            ) : (
              <><RefreshCw className="h-4 w-4" /> Refresh</>
            )}
          </button>
      </div>

      <ReportsNav />

      <div className="bg-white rounded-lg border border-gray-200 p-3 flex flex-wrap items-center gap-3">
        <Calendar className="h-4 w-4 text-gray-500" />
        <select value={filter} onChange={(e) => setFilter(e.target.value as DateFilter)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg">
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="custom">Custom</option>
        </select>
        {filter === 'custom' && (
          <>
            <input type="date" value={cs} onChange={(e) => setCs(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg" />
            <span className="text-gray-400">to</span>
            <input type="date" value={ce} onChange={(e) => setCe(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg" />
          </>
        )}
        <span className="ml-auto text-sm text-gray-500">{range?.label ?? 'Pick a range'}</span>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center h-64 bg-white rounded-lg border border-gray-200">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Revenue" value={fmt(data.revenue)} />
            <Stat label="COGS" value={fmt(data.cogs)} />
            <Stat label="Expenses" value={fmt(data.totalExpenses)} />
            <Stat label="Items Sold" value={data.itemCount.toString()} />
            <Stat label="Outsource Cost" value={fmt(data.outsourceCost)} />
            <Stat label="Product Cost (est.)" value={fmt(data.estimatedProductCost)} />
            <Stat label="Gross Margin" value={`${data.grossMargin.toFixed(1)}%`} />
            <Stat label="Net Margin" value={`${data.netMargin.toFixed(1)}%`} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-emerald-800">Gross Profit (Revenue − COGS)</span>
                <TrendingUp className="h-5 w-5 text-emerald-700" />
              </div>
              <div className="text-2xl font-bold text-emerald-700 mt-2">{fmt(data.grossProfit)}</div>
            </div>
            <div className={`p-5 rounded-lg border ${profitable ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium ${profitable ? 'text-blue-800' : 'text-red-800'}`}>
                  Net Profit (Gross − Expenses)
                </span>
                {profitable ? <TrendingUp className="h-5 w-5 text-blue-700" /> : <TrendingDown className="h-5 w-5 text-red-700" />}
              </div>
              <div className={`text-2xl font-bold mt-2 ${profitable ? 'text-blue-700' : 'text-red-700'}`}>
                {fmt(data.netProfit)}
              </div>
            </div>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            Labour-only items are excluded from COGS. Product cost is only included when the product record has a <code>costPrice</code> value — fill those in under Products for tighter accuracy.
          </div>
        </>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-base font-semibold text-gray-900 mt-0.5 truncate">{value}</div>
    </div>
  );
}
