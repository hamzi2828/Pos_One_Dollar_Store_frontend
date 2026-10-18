'use client';

// Manual ledger correction: credit (we owe the vendor more) or debit (we owe less), with a reason.

import React, { useRef, useState } from 'react';
import { Scale, Loader2, Check } from 'lucide-react';
import { apiErrorMessage } from '@/helper/access';
import { Modal, Field, ErrorBox, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { vendorApi, pkToday } from '../services/vendorApi';
import { BalanceText } from './ui';

export default function AdjustmentModal({
  vendorId,
  vendorName,
  balance,
  onClose,
  onSaved,
}: {
  vendorId: string;
  vendorName: string;
  balance: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [direction, setDirection] = useState<'credit' | 'debit'>('debit');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(pkToday());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const value = Number(amount) || 0;

  const submit = async () => {
    if (lock.current) return;
    if (!(value > 0)) return setError('Enter the amount.');
    if (reason.trim().length < 3) return setError('Write the reason (the vendor may ask).');
    lock.current = true;
    setSaving(true);
    setError(null);
    try {
      await vendorApi.adjust(vendorId, { direction, amount: value, reason: reason.trim(), date });
      onSaved();
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not post the adjustment.'));
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Ledger adjustment"
      subtitle={vendorName}
      icon={<Scale className="h-5 w-5" />}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className={secondaryBtn}>
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={saving} aria-busy={saving} className={primaryBtn}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Post adjustment
          </button>
        </>
      }
    >
      <fieldset disabled={saving} className="min-w-0 space-y-4">
        <ErrorBox message={error} />
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { v: 'debit', t: 'We owe less', d: 'Discount, claim, correction down' },
              { v: 'credit', t: 'We owe more', d: 'Missed bill, extra charge' },
            ] as const
          ).map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => setDirection(o.v)}
              className={`text-left p-3 rounded-lg border transition-colors ${direction === o.v ? 'border-honey-500 bg-honey-50' : 'border-gray-200 hover:bg-gray-50'}`}
            >
              <p className="text-sm font-semibold text-gray-900">{o.t}</p>
              <p className="text-[11px] text-gray-500">{o.d}</p>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Amount (Rs)" required>
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} className={inputClass} inputMode="decimal" autoFocus />
          </Field>
          <Field label="Date">
            <input type="date" value={date} max={pkToday()} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </Field>
        </div>
        <Field label="Reason" required>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className={`${inputClass} resize-none`} placeholder="e.g. Vendor gave Rs 500 discount on old bill" />
        </Field>
        <div className="flex items-center justify-between text-xs bg-gray-50 border border-gray-200 rounded-lg p-2.5">
          <span className="text-gray-500">
            Now <BalanceText amount={balance} />
          </span>
          <span className="text-gray-500">
            After <BalanceText amount={direction === 'credit' ? balance + value : balance - value} />
          </span>
        </div>
      </fieldset>
    </Modal>
  );
}
