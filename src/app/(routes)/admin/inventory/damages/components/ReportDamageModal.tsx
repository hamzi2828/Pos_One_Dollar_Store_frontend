'use client';

// "Report damage": scan the item, qty, where it was (shelf / warehouse), reason, photos.
// Sent once per modal (requestId) so a double tap or a retry never makes two reports.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, PackageX, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { ErrorBox, Field, HelpBox, Modal, Toggle, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { storeApi, apiErrorMessage, formatRs } from '@/lib/storeApi';
import { DAMAGE_REASONS, newRequestId, unitTitle, type DamageReason, type DamageRecord } from '../../movements/_shared/stockOpsApi';
import { ProductPicker, type PickedUnit } from '../../movements/_shared/StockOpsBits';
import { SearchSelect } from '@/components/ui/SearchSelect';

const MAX_PHOTOS = 5;

export default function ReportDamageModal({
  onClose,
  onSaved,
  autoApprove = false,
}: {
  onClose: () => void;
  onSaved: (rec: DamageRecord) => void;
  autoApprove?: boolean;
}) {
  const [unit, setUnit] = useState<PickedUnit | null>(null);
  const [qty, setQty] = useState('1');
  const [location, setLocation] = useState<'shelf' | 'warehouse'>('shelf');
  const [shelfId, setShelfId] = useState('');
  const [reason, setReason] = useState<DamageReason>('broken');
  const [description, setDescription] = useState('');
  const [claimable, setClaimable] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(newRequestId());
  const fileRef = useRef<HTMLInputElement>(null);

  const previews = useMemo(() => photos.map((f) => URL.createObjectURL(f)), [photos]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const pick = (u: PickedUnit) => {
    setUnit(u);
    setError(null);
    const onShelves = u.shelves.filter((s) => s.qty > 0);
    setLocation(onShelves.length ? 'shelf' : 'warehouse');
    setShelfId(onShelves.length === 1 && onShelves[0].shelfId ? onShelves[0].shelfId : '');
    setClaimable(!!u.vendorName && (reason === 'defective' || reason === 'expired'));
  };

  const n = Math.floor(Number(qty) || 0);
  const loss = unit ? Math.round(unit.costPrice * Math.max(0, n) * 100) / 100 : 0;
  const tooMany = unit ? n > unit.available : false;

  const submit = async () => {
    if (saving || !unit) return;
    if (n < 1) return setError('Quantity must be at least 1');
    if (tooMany) return setError(`Only ${unit.available} piece(s) in stock`);
    setSaving(true);
    setError(null);
    try {
      const form = new FormData();
      // Scanned items go by code (keeps the scanned batch); searched ones by id.
      if (unit.scannedCode) form.append('code', unit.scannedCode);
      else form.append('productId', unit.productId);
      if (unit.variantId) form.append('variantId', unit.variantId);
      form.append('qty', String(n));
      form.append('location', location);
      if (location === 'shelf' && shelfId) form.append('shelfId', shelfId);
      form.append('reason', reason);
      form.append('description', description.trim());
      form.append('claimable', String(claimable));
      form.append('requestId', requestId.current);
      photos.forEach((f) => form.append('photos', f));
      const res = await storeApi.upload<DamageRecord>('/damages', form);
      toast.success(res.message || 'Damage reported');
      onSaved(res.data);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not save the report.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Report damage"
      subtitle="Scan the damaged item's barcode"
      icon={<PackageX className="h-5 w-5" />}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className={secondaryBtn}>
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={saving || !unit || tooMany} className={primaryBtn}>
            {saving ? 'Saving…' : 'Save report'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {!unit ? (
          <Field label="Item" required hint="Scan with the barcode scanner, or type a name and pick it.">
            <ProductPicker onPick={pick} autoFocus />
          </Field>
        ) : (
          <div className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-900">{unitTitle(unit)}</div>
              <div className="text-xs text-gray-500">
                <span className="font-mono">{unit.scannedCode || unit.code}</span>
                {unit.batchNo ? ` · batch ${unit.batchNo}` : ''} · {unit.available} in stock · avg cost {formatRs(unit.costPrice, { decimals: 2 })}
              </div>
              {unit.vendorName && <div className="text-xs text-gray-500">Last vendor: {unit.vendorName}</div>}
            </div>
            <button type="button" onClick={() => setUnit(null)} disabled={saving} className="p-1 text-gray-400 hover:text-gray-700" aria-label="Choose another item">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {unit && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Quantity (pieces)" required>
                <input type="number" min={1} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} className={inputClass} />
                {tooMany && <p className="mt-1 text-[11px] text-red-600">Only {unit.available} in stock</p>}
              </Field>
              <Field label="Reason" required>
                <SearchSelect
                  value={reason}
                  onChange={(e) => {
                    const r = e.target.value as DamageReason;
                    setReason(r);
                    if (unit.vendorName && (r === 'defective' || r === 'expired')) setClaimable(true);
                  }}
                  className={inputClass}
                >
                  {DAMAGE_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </SearchSelect>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Found on">
                <SearchSelect value={location} onChange={(e) => setLocation(e.target.value as 'shelf' | 'warehouse')} className={inputClass}>
                  <option value="shelf">Shelf</option>
                  <option value="warehouse">Warehouse</option>
                </SearchSelect>
              </Field>
              {location === 'shelf' && (
                <Field label="Shelf" hint={unit.shelves.length ? undefined : 'Not on any shelf yet'}>
                  <SearchSelect value={shelfId} onChange={(e) => setShelfId(e.target.value)} className={inputClass} disabled={!unit.shelves.length}>
                    <option value="">Any shelf</option>
                    {unit.shelves.map((s) => (
                      <option key={s.shelfId || s.code} value={s.shelfId || ''}>
                        {s.code} ({s.qty} pcs)
                      </option>
                    ))}
                  </SearchSelect>
                </Field>
              )}
            </div>

            <Field label="What happened">
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={1000} placeholder="e.g. Box got wet under the AC" className={inputClass} />
            </Field>

            <Field label={`Photos (up to ${MAX_PHOTOS})`}>
              <div className="flex flex-wrap gap-2">
                {previews.map((src, i) => (
                  <div key={src} className="relative h-16 w-16">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="h-16 w-16 rounded-lg object-cover border border-gray-200" />
                    <button
                      type="button"
                      onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                      className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-white border border-gray-300 text-gray-600 hover:text-red-600"
                      aria-label="Remove photo"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <button type="button" onClick={() => fileRef.current?.click()} className="h-16 w-16 rounded-lg border-2 border-dashed border-gray-300 text-gray-400 hover:border-honey-400 hover:text-honey-700 flex flex-col items-center justify-center text-[10px]">
                    <Camera className="h-5 w-5" />
                    Add
                  </button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setPhotos((p) => [...p, ...files].slice(0, MAX_PHOTOS));
                  e.target.value = '';
                }}
              />
            </Field>

            <Toggle checked={claimable} onChange={setClaimable} label="Claim from vendor" hint={unit.vendorName ? `Ask ${unit.vendorName} to replace or credit it` : 'No vendor recorded for this item'} />

            <HelpBox>
              Loss at cost: <strong>{formatRs(loss, { decimals: 2 })}</strong>. {autoApprove ? 'Stock is taken off as soon as you save (auto-approve is on).' : 'Stock is taken off when a manager approves this report.'}
            </HelpBox>
          </>
        )}
        <ErrorBox message={error} />
      </div>
    </Modal>
  );
}
