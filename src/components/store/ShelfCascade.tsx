'use client';

// Pick a shelf step by step: Zone -> Rack -> Shelf (three searchable dropdowns).
// Picking a zone shows only its racks; picking a rack shows only its shelves.
// When `value` changes from outside (e.g. a shelf label was scanned), the
// zone and rack follow it.
//
//   <ShelfCascade value={shelfId} onChange={(s) => setShelfId(s?._id ?? null)} />
import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { apiErrorMessage } from '@/lib/storeApi';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { inputClass } from '@/components/admin/FormBits';
import type { ShelfOption } from '@/app/(routes)/admin/inventory/racks/services/racksApi';
import { loadShelfOptions } from './ShelfPicker';

/** "A12" -> "A" (racks are zone letter + number). */
const zoneOf = (s: ShelfOption) => s.zone || s.rackCode.replace(/\d+$/, '') || s.rackCode;
const rackNumber = (code: string) => Number((code.match(/\d+$/) || ['0'])[0]);

export default function ShelfCascade({
  value,
  onChange,
  disabled,
  excludeIds,
  onPicked,
}: {
  value: string | null;
  onChange: (shelf: ShelfOption | null) => void;
  disabled?: boolean;
  /** shelves to leave out (e.g. the "from" shelf) */
  excludeIds?: string[];
  /** called after a shelf is chosen (e.g. jump to the pieces box) */
  onPicked?: (shelf: ShelfOption) => void;
}) {
  const [shelves, setShelves] = useState<ShelfOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zone, setZone] = useState('');
  const [rack, setRack] = useState('');

  useEffect(() => {
    let alive = true;
    loadShelfOptions()
      .then((list) => alive && setShelves(list))
      .catch((e) => alive && setError(apiErrorMessage(e, 'Could not load the shelves.')));
    return () => {
      alive = false;
    };
  }, []);

  const list = useMemo(
    () => (shelves || []).filter((s) => s.isActive !== false && !(excludeIds || []).includes(s._id)),
    [shelves, excludeIds]
  );
  const selected = list.find((s) => s._id === value) || null;

  // A shelf chosen elsewhere (scanned): show its zone and rack.
  useEffect(() => {
    if (selected) {
      setZone(zoneOf(selected));
      setRack(selected.rackId);
    }
  }, [selected]);

  const zones = useMemo(() => [...new Set(list.map(zoneOf))].sort(), [list]);
  const racks = useMemo(() => {
    const seen = new Map<string, ShelfOption>();
    for (const s of list) if (zoneOf(s) === zone && !seen.has(s.rackId)) seen.set(s.rackId, s);
    return [...seen.values()].sort((a, b) => rackNumber(a.rackCode) - rackNumber(b.rackCode));
  }, [list, zone]);
  const rackShelves = useMemo(() => list.filter((s) => s.rackId === rack).sort((a, b) => a.level - b.level), [list, rack]);

  if (error) return <p className="text-xs text-red-600">{error}</p>;
  if (!shelves) {
    return (
      <p className="flex items-center gap-2 text-xs text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading shelves…
      </p>
    );
  }
  if (!list.length) return <p className="text-xs text-gray-500">No shelves yet. Add racks in Inventory → Racks &amp; shelves.</p>;

  return (
    <div className="grid grid-cols-3 gap-2">
      <SearchSelect
        aria-label="Zone"
        value={zone}
        disabled={disabled}
        onChange={(e) => {
          setZone(e.target.value);
          setRack('');
          if (value) onChange(null);
        }}
        className={inputClass}
        placeholder="Zone"
      >
        <option value="" disabled>
          Zone
        </option>
        {zones.map((z) => (
          <option key={z} value={z}>
            Zone {z}
          </option>
        ))}
      </SearchSelect>
      <SearchSelect
        aria-label="Rack"
        value={rack}
        disabled={disabled || !zone}
        onChange={(e) => {
          setRack(e.target.value);
          if (value) onChange(null);
        }}
        className={inputClass}
        placeholder={zone ? 'Rack' : 'Pick a zone'}
      >
        <option value="" disabled>
          Rack
        </option>
        {racks.map((r) => (
          <option key={r.rackId} value={r.rackId}>
            {r.rackName && r.rackName !== r.rackCode ? `${r.rackCode} · ${r.rackName}` : `Rack ${r.rackCode}`}
          </option>
        ))}
      </SearchSelect>
      <SearchSelect
        aria-label="Shelf"
        value={value || ''}
        disabled={disabled || !rack}
        onChange={(e) => {
          const s = list.find((x) => x._id === e.target.value) || null;
          onChange(s);
          if (s) onPicked?.(s);
        }}
        className={inputClass}
        placeholder={rack ? 'Shelf' : 'Pick a rack'}
      >
        <option value="" disabled>
          Shelf
        </option>
        {rackShelves.map((s) => (
          <option key={s._id} value={s._id}>
            {`${s.code}${s.pieces ? ` · ${s.pieces} pcs` : ' · empty'}`}
          </option>
        ))}
      </SearchSelect>
    </div>
  );
}
