'use client';

// Add / edit vendor. On "add" the opening balance becomes the first ledger row
// (we owe them = payable, they owe us = receivable).

import React, { useRef, useState } from 'react';
import { Truck, Loader2, Check } from 'lucide-react';
import { apiErrorMessage } from '@/helper/access';
import { Modal, Field, Toggle, ErrorBox, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import MoneyInput from '@/components/ui/MoneyInput';
import { vendorApi, pkToday, type Vendor, type VendorDetail, type VendorPayload } from '../services/vendorApi';
import { SearchSelect } from '@/components/ui/SearchSelect';

export default function VendorFormModal({
  vendor,
  onClose,
  onSaved,
}: {
  vendor: Vendor | VendorDetail | null;
  onClose: () => void;
  onSaved: (v: VendorDetail) => void;
}) {
  const editing = !!vendor;
  const [f, setF] = useState({
    name: vendor?.name ?? '',
    code: vendor?.code ?? '',
    phone: vendor?.phone ?? '',
    email: vendor?.email ?? '',
    street: vendor?.address?.street ?? '',
    ntn: vendor?.ntn ?? '',
    categories: (vendor?.categories ?? []).join(', '),
    paymentTermsDays: String(vendor?.paymentTermsDays ?? 0),
    bankName: vendor?.bankDetails?.bankName ?? '',
    accountTitle: vendor?.bankDetails?.accountTitle ?? '',
    accountNumber: vendor?.bankDetails?.accountNumber ?? '',
    iban: vendor?.bankDetails?.iban ?? '',
    notes: vendor?.notes ?? '',
    isConsignment: !!vendor?.isConsignment,
    isActive: vendor?.isActive ?? true,
    openingAmount: '',
    openingSide: 'payable' as 'payable' | 'receivable',
    openingDate: pkToday(),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (lock.current) return;
    if (!f.name.trim()) return setError('Please enter the vendor name.');
    const terms = Number(f.paymentTermsDays || 0);
    if (!Number.isInteger(terms) || terms < 0 || terms > 365) return setError('Payment terms must be 0 to 365 days.');
    const opening = f.openingAmount.trim() ? Number(f.openingAmount) : 0;
    if (!editing && (!Number.isFinite(opening) || opening < 0)) return setError('Opening balance must be a positive amount.');

    const payload: VendorPayload = {
      name: f.name.trim(),
      code: f.code.trim() || undefined,
      // Contact person, WhatsApp, city and CNIC are no longer asked (owner, 2026-10-30); old values stay saved.
      phone: f.phone.trim(),
      email: f.email.trim(),
      address: { street: f.street.trim() },
      ntn: f.ntn.trim(),
      categories: f.categories
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
      paymentTermsDays: terms,
      bankDetails: { bankName: f.bankName.trim(), accountTitle: f.accountTitle.trim(), accountNumber: f.accountNumber.trim(), iban: f.iban.trim() },
      notes: f.notes.trim(),
      isConsignment: f.isConsignment,
      isActive: f.isActive,
    };
    if (!editing && opening > 0) {
      payload.openingBalance = f.openingSide === 'payable' ? opening : -opening;
      payload.openingBalanceDate = f.openingDate;
    }

    lock.current = true;
    setSaving(true);
    setError(null);
    try {
      const saved = editing ? await vendorApi.update(vendor!._id, payload) : await vendorApi.create(payload);
      onSaved(saved);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save the vendor.'));
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  return (
    <Modal
      wide="xl"
      title={editing ? 'Edit Vendor' : 'Add Vendor'}
      subtitle={editing ? vendor!.name : 'Supplier details and opening balance'}
      icon={<Truck className="h-5 w-5" />}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className={secondaryBtn}>
            Cancel
          </button>
          <button type="button" onClick={() => submit()} disabled={saving} aria-busy={saving} className={primaryBtn}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? 'Saving…' : editing ? 'Save' : 'Add Vendor'}
          </button>
        </>
      }
    >
      <form onSubmit={submit}>
        <fieldset disabled={saving} className="min-w-0 space-y-4">
          <ErrorBox message={error} />
          {/* Wide screens: details on the left, money on the right (no scrolling). */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
          <div className="min-w-0 space-y-4 lg:col-span-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Field label="Vendor / company name" required>
                <input value={f.name} onChange={(e) => set('name', e.target.value)} className={inputClass} placeholder="e.g. Shazoor Traders" autoFocus />
              </Field>
            </div>
            <Field label="Code" hint={editing ? undefined : 'Leave empty for automatic (VEN-0001)'}>
              <input value={f.code} onChange={(e) => set('code', e.target.value.toUpperCase())} className={`${inputClass} font-mono uppercase`} placeholder="Auto" maxLength={30} />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Phone">
              <input value={f.phone} onChange={(e) => set('phone', e.target.value)} className={inputClass} placeholder="03xx xxxxxxx" inputMode="tel" />
            </Field>
            <Field label="Email">
              <input value={f.email} onChange={(e) => set('email', e.target.value)} className={inputClass} type="email" />
            </Field>
            <Field label="NTN">
              <input value={f.ntn} onChange={(e) => set('ntn', e.target.value)} className={inputClass} />
            </Field>
          </div>
          <Field label="Address">
            <input value={f.street} onChange={(e) => set('street', e.target.value)} className={inputClass} placeholder="Shop / market address" />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Field label="Categories supplied" hint="Comma separated, e.g. Kitchen, Toys, Crockery">
                <input value={f.categories} onChange={(e) => set('categories', e.target.value)} className={inputClass} />
              </Field>
            </div>
            <Field label="Payment terms (days)" hint="0 = cash on delivery">
              <input value={f.paymentTermsDays} onChange={(e) => set('paymentTermsDays', e.target.value.replace(/[^0-9]/g, ''))} className={inputClass} inputMode="numeric" />
            </Field>
          </div>
          <Field label="Notes">
            <textarea value={f.notes} onChange={(e) => set('notes', e.target.value)} rows={2} className={`${inputClass} resize-none`} />
          </Field>
          </div>

          <div className="min-w-0 space-y-4 lg:col-span-2">
          <div className="rounded-lg border border-gray-200 p-3 space-y-3">
            <p className="text-xs font-semibold text-gray-700">Vendor bank account (for transfers)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Bank">
                <input value={f.bankName} onChange={(e) => set('bankName', e.target.value)} className={inputClass} placeholder="e.g. Meezan Bank" />
              </Field>
              <Field label="Account title">
                <input value={f.accountTitle} onChange={(e) => set('accountTitle', e.target.value)} className={inputClass} />
              </Field>
              <Field label="Account number">
                <input value={f.accountNumber} onChange={(e) => set('accountNumber', e.target.value)} className={inputClass} />
              </Field>
              <Field label="IBAN">
                <input value={f.iban} onChange={(e) => set('iban', e.target.value.toUpperCase())} className={`${inputClass} uppercase`} placeholder="PK.." />
              </Field>
            </div>
          </div>

          {!editing && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-3">
              <p className="text-xs font-semibold text-gray-700">Opening balance (from before this system)</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-2 gap-3">
                <Field label="Amount (Rs)">
                  <MoneyInput value={f.openingAmount} onValue={(v) => set('openingAmount', v)} className={inputClass} placeholder="0" />
                </Field>
                <Field label="Who owes">
                  <SearchSelect value={f.openingSide} onChange={(e) => set('openingSide', e.target.value as 'payable' | 'receivable')} className={inputClass}>
                    <option value="payable">We owe the vendor</option>
                    <option value="receivable">Vendor owes us</option>
                  </SearchSelect>
                </Field>
                <Field label="As of date">
                  <input type="date" value={f.openingDate} max={pkToday()} onChange={(e) => set('openingDate', e.target.value)} className={inputClass} />
                </Field>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
            <Toggle checked={f.isConsignment} onChange={(v) => set('isConsignment', v)} label="Consignment vendor" hint="Places stock on sale-or-return; paid only for what sells." />
            <Toggle checked={f.isActive} onChange={(v) => set('isActive', v)} label="Active" hint="Inactive vendors are hidden from pickers." />
          </div>
          </div>
          </div>
          <button type="submit" className="hidden" />
        </fieldset>
      </form>
    </Modal>
  );
}
