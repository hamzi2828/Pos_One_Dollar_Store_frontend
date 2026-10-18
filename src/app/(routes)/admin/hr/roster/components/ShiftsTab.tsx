'use client';

// Shift types: name, short code for the roster, start / end time, unpaid break
// and a colour. An end time at or before the start = a night shift ending next day.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertCircle, Check, Clock, Edit2, Loader2, Moon, Plus, Power, Trash2 } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage } from '@/lib/storeApi';
import { ErrorBox, Field, LoadingCard, Modal, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { SHIFT_COLORS, fmtDuration, fmtTime, rosterApi, spanMinutes, type Shift, type ShiftInput } from '../services/rosterApi';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function ShiftForm({ shift, onClose, onSaved }: { shift: Shift | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<ShiftInput>(
    shift
      ? { name: shift.name, code: shift.code, start: shift.start, end: shift.end, breakMinutes: shift.breakMinutes, color: shift.color }
      : { name: '', code: '', start: '10:00', end: '18:00', breakMinutes: 30, color: SHIFT_COLORS[0] }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const set = <K extends keyof ShiftInput>(k: K, v: ShiftInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const timesOk = TIME_RE.test(form.start) && TIME_RE.test(form.end) && form.start !== form.end;
  const span = timesOk ? spanMinutes(form.start, form.end) : 0;
  const brk = Math.max(0, Number(form.breakMinutes) || 0);
  const overnight = timesOk && form.end <= form.start;

  const save = async () => {
    if (lock.current) return;
    if (!form.name.trim()) return setError('Give the shift a name, e.g. Morning');
    if (!timesOk) return setError('Pick a start and an end time (they cannot be the same)');
    if (brk >= span) return setError('The break must be shorter than the shift');
    lock.current = true;
    setSaving(true);
    setError(null);
    try {
      const body = { ...form, name: form.name.trim(), code: form.code.trim().toUpperCase(), breakMinutes: brk };
      if (shift) {
        const s = await rosterApi.updateShift(shift._id, body);
        toast.success('Shift saved');
        if (s.recomputed) toast(`Attendance re-checked for ${s.recomputed} day${s.recomputed === 1 ? '' : 's'} this month.`, { icon: 'ℹ️' });
      } else {
        await rosterApi.createShift(body);
        toast.success('Shift added');
      }
      onSaved();
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not save the shift.'));
      lock.current = false;
      setSaving(false);
    }
  };

  return (
    <Modal
      title={shift ? 'Edit shift' : 'New shift'}
      icon={<Clock className="h-5 w-5" />}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className={secondaryBtn}>
            Cancel
          </button>
          <button type="button" onClick={save} disabled={saving} className={primaryBtn}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <fieldset disabled={saving} className="space-y-4">
          <ErrorBox message={error} />
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Field label="Name" required>
                <input value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={60} placeholder="Morning" className={inputClass} autoFocus />
              </Field>
            </div>
            <Field label="Code" hint="On the roster">
              <input value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} maxLength={4} placeholder={form.name.slice(0, 1).toUpperCase() || 'M'} className={`${inputClass} uppercase`} />
            </Field>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="Starts" required>
              <input type="time" value={form.start} onChange={(e) => set('start', e.target.value)} className={inputClass} />
            </Field>
            <Field label="Ends" required>
              <input type="time" value={form.end} onChange={(e) => set('end', e.target.value)} className={inputClass} />
            </Field>
            <div className="col-span-2 sm:col-span-1">
              <Field label="Break (minutes)" hint="Unpaid">
                <input type="number" min={0} step={5} inputMode="numeric" value={form.breakMinutes} onChange={(e) => set('breakMinutes', Number(e.target.value))} className={inputClass} />
              </Field>
            </div>
          </div>

          {timesOk && (
            <div className={`rounded-lg border px-3 py-2 text-sm ${brk >= span ? 'border-red-200 bg-red-50 text-red-700' : 'border-honey-200 bg-honey-50 text-gray-800'}`}>
              {fmtTime(form.start)} – {fmtTime(form.end)}
              {overnight && (
                <span className="ml-1 inline-flex items-center gap-1 text-xs font-semibold text-indigo-700">
                  <Moon className="h-3.5 w-3.5" /> ends next day
                </span>
              )}
              <span className="block text-xs text-gray-600 mt-0.5">
                {fmtDuration(span)} at the shop{brk ? ` − ${fmtDuration(brk)} break` : ''} = <b>{fmtDuration(Math.max(0, span - brk))} paid</b>
              </span>
              {overnight && <span className="block text-[11px] text-gray-500 mt-0.5">A night shift belongs to the day it starts (e.g. Monday 6 PM – Tuesday 2 AM is Monday).</span>}
            </div>
          )}

          <Field label="Colour">
            <div className="flex flex-wrap gap-2">
              {SHIFT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set('color', c)}
                  aria-label={`Colour ${c}`}
                  aria-pressed={form.color.toUpperCase() === c}
                  className={`h-8 w-8 rounded-full border-2 flex items-center justify-center ${form.color.toUpperCase() === c ? 'border-gray-900' : 'border-white shadow'}`}
                  style={{ backgroundColor: c }}
                >
                  {form.color.toUpperCase() === c && <Check className="h-4 w-4 text-gray-900" />}
                </button>
              ))}
            </div>
          </Field>
        </fieldset>
      </form>
    </Modal>
  );
}

export default function ShiftsTab() {
  const { can } = useAccess();
  const canCreate = can('shifts', 'create');
  const canEdit = can('shifts', 'edit');
  const canDelete = can('shifts', 'delete');
  const [shifts, setShifts] = useState<Shift[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Shift | null | 'new'>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const lock = useRef(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setShifts(await rosterApi.shifts());
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load the shifts.'));
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const run = async (id: string, fn: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusyId(id);
    try {
      await fn();
    } finally {
      lock.current = false;
      setBusyId(null);
    }
  };

  const toggleActive = (s: Shift) => {
    if (s.isActive && s.defaultFor && !window.confirm(`${s.defaultFor} employee(s) work "${s.name}" by default. Switched off, it stays their default but cannot be picked for new days. Switch it off?`)) return;
    run(s._id, async () => {
      try {
        await rosterApi.setShiftActive(s._id, !s.isActive);
        toast.success(s.isActive ? 'Shift switched off' : 'Shift switched on');
        await load();
      } catch (e) {
        toast.error(apiErrorMessage(e, 'Could not change the shift.'));
      }
    });
  };

  const remove = (s: Shift) => {
    if (!window.confirm(`Delete the shift "${s.name}"?\n\nOld attendance keeps its times.`)) return;
    run(s._id, async () => {
      try {
        await rosterApi.removeShift(s._id);
        toast.success('Shift deleted');
        await load();
      } catch (e) {
        toast.error(apiErrorMessage(e, 'Could not delete the shift.'), { duration: 6000 });
      }
    });
  };

  if (!shifts && !error) return <LoadingCard text="Loading shifts…" />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs sm:text-sm text-gray-500">The shift types your shop works. Give each employee a default shift on their profile; change single days on the roster.</p>
        {canCreate && (
          <button type="button" onClick={() => setEditing('new')} className={primaryBtn}>
            <Plus className="h-4 w-4" /> New shift
          </button>
        )}
      </div>

      {error && (
        <div className="bg-white rounded-lg border border-red-200 p-4 flex items-center gap-3 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={load} className={secondaryBtn}>
            Try again
          </button>
        </div>
      )}

      {shifts && shifts.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 text-center py-12 px-4">
          <Clock className="h-10 w-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-600">No shifts yet.</p>
          <p className="text-xs text-gray-500 mt-1">For example: Morning 10:00 AM – 6:00 PM, Evening 4:00 PM – 12:00 AM.</p>
        </div>
      )}

      {shifts && shifts.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {shifts.map((s) => (
            <div key={s._id} className={`p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${s.isActive ? '' : 'opacity-60'}`}>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-sm font-bold text-gray-900" style={{ backgroundColor: s.color }}>
                  {s.code || s.name.slice(0, 1)}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 flex flex-wrap items-center gap-2">
                    {s.name}
                    {!s.isActive && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-700">Switched off</span>}
                    {s.overnight && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                        <Moon className="h-3 w-3" /> Ends next day
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-600">
                    {fmtTime(s.start)} – {fmtTime(s.end)} · {fmtDuration(s.workMinutes)} paid{s.breakMinutes ? ` (${s.breakMinutes} min break)` : ''}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {s.defaultFor ? `Default for ${s.defaultFor} employee${s.defaultFor === 1 ? '' : 's'}` : 'Nobody has it as default'}
                    {s.upcomingDays ? ` · ${s.upcomingDays} roster day${s.upcomingDays === 1 ? '' : 's'} ahead` : ''}
                  </p>
                </div>
              </div>
              {(canEdit || canDelete) && (
                <div className="flex gap-1 self-end sm:self-auto">
                  {canEdit && (
                    <button type="button" onClick={() => setEditing(s)} disabled={busyId === s._id} className="p-2 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-100" aria-label={`Edit ${s.name}`}>
                      <Edit2 className="h-4 w-4" />
                    </button>
                  )}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => toggleActive(s)}
                      disabled={busyId === s._id}
                      className="p-2 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                      aria-label={s.isActive ? `Switch off ${s.name}` : `Switch on ${s.name}`}
                      title={s.isActive ? 'Switch off' : 'Switch on'}
                    >
                      {busyId === s._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className={`h-4 w-4 ${s.isActive ? '' : 'text-green-600'}`} />}
                    </button>
                  )}
                  {canDelete && (
                    <button type="button" onClick={() => remove(s)} disabled={busyId === s._id} className="p-2 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50" aria-label={`Delete ${s.name}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editing && (
        <ShiftForm
          shift={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}
