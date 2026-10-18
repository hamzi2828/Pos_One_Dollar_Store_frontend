'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Signal,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  CircleDashed,
} from 'lucide-react';
import { networkService } from '../service/networkService';
import type { Network, NetworkDay } from '../types';
import { shopToday, formatDayLabel, formatPkr, formatTime, shiftDay } from '../utils';

const HISTORY_LIMIT = 14;

const NetworkDetail = () => {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const networkId = String(params?.id ?? '');

  const [date, setDate] = useState<string>(searchParams.get('date') || shopToday());
  const [network, setNetwork] = useState<Network | null>(null);
  const [day, setDay] = useState<NetworkDay | null>(null);
  const [history, setHistory] = useState<NetworkDay[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Balance form — kept as strings so the inputs can be cleared while typing
  const [openingInput, setOpeningInput] = useState<string>('');
  const [closingInput, setClosingInput] = useState<string>('');
  const [savingDay, setSavingDay] = useState<boolean>(false);
  const [savedAt, setSavedAt] = useState<number>(0);

  // Add-load form
  const [loadAmount, setLoadAmount] = useState<string>('');
  const [loadProvider, setLoadProvider] = useState<string>('');
  const [loadReference, setLoadReference] = useState<string>('');
  const [addingLoad, setAddingLoad] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletingLoadId, setDeletingLoadId] = useState<string | null>(null);
  // One synchronous lock for every write to this day (save / add load / delete load):
  // they all replace the same day record, so only one may run at a time and a fast
  // double-click can't fire a second request before React re-renders.
  const mutatingRef = useRef(false);
  const mutating = savingDay || addingLoad || deletingLoadId !== null;

  const applyDay = useCallback((next: NetworkDay) => {
    setDay(next);
    setOpeningInput(String(next.openingBalance ?? 0));
    setClosingInput(next.closingBalance === null ? '' : String(next.closingBalance));
  }, []);

  const fetchAll = useCallback(async () => {
    if (!networkId) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      setLoading(true);
      setError(null);
      const [net, dayData, days] = await Promise.all([
        networkService.getNetwork(networkId, date, controller.signal),
        networkService.getDay(networkId, date, controller.signal),
        networkService.getDays(networkId, { limit: HISTORY_LIMIT }, controller.signal),
      ]);
      setNetwork(net);
      applyDay(dayData);
      setHistory(days.items);
    } catch (e: unknown) {
      if ((e as { name?: string })?.name === 'CanceledError' || (e as { code?: string })?.code === 'ERR_CANCELED') return;
      console.error(e);
      setError('Failed to load this network. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [networkId, date, applyDay]);

  useEffect(() => {
    fetchAll();
    return () => abortRef.current?.abort();
  }, [fetchAll]);

  // Keep the date in the URL so the back link and refreshes stay on the same day
  const changeDate = (next: string) => {
    if (mutatingRef.current) return;
    const value = next || shopToday();
    setDate(value);
    router.replace(`/admin/load/${networkId}?date=${value}`);
  };

  const refreshHistory = async () => {
    try {
      const days = await networkService.getDays(networkId, { limit: HISTORY_LIMIT });
      setHistory(days.items);
    } catch (e) {
      console.error('Error refreshing history:', e);
    }
  };

  const handleSaveDay = async () => {
    if (mutatingRef.current) return;
    mutatingRef.current = true;
    setSavingDay(true);
    setError(null);
    try {
      const opening = Number(openingInput);
      if (!Number.isFinite(opening) || opening < 0) {
        setError('Opening balance must be a number of 0 or more');
        return;
      }
      const closingTrimmed = closingInput.trim();
      let closing: number | null = null;
      if (closingTrimmed !== '') {
        closing = Number(closingTrimmed);
        if (!Number.isFinite(closing) || closing < 0) {
          setError('Closing balance must be a number of 0 or more');
          return;
        }
      }

      const updated = await networkService.saveDay(networkId, date, {
        openingBalance: opening,
        closingBalance: closing,
      });
      applyDay(updated);
      setSavedAt(Date.now());
      refreshHistory();
    } catch (e: unknown) {
      const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(message || 'Failed to save the day');
    } finally {
      mutatingRef.current = false;
      setSavingDay(false);
    }
  };

  const handleAddLoad = async () => {
    if (mutatingRef.current) return;
    const amount = Number(loadAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setLoadError('Enter a load amount greater than 0');
      return;
    }
    mutatingRef.current = true;
    setAddingLoad(true);
    setLoadError(null);
    try {
      const updated = await networkService.addLoad(networkId, date, {
        amount,
        provider: loadProvider.trim() || undefined,
        reference: loadReference.trim() || undefined,
      });
      applyDay(updated);
      setLoadAmount('');
      setLoadReference('');
      refreshHistory();
    } catch (e: unknown) {
      const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setLoadError(message || 'Failed to add the load');
    } finally {
      mutatingRef.current = false;
      setAddingLoad(false);
    }
  };

  const handleDeleteLoad = async (loadId: string) => {
    if (mutatingRef.current) return;
    mutatingRef.current = true;
    setDeletingLoadId(loadId);
    try {
      const updated = await networkService.deleteLoad(networkId, date, loadId);
      applyDay(updated);
      refreshHistory();
    } catch (e) {
      console.error('Error deleting load:', e);
      setError('Failed to remove the load entry');
    } finally {
      mutatingRef.current = false;
      setDeletingLoadId(null);
    }
  };

  const isToday = date === shopToday();

  if (loading && !network) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#dc2626]" />
      </div>
    );
  }

  if (!network || !day) {
    return (
      <div className="space-y-4">
        <Link href="/admin/load" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-[#dc2626]">
          <ArrowLeft className="h-4 w-4" />
          Back to Load
        </Link>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          {error || 'Network not found'}
        </div>
      </div>
    );
  }

  // Live preview of what will be saved, so the numbers move as you type
  const previewOpening = Number(openingInput) || 0;
  const previewClosing = closingInput.trim() === '' ? null : Number(closingInput);
  const previewSold =
    previewClosing === null || !Number.isFinite(previewClosing)
      ? null
      : previewOpening + day.loadTotal - previewClosing;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Link
          href={`/admin/load?date=${date}`}
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-[#dc2626] w-fit"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Load
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="h-12 w-12 flex-shrink-0 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${network.color}1A` }}
            >
              <Signal className="h-6 w-6" style={{ color: network.color }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{network.name}</h1>
              <p className="text-sm text-gray-500">
                {network.code} · {formatDayLabel(date)}
                {isToday && ' · Today'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => changeDate(shiftDay(date, -1))}
              disabled={loading || mutating}
              aria-busy={loading}
              className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
              aria-label="Previous day"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
            <input
              type="date"
              value={date}
              max={shopToday()}
              onChange={(e) => changeDate(e.target.value)}
              disabled={mutating}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#dc2626] focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed"
            />
            <button
              onClick={() => changeDate(shiftDay(date, 1))}
              disabled={isToday || loading || mutating}
              aria-busy={loading}
              className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Next day"
            >
              {loading && !isToday ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      {/* The day's balance sheet */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-900">Balance for {formatDayLabel(date)}</h2>
          <span
            className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
              day.isClosed ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
            }`}
          >
            {day.isClosed ? <CheckCircle2 className="h-3 w-3" /> : <CircleDashed className="h-3 w-3" />}
            {day.isClosed ? 'Closed' : 'Open'}
          </span>
        </div>

        <fieldset disabled={mutating} className="min-w-0 p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Opening balance</label>
            <input
              type="number"
              min="0"
              value={openingInput}
              onChange={(e) => setOpeningInput(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#dc2626] focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500">Carried from the last closed day</p>
          </div>

          <div>
            <p className="block text-sm font-medium text-gray-700 mb-1">Load received</p>
            <div className="px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-gray-900 font-semibold">
              {formatPkr(day.loadTotal)}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {day.loads.length === 0
                ? 'No load taken this day'
                : `From ${day.loads.length} ${day.loads.length === 1 ? 'entry' : 'entries'} below`}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Closing balance</label>
            <input
              type="number"
              min="0"
              value={closingInput}
              onChange={(e) => setClosingInput(e.target.value)}
              placeholder="Leave empty while open"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#dc2626] focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500">Balance shown by the network</p>
          </div>

          <div>
            <p className="block text-sm font-medium text-gray-700 mb-1">Sold</p>
            <div className="px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg font-semibold text-gray-900">
              {previewSold === null ? '—' : formatPkr(previewSold)}
            </div>
            <p className="mt-1 text-xs text-gray-500">Opening + load − closing</p>
          </div>
        </fieldset>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-3">
          <p className="text-sm text-gray-500">
            {previewSold !== null && previewSold < 0
              ? 'Closing is higher than opening plus load — check the figures.'
              : savedAt
                ? 'Saved'
                : 'Enter the balances, then save.'}
          </p>
          <button
            onClick={handleSaveDay}
            disabled={mutating}
            aria-busy={savingDay}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#dc2626] text-white rounded-lg hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {savingDay ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Saving…</>
            ) : (
              <><Save className="h-4 w-4" />Save day</>
            )}
          </button>
        </div>
      </div>

      {/* Loads taken from the provider */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Load received</h2>
          <p className="mt-0.5 text-sm text-gray-500">Top-ups bought from the load provider on this day</p>
        </div>

        {/* Add form */}
        <div className="p-6 border-b border-gray-100">
          {loadError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {loadError}
            </div>
          )}
          <fieldset disabled={mutating} className="min-w-0 grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Amount</label>
              <input
                type="number"
                min="0"
                value={loadAmount}
                onChange={(e) => setLoadAmount(e.target.value)}
                placeholder="50000"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#dc2626] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Provider <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={loadProvider}
                onChange={(e) => setLoadProvider(e.target.value)}
                placeholder="Distributor name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#dc2626] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Reference <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={loadReference}
                onChange={(e) => setLoadReference(e.target.value)}
                placeholder="Slip / TID"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#dc2626] focus:border-transparent"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleAddLoad}
                disabled={mutating}
                aria-busy={addingLoad}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#dc2626] text-white rounded-lg hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {addingLoad ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Adding…</>
                ) : (
                  <><Plus className="h-4 w-4" />Add load</>
                )}
              </button>
            </div>
          </fieldset>
        </div>

        {/* Entries */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {day.loads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                    No load taken on this day
                  </td>
                </tr>
              ) : (
                day.loads.map((entry) => (
                  <tr key={entry._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatTime(entry.at)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{entry.provider || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{entry.reference || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-emerald-600 text-right">
                      {formatPkr(entry.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => handleDeleteLoad(entry._id)}
                        disabled={mutating}
                        aria-busy={deletingLoadId === entry._id}
                        className="text-gray-600 hover:text-red-600 disabled:opacity-60 disabled:cursor-not-allowed"
                        aria-label={deletingLoadId === entry._id ? 'Removing load entry…' : 'Remove load entry'}
                      >
                        {deletingLoadId === entry._id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {day.loads.length > 0 && (
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={3} className="px-6 py-3 text-sm font-medium text-gray-700">
                    Total
                  </td>
                  <td className="px-6 py-3 text-sm font-bold text-emerald-600 text-right">
                    {formatPkr(day.loadTotal)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Recent days */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Recent days</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Opening</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Load</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Closing</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Sold</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                    Nothing recorded yet
                  </td>
                </tr>
              ) : (
                history.map((row) => (
                  <tr
                    key={row.date}
                    className={`hover:bg-gray-50 ${mutating ? 'cursor-not-allowed' : 'cursor-pointer'} ${row.date === date ? 'bg-red-50/40' : ''}`}
                    onClick={() => changeDate(row.date)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatDayLabel(row.date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">
                      {formatPkr(row.openingBalance)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      <span className={row.loadTotal > 0 ? 'text-emerald-600 font-medium' : 'text-gray-400'}>
                        {row.loadTotal > 0 ? formatPkr(row.loadTotal) : 'None'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">
                      {row.closingBalance === null ? '—' : formatPkr(row.closingBalance)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
                      {row.sold === null ? '—' : formatPkr(row.sold)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// useSearchParams needs a Suspense boundary above it during prerender.
const NetworkDetailPage = () => (
  <Suspense
    fallback={
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#dc2626]" />
      </div>
    }
  >
    <NetworkDetail />
  </Suspense>
);

export default NetworkDetailPage;
