'use client';

import React, { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { procurementService, type Purchase } from '../services/procurementService';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (purchase: Purchase) => void;
  purchase: Purchase | null;
}

export default function PaymentModal({ open, onClose, onSaved, purchase }: Props) {
  const [amount, setAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank' | 'card' | 'cheque' | 'other'>('cash');
  const [paymentDate, setPaymentDate] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && purchase) {
      setAmount(purchase.pendingAmount);
      setPaymentMethod('cash');
      setPaymentDate(new Date().toISOString().slice(0, 10));
      setReference('');
      setNotes('');
    }
  }, [open, purchase]);

  if (!open || !purchase) return null;

  const handleSave = async () => {
    if (!(amount > 0)) { toast.error('Amount must be greater than zero'); return; }
    setSaving(true);
    try {
      const updated = await procurementService.addPayment(purchase._id, {
        amount, paymentMethod, paymentDate, reference: reference.trim(), notes: notes.trim(),
      });
      toast.success('Payment recorded');
      onSaved(updated);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Record Payment</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4 text-gray-500" /></button>
        </div>

        <div className="p-5 space-y-3">
          <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-gray-500">Invoice</span><span className="font-semibold">{purchase.invoiceNumber}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Vendor</span><span className="font-semibold">{purchase.vendorName}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Total</span><span className="font-semibold tabular-nums">{purchase.total.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Paid</span><span className="font-semibold text-emerald-600 tabular-nums">{purchase.paidAmount.toFixed(2)}</span></div>
            <div className="flex justify-between pt-1 mt-1 border-t border-gray-200">
              <span className="text-gray-900 font-semibold">Pending</span>
              <span className="font-bold text-honey-600 tabular-nums">{purchase.pendingAmount.toFixed(2)}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Amount *</label>
            <div className="flex gap-1">
              <input
                type="number"
                step="0.01"
                min="0"
                max={purchase.pendingAmount}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-honey-400 bg-white"
              />
              <button type="button" onClick={() => setAmount(purchase.pendingAmount)} className="px-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">Full</button>
              <button type="button" onClick={() => setAmount(purchase.pendingAmount / 2)} className="px-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">½</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-honey-400 bg-white"
              >
                <option value="cash">Cash</option>
                <option value="bank">Bank Transfer</option>
                <option value="card">Card</option>
                <option value="cheque">Cheque</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-honey-400 bg-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Reference</label>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Cheque #, transaction ID, etc."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-honey-400 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
            Record Payment
          </button>
        </div>
      </div>
    </div>
  );
}
