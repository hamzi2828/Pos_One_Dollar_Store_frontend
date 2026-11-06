'use client';

// Dialogs of the Tips tab: give a tip to one or more employees, delete a tip.
// Every tip is saved as an expense in "Staff Tips" (not cut from salary).
import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Gift, Loader2, Plus, Trash2, X } from 'lucide-react';
import { ErrorBox, Field, Modal, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { apiErrorMessage, formatDate, formatRs } from '@/lib/storeApi';
import MoneyInput from '@/components/ui/MoneyInput';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { METHODS, METHOD_LABEL, payrollApi, todayPKT, type PayMethod, type StaffOption, type StaffTip } from '../../payroll/_shared/payrollApi';
import { StaffPicker } from '../../payroll/_shared/PayrollBits';

export const TIPS_CATEGORY = 'Staff Tips';

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

/** Label only on the first line of the employee list. */
const LineField = ({ label, first, children }: { label: string; first: boolean; children: React.ReactNode }) =>
  first ? (
    <Field label={label} required>
      {children}
    </Field>
  ) : (
    <div>{children}</div>
  );

interface TipRow {
  key: number;
  staff: StaffOption | null;
  amount: string;
}

export function GiveTipModal({ onClose, onDone }: { onClose: () => void; onDone: (tips: StaffTip[]) => void }) {
  const { busy, error, setError, run } = useSubmit();
  const nextKey = useRef(1);
  const [rows, setRows] = useState<TipRow[]>([{ key: 0, staff: null, amount: '' }]);
  const [date, setDate] = useState(todayPKT());
  const [method, setMethod] = useState<PayMethod>('cash');
  const [note, setNote] = useState('');

  const setRow = (key: number, patch: Partial<TipRow>) => setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const addRow = () => setRows((list) => [...list, { key: nextKey.current++, staff: null, amount: list[list.length - 1]?.amount || '' }]);
  const removeRow = (key: number) => setRows((list) => (list.length > 1 ? list.filter((r) => r.key !== key) : list));
  const total = rows.reduce((s, r) => s + Math.round(Number(r.amount) || 0), 0);

  const submit = () => {
    const filled = rows.filter((r) => r.staff || Number(r.amount) > 0);
    if (!filled.length) return setError('Pick the employee');
    for (const r of filled) {
      if (!r.staff) return setError('Pick the employee on every line (or remove the empty line)');
      if (!(Math.round(Number(r.amount) || 0) > 0)) return setError(`Write the tip amount for ${r.staff.name}`);
    }
    const ids = filled.map((r) => r.staff!._id);
    const twice = filled.find((r, i) => ids.indexOf(r.staff!._id) !== i);
    if (twice) return setError(`${twice.staff!.name} is picked two times`);
    return run(async () => {
      const res = await payrollApi.addTips({
        date,
        method,
        note: note.trim(),
        tips: filled.map((r) => ({ employeeId: r.staff!._id, amount: Math.round(Number(r.amount)) })),
      });
      toast.success(res.message || 'Tip saved');
      onDone(res.data || []);
    }, 'Could not save the tip.');
  };

  return (
    <Modal
      title="Give tip"
      subtitle={`Saved as an expense in “${TIPS_CATEGORY}”. Not cut from salary.`}
      icon={<Gift className="h-5 w-5" />}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={secondaryBtn}>
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={busy} aria-busy={busy} className={primaryBtn}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />} Save tip{rows.length > 1 ? 's' : ''}
            {total > 0 && ` · ${formatRs(total)}`}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={r.key} className="grid grid-cols-[1fr_8rem_auto] gap-2 items-start">
              <LineField label="Employee" first={i === 0}>
                <StaffPicker value={r.staff} onChange={(s) => setRow(r.key, { staff: s })} autoFocus={i === 0} disabled={busy} />
              </LineField>
              <LineField label="Tip (Rs)" first={i === 0}>
                <MoneyInput value={r.amount} onValue={(v) => setRow(r.key, { amount: v })} className={inputClass} placeholder="e.g. 500" />
              </LineField>
              <div className={i === 0 ? 'pt-[22px]' : ''}>
                <button
                  type="button"
                  onClick={() => removeRow(r.key)}
                  disabled={busy || rows.length === 1}
                  className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent"
                  aria-label="Remove line"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          {rows.length < 50 && (
            <button type="button" onClick={addRow} disabled={busy} className="inline-flex items-center gap-1 text-sm font-semibold text-honey-700 hover:text-honey-900">
              <Plus className="h-4 w-4" /> Add another employee
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" required hint="Goes in the expenses of this day">
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
        <Field label="Note">
          <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} maxLength={500} placeholder="e.g. Eid tip, good work on sale day" />
        </Field>
        {total > 0 && (
          <p className="text-sm bg-honey-50 border border-honey-200 rounded-lg px-3 py-2 text-gray-900">
            Total <span className="font-semibold">{formatRs(total)}</span> will be added to expenses ({TIPS_CATEGORY}) on this date.
            {method === 'cash' && <span className="block text-xs text-gray-600 mt-0.5">Cash tips are taken out in that day&apos;s cash closing.</span>}
          </p>
        )}
        <ErrorBox message={error} />
      </div>
    </Modal>
  );
}

export function DeleteTipModal({ tip, onClose, onDone }: { tip: StaffTip; onClose: () => void; onDone: () => void }) {
  const { busy, error, run } = useSubmit();
  const [reason, setReason] = useState('');
  const submit = () =>
    run(async () => {
      await payrollApi.deleteTip(tip._id, reason.trim());
      toast.success(`${tip.tipNo} deleted`);
      onDone();
    }, 'Could not delete the tip.');
  return (
    <Modal
      title={`Delete ${tip.tipNo}?`}
      subtitle={`${tip.employeeName} · ${formatRs(tip.amount)} · ${formatDate(tip.date)}`}
      icon={<Trash2 className="h-5 w-5" />}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={secondaryBtn}>
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={busy} aria-busy={busy} className={primaryBtn}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete tip
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-gray-700">Its expense in “{TIPS_CATEGORY}” is removed too.</p>
        <Field label="Reason">
          <input value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} maxLength={300} autoFocus />
        </Field>
        <ErrorBox message={error} />
      </div>
    </Modal>
  );
}
