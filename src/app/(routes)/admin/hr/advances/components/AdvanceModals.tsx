'use client';

// Dialogs of the advances & deductions page: give advance, add deduction,
// approve (all or part) / waive a deduction, cancel an advance.
import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Ban, CheckCircle2, HandCoins, Loader2, MinusCircle, XCircle } from 'lucide-react';
import { ErrorBox, Field, Modal, Toggle, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { apiErrorMessage, formatRs } from '@/lib/storeApi';
import {
  METHODS,
  METHOD_LABEL,
  payrollApi,
  todayPKT,
  type PayMethod,
  type PayrollDeduction,
  type SalaryAdvance,
  type StaffOption,
} from '../../payroll/_shared/payrollApi';
import { StaffPicker } from '../../payroll/_shared/PayrollBits';
import { SearchSelect } from '@/components/ui/SearchSelect';

function useSubmit() {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<void>, fallback: string) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(apiErrorMessage(e, fallback));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}

const Footer = ({ busy, onClose, onSubmit, label, icon, disabled }: { busy: boolean; onClose: () => void; onSubmit: () => void; label: string; icon: React.ReactNode; disabled?: boolean }) => (
  <>
    <button type="button" onClick={onClose} disabled={busy} className={secondaryBtn}>
      Cancel
    </button>
    <button type="button" onClick={onSubmit} disabled={busy || disabled} aria-busy={busy} className={primaryBtn}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : icon} {label}
    </button>
  </>
);

/** Installment plan the same way payroll does it: balance ÷ months, last month takes the rest. */
function plan(amount: number, months: number) {
  if (!(amount > 0) || !(months >= 1)) return null;
  const first = months === 1 ? amount : Math.round(amount / months);
  let left = amount;
  const list: number[] = [];
  for (let i = months; i >= 1; i -= 1) {
    const take = i === 1 ? left : Math.round(left / i);
    list.push(take);
    left -= take;
  }
  return { first, last: list[list.length - 1], same: list.every((x) => x === first) };
}

export function GiveAdvanceModal({ onClose, onDone }: { onClose: () => void; onDone: (a: SalaryAdvance) => void }) {
  const { busy, error, setError, run } = useSubmit();
  const [staff, setStaff] = useState<StaffOption | null>(null);
  const [amount, setAmount] = useState('');
  const [installments, setInstallments] = useState('1');
  const [date, setDate] = useState(todayPKT());
  const [method, setMethod] = useState<PayMethod>('cash');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const amt = Math.round(Number(amount) || 0);
  const months = Math.round(Number(installments) || 0);
  const p = plan(amt, months);
  const pay = staff ? (staff.payType === 'daily' ? staff.dailyRate * 26 : staff.salary) : 0;

  const submit = () => {
    if (!staff) return setError('Pick the employee');
    if (!(amt > 0)) return setError('Write the amount');
    if (!(months >= 1 && months <= 24)) return setError('Installments must be 1 to 24 months');
    return run(async () => {
      const res = await payrollApi.giveAdvance({ employeeId: staff._id, amount: amt, installments: months, date, method, reference: reference.trim(), note: note.trim() });
      toast.success(`${res.data.advanceNo} given to ${staff.name}`);
      onDone(res.data);
    }, 'Could not save the advance.');
  };

  return (
    <Modal
      title="Give salary advance"
      subtitle="Taken back from salary in monthly installments"
      icon={<HandCoins className="h-5 w-5" />}
      onClose={onClose}
      busy={busy}
      footer={<Footer busy={busy} onClose={onClose} onSubmit={submit} label="Give advance" icon={<HandCoins className="h-4 w-4" />} />}
    >
      <div className="space-y-4">
        <Field label="Employee" required>
          <StaffPicker value={staff} onChange={setStaff} autoFocus disabled={busy} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (Rs)" required>
            <input type="number" inputMode="numeric" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} placeholder="e.g. 10000" />
          </Field>
          <Field label="Installments (months)" required>
            <input type="number" inputMode="numeric" min={1} max={24} value={installments} onChange={(e) => setInstallments(e.target.value)} className={inputClass} />
          </Field>
        </div>
        {p && (
          <p className="text-sm bg-honey-50 border border-honey-200 rounded-lg px-3 py-2 text-gray-900">
            <span className="font-semibold">{formatRs(p.first)} per month</span> for {months} month{months === 1 ? '' : 's'}
            {!p.same && <span className="text-gray-600"> (last month {formatRs(p.last)})</span>}
            {pay > 0 && p.first > pay / 2 && <span className="block text-xs text-amber-700 mt-0.5">That is more than half of the monthly pay ({formatRs(pay)}).</span>}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" required>
            <input type="date" value={date} max={todayPKT()} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Given by" required>
            <SearchSelect value={method} onChange={(e) => setMethod(e.target.value as PayMethod)} className={inputClass}>
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {METHOD_LABEL[m]}
                </option>
              ))}
            </SearchSelect>
          </Field>
        </div>
        <Field label="Reference" hint={method === 'cash' ? 'Optional' : 'Transaction ID from the bank / wallet'}>
          <input value={reference} onChange={(e) => setReference(e.target.value)} className={inputClass} maxLength={120} />
        </Field>
        <Field label="Note">
          <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} maxLength={500} placeholder="e.g. Child's school fee" />
        </Field>
        <ErrorBox message={error} />
      </div>
    </Modal>
  );
}

export function AddDeductionModal({ canApprove, onClose, onDone }: { canApprove: boolean; onClose: () => void; onDone: (d: PayrollDeduction) => void }) {
  const { busy, error, setError, run } = useSubmit();
  const [staff, setStaff] = useState<StaffOption | null>(null);
  const [type, setType] = useState<'damage' | 'other'>('damage');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayPKT());
  const [note, setNote] = useState('');
  const [approveNow, setApproveNow] = useState(false);

  const submit = () => {
    const amt = Math.round(Number(amount) || 0);
    if (!staff) return setError('Pick the employee');
    if (!(amt > 0)) return setError('Write the amount');
    if (!note.trim()) return setError('Write what this deduction is for');
    return run(async () => {
      const res = await payrollApi.addDeduction({ employeeId: staff._id, type, amount: amt, date, note: note.trim(), approveNow: canApprove && approveNow });
      toast.success(res.message || 'Deduction added');
      onDone(res.data);
    }, 'Could not add the deduction.');
  };

  return (
    <Modal
      title="Add deduction"
      subtitle="Cut from the next payroll once approved"
      icon={<MinusCircle className="h-5 w-5" />}
      onClose={onClose}
      busy={busy}
      footer={<Footer busy={busy} onClose={onClose} onSubmit={submit} label="Add" icon={<MinusCircle className="h-4 w-4" />} />}
    >
      <div className="space-y-4">
        <Field label="Employee" required>
          <StaffPicker value={staff} onChange={setStaff} autoFocus disabled={busy} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type" required>
            <SearchSelect value={type} onChange={(e) => setType(e.target.value as 'damage' | 'other')} className={inputClass}>
              <option value="damage">Damage</option>
              <option value="other">Other</option>
            </SearchSelect>
          </Field>
          <Field label="Amount (Rs)" required>
            <input type="number" inputMode="numeric" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
          </Field>
        </div>
        <Field label="Date" required hint="Payroll of this month (or later) cuts it.">
          <input type="date" value={date} max={todayPKT()} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </Field>
        <Field label="What is it for?" required>
          <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} maxLength={500} placeholder="e.g. Broke 2 glass jars" />
        </Field>
        {canApprove && <Toggle checked={approveNow} onChange={setApproveNow} label="Approve now" hint="Otherwise it waits for a manager's approval." />}
        <p className="text-[11px] text-gray-500">Till shortages are added automatically when a short cash closing is verified.</p>
        <ErrorBox message={error} />
      </div>
    </Modal>
  );
}

export function ApproveDeductionModal({ deduction, onClose, onDone }: { deduction: PayrollDeduction; onClose: () => void; onDone: (d: PayrollDeduction) => void }) {
  const { busy, error, setError, run } = useSubmit();
  const [amount, setAmount] = useState(String(Math.round(deduction.amount)));
  const submit = () => {
    const amt = Math.round(Number(amount) || 0);
    if (!(amt > 0)) return setError('Write the amount to cut');
    if (amt > Math.round(deduction.amount)) return setError(`Cannot be more than ${formatRs(deduction.amount)}`);
    return run(async () => {
      const res = await payrollApi.approveDeduction(deduction._id, amt === Math.round(deduction.amount) ? undefined : amt);
      toast.success('Approved — it will be cut in payroll');
      onDone(res.data);
    }, 'Could not approve.');
  };
  return (
    <Modal
      title={`Approve ${deduction.typeLabel.toLowerCase()}`}
      subtitle={`${deduction.employeeName}${deduction.refNo ? ` · ${deduction.refNo}` : ''}`}
      icon={<CheckCircle2 className="h-5 w-5" />}
      onClose={onClose}
      busy={busy}
      footer={<Footer busy={busy} onClose={onClose} onSubmit={submit} label="Approve" icon={<CheckCircle2 className="h-4 w-4" />} />}
    >
      <div className="space-y-4">
        {deduction.note && <p className="text-sm text-gray-700">{deduction.note}</p>}
        <Field label="Amount to cut (Rs)" hint={`Full amount ${formatRs(deduction.amount)}. Write less to cut only part of it.`}>
          <input type="number" inputMode="numeric" min={1} max={Math.round(deduction.amount)} value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} autoFocus />
        </Field>
        <ErrorBox message={error} />
      </div>
    </Modal>
  );
}

export function WaiveDeductionModal({ deduction, onClose, onDone }: { deduction: PayrollDeduction; onClose: () => void; onDone: (d: PayrollDeduction) => void }) {
  const { busy, error, setError, run } = useSubmit();
  const [note, setNote] = useState('');
  const submit = () => {
    if (!note.trim()) return setError('Write why it is waived');
    return run(async () => {
      const res = await payrollApi.waiveDeduction(deduction._id, note.trim());
      toast.success('Waived — it will not be cut');
      onDone(res.data);
    }, 'Could not waive.');
  };
  return (
    <Modal
      title={`Waive ${formatRs(deduction.amount)}?`}
      subtitle={`${deduction.typeLabel} · ${deduction.employeeName}`}
      icon={<XCircle className="h-5 w-5" />}
      onClose={onClose}
      busy={busy}
      footer={<Footer busy={busy} onClose={onClose} onSubmit={submit} label="Waive" icon={<XCircle className="h-4 w-4" />} />}
    >
      <div className="space-y-3">
        <Field label="Why?" required>
          <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} maxLength={500} placeholder="e.g. Counting mistake, cash found" autoFocus />
        </Field>
        <ErrorBox message={error} />
      </div>
    </Modal>
  );
}

export function CancelAdvanceModal({ advance, onClose, onDone }: { advance: SalaryAdvance; onClose: () => void; onDone: (a: SalaryAdvance) => void }) {
  const { busy, error, run } = useSubmit();
  const [reason, setReason] = useState('');
  const submit = () =>
    run(async () => {
      const res = await payrollApi.cancelAdvance(advance._id, reason.trim());
      toast.success(`${advance.advanceNo} cancelled`);
      onDone(res.data);
    }, 'Could not cancel.');
  return (
    <Modal
      title={`Cancel ${advance.advanceNo}?`}
      subtitle={`${advance.employeeName} · ${formatRs(advance.amount)}`}
      icon={<Ban className="h-5 w-5" />}
      onClose={onClose}
      busy={busy}
      footer={<Footer busy={busy} onClose={onClose} onSubmit={submit} label="Cancel advance" icon={<Ban className="h-4 w-4" />} />}
    >
      <div className="space-y-3">
        <p className="text-sm text-gray-700">Use this when the advance was typed by mistake or the money came back. Nothing has been taken from salary yet.</p>
        <Field label="Reason">
          <input value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} maxLength={300} autoFocus />
        </Field>
        <ErrorBox message={error} />
      </div>
    </Modal>
  );
}
