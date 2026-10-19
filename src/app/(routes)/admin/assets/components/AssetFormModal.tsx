'use client';

// Add / edit an asset. Money is per unit; totals and depreciation preview update as you type.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Check, Loader2, Package, UploadCloud, X } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage, formatRs, storeApi } from '@/lib/storeApi';
import { ErrorBox, Field, Modal, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import VendorPicker from '@/components/store/VendorPicker';
import {
  assetApi,
  dateInput,
  fileUrl,
  previewDepreciation,
  type Asset,
  type AssetCategory,
  type AssetPayload,
  type DepMethod,
} from '../services/assetApi';
import { SearchSelect } from '@/components/ui/SearchSelect';

type EmployeeOption = { _id: string; name: string; employeeCode?: string; designation?: string };

export default function AssetFormModal({
  asset,
  categories,
  defaultCategoryId,
  onClose,
  onSaved,
}: {
  asset: Asset | null;
  categories: AssetCategory[];
  defaultCategoryId?: string;
  onClose: () => void;
  onSaved: (a: Asset) => void;
}) {
  const { can } = useAccess();
  const canSeeEmployees = can('employees', 'view');
  const canSeeVendors = can('vendors', 'view');

  const activeCats = categories.filter((c) => c.isActive || c._id === asset?.category?._id);
  const [f, setF] = useState(() => ({
    name: asset?.name || '',
    category: asset?.category?._id || defaultCategoryId || activeCats[0]?._id || '',
    location: asset?.location || '',
    assignedTo: asset?.assignedTo?._id || '',
    quantity: String(asset?.quantity || 1),
    purchasePrice: asset ? String(asset.purchasePrice) : '',
    purchaseDate: dateInput(asset?.purchaseDate) || new Date().toISOString().slice(0, 10),
    vendor: asset?.vendor || '',
    vendorRef: asset?.vendorRef?._id || null,
    invoiceNo: asset?.invoiceNo || '',
    serialNumber: asset?.serialNumber || '',
    warrantyUntil: dateInput(asset?.warrantyUntil),
    depreciationMethod: (asset?.depreciationMethod || '') as '' | DepMethod,
    usefulLifeYears: asset?.usefulLifeYears != null ? String(asset.usefulLifeYears) : '',
    salvageValue: asset?.salvageValue ? String(asset.salvageValue) : '',
    status: (asset?.status === 'maintenance' ? 'maintenance' : 'active') as 'active' | 'maintenance',
    description: asset?.description || '',
    notes: asset?.notes || '',
  }));
  const [keepPhotos, setKeepPhotos] = useState<string[]>(asset?.photos || []);
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const bind = (k: keyof typeof f) => ({
    value: (f[k] ?? '') as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => set(k, e.target.value as never),
    className: inputClass,
  });

  useEffect(() => {
    if (!canSeeEmployees) return;
    let alive = true;
    storeApi
      .get<EmployeeOption[]>('/employees', { status: 'active,on_leave', limit: 200, sort: 'name' })
      .then((r) => alive && setEmployees(r.data))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [canSeeEmployees]);

  const cat = categories.find((c) => c._id === f.category);
  const method: DepMethod = f.depreciationMethod || cat?.depreciationMethod || 'none';
  const life = f.usefulLifeYears !== '' ? Number(f.usefulLifeYears) : cat?.usefulLifeYears ?? null;
  const qty = Math.max(1, parseInt(f.quantity, 10) || 1);
  const total = (Number(f.purchasePrice) || 0) * qty;
  const preview = useMemo(
    () => previewDepreciation(total, (Number(f.salvageValue) || 0) * qty, life, method, f.purchaseDate),
    [total, f.salvageValue, qty, life, method, f.purchaseDate],
  );

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (lock.current) return;
    if (!f.name.trim()) return setError('Enter the asset name.');
    if (!f.category) return setError('Choose a category.');
    if (f.purchasePrice === '' || Number(f.purchasePrice) < 0) return setError('Enter the purchase price per unit.');
    if (!f.purchaseDate) return setError('Enter the purchase date.');
    if (!Number.isInteger(Number(f.quantity)) || Number(f.quantity) < 1) return setError('Quantity must be a whole number of 1 or more.');
    if ((Number(f.salvageValue) || 0) > (Number(f.purchasePrice) || 0)) return setError('Salvage value cannot be more than the price.');
    lock.current = true;
    setSaving(true);
    setError(null);
    try {
      const body: AssetPayload = {
        name: f.name.trim(),
        category: f.category,
        location: f.location.trim(),
        assignedTo: f.assignedTo || null,
        quantity: qty,
        purchasePrice: Number(f.purchasePrice),
        purchaseDate: f.purchaseDate,
        vendor: f.vendor.trim(),
        vendorRef: f.vendorRef,
        invoiceNo: f.invoiceNo.trim(),
        serialNumber: f.serialNumber.trim(),
        warrantyUntil: f.warrantyUntil || null,
        depreciationMethod: f.depreciationMethod || null,
        usefulLifeYears: f.usefulLifeYears === '' ? null : Number(f.usefulLifeYears),
        salvageValue: Number(f.salvageValue) || 0,
        description: f.description.trim(),
        notes: f.notes.trim(),
        ...(asset ? { photos: keepPhotos } : { status: f.status }),
      };
      let saved = asset ? await assetApi.update(asset._id, body) : await assetApi.create(body);
      if (newPhotos.length) {
        try {
          saved = await assetApi.uploadPhotos(saved._id, newPhotos.slice(0, 5));
        } catch (err) {
          toast.error(`Saved, but the photos did not upload: ${apiErrorMessage(err)}`);
        }
      }
      toast.success(asset ? 'Asset saved' : `Asset added (${saved.assetCode})`);
      onSaved(saved);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save the asset.'));
      lock.current = false;
      setSaving(false);
    }
  };

  return (
    <Modal
      title={asset ? 'Edit asset' : 'Add asset'}
      subtitle={asset?.assetCode || 'Something the shop owns'}
      icon={<Package className="h-5 w-5" />}
      onClose={onClose}
      busy={saving}
      wide
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className={secondaryBtn}>
            Cancel
          </button>
          <button type="button" onClick={() => submit()} disabled={saving} aria-busy={saving} className={primaryBtn}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? 'Saving…' : asset ? 'Save' : 'Add asset'}
          </button>
        </>
      }
    >
      <form onSubmit={submit}>
        <fieldset disabled={saving} className="space-y-4 min-w-0">
          <ErrorBox message={error} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Name" required>
              <input {...bind('name')} placeholder="e.g. Steel rack 6 ft, POS computer, 1.5 ton AC" autoFocus />
            </Field>
            <Field label="Category" required>
              <SearchSelect {...bind('category')}>
                {activeCats.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </SearchSelect>
            </Field>
            <Field label="Location in the shop">
              <input {...bind('location')} placeholder='e.g. "Counter 1", "Rack A1", "Store room"' />
            </Field>
            <Field label="In the care of" hint={canSeeEmployees ? undefined : 'Needs permission to view employees'}>
              <SearchSelect {...bind('assignedTo')} disabled={!canSeeEmployees && !asset?.assignedTo}>
                <option value="">Nobody / shared</option>
                {asset?.assignedTo && !employees.some((e) => e._id === asset.assignedTo?._id) && (
                  <option value={asset.assignedTo._id}>
                    {`${asset.assignedTo.firstName} ${asset.assignedTo.lastName || ''}`.trim()}
                  </option>
                )}
                {employees.map((e) => (
                  <option key={e._id} value={e._id}>
                    {e.name}
                    {e.designation ? ` — ${e.designation}` : ''}
                  </option>
                ))}
              </SearchSelect>
            </Field>
            {!asset && (
              <Field label="Status">
                <SearchSelect {...bind('status')}>
                  <option value="active">In use</option>
                  <option value="maintenance">In maintenance</option>
                </SearchSelect>
              </Field>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 border-t border-gray-100">
            <Field label="Quantity">
              <input type="number" min={1} step={1} inputMode="numeric" {...bind('quantity')} />
            </Field>
            <Field label="Price per unit (Rs)" required>
              <input type="number" min={0} inputMode="decimal" {...bind('purchasePrice')} placeholder="0" />
            </Field>
            <Field label="Purchase date" required>
              <input type="date" {...bind('purchaseDate')} />
            </Field>
            <Field label="Warranty until">
              <input type="date" {...bind('warrantyUntil')} />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Depreciation">
              <SearchSelect {...bind('depreciationMethod')}>
                <option value="">Category default ({cat?.depreciationMethod === 'none' ? 'none' : `straight line, ${cat?.usefulLifeYears ?? '—'} yrs`})</option>
                <option value="straight_line">Straight line</option>
                <option value="none">None (keeps its value)</option>
              </SearchSelect>
            </Field>
            <Field label="Useful life (years)">
              <input type="number" min={0} max={100} step="0.5" {...bind('usefulLifeYears')} placeholder={cat ? String(cat.usefulLifeYears) : ''} disabled={method === 'none'} />
            </Field>
            <Field label="Salvage value per unit (Rs)" hint="Expected resale value at the end">
              <input type="number" min={0} {...bind('salvageValue')} placeholder="0" disabled={method === 'none'} />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-lg bg-honey-50 border border-honey-100 px-3 py-2 text-center">
            <div>
              <p className="text-[10px] uppercase text-gray-500">Total cost</p>
              <p className="text-sm font-semibold tabular-nums">{formatRs(total)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-gray-500">Per month</p>
              <p className="text-sm font-semibold tabular-nums">{method === 'none' ? '—' : formatRs(preview.monthly)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-gray-500">Value today</p>
              <p className="text-sm font-semibold tabular-nums">{formatRs(preview.currentValue)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-gray-100">
            {canSeeVendors && (
              <Field label="Vendor (from your vendor list)">
                <VendorPicker
                  value={f.vendorRef}
                  onChange={(vid, v) => {
                    set('vendorRef', vid);
                    if (v && !f.vendor.trim()) set('vendor', v.name);
                  }}
                  includeInactive
                />
              </Field>
            )}
            <Field label={canSeeVendors ? 'Or vendor / shop name' : 'Vendor / shop name'}>
              <input {...bind('vendor')} placeholder="e.g. Hafeez Furniture, Hall Road" />
            </Field>
            <Field label="Invoice / bill no.">
              <input {...bind('invoiceNo')} />
            </Field>
            <Field label="Serial no.">
              <input {...bind('serialNumber')} className={`${inputClass} font-mono`} />
            </Field>
          </div>

          <Field label="Description">
            <textarea {...bind('description')} rows={2} className={`${inputClass} resize-none`} placeholder="Model, size, colour…" />
          </Field>

          <div>
            <p className="text-xs font-medium text-gray-700 mb-1.5">Photos</p>
            <div className="flex flex-wrap gap-2">
              {keepPhotos.map((p) => (
                <div key={p} className="relative h-16 w-16 rounded-md overflow-hidden border border-gray-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={fileUrl(p)} alt="" className="h-full w-full object-cover" />
                  <button type="button" onClick={() => setKeepPhotos(keepPhotos.filter((x) => x !== p))} className="absolute top-0.5 right-0.5 p-0.5 rounded bg-white/90 text-gray-600 hover:text-red-600" aria-label="Remove photo">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {newPhotos.map((file, i) => (
                <div key={`${file.name}-${i}`} className="relative h-16 w-16 rounded-md border border-dashed border-honey-300 bg-honey-50 flex items-center justify-center text-[10px] text-honey-700 p-1 text-center break-all">
                  {file.name.slice(0, 18)}
                  <button type="button" onClick={() => setNewPhotos(newPhotos.filter((_, j) => j !== i))} className="absolute top-0.5 right-0.5 p-0.5 rounded bg-white/90 text-gray-600 hover:text-red-600" aria-label="Remove photo">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {newPhotos.length < 5 && (
                <label className="h-16 w-16 rounded-md border border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-honey-400 hover:text-honey-700 cursor-pointer text-[10px]">
                  <UploadCloud className="h-4 w-4" /> Add
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      setNewPhotos([...newPhotos, ...Array.from(e.target.files || [])].slice(0, 5));
                      e.target.value = '';
                    }}
                  />
                </label>
              )}
            </div>
          </div>

          <Field label="Notes">
            <textarea {...bind('notes')} rows={2} className={`${inputClass} resize-none`} />
          </Field>
          <button type="submit" className="hidden" />
        </fieldset>
      </form>
    </Modal>
  );
}
