'use client';

// Searchable shelf select. Type part of a code / rack name, or scan a shelf
// label (the scanner types "A1-S2" + Enter -> that shelf is picked at once).
//
//   <ShelfPicker value={shelfId} onChange={(s) => setShelfId(s?._id ?? null)} />
//
// Props:
//   value        selected shelf id (or null)
//   onChange     (shelf | null) — the full ShelfOption (code, rackName, pieces...)
//   placeholder  input placeholder
//   autoFocus, disabled, excludeIds (hide e.g. the "from" shelf), inputRef, id
//   onPicked     called right after a pick by Enter (scanner flow: jump to the next field)
//
// Shelves are loaded once and cached for a minute (the shop has a few
// hundred shelves), so searching and scanning are instant. Call
// invalidateShelfOptions() after changing racks / stock to refresh counts.

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Loader2, MapPin, Search, X } from 'lucide-react';
import { apiErrorMessage } from '@/lib/storeApi';
import { racksApi, type ShelfOption } from '@/app/(routes)/admin/inventory/racks/services/racksApi';

const TTL_MS = 60_000;
const MAX_SHOWN = 80;
let cache: { at: number; promise: Promise<ShelfOption[]> } | null = null;

/** All active shelves of the shop (cached 60 s). */
export function loadShelfOptions(force = false): Promise<ShelfOption[]> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.promise;
  const promise = racksApi.shelves({ limit: 2000 }).catch((e) => {
    if (cache?.promise === promise) cache = null;
    throw e;
  });
  cache = { at: Date.now(), promise };
  return promise;
}

/** Forget cached shelves (after racks / stock changed). */
export function invalidateShelfOptions() {
  cache = null;
}

const norm = (s: string) => s.trim().toUpperCase();

interface ShelfPickerProps {
  value: string | null;
  onChange: (shelf: ShelfOption | null) => void;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  excludeIds?: string[];
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onPicked?: (shelf: ShelfOption) => void;
  id?: string;
  className?: string;
}

export default function ShelfPicker({
  value,
  onChange,
  placeholder = 'Type or scan a shelf code, e.g. A1-S2',
  autoFocus,
  disabled,
  excludeIds,
  inputRef,
  onPicked,
  id,
  className = '',
}: ShelfPickerProps) {
  const [shelves, setShelves] = useState<ShelfOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // null = not typing (input shows the selected code)
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // Arrow keys used since the list opened (Enter then picks the highlighted row).
  const [navigated, setNavigated] = useState(false);
  const ownRef = useRef<HTMLInputElement>(null);
  const ref = inputRef || ownRef;
  const listId = useId();

  const load = useCallback(
    async (force = false) => {
      try {
        setLoading(true);
        setError(null);
        setShelves(await loadShelfOptions(force));
      } catch (e) {
        setError(apiErrorMessage(e, 'Could not load shelves'));
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  const available = useMemo(() => {
    if (!excludeIds?.length) return shelves;
    const skip = new Set(excludeIds);
    return shelves.filter((s) => !skip.has(s._id));
  }, [shelves, excludeIds]);

  const selected = useMemo(() => shelves.find((s) => s._id === value) || null, [shelves, value]);

  const filtered = useMemo(() => {
    const q = norm(query || '');
    if (!q) return available;
    // exact code first, then codes starting with the text, then anything containing it
    const starts: ShelfOption[] = [];
    const contains: ShelfOption[] = [];
    for (const s of available) {
      if (s.code.startsWith(q)) starts.push(s);
      else if (s.code.includes(q) || norm(s.rackName).includes(q) || norm(s.name).includes(q)) contains.push(s);
    }
    const exact = starts.filter((s) => s.code === q);
    return [...exact, ...starts.filter((s) => s.code !== q), ...contains];
  }, [available, query]);

  const pick = (s: ShelfOption | null, byEnter = false) => {
    onChange(s);
    setQuery(null);
    setOpen(false);
    setActive(0);
    setNavigated(false);
    if (s && byEnter) onPicked?.(s);
  };

  const exactMatch = (text: string) => {
    const q = norm(text);
    return q ? available.find((s) => s.code === q) || null : null;
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      setNavigated(true);
      const last = Math.max(0, Math.min(filtered.length, MAX_SHOWN) - 1);
      setActive((i) => (e.key === 'ArrowDown' ? Math.min(i + 1, last) : Math.max(0, i - 1)));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const text = (query || '').trim();
      if (text) {
        // Scanned / typed code: exact code wins, else the highlighted row.
        const pickIt = exactMatch(text) || filtered[active];
        if (pickIt) pick(pickIt, true);
      } else if (navigated && filtered[active]) {
        pick(filtered[active], true);
      } else if (selected) {
        // Already chosen: Enter just moves on (scanner flow).
        setOpen(false);
        onPicked?.(selected);
      }
    } else if (e.key === 'Escape') {
      setQuery(null);
      setOpen(false);
    }
  };

  const onBlur = () => {
    // Scanners that end with Tab instead of Enter: accept an exact code on blur.
    if (query) {
      const exact = exactMatch(query);
      if (exact && exact._id !== value) onChange(exact);
    }
    window.setTimeout(() => {
      setOpen(false);
      setQuery(null);
    }, 150);
  };

  const typed = query !== null && query.trim() !== '';
  const notFound = typed && !loading && filtered.length === 0;
  const shown = filtered.slice(0, MAX_SHOWN);

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <input
          id={id}
          ref={ref}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
          autoFocus={autoFocus}
          disabled={disabled}
          value={query ?? (selected ? selected.code : '')}
          placeholder={loading && !shelves.length ? 'Loading shelves…' : placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={(e) => {
            setOpen(true);
            setNavigated(false);
            e.currentTarget.select();
          }}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          className="w-full pl-9 pr-9 py-2 text-sm font-mono uppercase text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-honey-500/30 focus:border-honey-500 placeholder:font-sans placeholder:normal-case placeholder:text-gray-400 disabled:bg-gray-50 disabled:text-gray-500"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          ) : value && !disabled ? (
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(null)}
              className="p-1 rounded text-gray-400 hover:text-gray-600"
              aria-label="Clear shelf"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <Search className="h-4 w-4 text-gray-300" />
          )}
        </div>
      </div>

      {selected && query === null && (selected.rackName || selected.pieces > 0) && (
        <p className="mt-1 text-[11px] text-gray-500 truncate">
          {selected.rackName ? `${selected.rackName} · ` : ''}
          {selected.pieces} pcs on it now
        </p>
      )}

      {open && !disabled && (
        <div
          id={listId}
          role="listbox"
          className="absolute z-40 mt-1 w-full max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg"
        >
          {error ? (
            <div className="px-3 py-2 text-xs text-red-600 flex items-center justify-between gap-2">
              <span>{error}</span>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => load(true)} className="font-semibold underline">
                Retry
              </button>
            </div>
          ) : loading && !shelves.length ? (
            <div className="px-3 py-2 text-xs text-gray-500">Loading shelves…</div>
          ) : !shelves.length ? (
            <div className="px-3 py-2 text-xs text-gray-500">No shelves yet. Create racks on the Racks &amp; Shelves page.</div>
          ) : notFound ? (
            <div className="px-3 py-2 text-xs text-gray-500">No shelf &quot;{norm(query || '')}&quot; found.</div>
          ) : (
            <>
              {shown.map((s, i) => (
                <button
                  key={s._id}
                  type="button"
                  role="option"
                  aria-selected={s._id === value}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(s)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-left text-sm ${
                    i === active ? 'bg-honey-50' : ''
                  } ${s._id === value ? 'font-semibold' : ''}`}
                >
                  <span className="min-w-0 flex items-baseline gap-2">
                    <span className="font-mono text-gray-900">{s.code}</span>
                    {(s.rackName || s.name) && <span className="text-[11px] text-gray-500 truncate">{[s.rackName, s.name].filter(Boolean).join(' · ')}</span>}
                  </span>
                  <span className={`text-[11px] tabular-nums flex-shrink-0 ${s.pieces ? 'text-gray-600' : 'text-gray-300'}`}>
                    {s.pieces ? `${s.pieces} pcs` : 'empty'}
                  </span>
                </button>
              ))}
              {filtered.length > MAX_SHOWN && (
                <div className="px-3 py-1.5 text-[11px] text-gray-400">Type more to narrow down ({filtered.length} shelves)</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
