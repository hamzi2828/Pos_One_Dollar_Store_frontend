'use client';

// One employee's shop day: plan, times (fingerprint or corrected), minutes,
// fingerprint punches, correction history — plus "Correct times" (reason
// required: corrections are the only change made outside the fingerprint
// desktop app), overtime approve / reject and "Don't count this late" (reason
// required, can be undone: the late stays shown but is not cut). Locked days
// are read-only.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { CalendarClock, Check, CircleSlash, Fingerprint, History, Info, Loader2, Lock, Pencil, RotateCcw, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { ErrorBox, Field, Modal, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { apiErrorMessage } from '@/lib/storeApi';
import {
  addDays,
  attendanceApi,
  clock,
  dayLabel,
  fileUrl,
  mins,
  planText,
  shopDay,
  shopHHmm,
  shopIso,
  type Correction,
  type DayDetail,
} from '../services/attendanceApi';
import { LateBadge, PhotoViewer, SourceTag, StatusChip } from './AttendanceBits';

const FIELD_LABEL: Record<string, string> = { checkIn: 'Check-in', checkOut: 'Check-out', overtime: 'Overtime', status: 'Status', lateExcuse: 'Late' };

function correctionValue(c: Correction, v: string | boolean | null) {
  if (c.field === 'overtime') return v === true ? 'approved' : v === false ? 'rejected' : 'waiting';
  if (c.field === 'lateExcuse') return v === true ? 'not counted' : 'counted';
  return v ? `${clock(String(v))} (${dayLabel(shopDay(String(v)), { day: 'numeric', month: 'short' })})` : 'empty';
}

export default function DayModal({
  employeeId,
  employeeName,
  date,
  canEdit,
  startEditing,
  onClose,
  onChanged,
}: {
  employeeId: string;
  employeeName: string;
  date: string;
  canEdit: boolean;
  startEditing?: boolean;
  onClose: () => void;
  /** Called after a correction / overtime decision (parent reloads its list). */
  onChanged: () => void;
}) {
  const [day, setDay] = useState<DayDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(!!startEditing);
  const [inDate, setInDate] = useState(date);
  const [inTime, setInTime] = useState('');
  const [outDate, setOutDate] = useState(date);
  const [outTime, setOutTime] = useState('');
  const [reason, setReason] = useState('');
  const [otReason, setOtReason] = useState('');
  const [excusing, setExcusing] = useState(false);
  const [excuseReason, setExcuseReason] = useState('');
  const [excuseError, setExcuseError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<{ url: string; caption: string } | null>(null);
  const lock = useRef(false);

  const fillForm = useCallback(
    (d: DayDetail) => {
      // Night shift: the check-out is usually the next day.
      const endDay = d.plan.end ? shopDay(d.plan.end) : date;
      setInDate(d.checkIn ? shopDay(d.checkIn) : date);
      setInTime(d.checkIn ? shopHHmm(d.checkIn) : d.plan.start ? shopHHmm(d.plan.start) : '');
      setOutDate(d.checkOut ? shopDay(d.checkOut) : endDay);
      setOutTime(d.checkOut ? shopHHmm(d.checkOut) : '');
    },
    [date],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await attendanceApi.day(employeeId, date);
      setDay(d);
      fillForm(d);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load this day.'));
    } finally {
      setLoading(false);
    }
  }, [employeeId, date, fillForm]);

  useEffect(() => {
    load();
  }, [load]);

  const editable = canEdit && !!day && !day.locked && !day.notEmployed;
  // Worked on a day with no shift / roster: late can't be worked out.
  const noShift = !!day && day.plan.type === 'none' && !day.notEmployed;

  const save = async () => {
    if (lock.current || !day) return;
    if (!reason.trim()) {
      setFormError('Write the reason for this correction.');
      return;
    }
    if (outTime && !inTime) {
      setFormError('A check-out needs a check-in time too.');
      return;
    }
    const checkIn = inTime ? shopIso(inDate, inTime) : null;
    const checkOut = outTime ? shopIso(outDate, outTime) : null;
    if (checkIn && checkOut && new Date(checkOut) <= new Date(checkIn)) {
      setFormError('Check-out must be after check-in.');
      return;
    }
    lock.current = true;
    setSaving(true);
    setFormError(null);
    try {
      const res = await attendanceApi.correct({ employeeId, date, checkIn, checkOut, reason: reason.trim() });
      toast.success(res.message || 'Times corrected');
      setDay(res.data);
      fillForm(res.data);
      setReason('');
      setEditing(false);
      onChanged();
    } catch (e) {
      setFormError(apiErrorMessage(e, 'Could not save the correction.'));
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  const decide = async (approved: boolean) => {
    if (lock.current || !day?.recordId) return;
    lock.current = true;
    setSaving(true);
    try {
      const res = await attendanceApi.overtime({ recordIds: [day.recordId], approved, reason: otReason.trim() || undefined });
      toast.success(res.message || (approved ? 'Overtime approved' : 'Overtime rejected'));
      setOtReason('');
      onChanged();
      await load();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not save the decision.'));
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  /** Don't count this late (reason required) / count it again. */
  const setLateExcused = async (excused: boolean) => {
    if (lock.current || !day) return;
    if (excused && !excuseReason.trim()) {
      setExcuseError('Write a short reason, e.g. "Bus was late".');
      return;
    }
    lock.current = true;
    setSaving(true);
    setExcuseError(null);
    try {
      const res = await attendanceApi.excuseLate({ employeeId, date, excused, reason: excused ? excuseReason.trim() : undefined });
      toast.success(res.message || (excused ? 'Late not counted' : 'Late counted again'));
      setDay(res.data);
      setExcusing(false);
      setExcuseReason('');
      onChanged();
    } catch (e) {
      const msg = apiErrorMessage(e, 'Could not save.');
      if (excused) setExcuseError(msg);
      else toast.error(msg);
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  const otState = !day?.overtimeMinutes ? null : day.overtimeApproved === true ? 'Approved' : day.overtimeApproved === false ? 'Rejected' : 'Waiting for approval';

  return (
    <Modal
      title={employeeName}
      subtitle={dayLabel(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      icon={<CalendarClock className="h-5 w-5" />}
      onClose={onClose}
      busy={saving}
      footer={
        editing && editable ? (
          <>
            <button type="button" className={secondaryBtn} onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </button>
            <button type="button" className={primaryBtn} onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save correction
            </button>
          </>
        ) : (
          <>
            {editable && (
              <button type="button" className={primaryBtn} onClick={() => setEditing(true)}>
                Correct times
              </button>
            )}
            <button type="button" className={secondaryBtn} onClick={onClose}>
              Close
            </button>
          </>
        )
      }
    >
      {loading && !day ? (
        <div className="py-10 text-center">
          <Loader2 className="h-6 w-6 text-honey-700 animate-spin mx-auto" />
        </div>
      ) : error ? (
        <div className="space-y-3">
          <ErrorBox message={error} />
          <button type="button" className={secondaryBtn} onClick={load}>
            Try again
          </button>
        </div>
      ) : day ? (
        <div className="space-y-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip status={day.status} />
              <LateBadge minutes={day.lateMinutes} excused={day.lateExcused} />
              <span className="text-sm text-gray-600">{planText(day.plan)}</span>
              {day.policyName && <span className="text-[11px] text-gray-400">· {day.policyName}</span>}
            </div>
            {day.plan.type === 'shift' && day.lateMinutes > 0 && (
              <p className="text-[11px] text-gray-500">
                Shift {clock(day.plan.start)} · grace {day.graceMinutes ?? 0} min · checked in {clock(day.checkIn)}
              </p>
            )}
          </div>
          {noShift && (
            <div className="flex items-start gap-2 px-3 py-2 text-xs bg-blue-50 border border-blue-200 rounded-lg text-blue-900">
              <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span>
                No shift on this day, so late can&apos;t be worked out — set a shift in{' '}
                <Link href={`/admin/hr/roster?employeeId=${employeeId}&date=${date}`} className="font-semibold underline">
                  Roster
                </Link>{' '}
                or on the{' '}
                <Link href={`/admin/hr/employees/${employeeId}/edit`} className="font-semibold underline">
                  employee
                </Link>
                .
              </span>
            </div>
          )}
          {day.locked && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg text-gray-600">
              <Lock className="h-4 w-4" /> Payroll for this month is approved — this day can no longer be changed.
            </div>
          )}
          {day.notEmployed && <p className="text-xs text-gray-500">Not working here on this day.</p>}

          {day.lastCorrection && (
            <div className="flex items-start gap-2 px-3 py-2 text-xs bg-honey-50 border border-honey-200 rounded-lg text-gray-800">
              <Pencil className="h-3.5 w-3.5 mt-0.5 text-honey-700 flex-shrink-0" />
              <span>
                <strong>Corrected by {day.lastCorrection.byName || 'manager'}:</strong> {day.lastCorrection.reason}
              </span>
            </div>
          )}

          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <Fact label="Check-in" value={day.checkIn ? clock(day.checkIn) : '—'} tag={<SourceTag source={day.inSource} />} />
            <Fact label="Check-out" value={day.checkOut ? clock(day.checkOut) : '—'} tag={<SourceTag source={day.outSource} />} />
            <Fact label="Worked" value={day.workedMinutes ? mins(day.workedMinutes) : '—'} />
            <Fact
              label="Late"
              value={day.lateMinutes ? `${mins(day.lateMinutes)}${day.lateExcused ? ' · excused' : ''}` : noShift ? 'No shift' : '—'}
              warn={!!day.lateMinutes && !day.lateExcused}
            />
            <Fact label="Left early" value={day.earlyLeaveMinutes ? mins(day.earlyLeaveMinutes) : '—'} warn={!!day.earlyLeaveMinutes} />
            <Fact label="Overtime" value={day.overtimeMinutes ? `${mins(day.overtimeMinutes)} · ${otState}` : '—'} />
            <Fact
              label="Break"
              value={day.breakMinutes ? `${mins(day.breakMinutes)}${day.overBreakMinutes ? ` · ${mins(day.overBreakMinutes)} over` : ''}` : '—'}
              warn={!!day.overBreakMinutes}
            />
          </dl>

          {!!day.overtimeMinutes && canEdit && !day.locked && (
            <div className="p-3 rounded-lg border border-honey-200 bg-honey-50 space-y-2">
              <p className="text-xs font-medium text-gray-800">
                {mins(day.overtimeMinutes)} overtime — {otState}. Overtime is paid only after approval.
              </p>
              <input value={otReason} onChange={(e) => setOtReason(e.target.value)} placeholder="Note (optional)" className={inputClass} maxLength={300} />
              <div className="flex gap-2">
                <button type="button" onClick={() => decide(true)} disabled={saving || day.overtimeApproved === true} className={`${primaryBtn} flex-1`}>
                  <Check className="h-4 w-4" /> Approve
                </button>
                <button type="button" onClick={() => decide(false)} disabled={saving || day.overtimeApproved === false} className={`${secondaryBtn} flex-1`}>
                  <X className="h-4 w-4" /> Reject
                </button>
              </div>
            </div>
          )}

          {day.lateMinutes > 0 && day.lateExcused && (
            <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50 space-y-2">
              <p className="text-xs text-emerald-900">
                <strong>Late {mins(day.lateMinutes)} — not counted (no cut).</strong>
                {day.lateExcuse?.reason ? ` “${day.lateExcuse.reason}”` : ''}
                {day.lateExcuse?.byName ? ` — ${day.lateExcuse.byName}` : ''}
              </p>
              {editable && (
                <button type="button" onClick={() => setLateExcused(false)} disabled={saving} className={secondaryBtn}>
                  <RotateCcw className="h-4 w-4" /> Count this late again
                </button>
              )}
            </div>
          )}

          {day.lateMinutes > 0 && !day.lateExcused && editable && (
            <div className="p-3 rounded-lg border border-red-200 bg-red-50 space-y-2">
              {!excusing ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-red-900">This late counts for the late cut in payroll.</p>
                  <button type="button" onClick={() => setExcusing(true)} disabled={saving} className={secondaryBtn}>
                    <CircleSlash className="h-4 w-4" /> Don&apos;t count this late (no cut)
                  </button>
                </div>
              ) : (
                <>
                  <Field label="Why not count it?" required hint="Saved in the history with your name. You can undo it later.">
                    <input
                      value={excuseReason}
                      onChange={(e) => setExcuseReason(e.target.value)}
                      placeholder="e.g. Bus was late, told the manager"
                      className={inputClass}
                      maxLength={300}
                      autoFocus
                    />
                  </Field>
                  <ErrorBox message={excuseError} />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setLateExcused(true)} disabled={saving} className={`${primaryBtn} flex-1`}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Don&apos;t count
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setExcusing(false);
                        setExcuseError(null);
                      }}
                      disabled={saving}
                      className={`${secondaryBtn} flex-1`}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {editing && editable && (
            <div className="p-3 rounded-lg border border-gray-200 bg-gray-50 space-y-3">
              <p className="text-xs text-gray-600">Shop time (Pakistan). Leave a time empty to clear it. Staff normally clock in with their fingerprint — use this only to fix a day.</p>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Check-in day">
                  <input type="date" value={inDate} min={addDays(date, -1)} max={addDays(date, 1)} onChange={(e) => setInDate(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Check-in time">
                  <input type="time" value={inTime} onChange={(e) => setInTime(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Check-out day">
                  <input type="date" value={outDate} min={date} max={addDays(date, 2)} onChange={(e) => setOutDate(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Check-out time">
                  <input type="time" value={outTime} onChange={(e) => setOutTime(e.target.value)} className={inputClass} />
                </Field>
              </div>
              <Field label="Reason" required hint="Saved in the history with your name.">
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Forgot to clock out, left at 6 pm"
                  className={inputClass}
                  maxLength={300}
                  autoFocus
                />
              </Field>
              <ErrorBox message={formError} />
            </div>
          )}

          {day.punches.length > 0 && (
            <section>
              <h3 className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                <Fingerprint className="h-3.5 w-3.5" /> Punches
              </h3>
              <ul className="space-y-1.5">
                {day.punches.map((p, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm">
                    {p.photo ? (
                      <button type="button" onClick={() => setPhoto({ url: p.photo as string, caption: `${p.kind === 'in' ? 'In' : 'Out'} ${clock(p.at)}` })} className="flex-shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={fileUrl(p.photo)} alt="Clock-in photo" className="h-10 w-10 rounded-md object-cover border border-gray-200" />
                      </button>
                    ) : null}
                    <span className={`font-semibold ${p.kind === 'in' ? 'text-green-700' : p.kind === 'out' ? 'text-blue-700' : 'text-amber-700'}`}>
                      {p.kind === 'in' ? 'IN' : p.kind === 'out' ? 'OUT' : p.kind === 'break_start' ? 'BREAK' : 'BACK'}
                    </span>
                    <span className="text-gray-900">{clock(p.at)}</span>
                    <span className="text-xs text-gray-500 truncate">
                      {p.source === 'device' ? 'Fingerprint (desktop app)' : p.source === 'manual' ? `By hand${p.by ? ` · ${p.by}` : ''}` : 'Web clock-in (old)'}
                      {p.note ? ` · ${p.note}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {day.correctionLog.length > 0 && (
            <section>
              <h3 className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                <History className="h-3.5 w-3.5" /> Changes
              </h3>
              <ul className="space-y-2">
                {[...day.correctionLog].reverse().map((c, i) => (
                  <li key={i} className="text-xs text-gray-700 border-l-2 border-honey-400 pl-2">
                    <span className="font-medium">{FIELD_LABEL[c.field] || c.field}</span>: {correctionValue(c, c.from)} → {correctionValue(c, c.to)}
                    <span className="block text-gray-500">
                      “{c.reason}” — {c.byName || 'someone'}, {dayLabel(shopDay(c.at), { day: 'numeric', month: 'short' })} {clock(c.at)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      ) : null}
      {photo && <PhotoViewer url={photo.url} caption={photo.caption} onClose={() => setPhoto(null)} />}
    </Modal>
  );
}

function Fact({ label, value, warn, tag }: { label: string; value: string; warn?: boolean; tag?: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className={`mt-0.5 font-medium break-words flex flex-wrap items-center gap-1 ${warn ? 'text-amber-700' : 'text-gray-900'}`}>
        {value}
        {tag}
      </dd>
    </div>
  );
}
