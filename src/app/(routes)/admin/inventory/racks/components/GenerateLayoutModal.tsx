'use client';

// "Generate layout": zones A, B, C, D × 20 racks × 4 shelves -> A1..D20, A1-S1..D20-S4.
// Safe to run again: existing racks / shelves are kept, only missing ones are added.

import React, { useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { LayoutGrid, Loader2, Wand2 } from 'lucide-react';
import { Modal, Field, ErrorBox, HelpBox, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { apiErrorMessage } from '@/lib/storeApi';
import { invalidateShelfOptions } from '@/components/store/ShelfPicker';
import { racksApi } from '../services/racksApi';

const MAX = { zones: 26, racks: 100, shelves: 12, total: 1000 };

/** "A, B, C, D" / "A-D" / "abcd" -> ['A','B','C','D'] (or an error text). */
function parseZones(text: string): { zones: string[]; error: string | null } {
  const parts = text
    .toUpperCase()
    .split(/[\s,;]+/)
    .filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    const range = /^([A-Z])-([A-Z])$/.exec(p);
    if (range) {
      const a = range[1].charCodeAt(0);
      const b = range[2].charCodeAt(0);
      if (b < a) return { zones: [], error: `Range ${p} is backwards` };
      for (let c = a; c <= b; c++) out.push(String.fromCharCode(c));
    } else if (/^[A-Z]{1,2}$/.test(p)) out.push(p);
    else if (/^[A-Z]{3,}$/.test(p) && parts.length === 1) out.push(...p.split(''));
    else return { zones: [], error: `"${p}" is not a zone. Use letters like A, B, C, D` };
  }
  const zones = [...new Set(out)];
  if (!zones.length) return { zones, error: 'Enter at least one zone letter' };
  if (zones.length > MAX.zones) return { zones, error: `At most ${MAX.zones} zones` };
  return { zones, error: null };
}

export default function GenerateLayoutModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const [zonesText, setZonesText] = useState('A, B, C, D');
  const [racksPerZone, setRacksPerZone] = useState('20');
  const [shelvesPerRack, setShelvesPerRack] = useState('4');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  const preview = useMemo(() => {
    const { zones, error: zErr } = parseZones(zonesText);
    const r = Number(racksPerZone);
    const s = Number(shelvesPerRack);
    let err = zErr;
    if (!err && (!Number.isInteger(r) || r < 1 || r > MAX.racks)) err = `Racks per zone: 1 to ${MAX.racks}`;
    if (!err && (!Number.isInteger(s) || s < 1 || s > MAX.shelves)) err = `Shelves per rack: 1 to ${MAX.shelves}`;
    if (!err && zones.length * r > MAX.total) err = `That is ${zones.length * r} racks. At most ${MAX.total} at a time.`;
    const racks = err ? 0 : zones.length * r;
    return {
      zones,
      racks,
      shelves: err ? 0 : racks * s,
      error: err,
      first: zones.length ? `${zones[0]}1-S1` : '',
      last: zones.length && !err ? `${zones[zones.length - 1]}${r}-S${s}` : '',
    };
  }, [zonesText, racksPerZone, shelvesPerRack]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (lock.current) return;
    if (preview.error) return setError(preview.error);
    lock.current = true;
    try {
      setSaving(true);
      setError(null);
      const { result, message } = await racksApi.generate({
        zones: preview.zones,
        racksPerZone: Number(racksPerZone),
        shelvesPerRack: Number(shelvesPerRack),
      });
      invalidateShelfOptions();
      const skipped = result.racksSkipped || result.shelvesSkipped;
      toast.success(
        skipped
          ? `${message} (${result.racksSkipped} rack(s) and ${result.shelvesSkipped} shelf/shelves already existed)`
          : message,
        { duration: 6000 },
      );
      onDone();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not create the layout.'));
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Generate rack layout"
      icon={<LayoutGrid className="h-5 w-5" />}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className={secondaryBtn}>
            Cancel
          </button>
          <button type="button" onClick={() => submit()} disabled={saving || !!preview.error} aria-busy={saving} className={primaryBtn}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {saving ? 'Creating…' : `Create ${preview.racks} racks`}
          </button>
        </>
      }
    >
      <form onSubmit={submit}>
        <fieldset disabled={saving} className="space-y-4 min-w-0">
          <ErrorBox message={error} />
          <Field label="Zones (rack letters)" required hint='Letters separated by commas, or a range like "A-D".'>
            <input
              value={zonesText}
              onChange={(e) => setZonesText(e.target.value)}
              className={`${inputClass} font-mono uppercase`}
              placeholder="A, B, C, D"
              autoFocus
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Racks per zone" required hint={`1 – ${MAX.racks}`}>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX.racks}
                value={racksPerZone}
                onChange={(e) => setRacksPerZone(e.target.value)}
                className={`${inputClass} tabular-nums`}
              />
            </Field>
            <Field label="Shelves per rack" required hint={`1 – ${MAX.shelves}`}>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX.shelves}
                value={shelvesPerRack}
                onChange={(e) => setShelvesPerRack(e.target.value)}
                className={`${inputClass} tabular-nums`}
              />
            </Field>
          </div>

          <div className={`rounded-lg border p-3 text-center ${preview.error ? 'border-red-200 bg-red-50' : 'border-honey-200 bg-honey-50'}`}>
            {preview.error ? (
              <p className="text-sm text-red-700">{preview.error}</p>
            ) : (
              <>
                <p className="text-lg font-semibold text-gray-900 tabular-nums">
                  {preview.racks} racks · {preview.shelves} shelves
                </p>
                <p className="text-xs text-gray-600 mt-0.5">
                  Zones {preview.zones.join(', ')} · codes <span className="font-mono">{preview.first}</span> …{' '}
                  <span className="font-mono">{preview.last}</span>
                </p>
              </>
            )}
          </div>

          <HelpBox>
            Safe to run again: racks and shelves that already exist are kept as they are. Only missing ones are added — e.g. run
            it later with 22 racks per zone to add A21, A22 … or with 5 shelves to add an S5 to every rack.
          </HelpBox>
          <button type="submit" className="hidden" />
        </fieldset>
      </form>
    </Modal>
  );
}
