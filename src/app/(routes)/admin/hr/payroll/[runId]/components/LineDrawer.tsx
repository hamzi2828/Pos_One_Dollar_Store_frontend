'use client';

// One employee's payroll line: the money in plain words, the attendance it came
// from, and (on a draft) bonus / adjustments / advance recovery / note.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { FileText, Loader2, Minus, Plus, Save, Trash2, X } from 'lucide-react';
import { Field, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { apiErrorMessage, formatDate, formatRs } from '@/lib/storeApi';
import { hoursText, payrollApi, type Adjustment, type MoneyRow, type PayrollLine, type PayrollRun } from '../../_shared/payrollApi';
import { StatusChip, minusRs } from '../../_shared/PayrollBits';

function Rows({ rows, minus }: { rows: MoneyRow[]; minus?: boolean }) {
  if (!rows.length) return <p className="text-xs text-gray-400 py-1">None</p>;
  return (
    <ul className="divide-y divide-gray-100">
      {rows.map((r) => (
        <li key={r.key} className="flex items-start justify-between gap-3 py-2">
          <div className="min-w-0">
            <p className="text-sm text-gray-900">{r.label}</p>
            {r.detail && <p className="text-[11px] text-gray-500 leading-snug">{r.detail}</p>}
          </div>
          <span className={`text-sm font-medium tabular-nums whitespace-nowrap ${minus ? 'text-red-700' : 'text-gray-900'}`}>
            {minus ? minusRs(r.amount) : formatRs(r.amount)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Fact({ label, value, warn }: { label: string; value: React.ReactNode; warn?: boolean }) {
  return (
    <div className={`rounded-lg border px-2.5 py-1.5 ${warn ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}>
      <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`text-sm font-semibold tabular-nums ${warn ? 'text-amber-800' : 'text-gray-900'}`}>{value}</p>
    </div>
  );
}

type AdjDraft = { key: string; label: string; sign: 1 | -1; amount: string; note: string };
const toDraft = (a: Adjustment, i: number): AdjDraft => ({
  key: a._id || `n${i}`,
  label: a.label,
  sign: a.amount < 0 ? -1 : 1,
  amount: String(Math.abs(a.amount)),
  note: a.note || '',
});

export default function LineDrawer({
  run,
  line,
  canEdit,
  onClose,
  onSaved,
}: {
  run: PayrollRun;
  line: PayrollLine;
  canEdit: boolean;
  onClose: () => void;
  onSaved: (run: PayrollRun) => void;
}) {
  const editable = canEdit && run.status === 'draft';
  const a = line.attendance;
  const [bonus, setBonus] = useState(line.bonus ? String(line.bonus) : '');
  const [bonusNote, setBonusNote] = useState(line.bonusNote || '');
  const [adjs, setAdjs] = useState<AdjDraft[]>(() => (line.adjustments || []).map(toDraft));
  const [override, setOverride] = useState(line.advanceRecoveryOverride === null ? '' : String(line.advanceRecoveryOverride));
  const [note, setNote] = useState(line.note || '');
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);

  // Reset the form when another line (or a fresh copy) is shown.
  useEffect(() => {
    setBonus(line.bonus ? String(line.bonus) : '');
    setBonusNote(line.bonusNote || '');
    setAdjs((line.adjustments || []).map(toDraft));
    setOverride(line.advanceRecoveryOverride === null ? '' : String(line.advanceRecoveryOverride));
    setNote(line.note || '');
  }, [line]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const advanceBalance = useMemo(() => (line.advanceItems || []).reduce((s, x) => s + x.balance, 0), [line]);
  const dirty =
    (Number(bonus) || 0) !== (line.bonus || 0) ||
    bonusNote !== (line.bonusNote || '') ||
    note !== (line.note || '') ||
    override !== (line.advanceRecoveryOverride === null ? '' : String(line.advanceRecoveryOverride)) ||
    JSON.stringify(adjs.map((x) => [x.label, x.sign * (Number(x.amount) || 0), x.note])) !==
      JSON.stringify((line.adjustments || []).map((x) => [x.label, x.amount, x.note || '']));

  const save = async () => {
    if (lock.current) return;
    const cleanAdjs = adjs.filter((x) => x.label.trim() || x.amount);
    for (const x of cleanAdjs) {
      if (!x.label.trim()) return toast.error('Every adjustment needs a label');
      if (!(Number(x.amount) > 0)) return toast.error(`Write the amount for "${x.label}"`);
    }
    lock.current = true;
    setSaving(true);
    try {
      const res = await payrollApi.updateLine(run._id, line._id, {
        bonus: Number(bonus) || 0,
        bonusNote,
        note,
        advanceRecoveryOverride: override === '' ? null : Number(override),
        adjustments: cleanAdjs.map((x) => ({
          _id: x.key.startsWith('n') ? undefined : x.key,
          label: x.label.trim(),
          amount: x.sign * Math.round(Number(x.amount)),
          note: x.note.trim(),
        })),
      });
      toast.success('Saved');
      onSaved(res.data);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not save'));
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-gray-900/40 backdrop-blur-[1px]" onMouseDown={(e) => e.target === e.currentTarget && !saving && onClose()}>
      <aside className="h-full w-full sm:max-w-xl bg-white shadow-2xl flex flex-col" role="dialog" aria-label={`Pay for ${line.name}`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-4 sm:px-5 py-4 border-b border-gray-200">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 truncate">{line.name}</h2>
              <StatusChip status={line.status === 'paid' ? 'paid' : run.status === 'draft' ? 'draft' : 'to_pay'} />
            </div>
            <p className="text-xs text-gray-500 truncate">
              {[line.code, line.designation, line.payType === 'daily' ? 'Daily wage' : 'Monthly salary'].filter(Boolean).join(' · ')}
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-5">
          {/* Rates */}
          <div className="text-xs text-gray-600 bg-honey-50 border border-honey-100 rounded-lg px-3 py-2 leading-relaxed">
            <span className="font-semibold text-gray-900">{line.policy?.name || 'HR policy'}</span>
            {line.payType === 'daily' ? (
              <> · {formatRs(line.dailyRate)} a day</>
            ) : (
              <>
                {' '}· salary {formatRs(line.salary)} · day rate {formatRs(line.dayRate)} ({line.divisorLabel})
              </>
            )}{' '}
            · hourly {formatRs(line.hourlyRate)} ({line.workHoursPerDay} h shift)
            {line.joinedOn && <> · joined {formatDate(line.joinedOn)}</>}
            {line.leftOn && <> · left {formatDate(line.leftOn)}</>}
          </div>

          {/* Attendance */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Attendance</h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              <Fact label="Days worked" value={a.daysWorked} />
              <Fact label="Shift days" value={a.scheduledDaysInMonth} warn={!a.scheduledDaysInMonth} />
              <Fact label="Absent" value={a.absentDays} warn={a.absentDays > 0} />
              <Fact label="Half days" value={a.halfDays} />
              <Fact label="Lates" value={`${a.lateCount}${a.lateMinutes ? ` · ${a.lateMinutes}m` : ''}`} />
              <Fact label="Left early" value={a.earlyLeaveCount} />
              <Fact label="Leave" value={`${a.leave.paid + a.leave.sick + a.leave.unpaid}${a.leave.unpaidTotal ? ` (${a.leave.unpaidTotal} unpaid)` : ''}`} />
              <Fact label="Offs / holidays" value={`${a.offDays} / ${a.holidayDays}`} />
              <Fact label="OT paid" value={hoursText(a.overtimeMinutesPaid)} />
              <Fact label="OT waiting" value={hoursText(a.overtimeMinutesPending)} warn={a.overtimeMinutesPending > 0} />
              <Fact label="No check-out" value={a.pendingCorrections} warn={a.pendingCorrections > 0} />
              {a.notEmployedDays > 0 && <Fact label="Not employed" value={`${a.notEmployedDays} days`} />}
            </div>
          </section>

          {/* Money */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Earnings</h3>
            <Rows rows={line.earnings} />
          </section>
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Deductions</h3>
            <Rows rows={line.deductions} minus />
          </section>
          <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 text-sm">
            <div className="flex justify-between px-3 py-2">
              <span className="text-gray-600">Gross</span>
              <span className="tabular-nums font-medium">{formatRs(line.gross)}</span>
            </div>
            <div className="flex justify-between px-3 py-2">
              <span className="text-gray-600">Deductions</span>
              <span className="tabular-nums font-medium text-red-700">{minusRs(line.totalDeductions)}</span>
            </div>
            <div className="flex justify-between px-3 py-2.5 bg-honey-50">
              <span className="font-semibold text-gray-900">Net pay</span>
              <span className="tabular-nums text-base font-bold text-gray-900">{formatRs(line.net)}</span>
            </div>
          </div>
          {line.notes.length > 0 && (
            <ul className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 space-y-1 list-disc list-inside">
              {line.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
          {!editable && line.note && <p className="text-xs text-gray-600 italic">Note: {line.note}</p>}

          {/* Draft edits */}
          {editable && (
            <section className="space-y-4 border-t border-gray-200 pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Change this line</h3>
              <div className="grid grid-cols-1 sm:grid-cols-[9rem_1fr] gap-2">
                <Field label="Bonus (Rs)">
                  <input type="number" inputMode="numeric" min={0} value={bonus} onChange={(e) => setBonus(e.target.value)} className={inputClass} placeholder="0" />
                </Field>
                <Field label="Bonus note">
                  <input value={bonusNote} onChange={(e) => setBonusNote(e.target.value)} className={inputClass} placeholder="e.g. Eid bonus" maxLength={200} />
                </Field>
              </div>

              <div>
                <p className="block text-xs font-medium text-gray-700 mb-1.5">Adjustments</p>
                <div className="space-y-2">
                  {adjs.map((x, i) => (
                    <div key={x.key} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_8.5rem_1fr_auto] gap-2 items-start rounded-lg border border-gray-200 p-2">
                      <input
                        value={x.label}
                        onChange={(e) => setAdjs((list) => list.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)))}
                        className={inputClass}
                        placeholder="Label, e.g. Uniform"
                        maxLength={80}
                      />
                      <div className="flex items-center gap-1 sm:order-none order-3 col-span-2 sm:col-span-1">
                        <button
                          type="button"
                          onClick={() => setAdjs((list) => list.map((y, j) => (j === i ? { ...y, sign: y.sign === 1 ? -1 : 1 } : y)))}
                          className={`h-9 w-9 flex-shrink-0 rounded-lg border flex items-center justify-center ${x.sign === 1 ? 'border-green-300 bg-green-50 text-green-700' : 'border-red-300 bg-red-50 text-red-700'}`}
                          aria-label={x.sign === 1 ? 'Adds to pay (tap to make it a cut)' : 'Takes from pay (tap to make it an addition)'}
                          title={x.sign === 1 ? 'Adds to pay' : 'Takes from pay'}
                        >
                          {x.sign === 1 ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                        </button>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          value={x.amount}
                          onChange={(e) => setAdjs((list) => list.map((y, j) => (j === i ? { ...y, amount: e.target.value } : y)))}
                          className={inputClass}
                          placeholder="Rs"
                        />
                      </div>
                      <input
                        value={x.note}
                        onChange={(e) => setAdjs((list) => list.map((y, j) => (j === i ? { ...y, note: e.target.value } : y)))}
                        className={`${inputClass} order-4 sm:order-none col-span-2 sm:col-span-1`}
                        placeholder="Note (optional)"
                        maxLength={200}
                      />
                      <button
                        type="button"
                        onClick={() => setAdjs((list) => list.filter((_, j) => j !== i))}
                        className="h-9 w-9 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center order-2 sm:order-none"
                        aria-label="Remove adjustment"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setAdjs((list) => [...list, { key: `n${Date.now()}`, label: '', sign: -1, amount: '', note: '' }])}
                    className="text-xs font-semibold text-honey-700 hover:text-honey-900 inline-flex items-center gap-1"
                    disabled={adjs.length >= 20}
                  >
                    <Plus className="h-3.5 w-3.5" /> Add adjustment
                  </button>
                </div>
              </div>

              {line.advanceItems.length > 0 && (
                <Field
                  label="Advance recovery this month (Rs)"
                  hint={`Plan: ${formatRs(line.advanceSuggested)} (${line.advanceItems
                    .map((x) => `${x.advanceNo}: installment ${x.installmentNo} of ${x.installments}, balance ${formatRs(x.balance)}`)
                    .join('; ')}). Leave empty to follow the plan. Most you can take: ${formatRs(advanceBalance)}.`}
                >
                  <div className="flex gap-2">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={advanceBalance}
                      value={override}
                      onChange={(e) => setOverride(e.target.value)}
                      className={inputClass}
                      placeholder={String(line.advanceSuggested)}
                    />
                    {override !== '' && (
                      <button type="button" onClick={() => setOverride('')} className={secondaryBtn}>
                        Use plan
                      </button>
                    )}
                  </div>
                </Field>
              )}

              <Field label="Note on this line">
                <textarea value={note} onChange={(e) => setNote(e.target.value)} className={`${inputClass} min-h-[60px]`} maxLength={500} placeholder="Shown on the payslip" />
              </Field>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 border-t border-gray-200 bg-gray-50">
          <Link href={`/admin/hr/payroll/${run._id}/payslip/${line._id}`} className={secondaryBtn}>
            <FileText className="h-4 w-4" /> Payslip
          </Link>
          {editable && (
            <button type="button" onClick={save} disabled={saving || !dirty} aria-busy={saving} className={primaryBtn}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
