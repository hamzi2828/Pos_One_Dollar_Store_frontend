'use client';

// Print shelf / rack labels (big code + barcode) for one rack, one zone or all racks.

import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, Printer } from 'lucide-react';
import { Modal, Field, ErrorBox, HelpBox, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { apiErrorMessage } from '@/lib/storeApi';
import { racksApi, LABEL_SIZES, type LabelSize, type LabelType, type RackView, type ZoneSummary } from '../services/racksApi';
import { printLabelHtml } from './shared';

type Scope = 'rack' | 'zone' | 'all';

export default function PrintLabelsModal({
  rack,
  zone,
  zones,
  racks,
  onClose,
}: {
  /** preselect this rack */
  rack?: RackView | null;
  /** preselect this zone */
  zone?: string | null;
  zones: ZoneSummary[];
  racks: RackView[];
  onClose: () => void;
}) {
  const [scope, setScope] = useState<Scope>(rack ? 'rack' : zone ? 'zone' : 'all');
  const [rackId, setRackId] = useState(rack?._id ?? racks[0]?._id ?? '');
  const [zoneKey, setZoneKey] = useState(zone ?? zones[0]?.zone ?? '');
  const [type, setType] = useState<LabelType>('shelf');
  const [size, setSize] = useState<LabelSize>('50x30');
  const [copies, setCopies] = useState('1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  // Rough count for the button (active racks / shelves only, like the server).
  const chosen = racks.filter((r) =>
    r.isActive && (scope === 'all' || (scope === 'zone' ? r.zone === zoneKey : r._id === rackId)),
  );
  const shelfCount = chosen.reduce((s, r) => s + r.shelves.filter((x) => x.isActive).length, 0);
  const perCopy = (type !== 'rack' ? shelfCount : 0) + (type !== 'shelf' ? chosen.length : 0);
  const n = Math.max(1, Math.min(10, Number(copies) || 1));
  const total = perCopy * n;

  const print = async () => {
    if (lock.current) return;
    if (!total) return setError('Nothing to print for this choice (no active shelves).');
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await printLabelHtml(() =>
        racksApi.labelsHtml({
          rackId: scope === 'rack' ? rackId : undefined,
          zone: scope === 'zone' ? zoneKey : undefined,
          type,
          size,
          copies: n,
        }),
      );
      toast.success(`${total} label(s) ready to print`);
      onClose();
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not make the labels.'));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const segBtn = (active: boolean) =>
    `px-3 py-1.5 text-sm rounded-lg border transition-colors ${
      active ? 'border-honey-500 bg-honey-50 text-honey-700 font-semibold' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
    }`;

  return (
    <Modal
      title="Print shelf labels"
      subtitle="Big shelf code + barcode to stick on each shelf"
      icon={<Printer className="h-5 w-5" />}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={secondaryBtn}>
            Cancel
          </button>
          <button type="button" onClick={print} disabled={busy || !total} aria-busy={busy} className={primaryBtn}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            {busy ? 'Preparing…' : `Print ${total} label${total === 1 ? '' : 's'}`}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <ErrorBox message={error} />
        <Field label="Which racks">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={segBtn(scope === 'rack')} onClick={() => setScope('rack')}>
              One rack
            </button>
            <button type="button" className={segBtn(scope === 'zone')} onClick={() => setScope('zone')}>
              One zone
            </button>
            <button type="button" className={segBtn(scope === 'all')} onClick={() => setScope('all')}>
              All racks
            </button>
          </div>
        </Field>
        {scope === 'rack' && (
          <Field label="Rack">
            <select value={rackId} onChange={(e) => setRackId(e.target.value)} className={inputClass}>
              {racks.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.code}
                  {r.name ? ` · ${r.name}` : ''}
                  {r.isActive ? '' : ' (inactive)'}
                </option>
              ))}
            </select>
          </Field>
        )}
        {scope === 'zone' && (
          <Field label="Zone">
            <select value={zoneKey} onChange={(e) => setZoneKey(e.target.value)} className={inputClass}>
              {zones.map((z) => (
                <option key={z.zone} value={z.zone}>
                  Zone {z.zone} ({z.racks} racks)
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Labels">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={segBtn(type === 'shelf')} onClick={() => setType('shelf')}>
              Shelf labels
            </button>
            <button type="button" className={segBtn(type === 'rack')} onClick={() => setType('rack')}>
              Rack labels
            </button>
            <button type="button" className={segBtn(type === 'both')} onClick={() => setType('both')}>
              Both
            </button>
          </div>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Field label="Label size">
              <select value={size} onChange={(e) => setSize(e.target.value as LabelSize)} className={inputClass}>
                {LABEL_SIZES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Copies each">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={10}
              value={copies}
              onChange={(e) => setCopies(e.target.value)}
              className={`${inputClass} tabular-nums`}
            />
          </Field>
        </div>
        <HelpBox>
          Stick the label on the front edge of each shelf. When sending stock to the shop, staff scan the product, then this label, so the
          system knows exactly which shelf the pieces went on.
        </HelpBox>
      </div>
    </Modal>
  );
}
