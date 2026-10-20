'use client';

// Scanner flow: 1) scan the product barcode  2) scan the shelf label  3) pieces + Enter.
// Keyboard only: every step autofocuses the next field; Esc starts over.
// Scanning a shelf label first also works (then scan the products for it).

import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Check, Loader2, MapPin, Package, RotateCcw, ScanLine, Star } from 'lucide-react';
import { ErrorBox, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import ShelfPicker, { invalidateShelfOptions, loadShelfOptions } from '@/components/store/ShelfPicker';
import ShelfCascade from '@/components/store/ShelfCascade';
import { apiErrorMessage, formatRs } from '@/lib/storeApi';
import { racksApi, unitKey, unitName, type ShelfOption, type UnitLocation } from '../../racks/services/racksApi';

interface Done {
  at: number;
  text: string;
}

export default function ScanPutaway({ initialShelfCode, onDone }: { initialShelfCode?: string | null; onDone: () => void }) {
  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [unit, setUnit] = useState<UnitLocation | null>(null);
  const [choices, setChoices] = useState<UnitLocation[]>([]);
  const [shelfId, setShelfId] = useState<string | null>(null);
  const [shelf, setShelf] = useState<ShelfOption | null>(null);
  const [qty, setQty] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<Done[]>([]);
  const lock = useRef(false);

  const codeRef = useRef<HTMLInputElement>(null);
  const shelfRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const focus = (r: React.RefObject<HTMLInputElement | null>) => window.setTimeout(() => r.current?.focus(), 30);

  const chooseShelf = useCallback((s: ShelfOption | null) => {
    setShelfId(s?._id ?? null);
    setShelf(s);
  }, []);

  // ?shelf=A1-S2 from the shelf drawer: start with that shelf.
  useEffect(() => {
    if (!initialShelfCode) return;
    loadShelfOptions()
      .then((list) => {
        const s = list.find((x) => x.code === initialShelfCode.toUpperCase());
        if (s) chooseShelf(s);
      })
      .catch(() => {});
  }, [initialShelfCode, chooseShelf]);

  const reset = () => {
    setUnit(null);
    setChoices([]);
    setQty('');
    setCode('');
    setError(null);
    // The shelf is picked again for every item (zone and rack stay chosen).
    chooseShelf(null);
    focus(codeRef);
  };

  /** A product unit was picked (scan or variant choice). */
  const selectUnit = async (u: UnitLocation) => {
    setChoices([]);
    setUnit(u);
    setQty(String(u.warehouse));
    if (u.warehouse <= 0) {
      setError(`No ${unitName(u)} in the warehouse (${u.total} pcs, all on display). Nothing to send.`);
      focus(codeRef);
      return;
    }
    setError(null);
    // Suggest the home shelf: Enter accepts it.
    const home = u.shelves.find((s) => s.isHome);
    if (home) {
      try {
        const list = await loadShelfOptions();
        const s = list.find((x) => x._id === home.shelfId);
        if (s) chooseShelf(s);
      } catch {
        /* picker shows its own error */
      }
    }
    focus(shelfRef);
  };

  const scan = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = code.trim();
    if (!text || scanning) return;
    setScanning(true);
    setError(null);
    try {
      const r = await racksApi.scan(text);
      if (r.kind === 'shelf') {
        const list = await loadShelfOptions();
        const s = list.find((x) => x._id === r.shelf._id);
        if (!s) setError(`Shelf ${r.shelf.code} is switched off.`);
        else {
          chooseShelf(s);
          toast.success(`Shelf ${s.code} selected. Now scan the products for it.`);
        }
        setCode('');
        focus(unit && s ? qtyRef : codeRef);
      } else if (r.kind === 'rack') {
        setError(`${r.code} is a rack. Scan a shelf label instead (e.g. ${r.code}-S1).`);
        setCode('');
        focus(codeRef);
      } else if (r.unit) {
        setCode('');
        await selectUnit(r.unit);
      } else {
        // Variant product without a variant code: let the user pick.
        setUnit(null);
        setChoices(r.units);
        setCode('');
      }
    } catch (err) {
      setError(apiErrorMessage(err, 'Nothing found for this code.'));
      setCode('');
      focus(codeRef);
    } finally {
      setScanning(false);
    }
  };

  const confirm = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (lock.current || !unit) return;
    const n = Number(qty);
    if (!shelfId || !shelf) {
      setError('Scan or choose the shelf first.');
      return focus(shelfRef);
    }
    if (!Number.isInteger(n) || n < 1) {
      setError('Enter how many pieces (1 or more).');
      return focus(qtyRef);
    }
    if (n > unit.warehouse) {
      setError(`Only ${unit.warehouse} piece(s) of ${unitName(unit)} are in the warehouse.`);
      return focus(qtyRef);
    }
    lock.current = true;
    try {
      setSaving(true);
      setError(null);
      await racksApi.putaway({ productId: unit.productId, variantId: unit.variantId, shelfId, qty: n });
      const text = `${n} × ${unitName(unit)} → ${shelf.code}`;
      toast.success(text);
      setLog((l) => [{ at: Date.now(), text }, ...l].slice(0, 6));
      invalidateShelfOptions();
      onDone();
      reset();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not put the stock away.'));
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  const onKeyDownCard = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !saving) reset();
  };

  const step = !unit ? 1 : !shelfId ? 2 : 3;
  const stepClass = (n: number) =>
    `flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold flex-shrink-0 ${
      step === n ? 'bg-honey-500 text-gray-900' : step > n ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'
    }`;

  return (
    <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5" onKeyDown={onKeyDownCard}>
      <div className="flex items-center justify-between gap-2 mb-4">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <ScanLine className="h-5 w-5 text-honey-700" /> Scan &amp; send to shop
        </h2>
        <button type="button" onClick={() => reset()} disabled={saving} className="text-xs text-gray-500 hover:text-gray-700 inline-flex items-center gap-1">
          <RotateCcw className="h-3.5 w-3.5" /> Start over (Esc)
        </button>
      </div>

      <div className="space-y-4">
        <ErrorBox message={error} />

        {/* 1. product */}
        <div className="flex gap-3">
          <span className={stepClass(1)}>{step > 1 ? <Check className="h-3.5 w-3.5" /> : 1}</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-700 mb-1.5">Scan the product barcode</p>
            <form onSubmit={scan} className="flex gap-2">
              <div className="relative flex-1">
                <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  ref={codeRef}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Scan or type barcode / short code"
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                  disabled={saving}
                  className={`${inputClass} pl-9 font-mono`}
                />
              </div>
              <button type="submit" disabled={scanning || !code.trim()} aria-busy={scanning} className={secondaryBtn}>
                {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Find'}
              </button>
            </form>

            {choices.length > 0 && (
              <div className="mt-2">
                <p className="text-[11px] text-gray-500 mb-1">Which one?</p>
                <div className="flex flex-wrap gap-1.5">
                  {choices.map((u) => (
                    <button
                      key={unitKey(u)}
                      type="button"
                      onClick={() => selectUnit(u)}
                      className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 hover:border-honey-400 hover:bg-honey-50"
                    >
                      {u.variantLabel || u.code || 'Variant'} <span className="text-gray-400">· {u.warehouse} in warehouse</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {unit && (
              <div className="mt-2 flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 border border-gray-200">
                {unit.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={unit.thumbnailUrl} alt="" className="h-10 w-10 rounded object-cover bg-white" />
                ) : (
                  <div className="h-10 w-10 rounded bg-white flex items-center justify-center">
                    <Package className="h-5 w-5 text-gray-300" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 truncate">{unitName(unit)}</p>
                  <p className="text-[11px] text-gray-500">
                    {unit.code && <span className="font-mono">{unit.code} · </span>}
                    {unit.price !== null && `${formatRs(unit.price)} · `}
                    <strong className="text-gray-800">{unit.warehouse}</strong> in warehouse · {unit.shelved} on shelves
                  </p>
                  {unit.shelves.length > 0 && (
                    <p className="text-[11px] text-gray-500 truncate">
                      On: {unit.shelves.map((s) => `${s.code}${s.isHome ? '★' : ''} (${s.qty})`).join(', ')}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 2. shelf */}
        <div className="flex gap-3">
          <span className={stepClass(2)}>{step > 2 ? <Check className="h-3.5 w-3.5" /> : 2}</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-700 mb-1.5">Choose the zone, rack and shelf</p>
            <ShelfCascade value={shelfId} onChange={chooseShelf} disabled={saving} onPicked={() => focus(qtyRef)} />
            <p className="mt-2 mb-1 text-[11px] text-gray-500">or scan / type the shelf label</p>
            <ShelfPicker value={shelfId} onChange={chooseShelf} inputRef={shelfRef} disabled={saving} onPicked={() => focus(qtyRef)} placeholder="Scan or type e.g. A1-S2" />
            <div className="mt-2 flex items-center justify-end gap-2">
              {unit && shelf && unit.shelves.some((s) => s.isHome && s.shelfId === shelf._id) && (
                <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 flex-shrink-0">
                  <Star className="h-3 w-3 fill-amber-400" /> home shelf
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 3. qty */}
        <form onSubmit={confirm} className="flex gap-3">
          <span className={stepClass(3)}>3</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-700 mb-1.5">Pieces, then Enter</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                ref={qtyRef}
                type="number"
                inputMode="numeric"
                min={1}
                max={unit?.warehouse}
                step={1}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                disabled={!unit || saving}
                placeholder={unit ? String(unit.warehouse) : '—'}
                className={`${inputClass} sm:w-32 tabular-nums text-base font-semibold`}
              />
              <button type="submit" disabled={!unit || !shelfId || saving} aria-busy={saving} className={`${primaryBtn} flex-1 sm:flex-none`}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                {saving
                  ? 'Saving…'
                  : unit && shelf
                    ? `Put ${Number(qty) || 0} pcs on ${shelf.code}`
                    : 'Confirm'}
              </button>
            </div>
          </div>
        </form>

        {log.length > 0 && (
          <div className="border-t border-gray-100 pt-3">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Just sent to shop</p>
            <ul className="space-y-0.5">
              {log.map((l) => (
                <li key={l.at} className="text-xs text-gray-700 flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                  <span className="truncate">{l.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
