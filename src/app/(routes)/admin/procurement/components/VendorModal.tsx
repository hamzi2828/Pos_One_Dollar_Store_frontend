'use client';

import React, { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { procurementService, type Vendor } from '../services/procurementService';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (vendor: Vendor) => void;
  vendor?: Vendor | null;
}

const empty: Partial<Vendor> = {
  name: '', contactPerson: '', email: '', phone: '', category: '', notes: '',
  address: { street: '', city: '', state: '', country: '', postalCode: '' }, isActive: true,
};

export default function VendorModal({ open, onClose, onSaved, vendor }: Props) {
  const [form, setForm] = useState<Partial<Vendor>>(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(vendor ? { ...vendor, address: vendor.address || empty.address } : { ...empty });
    }
  }, [open, vendor]);

  if (!open) return null;

  const handleSave = async () => {
    if (!form.name || !form.name.trim()) {
      toast.error('Vendor name is required');
      return;
    }
    setSaving(true);
    try {
      const saved = vendor
        ? await procurementService.updateVendor(vendor._id, form)
        : await procurementService.createVendor(form);
      toast.success(vendor ? 'Vendor updated' : 'Vendor created');
      onSaved(saved);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save vendor');
    } finally {
      setSaving(false);
    }
  };

  const update = (patch: Partial<Vendor>) => setForm((prev) => ({ ...prev, ...patch }));
  const updateAddr = (patch: Record<string, string>) =>
    setForm((prev) => ({ ...prev, address: { ...(prev.address || {}), ...patch } }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">{vendor ? 'Edit Vendor' : 'Add Vendor'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4 text-gray-500" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Name *" value={form.name || ''} onChange={(v) => update({ name: v })} />
            <Input label="Contact Person" value={form.contactPerson || ''} onChange={(v) => update({ contactPerson: v })} />
            <Input label="Email" type="email" value={form.email || ''} onChange={(v) => update({ email: v })} />
            <Input label="Phone" value={form.phone || ''} onChange={(v) => update({ phone: v })} />
            <Input label="Category" value={form.category || ''} onChange={(v) => update({ category: v })} placeholder="e.g. Parts, Oils" />
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select
                value={form.isActive ? 'active' : 'inactive'}
                onChange={(e) => update({ isActive: e.target.value === 'active' })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-honey-400 bg-white"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Address</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Street" value={form.address?.street || ''} onChange={(v) => updateAddr({ street: v })} />
              <Input label="City" value={form.address?.city || ''} onChange={(v) => updateAddr({ city: v })} />
              <Input label="State/Province" value={form.address?.state || ''} onChange={(v) => updateAddr({ state: v })} />
              <Input label="Country" value={form.address?.country || ''} onChange={(v) => updateAddr({ country: v })} />
              <Input label="Postal Code" value={form.address?.postalCode || ''} onChange={(v) => updateAddr({ postalCode: v })} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea
              value={form.notes || ''}
              onChange={(e) => update({ notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-honey-400 resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-white">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-honey-500 text-white text-sm font-semibold rounded-lg hover:bg-honey-600 disabled:opacity-60"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {vendor ? 'Save Changes' : 'Create Vendor'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-honey-400 bg-white"
      />
    </div>
  );
}
