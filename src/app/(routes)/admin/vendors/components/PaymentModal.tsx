'use client';

// Record a vendor payment (cash / bank / cheque / Easypaisa / JazzCash) with
// optional receipt photos. Shows the vendor's current balance first.

import React, { useEffect, useRef, useState } from 'react';
import { HandCoins, Loader2, Check, ImagePlus, X } from 'lucide-react';
import { apiErrorMessage } from '@/helper/access';
import { formatRs } from '@/lib/storeApi';
import VendorPicker, { type VendorPickerOption } from '@/components/store/VendorPicker';
import { Modal, Field, ErrorBox, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { vendorApi, pkToday, PAYMENT_METHODS, type BankOption, type PaymentMethod, type VendorPayment } from '../services/vendorApi';
import { BalanceText } from './ui';

export default function PaymentModal({
  vendorId: initialVendorId = null,
  lockVendor = false,
  onClose,
  onSaved,
}: {
  vendorId?: string | null;
  lockVendor?: boolean;
  onClose: () => void;
  onSaved: (p: VendorPayment) => void;
}) {
  const [vendorId, setVendorId] = useState<string | null>(initialVendorId);
  const [vendor, setVendor] = useState<VendorPickerOption | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [bankId, setBankId] = useState('');
  const [reference, setReference] = useState('');
  const [date, setDate] = useState(pkToday());
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  useEffect(() => {
    vendorApi
      .banks()
      .then(setBanks)
      .catch(() => setBanks([]));
  }, []);

  const balance = vendor?.balance ?? 0;
  const value = Number(amount);
  const after = Number.isFinite(value) ? balance - value : balance;

  const addPhotos = (list: FileList | null) => {
    if (!list) return;
    const next = [...photos, ...Array.from(list)].slice(0, 5);
    setPhotos(next);
  };

  const submit = async () => {
    if (lock.current) return;
    if (!vendorId) return setError('Choose the vendor.');
    if (!Number.isFinite(value) || value <= 0) return setError('Enter the amount paid.');
    if (method === 'cheque' && !reference.trim()) return setError('Enter the cheque number.');
    lock.current = true;
    setSaving(true);
    setError(null);
    try {
      const p = await vendorApi.recordPayment({
        vendorId,
        amount: value,
        method,
        bankId: method === 'bank' || method === 'cheque' ? bankId || null : null,
        reference: reference.trim(),
        date,
        notes: notes.trim(),
        photos,
      });
      onSaved(p);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not record the payment.'));
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  const refLabel =
    method === 'cheque' ? 'Cheque number' : method === 'bank' ? 'Transaction / IBFT ref' : method === 'cash' ? 'Receipt no. (optional)' : 'Transaction ID';

  return (
    <Modal
      title="Record Vendor Payment"
      subtitle="Money paid to a vendor"
      icon={<HandCoins className="h-5 w-5" />}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className={secondaryBtn}>
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={saving} aria-busy={saving} className={primaryBtn}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? 'Saving…' : 'Record payment'}
          </button>
        </>
      }
    >
      <fieldset disabled={saving} className="min-w-0 space-y-4">
        <ErrorBox message={error} />
        <Field label="Vendor" required>
          <VendorPicker
            value={vendorId}
            disabled={lockVendor}
            includeInactive
            onResolved={setVendor}
            onChange={(id, v) => {
              setVendorId(id);
              setVendor(v);
            }}
          />
        </Field>
        {vendor && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-2.5">
              <p className="text-gray-500">Current balance</p>
              <BalanceText amount={balance} className="text-sm" />
            </div>
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-2.5">
              <p className="text-gray-500">After this payment</p>
              <BalanceText amount={after} className="text-sm" />
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Amount (Rs)" required>
            <div className="flex gap-2">
              <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} className={inputClass} inputMode="decimal" placeholder="0" />
              {balance > 0 && (
                <button type="button" onClick={() => setAmount(String(balance))} className={`${secondaryBtn} !px-2 text-xs whitespace-nowrap`} title="Pay the full balance">
                  Full {formatRs(balance)}
                </button>
              )}
            </div>
          </Field>
          <Field label="Date" required>
            <input type="date" value={date} max={pkToday()} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </Field>
        </div>
        <Field label="Paid by" required>
          <div className="flex flex-wrap gap-1.5">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMethod(m.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  method === m.value ? 'bg-honey-500 text-gray-900 border-honey-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(method === 'bank' || method === 'cheque') && (
            <Field label="From our bank account">
              <select value={bankId} onChange={(e) => setBankId(e.target.value)} className={inputClass}>
                <option value="">— Not set —</option>
                {banks.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name} · {b.accountTitle} ({b.accountNumber.slice(-4)})
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label={refLabel} required={method === 'cheque'}>
            <input value={reference} onChange={(e) => setReference(e.target.value)} className={inputClass} maxLength={100} />
          </Field>
        </div>
        <Field label="Notes">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${inputClass} resize-none`} placeholder="e.g. Payment for bill of 12 Oct" />
        </Field>
        <Field label="Receipt photos" hint="Up to 5 images (optional)">
          <div className="flex flex-wrap items-center gap-2">
            {photos.map((p, i) => (
              <span key={`${p.name}-${i}`} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-gray-100 rounded">
                <span className="max-w-[120px] truncate">{p.name}</span>
                <button type="button" onClick={() => setPhotos(photos.filter((_, j) => j !== i))} aria-label="Remove photo" className="text-gray-400 hover:text-gray-700">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {photos.length < 5 && (
              <label className={`${secondaryBtn} cursor-pointer !py-1.5 text-xs`}>
                <ImagePlus className="h-4 w-4" /> Add photo
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addPhotos(e.target.files)} />
              </label>
            )}
          </div>
        </Field>
      </fieldset>
    </Modal>
  );
}
