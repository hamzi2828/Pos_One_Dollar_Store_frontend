'use client';

// Edit a bill after the sale (sales report, POS orders, cashier "Find a bill"):
//   Payment  — fix the method or split it across cash / card / bank / JazzCash
//   Refund   — full refund (stock back) or part refund (money only)
//   Discount — discount after the sale (admins only: allowDiscount)
//   History  — every change ever made to the bill, before -> after (order.editLog)
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Pencil,
  Loader2,
  Undo2,
  X,
  Banknote,
  CreditCard,
  Landmark,
  Smartphone,
  Split,
  Percent,
  History,
  ArrowRight,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { Field, inputClass } from '@/components/admin/FormBits';
import MoneyInput from '@/components/ui/MoneyInput';
import { formatRs } from '@/lib/storeApi';
import {
  changeOrderPaymentMethod,
  giveOrderDiscount,
  refundPOSOrder,
  getRefundInfo,
  partialRefundPOSOrder,
  getOrderEditLog,
  type BillPayMethod,
  type RefundInfo,
  type BillEditEntry,
  type BillSnapshot,
} from '../../pos/services/posOrderService';
import { RefundMethodPicker, type RefundMethod } from '../../pos/components/RefundMethodPicker';

export interface EditableBill {
  _id: string;
  orderNumber: string;
  total: number;
  pendingAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  /** Optional, shown in the header. */
  customerName?: string;
  createdAt?: string;
}

const METHODS: { value: BillPayMethod; label: string; icon: React.ReactNode }[] = [
  { value: 'cash', label: 'Cash', icon: <Banknote className="h-4 w-4" /> },
  { value: 'card', label: 'Card', icon: <CreditCard className="h-4 w-4" /> },
  { value: 'bank_transfer', label: 'Bank (UBL)', icon: <Landmark className="h-4 w-4" /> },
  { value: 'jazzcash', label: 'JazzCash', icon: <Smartphone className="h-4 w-4" /> },
  { value: 'split', label: 'Split', icon: <Split className="h-4 w-4" /> },
];
type PartMethod = 'cash' | 'card' | 'bank_transfer' | 'jazzcash';
const PART_ROWS: { method: PartMethod; label: string; icon: React.ReactNode }[] = [
  { method: 'cash', label: 'Cash', icon: <Banknote className="h-4 w-4" /> },
  { method: 'card', label: 'Card', icon: <CreditCard className="h-4 w-4" /> },
  { method: 'bank_transfer', label: 'Bank (UBL)', icon: <Landmark className="h-4 w-4" /> },
  { method: 'jazzcash', label: 'JazzCash', icon: <Smartphone className="h-4 w-4" /> },
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
          : m === 'split'
            ? 'split'
            : null;
const labelOf = (m: string) => METHODS.find((x) => x.value === toApiMethod(m))?.label || String(m || '').replace('_', ' ');

export type Tab = 'payment' | 'refund' | 'discount' | 'history';

const ACTION_META: Record<BillEditEntry['action'], { label: string; cls: string }> = {
  payment_method: { label: 'Payment changed', cls: 'bg-sky-50 text-sky-700 ring-sky-200' },
  refund: { label: 'Full refund', cls: 'bg-red-50 text-red-700 ring-red-200' },
  partial_refund: { label: 'Part refund', cls: 'bg-amber-50 text-amber-800 ring-amber-200' },
  discount: { label: 'Discount', cls: 'bg-violet-50 text-violet-700 ring-violet-200' },
};

const paysText = (s: BillSnapshot | null) => {
  if (!s) return '—';
  if (s.payments?.length) return s.payments.map((p) => `${labelOf(p.method)} ${formatRs(p.amount)}`).join(' + ');
  return labelOf(s.paymentMethod);
};

export default function EditBillModal({
  bill,
  onClose,
  onSaved,
  allowDiscount = true,
  initialTab,
}: {
  bill: EditableBill;
  onClose: () => void;
  onSaved: () => void;
  /** false = cashier (no discount after the sale). */
  allowDiscount?: boolean;
  initialTab?: Tab;
}) {
  const current = toApiMethod(bill.paymentMethod);
  const closedBill = ['refunded', 'cancelled'].includes(bill.orderStatus) || bill.paymentStatus === 'refunded';
  const [tab, setTab] = useState<Tab>(closedBill ? 'history' : initialTab || 'payment');
  const [method, setMethod] = useState<BillPayMethod>(current || 'cash');
  const [reason, setReason] = useState('');
  const [amt, setAmt] = useState('');
  const [discReason, setDiscReason] = useState('');
  const [busy, setBusy] = useState<'method' | 'discount' | 'refund' | 'part' | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [confirmRefund, setConfirmRefund] = useState(false);
  const [refundMethod, setRefundMethod] = useState<RefundMethod>('cash');
  // Split: what each method paid (must add up to what was paid on the bill).
  const paidOnBill = Math.round((Number(bill.total) - (Number(bill.pendingAmount) || 0)) * 100) / 100;
  const [parts, setParts] = useState<Record<PartMethod, string>>({ cash: '', card: '', bank_transfer: '', jazzcash: '' });
  const partList = PART_ROWS.map((r) => ({ method: r.method, amount: Math.round((Number(parts[r.method]) || 0) * 100) / 100 })).filter((p) => p.amount > 0);
  const partSum = Math.round(partList.reduce((t, p) => t + p.amount, 0) * 100) / 100;
  const splitOk = partList.length > 0 && Math.abs(partSum - paidOnBill) < 0.01;
  const restInto = (m: PartMethod) => {
    const others = partList.filter((p) => p.method !== m).reduce((t, p) => t + p.amount, 0);
    setParts((prev) => ({ ...prev, [m]: String(Math.max(0, Math.round((paidOnBill - others) * 100) / 100)) }));
  };
  // Part refund (money only, a Refund expense on the bill; stock stays).
  const [refundMode, setRefundMode] = useState<'full' | 'part'>('full');
  const [partAmt, setPartAmt] = useState('');
  const [refundInfo, setRefundInfo] = useState<RefundInfo | null>(null);
  const [log, setLog] = useState<BillEditEntry[] | null>(null);
  useEffect(() => {
    let alive = true;
    getRefundInfo(bill._id)
      .then((d) => {
        if (!alive) return;
        setRefundInfo(d);
        if (d.refunded > 0) setRefundMode('part');
      })
      .catch(() => {});
    getOrderEditLog(bill._id)
      .then((d) => alive && setLog(d))
      .catch(() => alive && setLog([]));
    return () => {
      alive = false;
    };
  }, [bill._id]);
  const partTaken = !!refundInfo && refundInfo.refunded > 0;
  const partN = Number(partAmt) || 0;
  const partTooMuch = !!refundInfo && partN - refundInfo.refundable > 0.009;

  const total = Number(bill.total) || 0;
  const n = Number(amt) || 0;
  const amtOk = n >= 1 && n <= total - 1;
  // Same rule as the server: owed money goes first, the rest is given back.
  const back = Math.max(0, Math.round((n - Math.min(n, Number(bill.pendingAmount) || 0)) * 100) / 100);
  const reasonLooksLikeAmount = refundMode === 'full' && /^\s*\d+(\.\d+)?\s*$/.test(refundReason);

  const done = (msg: string) => {
    toast.success(msg);
    onSaved();
    onClose();
  };

  const saveMethod = async () => {
    if (busy || closedBill || (method === current && method !== 'split') || (method === 'split' && !splitOk)) return;
    setBusy('method');
    try {
      await changeOrderPaymentMethod(bill._id, method, reason.trim() || undefined, method === 'split' ? partList : undefined);
      done(
        method === 'split'
          ? `${bill.orderNumber}: split ${partList.map((p) => `${PART_ROWS.find((r) => r.method === p.method)?.label} ${formatRs(p.amount)}`).join(' + ')}`
          : `${bill.orderNumber}: now ${labelOf(method)}`
      );
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
      done(back > 0 ? `Rs ${n} discount given — give Rs ${back} back to the customer` : `Rs ${n} discount given`);
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
      done(`${bill.orderNumber} refunded — give ${formatRs(paidOnBill)} back`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not refund the bill');
    } finally {
      setBusy(null);
    }
  };

  const doPartRefund = async () => {
    if (busy || closedBill || !(partN > 0) || partTooMuch) return;
    setBusy('part');
    try {
      await partialRefundPOSOrder(bill._id, partN, refundReason.trim() || undefined, refundMethod);
      done(`${formatRs(partN)} refunded on ${bill.orderNumber} (saved as a Refund expense)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the part refund');
    } finally {
      setBusy(null);
    }
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: 'payment', label: 'Payment', icon: <CreditCard className="h-4 w-4" /> },
    { key: 'refund', label: 'Refund', icon: <Undo2 className="h-4 w-4" /> },
    ...(allowDiscount ? [{ key: 'discount' as Tab, label: 'Discount', icon: <Percent className="h-4 w-4" /> }] : []),
    { key: 'history', label: 'History', icon: <History className="h-4 w-4" />, badge: log?.length || 0 },
  ];

  // Footer action of the open tab.
  const methodDisabled = closedBill || !!busy || (method === current && method !== 'split') || (method === 'split' && !splitOk);
  let action: React.ReactNode = null;
  if (tab === 'payment') {
    action = (
      <button type="button" onClick={saveMethod} disabled={methodDisabled} className={btnPrimary}>
        {busy === 'method' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        Save payment
      </button>
    );
  } else if (tab === 'discount') {
    action = (
      <button type="button" onClick={saveDiscount} disabled={closedBill || !!busy || !amtOk} className={btnPrimary}>
        {busy === 'discount' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Percent className="h-4 w-4" />}
        Give discount
      </button>
    );
  } else if (tab === 'refund') {
    if (refundMode === 'part') {
      action = (
        <button
          type="button"
          onClick={doPartRefund}
          disabled={closedBill || !!busy || !(partN > 0) || partTooMuch || !refundInfo}
          className={btnAmber}
        >
          {busy === 'part' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
          Refund {partN > 0 ? formatRs(partN) : ''}
        </button>
      );
    } else if (confirmRefund) {
      action = (
        <>
          <button type="button" onClick={() => setConfirmRefund(false)} disabled={!!busy} className={btnGhost}>
            No
          </button>
          <button type="button" onClick={doRefund} disabled={!!busy} className={btnDanger}>
            {busy === 'refund' && <Loader2 className="h-4 w-4 animate-spin" />}
            Yes, refund {formatRs(paidOnBill)}
          </button>
        </>
      );
    } else {
      action = (
        <button
          type="button"
          onClick={() => setConfirmRefund(true)}
          disabled={closedBill || !!busy || partTaken || reasonLooksLikeAmount}
          className={btnDanger}
        >
          <Undo2 className="h-4 w-4" /> Refund whole bill
        </button>
      );
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-3 sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="border-b border-gray-200 bg-gradient-to-b from-honey-50/70 to-white px-5 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-honey-500 text-gray-900 shadow-sm">
                <Pencil className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Edit bill</p>
                <h2 className="truncate font-mono text-base font-semibold text-gray-900 sm:text-lg" title={bill.orderNumber}>
                  {bill.orderNumber}
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={!!busy}
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Bill facts */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Stat label="Total" value={formatRs(total)} strong />
            <Stat label="Paid by" value={labelOf(bill.paymentMethod)} />
            <Stat
              label="Status"
              value={closedBill ? 'Refunded' : (refundInfo?.refunded || 0) > 0 ? 'Part refunded' : Number(bill.pendingAmount) > 0 ? 'Pending' : 'Paid'}
              tone={closedBill ? 'red' : (refundInfo?.refunded || 0) > 0 ? 'amber' : Number(bill.pendingAmount) > 0 ? 'amber' : 'green'}
            />
          </div>
          {(bill.customerName || bill.createdAt) && (
            <p className="mt-2 truncate text-xs text-gray-500">
              {bill.customerName || 'Walk-in'}
              {bill.createdAt ? ` · ${new Date(bill.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}` : ''}
            </p>
          )}

          {/* Tabs */}
          <div
            className="my-4 grid gap-1 rounded-xl border border-gray-200 bg-gray-100 p-1"
            style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
            role="tablist"
          >
            {tabs.map((t) => {
              const on = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => {
                    setTab(t.key);
                    setConfirmRefund(false);
                  }}
                  disabled={!!busy}
                  className={`flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-sm font-bold transition-all ${
                    on ? 'bg-gray-900 text-white shadow-md' : 'text-gray-700 hover:bg-white hover:text-gray-900'
                  }`}
                >
                  <span className={on ? 'text-honey-400' : 'text-gray-500'}>{t.icon}</span>
                  <span className="truncate">{t.label}</span>
                  {!!t.badge && (
                    <span
                      className={`rounded-full px-1.5 text-[10px] font-bold leading-4 ${on ? 'bg-honey-500 text-gray-900' : 'bg-gray-300 text-gray-800'}`}
                    >
                      {t.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {closedBill && tab !== 'history' && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" /> This bill is refunded / cancelled, so it cannot change.
            </div>
          )}

          {tab === 'payment' && (
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-medium text-gray-700">How was this bill paid?</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {METHODS.map((m) => {
                    const on = method === m.value;
                    return (
                      <button
                        key={m.value}
                        type="button"
                        disabled={closedBill || !!busy}
                        onClick={() => setMethod(m.value)}
                        className={`relative flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs font-semibold transition-colors disabled:opacity-50 ${
                          on ? 'border-honey-500 bg-honey-50 text-gray-900 ring-1 ring-honey-500' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {m.icon}
                        {m.label}
                        {current === m.value && (
                          <span className="absolute -top-2 rounded-full bg-gray-800 px-1.5 text-[9px] font-bold uppercase leading-4 text-white">Now</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {method === 'split' && (
                <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs text-gray-600">
                    Enter what each method paid. Together it must be <b>{formatRs(paidOnBill)}</b>.
                  </p>
                  {PART_ROWS.map((r) => (
                    <div key={r.method} className="flex items-center gap-2">
                      <span className="flex w-28 flex-shrink-0 items-center gap-1.5 text-sm font-medium text-gray-700">
                        <span className="text-gray-400">{r.icon}</span>
                        {r.label}
                      </span>
                      <MoneyInput
                        className={inputClass}
                        value={parts[r.method]}
                        onValue={(val) => setParts((prev) => ({ ...prev, [r.method]: val }))}
                        disabled={closedBill || !!busy}
                        placeholder="0"
                      />
                      <button
                        type="button"
                        onClick={() => restInto(r.method)}
                        disabled={closedBill || !!busy}
                        className="flex-shrink-0 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                      >
                        Rest
                      </button>
                    </div>
                  ))}
                  <div className="h-1.5 overflow-hidden rounded-full bg-gray-200">
                    <div
                      className={`h-full transition-all ${splitOk ? 'bg-green-500' : partSum > paidOnBill ? 'bg-red-500' : 'bg-honey-500'}`}
                      style={{ width: `${Math.min(100, paidOnBill > 0 ? (partSum / paidOnBill) * 100 : 0)}%` }}
                    />
                  </div>
                  <p className={`text-xs font-semibold ${splitOk ? 'text-green-700' : 'text-red-600'}`}>
                    {formatRs(partSum)} of {formatRs(paidOnBill)}
                    {splitOk ? ' · adds up' : partSum < paidOnBill ? ` · ${formatRs(paidOnBill - partSum)} left` : ` · ${formatRs(partSum - paidOnBill)} too much`}
                  </p>
                </div>
              )}

              <Field label="Reason (optional)">
                <input
                  className={inputClass}
                  value={reason}
                  maxLength={200}
                  disabled={closedBill || !!busy}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. wrong button pressed"
                />
              </Field>
            </div>
          )}

          {tab === 'refund' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
                {(['full', 'part'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setRefundMode(m);
                      setConfirmRefund(false);
                    }}
                    disabled={closedBill || !!busy || (m === 'full' && partTaken)}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
                      refundMode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {m === 'full' ? 'Full refund' : 'Part refund'}
                    <span className="block text-[11px] font-normal text-gray-500">{m === 'full' ? 'Stock goes back' : 'Money only, stock stays'}</span>
                  </button>
                ))}
              </div>

              {refundInfo && (
                <div className="grid grid-cols-3 divide-x divide-gray-200 rounded-xl border border-gray-200 text-center">
                  <MiniStat label="Paid" value={formatRs(refundInfo.paid)} />
                  <MiniStat label="Refunded" value={formatRs(refundInfo.refunded)} />
                  <MiniStat label="Can refund" value={formatRs(refundInfo.refundable)} strong />
                </div>
              )}

              {refundMode === 'full' ? (
                <p className="text-sm text-gray-600">
                  All pieces go back into stock and the customer gets <b>{formatRs(paidOnBill)}</b> back.
                </p>
              ) : (
                <Field label="Amount to give back (Rs)">
                  <MoneyInput
                    className={inputClass}
                    value={partAmt}
                    onValue={setPartAmt}
                    disabled={closedBill || !!busy}
                    placeholder={refundInfo ? `Up to ${refundInfo.refundable}` : '0'}
                  />
                  {partTooMuch && <p className="mt-1 text-xs text-red-600">More than can be refunded on this bill.</p>}
                </Field>
              )}
              {partTaken && refundMode === 'part' && (
                <p className="text-xs text-amber-700">Part of this bill was already refunded, so a full refund is not possible.</p>
              )}

              <RefundMethodPicker value={refundMethod} onChange={setRefundMethod} disabled={closedBill || !!busy} />
              <Field label="Reason (optional)">
                <input
                  className={inputClass}
                  value={refundReason}
                  maxLength={300}
                  disabled={closedBill || !!busy}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="e.g. customer returned the items"
                />
              </Field>
              {reasonLooksLikeAmount && (
                <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  &quot;{refundReason.trim()}&quot; looks like an amount.{' '}
                  <button
                    type="button"
                    className="font-semibold underline"
                    onClick={() => {
                      setRefundMode('part');
                      setPartAmt(refundReason.trim());
                      setRefundReason('');
                    }}
                  >
                    Make it a part refund of {formatRs(Number(refundReason) || 0)}
                  </button>{' '}
                  or write the reason in words.
                </div>
              )}
              {confirmRefund && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" /> Refund the whole bill {bill.orderNumber}? This cannot be undone.
                </div>
              )}
            </div>
          )}

          {tab === 'discount' && allowDiscount && (
            <div className="space-y-4">
              <Field label="Discount amount (Rs)">
                <MoneyInput className={inputClass} value={amt} onValue={setAmt} disabled={closedBill || !!busy} placeholder={`1 to ${Math.max(0, total - 1)}`} />
              </Field>
              {n > 0 &&
                (amtOk ? (
                  <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
                    New total <b>{formatRs(total - n)}</b>.{' '}
                    {back > 0 ? `The customer gets ${formatRs(back)} back (${labelOf(bill.paymentMethod)}).` : 'Taken off the money still owed; nothing to give back.'}
                  </div>
                ) : (
                  <p className="text-xs text-red-600">Enter a discount between 1 and {Math.max(0, total - 1)}.</p>
                ))}
              <Field label="Reason (optional)">
                <input className={inputClass} value={discReason} maxLength={200} disabled={closedBill || !!busy} onChange={(e) => setDiscReason(e.target.value)} />
              </Field>
            </div>
          )}

          {tab === 'history' && <EditHistory log={log} />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
          <p className="hidden text-[11px] text-gray-400 sm:block">{tab === 'history' ? 'Read only' : 'Every change is saved in History'}</p>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={onClose} disabled={!!busy} className={btnGhost}>
              Close
            </button>
            {action}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Changes made to the bill, newest first, with what it was before and after. */
function EditHistory({ log }: { log: BillEditEntry[] | null }) {
  if (!log) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (!log.length) {
    return (
      <div className="py-10 text-center">
        <History className="mx-auto mb-2 h-8 w-8 text-gray-300" />
        <p className="text-sm text-gray-500">No changes yet. The bill is as it was sold.</p>
      </div>
    );
  }
  return (
    <ol className="relative space-y-4 border-l border-gray-200 pl-5">
      {log.map((e, i) => {
        const meta = ACTION_META[e.action] || { label: e.action, cls: 'bg-gray-50 text-gray-700 ring-gray-200' };
        const rows: { label: string; before: string; after: string }[] = [
          { label: 'Payment', before: paysText(e.before), after: paysText(e.after) },
          { label: 'Total', before: formatRs(e.before?.total || 0), after: formatRs(e.after?.total || 0) },
          { label: 'Refunded', before: formatRs(e.before?.refunded || 0), after: formatRs(e.after?.refunded || 0) },
          { label: 'Status', before: e.before?.orderStatus || '—', after: e.after?.orderStatus || '—' },
        ].filter((r) => r.before !== r.after);
        return (
          <li key={i} className="relative">
            <span className="absolute -left-[26px] top-1 h-3 w-3 rounded-full border-2 border-white bg-honey-500 ring-1 ring-gray-200" />
            <div className="rounded-xl border border-gray-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${meta.cls}`}>{meta.label}</span>
                <span className="text-[11px] text-gray-500">{new Date(e.at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </div>
              <p className="mt-1.5 text-sm text-gray-800">{e.summary}</p>
              <p className="text-xs text-gray-500">
                by <b className="font-semibold text-gray-700">{e.byName || 'Unknown'}</b>
                {e.byRole ? ` (${e.byRole})` : ''}
              </p>
              {e.reason && <p className="mt-1 text-xs italic text-gray-600">&ldquo;{e.reason}&rdquo;</p>}
              {rows.length > 0 && (
                <table className="mt-2 w-full text-xs">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wide text-gray-400">
                      <th className="py-1 font-medium" />
                      <th className="py-1 font-medium">Before</th>
                      <th className="w-4" />
                      <th className="py-1 font-medium">After</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map((r) => (
                      <tr key={r.label}>
                        <td className="py-1 pr-2 font-medium text-gray-500">{r.label}</td>
                        <td className="py-1 text-gray-500 line-through decoration-gray-300">{r.before}</td>
                        <td className="py-1 text-gray-300">
                          <ArrowRight className="h-3 w-3" />
                        </td>
                        <td className="py-1 font-semibold text-gray-900">{r.after}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Stat({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: 'green' | 'amber' | 'red' }) {
  const toneCls = tone === 'green' ? 'text-green-700' : tone === 'amber' ? 'text-amber-700' : tone === 'red' ? 'text-red-700' : 'text-gray-900';
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`truncate text-sm ${strong ? 'font-bold' : 'font-semibold'} ${toneCls}`}>{value}</p>
    </div>
  );
}

function MiniStat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="px-2 py-2">
      <p className="text-[10px] uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`text-sm ${strong ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}`}>{value}</p>
    </div>
  );
}

const btnBase =
  'inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50';
const btnPrimary = `${btnBase} bg-honey-500 text-gray-900 hover:bg-honey-600`;
const btnAmber = `${btnBase} bg-amber-500 text-white hover:bg-amber-600`;
const btnDanger = `${btnBase} bg-red-600 text-white hover:bg-red-700`;
const btnGhost = `${btnBase} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`;
