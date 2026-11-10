'use client';

// Edit a vendor payment: amount, method, bank, reference, date, notes, photos.
// The server keeps every change in the payment's history (old -> new).

import React, { useEffect, useRef, useState } from 'react';
import CounterSelect from '../../expenses/components/CounterSelect';
import { Pencil, Loader2, Check, ImagePlus, X, History } from 'lucide-react';
import { apiErrorMessage } from '@/helper/access';
import { formatRs, formatDate } from '@/lib/storeApi';
import { Modal, Field, ErrorBox, inputClass, primaryBtn, secondaryBtn, LoadingCard } from '@/components/admin/FormBits';
import MoneyInput from '@/components/ui/MoneyInput';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { vendorApi, pkToday, PAYMENT_METHODS, type BankOption, type PaymentMethod, type VendorPayment } from '../services/vendorApi';
import { fileUrl } from './ReceiptThumbs';

const dayOf = (d: string) => {
  try {
    return new Date(new Date(d).getTime() + 5 * 3600 * 1000).toISOString().slice(0, 10);
  } catch {
    return pkToday();
  }
};

export default function EditPaymentModal({ paymentId, onClose, onSaved }: { paymentId: string; onClose: () => void; onSaved: (p: VendorPayment) => void }) {
  const [p, setP] = useState<VendorPayment | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [bankId, setBankId] = useState('');
  const [counterId, setCounterId] = useState('');
  const [reference, setReference] = useState('');
  const [date, setDate] = useState(pkToday());
  const [notes, setNotes] = useState('');
  const [remove, setRemove] = useState<string[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [reason, setReason] = useState('');
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  useEffect(() => {
    vendorApi.banks().then(setBanks).catch(() => setBanks([]));
    vendorApi
      .getPayment(paymentId)
      .then((x) => {
        setP(x);
        setAmount(String(x.amount));
        setMethod(x.method);
        setBankId(x.bank || '');
        setCounterId(x.counter || '');
        setReference(x.reference || '');
        setDate(dayOf(x.date));
        setNotes(x.notes || '');
      })
      .catch((e) => setError(apiErrorMessage(e, 'Could not load the payment.')));
  }, [paymentId]);

  const save = async () => {
    if (lock.current || !p) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return setError('Enter the amount paid.');
    if (method === 'cheque' && !reference.trim()) return setError('Enter the cheque number.');
    lock.current = true;
    setSaving(true);
    setError(null);
    try {
      const out = await vendorApi.updatePayment(p._id, {
        amount: value,
        method,
        bankId: method === 'bank' || method === 'cheque' ? bankId || '' : '',
        counter: method === 'cash' ? counterId : '',
        reference: reference.trim(),
        date,
        notes: notes.trim(),
        reason: reason.trim(),
        removeAttachments: remove,
        photos,
      });
      onSaved(out);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not update the payment.'));
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  const kept = (p?.attachments || []).filter((a) => !remove.includes(a));

  return (
    <Modal
      title={`Edit payment ${p?.paymentNo || ''}`}
      subtitle={p ? `${p.vendorName} · was ${formatRs(p.amount)}` : 'Loading…'}
      icon={<Pencil className="h-5 w-5" />}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className={secondaryBtn}>
            Cancel
          </button>
          <button type="button" onClick={save} disabled={saving || !p} className={primaryBtn}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </>
      }
    >
      {!p ? (
        error ? <ErrorBox message={error} /> : <LoadingCard text="Loading payment…" />
      ) : (
        <fieldset disabled={saving} className="min-w-0 space-y-4">
          <ErrorBox message={error} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Amount (Rs)" required>
              <MoneyInput value={amount} onValue={setAmount} className={inputClass} />
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
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border ${method === m.value ? 'bg-honey-500 text-gray-900 border-honey-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {method === 'cash' && <CounterSelect value={counterId} onChange={setCounterId} disabled={saving} savedName={p?.counterName} />}
            {(method === 'bank' || method === 'cheque') && (
              <Field label="From our bank account">
                <SearchSelect value={bankId} onChange={(e) => setBankId(e.target.value)} className={inputClass}>
                  <option value="">— Not set —</option>
                  {banks.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name} · {b.accountTitle} ({b.accountNumber.slice(-4)})
                    </option>
                  ))}
                </SearchSelect>
              </Field>
            )}
            <Field label={method === 'cheque' ? 'Cheque number' : 'Reference / transaction ID'} required={method === 'cheque'}>
              <input value={reference} onChange={(e) => setReference(e.target.value)} className={inputClass} maxLength={100} />
            </Field>
          </div>
          <Field label="Notes">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${inputClass} resize-none`} />
          </Field>
          <Field label="Receipt photos" hint="Click × to remove a photo; add new ones (up to 5 at a time)">
            <div className="flex flex-wrap items-center gap-2">
              {kept.map((a) => (
                <span key={a} className="relative block h-16 w-16 overflow-hidden rounded border border-gray-200">
                  <a href={fileUrl(a)} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={fileUrl(a)} alt="Receipt" className="h-full w-full object-cover" />
                  </a>
                  <button type="button" onClick={() => setRemove((r) => [...r, a])} className="absolute right-0.5 top-0.5 rounded-full bg-white/90 p-0.5 text-gray-600 hover:text-red-600" aria-label="Remove photo">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {photos.map((f, i) => (
                <span key={`${f.name}-${i}`} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-honey-50 rounded">
                  <span className="max-w-[120px] truncate">{f.name}</span>
                  <button type="button" onClick={() => setPhotos(photos.filter((_, j) => j !== i))} aria-label="Remove" className="text-gray-400 hover:text-gray-700">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {photos.length < 5 && (
                <label className={`${secondaryBtn} cursor-pointer !py-1.5 text-xs`}>
                  <ImagePlus className="h-4 w-4" /> Add photo
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && setPhotos([...photos, ...Array.from(e.target.files)].slice(0, 5))} />
                </label>
              )}
            </div>
          </Field>
          <Field label="Why are you changing it?" hint="Saved in the history">
            <input value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} maxLength={300} placeholder="e.g. Amount typed wrong" />
          </Field>
          {(p.history || []).length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                <History className="h-3.5 w-3.5" /> History
              </p>
              <ul className="space-y-1 text-[11px] text-gray-600">
                {[...(p.history || [])].reverse().map((h, i) => (
                  <li key={i}>
                    <span className="font-medium text-gray-800">{formatDate(h.at, true)}</span> · <span className="capitalize">{h.action}</span>
                    {h.note ? ` · ${h.note}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </fieldset>
      )}
    </Modal>
  );
}
