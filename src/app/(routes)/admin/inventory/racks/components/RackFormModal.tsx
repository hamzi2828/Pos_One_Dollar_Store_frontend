'use client';

// Add one rack (zone + number -> code, N shelves) or edit a rack's name,
// description, category hint, order and active state. The code itself never
// changes once created (it is printed on the shelf labels).

import React, { useRef, useState } from 'react';
import { Check, Loader2, Rows3 } from 'lucide-react';
import { Modal, Field, Toggle, ErrorBox, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { apiErrorMessage } from '@/lib/storeApi';
import type { RackView } from '../services/racksApi';

export interface RackFormValues {
  zone: string;
  number: number;
  name: string;
  description: string;
  categories: string[];
  shelves: number;
  sortOrder: number;
  isActive: boolean;
}

export default function RackFormModal({
  rack,
  defaultZone,
  nextNumber,
  onClose,
  onSave,
}: {
  rack: RackView | null;
  defaultZone: string;
  /** suggested number for a new rack in defaultZone */
  nextNumber: (zone: string) => number;
  onClose: () => void;
  onSave: (values: RackFormValues) => Promise<void>;
}) {
  const [zone, setZone] = useState(rack?.zone ?? defaultZone);
  const [number, setNumber] = useState(String(rack?.number ?? nextNumber(defaultZone)));
  const [name, setName] = useState(rack?.name ?? '');
  const [description, setDescription] = useState(rack?.description ?? '');
  const [categories, setCategories] = useState((rack?.categories ?? []).join(', '));
  const [shelves, setShelves] = useState('4');
  const [sortOrder, setSortOrder] = useState(String(rack?.sortOrder ?? 0));
  const [isActive, setIsActive] = useState(rack?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  const zoneOk = /^[A-Z]{1,2}$/.test(zone);
  const code = zoneOk && Number(number) > 0 ? `${zone}${Number(number)}` : '';

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (lock.current) return;
    const n = Number(number);
    const s = Number(shelves);
    const order = Number(sortOrder);
    if (!rack) {
      if (!zoneOk) return setError('Zone must be 1-2 letters, e.g. A');
      if (!Number.isInteger(n) || n < 1 || n > 999) return setError('Rack number must be a whole number from 1 to 999');
      if (!Number.isInteger(s) || s < 0 || s > 12) return setError('Shelves must be 0 to 12');
    }
    if (!Number.isInteger(order)) return setError('Order must be a whole number');
    lock.current = true;
    try {
      setSaving(true);
      setError(null);
      await onSave({
        zone,
        number: n,
        name: name.trim(),
        description: description.trim(),
        categories: categories
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean),
        shelves: s,
        sortOrder: order,
        isActive,
      });
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save the rack.'));
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  return (
    <Modal
      title={rack ? `Edit rack ${rack.code}` : 'Add rack'}
      subtitle={rack ? rack.name || `Zone ${rack.zone}` : code ? `New rack ${code}` : 'A new rack'}
      icon={<Rows3 className="h-5 w-5" />}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className={secondaryBtn}>
            Cancel
          </button>
          <button type="button" onClick={() => submit()} disabled={saving} aria-busy={saving} className={primaryBtn}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? 'Saving…' : rack ? 'Save' : `Add ${code || 'rack'}`}
          </button>
        </>
      }
    >
      <form onSubmit={submit}>
        <fieldset disabled={saving} className="space-y-4 min-w-0">
          <ErrorBox message={error} />
          {!rack && (
            <div className="grid grid-cols-3 gap-3">
              <Field label="Zone" required hint="Letter">
                <input
                  value={zone}
                  onChange={(e) => {
                    const z = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
                    setZone(z);
                    if (/^[A-Z]{1,2}$/.test(z)) setNumber(String(nextNumber(z)));
                  }}
                  className={`${inputClass} font-mono uppercase`}
                  placeholder="A"
                  autoFocus
                />
              </Field>
              <Field label="Number" required>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={999}
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  className={`${inputClass} tabular-nums`}
                />
              </Field>
              <Field label="Shelves" required hint="0 – 12">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={12}
                  value={shelves}
                  onChange={(e) => setShelves(e.target.value)}
                  className={`${inputClass} tabular-nums`}
                />
              </Field>
            </div>
          )}
          <Field label="Name" hint='Optional, e.g. "Kitchen items"'>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Kitchen items" className={inputClass} autoFocus={!!rack} />
          </Field>
          <Field label="Categories kept here" hint="A hint for staff, separated by commas. Not enforced.">
            <input value={categories} onChange={(e) => setCategories(e.target.value)} placeholder="Kitchen, Plastic, Crockery" className={inputClass} />
          </Field>
          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={300}
              placeholder="Optional, e.g. left wall near the counter"
              className={`${inputClass} resize-none`}
            />
          </Field>
          {rack && (
            <>
              <Field label="Order" hint="Lower numbers are shown first (0 = normal A1, A2 … order)">
                <input type="number" step={1} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className={`${inputClass} tabular-nums w-32`} />
              </Field>
              <Toggle
                checked={isActive}
                onChange={setIsActive}
                label="Rack is in use (active)"
                hint="An inactive rack and its shelves cannot receive stock. Only empty racks can be switched off."
              />
            </>
          )}
          <button type="submit" className="hidden" />
        </fieldset>
      </form>
    </Modal>
  );
}
