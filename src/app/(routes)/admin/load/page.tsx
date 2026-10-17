'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Loader2,
  AlertCircle,
  Signal,
  ChevronLeft,
  ChevronRight,
  ArrowDownToLine,
  CheckCircle2,
  CircleDashed,
} from 'lucide-react';
import { networkService } from './service/networkService';
import type { Network } from './types';
import { shopToday, formatDayLabel, formatPkr, shiftDay } from './utils';

const PRESET_COLORS = ['#E4002B', '#00A99D', '#00A9E0', '#F58220', '#7C3AED', '#059669'];

const LoadPage = () => {
  const [networks, setNetworks] = useState<Network[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState<string>(shopToday());
  const abortRef = useRef<AbortController | null>(null);

  // Add-network modal
  const [isAddOpen, setIsAddOpen] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [newCode, setNewCode] = useState<string>('');
  const [newColor, setNewColor] = useState<string>(PRESET_COLORS[0]);
  const [saving, setSaving] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchNetworks = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      setLoading(true);
      setError(null);
      const { items } = await networkService.getNetworks({ date, limit: 100 }, controller.signal);
      setNetworks(items);
    } catch (e: unknown) {
      if ((e as { name?: string })?.name === 'CanceledError' || (e as { code?: string })?.code === 'ERR_CANCELED') return;
      console.error(e);
      setError('Failed to load networks. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchNetworks();
    return () => abortRef.current?.abort();
  }, [fetchNetworks]);

  const handleCreate = async () => {
    if (!newName.trim()) {
      setFormError('Network name is required');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await networkService.createNetwork({
        name: newName.trim(),
        code: newCode.trim() || undefined,
        color: newColor,
      });
      setIsAddOpen(false);
      setNewName('');
      setNewCode('');
      setNewColor(PRESET_COLORS[0]);
      fetchNetworks();
    } catch (e: unknown) {
      const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setFormError(message || 'Failed to create network');
    } finally {
      setSaving(false);
    }
  };

  // Totals across every network for the selected day
  const totals = networks.reduce(
    (acc, n) => {
      acc.balance += n.today.isClosed ? (n.today.closingBalance ?? 0) : n.today.expectedBalance;
      acc.load += n.today.loadTotal;
      acc.sold += n.today.sold ?? 0;
      if (n.today.loadTotal > 0) acc.withLoad += 1;
      return acc;
    },
    { balance: 0, load: 0, sold: 0, withLoad: 0 }
  );

  const isToday = date === shopToday();

  if (loading && networks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#dc2626]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Load</h1>
          <p className="mt-1 text-sm text-gray-500">
            Daily easyload balance for every network
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDate((d) => shiftDay(d, -1))}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <input
            type="date"
            value={date}
            max={shopToday()}
            onChange={(e) => setDate(e.target.value || shopToday())}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#dc2626] focus:border-transparent"
          />
          <button
            onClick={() => setDate((d) => shiftDay(d, 1))}
            disabled={isToday}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => setIsAddOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#dc2626] text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <Plus className="h-5 w-5" />
            Add Network
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      {/* Totals for the selected day */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Balance in hand</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{formatPkr(totals.balance)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Load received</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{formatPkr(totals.load)}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            {totals.withLoad === 0
              ? 'No load taken this day'
              : `${totals.withLoad} of ${networks.length} networks`}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Sold</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{formatPkr(totals.sold)}</p>
          <p className="mt-0.5 text-xs text-gray-500">From closed days only</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Day</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{formatDayLabel(date)}</p>
          <p className="mt-0.5 text-xs text-gray-500">{isToday ? 'Today' : 'Past day'}</p>
        </div>
      </div>

      {/* Network cards */}
      {networks.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Signal className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No networks yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {networks.map((network) => {
            const day = network.today;
            const balance = day.isClosed ? (day.closingBalance ?? 0) : day.expectedBalance;
            return (
              <Link
                key={network._id}
                href={`/admin/load/${network._id}?date=${date}`}
                className="bg-white rounded-lg shadow hover:shadow-md transition-shadow overflow-hidden block"
              >
                <div className="h-1.5" style={{ backgroundColor: network.color }} />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="h-10 w-10 flex-shrink-0 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: `${network.color}1A` }}
                      >
                        <Signal className="h-5 w-5" style={{ color: network.color }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{network.name}</p>
                        <p className="text-xs text-gray-500">{network.code}</p>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full flex-shrink-0 ${
                        day.isClosed ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {day.isClosed ? <CheckCircle2 className="h-3 w-3" /> : <CircleDashed className="h-3 w-3" />}
                      {day.isClosed ? 'Closed' : 'Open'}
                    </span>
                  </div>

                  <div className="mt-4">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {day.isClosed ? 'Closing balance' : 'Balance now'}
                    </p>
                    <p className="text-2xl font-bold text-gray-900">{formatPkr(balance)}</p>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 pt-4 border-t border-gray-100">
                    <div>
                      <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Opening</p>
                      <p className="text-sm font-semibold text-gray-900">{formatPkr(day.openingBalance)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Load</p>
                      <p
                        className={`text-sm font-semibold ${
                          day.loadTotal > 0 ? 'text-emerald-600' : 'text-gray-400'
                        }`}
                      >
                        {day.loadTotal > 0 ? formatPkr(day.loadTotal) : 'None'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Sold</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {day.sold === null ? '—' : formatPkr(day.sold)}
                      </p>
                    </div>
                  </div>

                  {day.loadTotal > 0 && (
                    <p className="mt-3 inline-flex items-center gap-1 text-xs text-emerald-700">
                      <ArrowDownToLine className="h-3 w-3" />
                      {day.loads.length} load {day.loads.length === 1 ? 'entry' : 'entries'} this day
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Add network modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setIsAddOpen(false)} />
          <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Network</h3>

            {formError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {formError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Warid"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#dc2626] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Code <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="Defaults to the name in capitals"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#dc2626] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Colour</label>
                <div className="flex items-center gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewColor(c)}
                      className={`h-8 w-8 rounded-full border-2 transition-transform ${
                        newColor === c ? 'border-gray-900 scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                      aria-label={`Colour ${c}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setIsAddOpen(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="px-4 py-2 bg-[#dc2626] text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoadPage;
