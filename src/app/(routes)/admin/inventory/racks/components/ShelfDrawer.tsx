'use client';

// Side drawer for one shelf: what is on it (since when), move / back to
// warehouse / home shelf, and shelf settings (name, capacity, on/off, delete).

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  AlertCircle,
  ArrowRightLeft,
  Check,
  Edit2,
  Loader2,
  Package,
  PackagePlus,
  Power,
  Star,
  Trash2,
  Warehouse,
  X,
} from 'lucide-react';
import { Field, ErrorBox, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { invalidateShelfOptions } from '@/components/store/ShelfPicker';
import { apiErrorMessage, formatDate, formatRs } from '@/lib/storeApi';
import { racksApi, daysText, unitKey, type ShelfDetail, type ShelfItem } from '../services/racksApi';
import MoveStockModal, { type MoveTarget } from './MoveStockModal';

export default function ShelfDrawer({
  shelfId,
  canEdit,
  canDelete,
  canMove,
  highlightKeys,
  onClose,
  onChanged,
}: {
  shelfId: string;
  canEdit: boolean;
  canDelete: boolean;
  canMove: boolean;
  /** unit keys to highlight (from the page search) */
  highlightKeys?: Set<string>;
  onClose: () => void;
  /** racks changed (stock moved / shelf edited) -> parent reloads */
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<ShelfDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [move, setMove] = useState<{ target: MoveTarget; toWarehouse: boolean } | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const lock = useRef(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setDetail(await racksApi.shelf(shelfId));
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load this shelf.'));
    } finally {
      setLoading(false);
    }
  }, [shelfId]);

  useEffect(() => {
    load();
    setEditing(false);
  }, [load]);

  // Esc closes the drawer (not while a modal is open on top).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !move && !busyKey) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [move, busyKey, onClose]);

  const changed = async () => {
    invalidateShelfOptions();
    await load();
    onChanged();
  };

  /** Run one action with a lock + busy marker. */
  const run = async (key: string, fn: () => Promise<string | void>, fallback: string) => {
    if (lock.current) return;
    lock.current = true;
    setBusyKey(key);
    try {
      const msg = await fn();
      if (msg) toast.success(msg);
      await changed();
    } catch (e) {
      toast.error(apiErrorMessage(e, fallback), { duration: 6000 });
    } finally {
      lock.current = false;
      setBusyKey(null);
    }
  };

  const toggleHome = (it: ShelfItem) =>
    run(
      `home:${unitKey(it)}`,
      () => racksApi.homeShelf({ productId: it.productId, variantId: it.variantId, shelfId, isHome: !it.isHome }),
      'Could not change the home shelf.',
    );

  const shelf = detail?.shelf;

  const toggleActive = () => {
    if (!shelf) return;
    if (shelf.isActive && !window.confirm(`Switch off shelf ${shelf.code}? It will not be offered when sending stock to the shop.`)) return;
    run(
      'active',
      async () => {
        await racksApi.updateShelf(shelf._id, { isActive: !shelf.isActive });
        return shelf.isActive ? `Shelf ${shelf.code} switched off` : `Shelf ${shelf.code} is in use again`;
      },
      'Could not change the shelf.',
    );
  };

  const remove = () => {
    if (!shelf) return;
    if (!window.confirm(`Delete shelf ${shelf.code}?\n\nOnly an empty shelf can be deleted.`)) return;
    if (lock.current) return;
    lock.current = true;
    setBusyKey('delete');
    racksApi
      .deleteShelf(shelf._id)
      .then(() => {
        toast.success(`Shelf ${shelf.code} deleted`);
        invalidateShelfOptions();
        onChanged();
        onClose();
      })
      .catch((e) => toast.error(apiErrorMessage(e, 'Could not delete the shelf.'), { duration: 6000 }))
      .finally(() => {
        lock.current = false;
        setBusyKey(null);
      });
  };

  const items = detail?.items ?? [];
  const stocked = items.filter((i) => i.qty > 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Shelf">
      <button type="button" className="absolute inset-0 bg-gray-900/40" aria-label="Close" onClick={() => !busyKey && onClose()} />
      <div className="relative w-full sm:max-w-md h-full bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-4 sm:px-5 py-4 border-b border-gray-200">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold font-mono text-gray-900">{shelf?.code ?? '…'}</h2>
              {shelf && !shelf.isActive && <span className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-200 text-gray-600 rounded">Inactive</span>}
            </div>
            {shelf && (
              <p className="text-xs text-gray-500 mt-0.5 truncate">
                Rack {shelf.rackCode}
                {shelf.rackName ? ` · ${shelf.rackName}` : ''} · level {shelf.level}
                {shelf.name ? ` · ${shelf.name}` : ''}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} disabled={!!busyKey} className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && !detail ? (
            <div className="py-16 text-center">
              <Loader2 className="h-7 w-7 text-honey-700 mx-auto animate-spin" />
            </div>
          ) : error ? (
            <div className="p-6 text-center">
              <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
              <p className="text-sm text-red-700 mb-3">{error}</p>
              <button type="button" onClick={load} className={primaryBtn}>
                Try again
              </button>
            </div>
          ) : shelf ? (
            <>
              {/* Summary */}
              <div className="grid grid-cols-3 gap-2 px-4 sm:px-5 py-3 bg-gray-50 border-b border-gray-100 text-center">
                <div>
                  <p className="text-lg font-semibold tabular-nums text-gray-900">{shelf.pieces}</p>
                  <p className="text-[10px] text-gray-500">pieces</p>
                </div>
                <div>
                  <p className="text-lg font-semibold tabular-nums text-gray-900">{shelf.products}</p>
                  <p className="text-[10px] text-gray-500">products</p>
                </div>
                <div>
                  <p className="text-lg font-semibold tabular-nums text-gray-900">{shelf.capacity ?? '—'}</p>
                  <p className="text-[10px] text-gray-500">capacity</p>
                </div>
              </div>
              {shelf.capacity !== null && shelf.pieces > shelf.capacity && (
                <p className="mx-4 sm:mx-5 mt-3 px-3 py-2 text-xs bg-amber-50 text-amber-800 border border-amber-200 rounded-lg">
                  This shelf holds more than its capacity ({shelf.pieces} / {shelf.capacity}).
                </p>
              )}
              {shelf.rackCategories.length > 0 && (
                <div className="px-4 sm:px-5 pt-3 flex flex-wrap gap-1">
                  {shelf.rackCategories.map((c) => (
                    <span key={c} className="px-1.5 py-0.5 text-[10px] bg-blue-50 text-blue-700 rounded">
                      {c}
                    </span>
                  ))}
                </div>
              )}

              {editing && canEdit && (
                <ShelfEditForm
                  shelf={shelf}
                  onCancel={() => setEditing(false)}
                  onSaved={async () => {
                    setEditing(false);
                    await changed();
                  }}
                />
              )}

              {/* Items */}
              <div className="px-4 sm:px-5 py-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">On this shelf</h3>
                {!items.length ? (
                  <div className="text-center py-8 border border-dashed border-gray-200 rounded-lg">
                    <Package className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">This shelf is empty.</p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {items.map((it) => {
                      const k = unitKey(it);
                      const hl = highlightKeys?.has(k);
                      return (
                        <li key={k} className={`rounded-lg border p-3 ${hl ? 'border-honey-400 ring-2 ring-honey-200' : 'border-gray-200'}`}>
                          <div className="flex items-start gap-3">
                            {it.thumbnailUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={it.thumbnailUrl} alt="" className="h-10 w-10 rounded object-cover bg-gray-100 flex-shrink-0" />
                            ) : (
                              <div className="h-10 w-10 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                                <Package className="h-5 w-5 text-gray-300" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900 leading-tight">
                                {it.name}
                                {it.variantLabel && <span className="text-gray-500"> · {it.variantLabel}</span>}
                              </p>
                              <p className="text-[11px] text-gray-500 mt-0.5">
                                {it.code && <span className="font-mono">{it.code}</span>}
                                {it.price !== null && <span> · {formatRs(it.price)}</span>}
                              </p>
                              <p className="text-[11px] text-gray-500 mt-0.5">
                                {it.qty > 0 ? (
                                  <>
                                    On shelf since {formatDate(it.firstPlacedAt)} ({daysText(it.daysOnShelf)})
                                  </>
                                ) : (
                                  'Home shelf — none on it now'
                                )}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-base font-semibold tabular-nums text-gray-900">{it.qty}</p>
                              <p className="text-[10px] text-gray-400">pcs</p>
                            </div>
                          </div>
                          {canMove && (
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => toggleHome(it)}
                                disabled={!!busyKey || !shelf.isActive}
                                title={it.isHome ? 'Home shelf of this item (click to unset)' : 'Make this the home shelf of this item'}
                                className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-md border disabled:opacity-50 ${
                                  it.isHome ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                              >
                                {busyKey === `home:${k}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Star className={`h-3 w-3 ${it.isHome ? 'fill-amber-400' : ''}`} />}
                                {it.isHome ? 'Home shelf' : 'Set home'}
                              </button>
                              {it.qty > 0 && (
                                <>
                                  <button
                                    type="button"
                                    disabled={!!busyKey}
                                    onClick={() => setMove({ target: { ...it, from: { shelfId, code: shelf.code, qty: it.qty } }, toWarehouse: false })}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                                  >
                                    <ArrowRightLeft className="h-3 w-3" /> Move
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!!busyKey}
                                    onClick={() => setMove({ target: { ...it, from: { shelfId, code: shelf.code, qty: it.qty } }, toWarehouse: true })}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                                  >
                                    <Warehouse className="h-3 w-3" /> To warehouse
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {stocked.length > 0 && !canMove && (
                  <p className="mt-3 text-[11px] text-gray-400">You can view this shelf. Moving stock needs the Put-away / Move permission.</p>
                )}
              </div>
            </>
          ) : null}
        </div>

        {/* Footer actions */}
        {shelf && (canMove || canEdit || canDelete) && (
          <div className="border-t border-gray-200 px-4 sm:px-5 py-3 flex flex-wrap items-center gap-2 bg-gray-50">
            {canMove && shelf.isActive && (
              <Link href={`/admin/inventory/putaway?shelf=${encodeURIComponent(shelf.code)}`} className={`${primaryBtn} !px-3 !py-1.5 text-xs`}>
                <PackagePlus className="h-3.5 w-3.5" /> Put items here
              </Link>
            )}
            {canEdit && !editing && (
              <button type="button" onClick={() => setEditing(true)} disabled={!!busyKey} className={`${secondaryBtn} !px-3 !py-1.5 text-xs`}>
                <Edit2 className="h-3.5 w-3.5" /> Edit shelf
              </button>
            )}
            {canEdit && (
              <button type="button" onClick={toggleActive} disabled={!!busyKey} className={`${secondaryBtn} !px-3 !py-1.5 text-xs`}>
                {busyKey === 'active' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Power className="h-3.5 w-3.5" />}
                {shelf.isActive ? 'Switch off' : 'Switch on'}
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={remove}
                disabled={!!busyKey || shelf.pieces > 0}
                title={shelf.pieces > 0 ? 'Move the pieces off this shelf first' : 'Delete this shelf'}
                className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {busyKey === 'delete' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Delete
              </button>
            )}
          </div>
        )}
      </div>

      {move && (
        <MoveStockModal
          target={move.target}
          toWarehouse={move.toWarehouse}
          onClose={() => setMove(null)}
          onDone={async () => {
            setMove(null);
            await changed();
          }}
        />
      )}
    </div>
  );
}

function ShelfEditForm({
  shelf,
  onCancel,
  onSaved,
}: {
  shelf: ShelfDetail['shelf'];
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(shelf.name);
  const [capacity, setCapacity] = useState(shelf.capacity === null ? '' : String(shelf.capacity));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  const save = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (lock.current) return;
    const cap = capacity.trim() === '' ? null : Number(capacity);
    if (cap !== null && (!Number.isInteger(cap) || cap < 0)) return setError('Capacity must be a whole number of pieces (or empty).');
    lock.current = true;
    try {
      setSaving(true);
      setError(null);
      await racksApi.updateShelf(shelf._id, { name: name.trim(), capacity: cap });
      toast.success(`Shelf ${shelf.code} saved`);
      await onSaved();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save the shelf.'));
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="mx-4 sm:mx-5 mt-3 p-3 border border-gray-200 rounded-lg bg-white">
      <fieldset disabled={saving} className="space-y-3 min-w-0">
        <ErrorBox message={error} />
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <Field label="Shelf name">
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Optional, e.g. Top" className={inputClass} autoFocus />
            </Field>
          </div>
          <Field label="Capacity (pcs)">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="—"
              className={`${inputClass} tabular-nums`}
            />
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className={`${secondaryBtn} !px-3 !py-1.5 text-xs`}>
            Cancel
          </button>
          <button type="submit" aria-busy={saving} className={`${primaryBtn} !px-3 !py-1.5 text-xs`}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save
          </button>
        </div>
      </fieldset>
    </form>
  );
}
