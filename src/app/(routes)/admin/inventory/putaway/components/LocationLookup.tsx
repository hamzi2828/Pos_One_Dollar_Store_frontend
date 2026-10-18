'use client';

// "Where is it?": find any product (name / barcode) and see its shelves + warehouse
// pieces; move between shelves, back to the warehouse, set the home shelf.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowRightLeft, Loader2, MapPin, Package, PackagePlus, Search, Star, Warehouse, X } from 'lucide-react';
import { inputClass, primaryBtn } from '@/components/admin/FormBits';
import { invalidateShelfOptions } from '@/components/store/ShelfPicker';
import { apiErrorMessage, formatDate } from '@/lib/storeApi';
import { racksApi, daysText, unitKey, type UnitLocation } from '../../racks/services/racksApi';
import MoveStockModal, { type MoveTarget } from '../../racks/components/MoveStockModal';

export default function LocationLookup({
  canMove,
  refreshKey,
  onPut,
  onChanged,
}: {
  canMove: boolean;
  /** changes after any put-away / move on the page -> search again */
  refreshKey: number;
  onPut: (unit: UnitLocation) => void;
  onChanged: () => void;
}) {
  const [term, setTerm] = useState('');
  const [units, setUnits] = useState<UnitLocation[] | null>(null);
  const [searched, setSearched] = useState('');
  const [loading, setLoading] = useState(false);
  const [move, setMove] = useState<{ target: MoveTarget; toWarehouse: boolean } | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const lock = useRef(false);

  const find = useCallback(async (text: string) => {
    const q = text.trim();
    if (!q) return;
    try {
      setLoading(true);
      setUnits(await racksApi.searchProducts(q));
      setSearched(q);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Search failed.'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Stock changed somewhere on the page: show fresh numbers.
  const searchedRef = useRef('');
  searchedRef.current = searched;
  useEffect(() => {
    if (refreshKey && searchedRef.current) find(searchedRef.current);
  }, [refreshKey, find]);

  // The parent bumps refreshKey, which searches again.
  const refresh = async () => {
    invalidateShelfOptions();
    onChanged();
  };

  const setHome = async (u: UnitLocation, shelfId: string, isHome: boolean) => {
    if (lock.current) return;
    lock.current = true;
    const key = `${unitKey(u)}|${shelfId}`;
    setBusyKey(key);
    try {
      toast.success(await racksApi.homeShelf({ productId: u.productId, variantId: u.variantId, shelfId, isHome }));
      await refresh();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not change the home shelf.'));
    } finally {
      lock.current = false;
      setBusyKey(null);
    }
  };

  return (
    <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          find(term);
        }}
        className="p-3 sm:p-4 border-b border-gray-100 flex gap-2"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Product name or scan its barcode…"
            className={`${inputClass} pl-9 pr-8`}
            autoComplete="off"
          />
          {term && (
            <button
              type="button"
              onClick={() => {
                setTerm('');
                setUnits(null);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="Clear"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <button type="submit" disabled={loading || !term.trim()} aria-busy={loading} className={primaryBtn}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
          <span className="hidden sm:inline">Where is it?</span>
        </button>
      </form>

      {units === null ? (
        <p className="px-4 py-10 text-center text-sm text-gray-500">Search a product to see on which shelves it is and how many pieces are in the warehouse.</p>
      ) : units.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-gray-500">No product matches “{searched}”.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {units.map((u) => (
            <li key={unitKey(u)} className="p-3 sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {u.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={u.thumbnailUrl} alt="" className="h-10 w-10 rounded object-cover bg-gray-100 flex-shrink-0" />
                  ) : (
                    <div className="h-10 w-10 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Package className="h-5 w-5 text-gray-300" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 leading-tight">
                      {u.name}
                      {u.variantLabel && <span className="text-gray-500 font-normal"> · {u.variantLabel}</span>}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {u.code && <span className="font-mono">{u.code} · </span>}
                      {u.total} pcs in the shop · {u.shelved} on shelves ·{' '}
                      <span className={u.warehouse ? 'font-semibold text-gray-800' : ''}>{u.warehouse} in warehouse</span>
                    </p>
                  </div>
                </div>
                {canMove && u.warehouse > 0 && (
                  <button type="button" onClick={() => onPut(u)} className={`${primaryBtn} !px-3 !py-1.5 text-xs flex-shrink-0`}>
                    <PackagePlus className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Send to shop</span>
                  </button>
                )}
              </div>

              {u.shelves.length > 0 ? (
                <ul className="mt-2 space-y-1.5">
                  {u.shelves.map((s) => {
                    const key = `${unitKey(u)}|${s.shelfId}`;
                    return (
                      <li key={s.shelfId} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-100 text-sm">
                        <span className="font-mono font-semibold text-gray-900 w-16">{s.code}</span>
                        <span className="tabular-nums text-gray-700">{s.qty} pcs</span>
                        {s.qty > 0 && s.firstPlacedAt && (
                          <span className="text-[11px] text-gray-500">
                            since {formatDate(s.firstPlacedAt)} ({daysText(s.daysOnShelf)})
                          </span>
                        )}
                        {canMove ? (
                          <span className="ml-auto flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setHome(u, s.shelfId, !s.isHome)}
                              disabled={!!busyKey}
                              title={s.isHome ? 'Home shelf (click to unset)' : 'Make this the home shelf'}
                              className={`p-1.5 rounded-md border disabled:opacity-50 ${
                                s.isHome ? 'border-amber-300 bg-amber-50 text-amber-600' : 'border-gray-200 text-gray-400 hover:text-amber-600'
                              }`}
                            >
                              {busyKey === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Star className={`h-3.5 w-3.5 ${s.isHome ? 'fill-amber-400' : ''}`} />}
                            </button>
                            {s.qty > 0 && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setMove({ target: { ...u, from: { shelfId: s.shelfId, code: s.code, qty: s.qty } }, toWarehouse: false })}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-md border border-gray-200 text-gray-600 hover:bg-white"
                                >
                                  <ArrowRightLeft className="h-3 w-3" /> Move
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setMove({ target: { ...u, from: { shelfId: s.shelfId, code: s.code, qty: s.qty } }, toWarehouse: true })}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-md border border-gray-200 text-gray-600 hover:bg-white"
                                  title="Back to the warehouse"
                                >
                                  <Warehouse className="h-3 w-3" />
                                </button>
                              </>
                            )}
                          </span>
                        ) : (
                          s.isHome && <Star className="ml-auto h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-2 text-[11px] text-gray-400">Not on any shelf yet.</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {move && (
        <MoveStockModal
          target={move.target}
          toWarehouse={move.toWarehouse}
          onClose={() => setMove(null)}
          onDone={async () => {
            setMove(null);
            await refresh();
          }}
        />
      )}
    </div>
  );
}
