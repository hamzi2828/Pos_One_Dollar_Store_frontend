'use client';

// Edit a bill from the sales report: fix the payment method, give a discount after the sale, or refund it.
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Pencil, Loader2, Undo2 } from 'lucide-react';
import { Modal, Field, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import MoneyInput from '@/components/ui/MoneyInput';
import { formatRs } from '@/lib/storeApi';
import { changeOrderPaymentMethod, giveOrderDiscount, refundPOSOrder, type BillPayMethod } from '../../pos/services/posOrderService';
import { RefundMethodPicker, type RefundMethod } from '../../pos/components/RefundMethodPicker';

export interface EditableBill {
  _id: string;
  orderNumber: string;
  total: number;
  pendingAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
}

const METHODS: { value: BillPayMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card (POS machine)' },
  { value: 'bank_transfer', label: 'Bank (UBL)' },
  { value: 'jazzcash', label: 'JazzCash' },
];

/** Report method ('bank') -> API method. */
const toApiMethod = (m: string): BillPayMethod | null =>
  m === 'cash'
    ? 'cash'
    : m === 'card'
      ? 'card'
      : m === 'bank' || m === 'bank_transfer'
        ? 'bank_transfer'
        : m === 'jazzcash'
          ? 'jazzcash'
          : null;
const labelOf = (m: string) => METHODS.find((x) => x.value === toApiMethod(m))?.label || m.replace('_', ' ');

export default function EditBillModal({ bill, onClose, onSaved }: { bill: EditableBill; onClose: () => void; onSaved: () => void }) {
  const current = toApiMethod(bill.paymentMethod);
  const closedBill = ['refunded', 'cancelled'].includes(bill.orderStatus) || bill.paymentStatus === 'refunded';
  const [method, setMethod] = useState<BillPayMethod>(current || 'cash');
  const [reason, setReason] = useState('');
  const [amt, setAmt] = useState('');
  const [discReason, setDiscReason] = useState('');
  const [busy, setBusy] = useState<'method' | 'discount' | 'refund' | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [confirmRefund, setConfirmRefund] = useState(false);
  const [refundMethod, setRefundMethod] = useState<RefundMethod>('cash');

  const total = Number(bill.total) || 0;
  const n = Number(amt) || 0;
  const amtOk = n >= 1 && n <= total - 1;
  // Same rule as the server: owed money goes first, the rest is given back.
  const back = Math.max(0, Math.round((n - Math.min(n, Number(bill.pendingAmount) || 0)) * 100) / 100);

  const saveMethod = async () => {
    if (busy || closedBill || method === current) return;
    setBusy('method');
    try {
      await changeOrderPaymentMethod(bill._id, method, reason.trim() || undefined);
      toast.success(`${bill.orderNumber}: now ${labelOf(method)}`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not change the payment method');
    } finally {
      setBusy(null);
    }
  };

  const saveDiscount = async () => {
    if (busy || closedBill || !amtOk) return;
    setBusy('discount');
    try {
      await giveOrderDiscount(bill._id, n, discReason.trim() || undefined);
      toast.success(back > 0 ? `Rs ${n} discount given — give Rs ${back} back to the customer` : `Rs ${n} discount given`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not give the discount');
    } finally {
      setBusy(null);
    }
  };

  // Whole bill back: pieces return to stock, the money is handed back.
  const doRefund = async () => {
    if (busy || closedBill) return;
    setBusy('refund');
    try {
      await refundPOSOrder(bill._id, refundReason.trim() || undefined, refundMethod);
      toast.success(`${bill.orderNumber} refunded — give ${formatRs(Number(bill.total) - (Number(bill.pendingAmount) || 0))} back`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not refund the bill');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal
      title={`Edit bill ${bill.orderNumber}`}
      subtitle={`Total ${formatRs(total)} · ${labelOf(bill.paymentMethod)}`}
      icon={<Pencil className="h-4 w-4" />}
      onClose={onClose}
      busy={!!busy}
      footer={
        <button type="button" className={secondaryBtn} onClick={onClose} disabled={!!busy}>
          Close
        </button>
      }
    >
      <div className="space-y-5">
        {closedBill && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">This bill is refunded / cancelled, so it cannot change.</p>
        )}

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">Payment method</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {METHODS.map((m) => (
              <label
                key={m.value}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                  method === m.value ? 'border-honey-500 bg-honey-50 font-semibold' : 'border-gray-300'
                } ${closedBill ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                <input
                  type="radio"
                  name="payMethod"
                  value={m.value}
                  checked={method === m.value}
                  disabled={closedBill || !!busy}
                  onChange={() => setMethod(m.value)}
                />
                {m.label}
              </label>
            ))}
          </div>
          <Field label="Reason (optional)">
            <input className={inputClass} value={reason} maxLength={200} disabled={closedBill || !!busy} onChange={(e) => setReason(e.target.value)} placeholder="e.g. wrong button pressed" />
          </Field>
          <button type="button" className={primaryBtn} onClick={saveMethod} disabled={closedBill || !!busy || method === current}>
            {busy === 'method' && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </button>
        </section>

        <section className="space-y-3 border-t border-gray-200 pt-4">
          <h3 className="text-sm font-semibold text-gray-900">Discount</h3>
          <Field label="Amount (Rs)">
            <MoneyInput className={inputClass} value={amt} onValue={setAmt} disabled={closedBill || !!busy} placeholder={`1 to ${Math.max(0, total - 1)}`} />
          </Field>
          <Field label="Reason (optional)">
            <input className={inputClass} value={discReason} maxLength={200} disabled={closedBill || !!busy} onChange={(e) => setDiscReason(e.target.value)} />
          </Field>
          {n > 0 &&
            (amtOk ? (
              <p className="text-xs text-gray-600">
                {back > 0 ? `The customer gets Rs ${back} back (${labelOf(bill.paymentMethod)}).` : 'Taken off the money still owed; nothing to give back.'}
              </p>
            ) : (
              <p className="text-xs text-red-600">Enter a discount between 1 and {Math.max(0, total - 1)}.</p>
            ))}
          <button type="button" className={primaryBtn} onClick={saveDiscount} disabled={closedBill || !!busy || !amtOk}>
            {busy === 'discount' && <Loader2 className="h-4 w-4 animate-spin" />}
            Give discount
          </button>
        </section>

        <section className="space-y-3 border-t border-gray-200 pt-4">
          <h3 className="text-sm font-semibold text-gray-900">Refund</h3>
          <p className="text-xs text-gray-600">
            The whole bill is refunded: all pieces go back into stock and the customer gets {formatRs(total - (Number(bill.pendingAmount) || 0))} back.
          </p>
          <RefundMethodPicker value={refundMethod} onChange={setRefundMethod} disabled={closedBill || !!busy} />
          <Field label="Reason (optional)">
            <input className={inputClass} value={refundReason} maxLength={300} disabled={closedBill || !!busy} onChange={(e) => setRefundReason(e.target.value)} placeholder="e.g. customer returned the items" />
          </Field>
          {!confirmRefund ? (
            <button
              type="button"
              onClick={() => setConfirmRefund(true)}
              disabled={closedBill || !!busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              <Undo2 className="h-4 w-4" /> Refund bill
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-red-50 px-3 py-2">
              <span className="text-sm text-red-800">Refund {bill.orderNumber}? This cannot be undone.</span>
              <button
                type="button"
                onClick={doRefund}
                disabled={!!busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {busy === 'refund' && <Loader2 className="h-4 w-4 animate-spin" />}
                Yes, refund
              </button>
              <button type="button" onClick={() => setConfirmRefund(false)} disabled={!!busy} className="text-sm text-gray-600 underline">
                No
              </button>
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
}
