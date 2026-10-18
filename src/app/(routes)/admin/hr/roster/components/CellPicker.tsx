'use client';

// Picker for one roster cell or many selected cells: a shift, day off, leave,
// or "use normal plan" (removes the change). Saves as soon as an option is tapped.
import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { CalendarOff, CalendarX2, Loader2, RotateCcw, Stethoscope, Wallet } from 'lucide-react';
import { apiErrorMessage } from '@/lib/storeApi';
import { ErrorBox, Field, Modal, inputClass } from '@/components/admin/FormBits';
import {
  LEAVE_LABEL,
  dayLabel,
  fmtHours,
  fmtShort,
  rosterApi,
  tint,
  type CellChange,
  type LeaveType,
  type RosterCell,
  type RosterDay,
  type RosterEmployee,
  type Shift,
} from '../services/rosterApi';

export interface PickTarget {
  employee: RosterEmployee;
  cell: RosterCell;
  day: RosterDay;
}

/** What the employee does on that day without a roster change. */
export function normalPlan(employee: RosterEmployee, day: RosterDay): string {
  if (day.holiday) return `Holiday (${day.holiday.name})`;
  if (employee.weeklyOff.includes(day.weekday)) return 'Weekly off';
  const s = employee.defaultShift;
  if (s) return `${s.name} ${fmtShort(s.start)}–${fmtShort(s.end)}`;
  return 'No default shift';
}

type Choice = { type: CellChange['type']; shiftId?: string; leaveType?: LeaveType };

export default function CellPicker({
  targets,
  shifts,
  onClose,
  onSaved,
}: {
  targets: PickTarget[];
  shifts: Shift[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const single = targets.length === 1 ? targets[0] : null;
  const [note, setNote] = useState(single?.cell.isOverride ? single.cell.note : '');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  const current = (c: Choice) => {
    if (!single || !single.cell.isOverride) return c.type === 'default' && !!single;
    const cell = single.cell;
    if (c.type === 'shift') return cell.type === 'shift' && cell.shiftId === c.shiftId;
    if (c.type === 'leave') return cell.type === 'leave' && cell.leaveType === c.leaveType;
    return cell.type === c.type;
  };

  const save = async (key: string, c: Choice) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(key);
    setError(null);
    try {
      const cells: CellChange[] = targets.map((t) => ({
        employeeId: t.employee._id,
        date: t.cell.date,
        type: c.type,
        ...(c.shiftId ? { shiftId: c.shiftId } : {}),
        ...(c.leaveType ? { leaveType: c.leaveType } : {}),
        ...(c.type !== 'default' && note.trim() ? { note: note.trim() } : {}),
      }));
      const res = await rosterApi.saveCells(cells);
      const n = res.saved + res.cleared;
      toast.success(n === 1 ? 'Roster updated' : `${n} days updated`);
      if (res.skipped) toast(`${res.skipped} day${res.skipped === 1 ? ' was' : 's were'} skipped (before joining or after leaving).`, { icon: 'ℹ️' });
      onSaved();
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not save the roster.'));
      lock.current = false;
      setBusy(null);
    }
  };

  const title = single ? single.employee.name : `${targets.length} days selected`;
  const subtitle = single
    ? `${dayLabel(single.cell.date).dow} ${dayLabel(single.cell.date).day} · normal plan: ${normalPlan(single.employee, single.day)}`
    : [...new Set(targets.map((t) => t.employee.name))].slice(0, 3).join(', ') + (new Set(targets.map((t) => t.employee._id)).size > 3 ? ' …' : '');

  const optionCls = (active: boolean) =>
    `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left text-sm transition-colors disabled:opacity-60 ${
      active ? 'border-gray-900 bg-honey-50' : 'border-gray-200 hover:border-honey-500 hover:bg-honey-50/50'
    }`;
  const spin = (key: string) => busy === key && <Loader2 className="h-4 w-4 animate-spin ml-auto text-gray-500" />;
  const disabled = !!busy;

  return (
    <Modal title={title} subtitle={subtitle} onClose={onClose} busy={!!busy}>
      <div className="space-y-4">
        <ErrorBox message={error} />

        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Shift</h3>
          {shifts.length === 0 ? (
            <p className="text-sm text-gray-500">No shifts yet — add them in the Shifts tab.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {shifts.map((s) => {
                const key = `shift:${s._id}`;
                return (
                  <button key={s._id} type="button" disabled={disabled} onClick={() => save(key, { type: 'shift', shiftId: s._id })} className={optionCls(current({ type: 'shift', shiftId: s._id }))}>
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-xs font-bold text-gray-900" style={{ backgroundColor: s.color }}>
                      {s.code || s.name.slice(0, 1)}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-medium text-gray-900 truncate">{s.name}</span>
                      <span className="block text-xs text-gray-500">
                        {fmtShort(s.start)}–{fmtShort(s.end)}
                        {s.overnight ? ' (next day)' : ''} · {fmtHours(s.workMinutes)}
                      </span>
                    </span>
                    {spin(key)}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Not working</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button type="button" disabled={disabled} onClick={() => save('off', { type: 'off' })} className={optionCls(current({ type: 'off' }))}>
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-100 text-gray-600">
                <CalendarOff className="h-4 w-4" />
              </span>
              <span className="font-medium text-gray-900">Day off</span>
              {spin('off')}
            </button>
            {(['paid', 'unpaid', 'sick'] as LeaveType[]).map((lt) => {
              const key = `leave:${lt}`;
              const Icon = lt === 'sick' ? Stethoscope : lt === 'paid' ? Wallet : CalendarX2;
              return (
                <button key={lt} type="button" disabled={disabled} onClick={() => save(key, { type: 'leave', leaveType: lt })} className={optionCls(current({ type: 'leave', leaveType: lt }))}>
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-violet-50 text-violet-700">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium text-gray-900">{LEAVE_LABEL[lt]} leave</span>
                    <span className="block text-[11px] text-gray-500">{lt === 'unpaid' ? 'Cut from pay' : 'Within the monthly quota of their HR policy'}</span>
                  </span>
                  {spin(key)}
                </button>
              );
            })}
          </div>
        </section>

        <button
          type="button"
          disabled={disabled}
          onClick={() => save('default', { type: 'default' })}
          className={optionCls(current({ type: 'default' }))}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-md" style={{ backgroundColor: tint('#FFD60A') }}>
            <RotateCcw className="h-4 w-4 text-honey-800" />
          </span>
          <span className="min-w-0">
            <span className="block font-medium text-gray-900">Use normal plan</span>
            <span className="block text-[11px] text-gray-500">{single ? normalPlan(single.employee, single.day) : "Each person's default shift and weekly off"}</span>
          </span>
          {spin('default')}
        </button>

        <Field label="Note (optional)" hint="Saved with a shift, off or leave, e.g. “Cover for Sana”.">
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} disabled={disabled} placeholder="Reason for the change" className={inputClass} />
        </Field>
      </div>
    </Modal>
  );
}
