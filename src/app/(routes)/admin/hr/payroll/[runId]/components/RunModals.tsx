'use client';

// Confirm dialogs of a payroll run: approve, pay (all / selected), reopen.
import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, Loader2, Lock, RotateCcw, Wallet } from 'lucide-react';
import { ErrorBox, Field, HelpBox, Modal, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { apiErrorMessage, formatRs } from '@/lib/storeApi';
import { METHODS, METHOD_LABEL, newRequestId, payrollApi, todayPKT, type PayMethod, type PayrollLine, type PayrollRun } from '../../_shared/payrollApi';

/** Shared submit lock + error for the dialogs. */
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
  return { busy, error, run };
}

export function ApproveModal({ run, onClose, onDone }: { run: PayrollRun; onClose: () => void; onDone: (r: PayrollRun) => void }) {
  const { busy, error, run: submit } = useSubmit();
  const warnings = run.warnings.filter((w) => w.level !== 'info').length;
  const finishing = run.status === 'approved' && !run.effectsDone;
  const go = () =>
    submit(async () => {
      const res = await payrollApi.approve(run._id);
      toast.success(res.message || 'Payroll approved');
      onDone(res.data);
    }, 'Could not approve the payroll.');

  return (
    <Modal
      title={finishing ? `Finish approving ${run.monthLabel}` : `Approve ${run.monthLabel} payroll?`}
      subtitle={`${run.runNo} · ${run.totals.staff} staff · net ${formatRs(run.totals.net)}`}
      icon={<CheckCircle2 className="h-5 w-5" />}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={secondaryBtn}>
            Cancel
          </button>
          <button type="button" onClick={go} disabled={busy} aria-busy={busy} className={primaryBtn}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} {finishing ? 'Finish approval' : 'Approve'}
          </button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-gray-700">
        <p className="flex items-start gap-2 font-medium text-gray-900">
          <Lock className="h-4 w-4 mt-0.5 text-honey-700 flex-shrink-0" />
          This locks attendance for {run.monthLabel}: no more clock-ins, corrections or overtime changes for those days.
        </p>
        <ul className="list-disc list-inside space-y-1 text-xs text-gray-600">
          <li>Till shortages and other deductions on this payroll are marked as cut.</li>
          <li>Advance installments are taken off each advance balance.</li>
          <li>Only the super admin can reopen it, and only before any salary is paid.</li>
        </ul>
        {warnings > 0 && (
          <p className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2">
            There {warnings === 1 ? 'is 1 thing' : `are ${warnings} things`} to check on this payroll (see the yellow box). You can still approve.
          </p>
        )}
        <ErrorBox message={error} />
      </div>
    </Modal>
  );
}

export function PayModal({
  run,
  lines,
  onClose,
  onDone,
}: {
  run: PayrollRun;
  lines: PayrollLine[];
  onClose: () => void;
  onDone: (r: PayrollRun) => void;
}) {
  const { busy, error, run: submit } = useSubmit();
  const [method, setMethod] = useState<PayMethod>('cash');
  const [date, setDate] = useState(todayPKT());
  const [reference, setReference] = useState('');
  // Same id for every retry of this dialog, so a repeated request is not paid twice.
  const [requestId] = useState(newRequestId);
  const total = lines.reduce((s, l) => s + l.net, 0);
  const recovered = lines.reduce((s, l) => s + (l.advanceRecovery || 0), 0);
  const all = lines.length === run.lines.filter((l) => l.status !== 'paid').length;

  const go = () =>
    submit(async () => {
      const res = await payrollApi.pay(run._id, { lineIds: all ? undefined : lines.map((l) => l._id), method, date, reference: reference.trim(), requestId });
      toast.success(res.message || 'Salaries marked as paid');
      onDone(res.data);
    }, 'Could not record the payment.');

  return (
    <Modal
      title={all ? 'Pay all salaries' : `Pay ${lines.length} selected`}
      subtitle={`${run.monthLabel} · ${lines.length} staff · ${formatRs(total)}`}
      icon={<Wallet className="h-5 w-5" />}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={secondaryBtn}>
            Cancel
          </button>
          <button type="button" onClick={go} disabled={busy || !lines.length} aria-busy={busy} className={primaryBtn}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />} Mark {formatRs(total)} paid
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
          {lines.map((l) => (
            <div key={l._id} className="flex justify-between px-3 py-1.5 text-sm">
              <span className="text-gray-800 truncate">{l.name}</span>
              <span className="tabular-nums font-medium">{formatRs(l.net)}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Paid by" required>
            <select value={method} onChange={(e) => setMethod(e.target.value as PayMethod)} className={inputClass}>
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {METHOD_LABEL[m]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Payment date" required>
            <input type="date" value={date} max={todayPKT()} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </Field>
        </div>
        <Field label="Reference" hint={method === 'cash' ? 'Optional, e.g. voucher number.' : 'Transaction ID from the bank / wallet.'}>
          <input value={reference} onChange={(e) => setReference(e.target.value)} className={inputClass} maxLength={120} placeholder={method === 'cash' ? 'Optional' : 'e.g. IBFT-1234'} />
        </Field>
        <HelpBox>
          One expense “Salaries {run.monthLabel}” of <b>{formatRs(total + recovered)}</b> is posted to Expenses
          {recovered > 0 ? ` (net ${formatRs(total)} + advance recovered ${formatRs(recovered)} — the salary earned).` : '.'}
        </HelpBox>
        <ErrorBox message={error} />
      </div>
    </Modal>
  );
}

export function ReopenModal({ run, onClose, onDone }: { run: PayrollRun; onClose: () => void; onDone: (r: PayrollRun) => void }) {
  const { busy, error, run: submit } = useSubmit();
  const [reason, setReason] = useState('');
  const go = () =>
    submit(async () => {
      const res = await payrollApi.reopen(run._id, reason.trim());
      toast.success(res.message || 'Payroll reopened');
      onDone(res.data);
    }, 'Could not reopen the payroll.');
  return (
    <Modal
      title={`Reopen ${run.monthLabel} payroll?`}
      subtitle="Back to draft"
      icon={<RotateCcw className="h-5 w-5" />}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={secondaryBtn}>
            Cancel
          </button>
          <button type="button" onClick={go} disabled={busy} aria-busy={busy} className={primaryBtn}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Reopen
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-gray-700">
          Attendance for {run.monthLabel} is unlocked, deductions go back to approved and advance installments are put back on the balances. Approve it again when ready.
        </p>
        <Field label="Why?">
          <input value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} maxLength={300} placeholder="e.g. Ali's overtime was missing" autoFocus />
        </Field>
        <ErrorBox message={error} />
      </div>
    </Modal>
  );
}
