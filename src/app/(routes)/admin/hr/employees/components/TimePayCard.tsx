'use client';

// "Time & pay" card on the employee profile: default shift, weekly off, pay type
// (monthly / daily wage), HR policy, and whether their fingerprint is enrolled
// (read-only: attendance is marked only on the DOLLAR & Co Attendance desktop
// app). Backend: GET/PUT /api/hr/employees/:id/time-settings.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { AlertCircle, CalendarClock, Check, Fingerprint, Loader2, X } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage, formatRs, storeApi } from '@/lib/storeApi';
import { ErrorBox, Field, Modal, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { SectionCard } from './EmployeeBits';
import { DAYS, type Day } from '../services/employeeApi';
import { fmtDuration, fmtTime, type Shift } from '../../roster/services/rosterApi';
import { SearchSelect } from '@/components/ui/SearchSelect';
import MoneyInput from '@/components/ui/MoneyInput';

interface PolicyOption {
  _id: string;
  name: string;
  isDefault: boolean;
  summary: string;
}

interface TimeSettings {
  employeeId: string;
  name: string;
  defaultShift: Shift | null;
  weeklyOff: Day[];
  payType: 'monthly' | 'daily';
  dailyRate: number | null;
  hrPolicy: string | null;
  policy: PolicyOption;
  /** Enrolled on the Attendance desktop app. */
  fingerprint: { enrolled: boolean; fingers: number; lastEnrolledAt: string | null; list?: { finger: string; enrolledAt: string | null }[] };
  sensitiveHidden: boolean;
  options: { shifts: Shift[]; policies: PolicyOption[] };
}

type SettingsInput = { defaultShift: string | null; weeklyOff: Day[]; payType: 'monthly' | 'daily'; dailyRate: number; hrPolicy: string | null };

const base = (id: string) => `/hr/employees/${id}`;

function SettingsModal({ data, onClose, onSaved }: { data: TimeSettings; onClose: () => void; onSaved: (d: TimeSettings) => void }) {
  const [form, setForm] = useState<SettingsInput>({
    defaultShift: data.defaultShift?._id || null,
    weeklyOff: data.weeklyOff,
    payType: data.payType,
    dailyRate: data.dailyRate || 0,
    hrPolicy: data.hrPolicy,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const set = <K extends keyof SettingsInput>(k: K, v: SettingsInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const defaultPolicy = data.options.policies.find((p) => p.isDefault);
  const chosenPolicy = form.hrPolicy ? data.options.policies.find((p) => p._id === form.hrPolicy) : defaultPolicy;
  const shift = data.options.shifts.find((s) => s._id === form.defaultShift);

  const toggleDay = (d: Day) => set('weeklyOff', form.weeklyOff.includes(d) ? form.weeklyOff.filter((x) => x !== d) : [...form.weeklyOff, d]);

  const save = async () => {
    if (lock.current) return;
    if (form.payType === 'daily' && !(Number(form.dailyRate) > 0)) return setError('Enter the daily rate for a daily-wage employee');
    if (form.weeklyOff.length > 3) return setError('Pick at most 3 weekly off days');
    lock.current = true;
    setSaving(true);
    setError(null);
    try {
      const body: Partial<SettingsInput> = { defaultShift: form.defaultShift, weeklyOff: form.weeklyOff, payType: form.payType, hrPolicy: form.hrPolicy };
      if (!data.sensitiveHidden) body.dailyRate = Number(form.dailyRate) || 0;
      const res = await storeApi.put<TimeSettings>(`${base(data.employeeId)}/time-settings`, body);
      toast.success('Time & pay saved');
      onSaved(res.data);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not save.'));
      lock.current = false;
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Time & pay"
      subtitle={data.name}
      icon={<CalendarClock className="h-5 w-5" />}
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
      <fieldset disabled={saving} className="space-y-4">
        <ErrorBox message={error} />
        <Field label="Default shift" hint="Planned on normal days. Change single days on the roster.">
          <SearchSelect value={form.defaultShift || ''} onChange={(e) => set('defaultShift', e.target.value || null)} className={inputClass}>
            <option value="">No default shift</option>
            {data.options.shifts.map((s) => (
              <option key={s._id} value={s._id} disabled={!s.isActive && s._id !== data.defaultShift?._id}>
                {s.name} · {fmtTime(s.start)} – {fmtTime(s.end)}
                {s.isActive ? '' : ' (switched off)'}
              </option>
            ))}
          </SearchSelect>
          {shift && <p className="mt-1 text-[11px] text-gray-500">{fmtDuration(shift.workMinutes)} paid{shift.overnight ? ' · ends next day' : ''}</p>}
          {data.options.shifts.length === 0 && <p className="mt-1 text-[11px] text-amber-700">No shifts yet — create them under HR → Shifts &amp; Roster.</p>}
        </Field>

        <Field label="Weekly off">
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((d) => {
              const on = form.weeklyOff.includes(d.key);
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => toggleDay(d.key)}
                  aria-pressed={on}
                  className={`min-w-[44px] px-2.5 py-1.5 rounded-lg border text-xs font-medium ${on ? 'bg-gray-950 text-honey-400 border-gray-950' : 'bg-white text-gray-700 border-gray-300 hover:border-honey-500'}`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Pay type">
          <div className="grid grid-cols-2 gap-2">
            {(['monthly', 'daily'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => set('payType', t)}
                aria-pressed={form.payType === t}
                className={`px-3 py-2 rounded-lg border text-left text-sm ${form.payType === t ? 'border-gray-900 bg-honey-50 font-medium text-gray-900' : 'border-gray-300 text-gray-700 hover:border-honey-500'}`}
              >
                {t === 'monthly' ? 'Monthly salary' : 'Daily wage'}
                <span className="block text-[11px] font-normal text-gray-500">{t === 'monthly' ? 'Salary per month, cuts by policy' : 'Paid per day worked'}</span>
              </button>
            ))}
          </div>
        </Field>
        {form.payType === 'daily' && !data.sensitiveHidden && (
          <Field label="Daily rate (Rs)" required>
            <MoneyInput value={form.dailyRate || ''} onValue={(v) => set('dailyRate', Number(v))} placeholder="1200" className={inputClass} />
          </Field>
        )}

        <Field label="HR policy" hint="Attendance & pay rules (grace time, late and absent cuts, overtime, leave).">
          <SearchSelect value={form.hrPolicy || ''} onChange={(e) => set('hrPolicy', e.target.value || null)} className={inputClass}>
            <option value="">Default{defaultPolicy ? ` — ${defaultPolicy.name}` : ''}</option>
            {data.options.policies.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
                {p.isDefault ? ' (the default)' : ''}
              </option>
            ))}
          </SearchSelect>
          {chosenPolicy && <p className="mt-1 text-[11px] text-gray-600 bg-gray-50 rounded-md px-2 py-1">{chosenPolicy.summary}</p>}
        </Field>
      </fieldset>
    </Modal>
  );
}

/** '12 Oct' (this year) or '12 Oct 2025'. */
/** "right_index" -> "Right index finger" */
function fingerName(f: string): string {
  const [side, name] = f.split('_');
  if (!name) return f;
  return `${side.charAt(0).toUpperCase()}${side.slice(1)} ${name}${name === 'thumb' ? '' : ' finger'}`;
}

function shortDate(v: string | null): string {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}

export default function TimePayCard({ employeeId, onSaved }: { employeeId: string; onSaved?: () => void }) {
  const { can } = useAccess();
  const canEdit = can('employees', 'edit');
  // Same rule as the backend: employees edit OR attendance edit may remove fingers.
  const canRemoveFinger = can(['employees', 'attendance'], 'edit');
  const [confirmFinger, setConfirmFinger] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const canPolicies = can('hr_policies', 'view');
  const canRoster = can('shifts', 'view');
  const [data, setData] = useState<TimeSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setData((await storeApi.get<TimeSettings>(`${base(employeeId)}/time-settings`)).data);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load time & pay settings.'));
    }
  }, [employeeId]);
  useEffect(() => {
    load();
  }, [load]);

  // The counter PC drops a removed finger at its next sync (a few minutes).
  const removeFinger = async (finger: string) => {
    if (removing) return;
    setRemoving(true);
    try {
      await storeApi.del(`/desktop/fingerprints/${employeeId}/${finger}`);
      toast.success(`${fingerName(finger)} removed. Enroll again on the desktop app if needed.`);
      setConfirmFinger(null);
      await load();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not remove the fingerprint.'));
    } finally {
      setRemoving(false);
    }
  };

  const offDays = (data?.weeklyOff || []).map((d) => DAYS.find((x) => x.key === d)?.label || d);
  const s = data?.defaultShift;

  return (
    <SectionCard
      title="Time & pay"
      icon={<CalendarClock className="h-4 w-4" />}
      action={
        canEdit && data ? (
          <button type="button" onClick={() => setOpen(true)} className="text-xs font-medium text-honey-700 hover:text-honey-800">
            Edit
          </button>
        ) : undefined
      }
    >
      {error ? (
        <div className="flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={load} className="text-xs font-medium underline">
            Try again
          </button>
        </div>
      ) : !data ? (
        <p className="text-sm text-gray-500 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Default shift</p>
            {s ? (
              <p className="mt-0.5 text-sm text-gray-900 flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
                <span className="truncate">
                  {s.name} · {fmtTime(s.start)} – {fmtTime(s.end)}
                </span>
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-amber-700">Not set — no shift planned on normal days</p>
            )}
            <div className="mt-1.5 flex flex-wrap gap-1">
              {offDays.length ? (
                offDays.map((d) => (
                  <span key={d} className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">
                    {d} off
                  </span>
                ))
              ) : (
                <span className="text-[11px] text-gray-500">No weekly off</span>
              )}
            </div>
            {canRoster && (
              <Link href="/admin/hr/roster" className="mt-1 inline-block text-[11px] font-medium text-honey-700 hover:underline">
                Open roster
              </Link>
            )}
          </div>

          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Pay</p>
            <p className="mt-0.5 text-sm text-gray-900">
              {data.payType === 'daily' ? (data.dailyRate !== null ? `Daily wage · ${formatRs(data.dailyRate)} a day` : 'Daily wage') : 'Monthly salary'}
            </p>
          </div>

          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">HR policy</p>
            <p className="mt-0.5 text-sm text-gray-900">
              {data.policy.name}
              {data.hrPolicy === null && <span className="ml-1 text-[11px] text-gray-500">(default)</span>}
            </p>
            <p className="text-[11px] text-gray-500 line-clamp-3">{data.policy.summary}</p>
            {canPolicies && (
              <Link href="/admin/hr/policies" className="mt-1 inline-block text-[11px] font-medium text-honey-700 hover:underline">
                See policies
              </Link>
            )}
          </div>

          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Fingerprint</p>
            {data.fingerprint.enrolled ? (
              <>
                <p className="mt-0.5 text-sm text-gray-900 flex items-start gap-1.5">
                  <Fingerprint className="h-4 w-4 text-green-600 flex-shrink-0 mt-px" />
                  <span>
                    Enrolled ({data.fingerprint.fingers} finger{data.fingerprint.fingers === 1 ? '' : 's'})
                    {data.fingerprint.lastEnrolledAt ? ` on ${shortDate(data.fingerprint.lastEnrolledAt)}` : ''}
                  </span>
                </p>
                {canRemoveFinger && (data.fingerprint.list || []).length > 0 && (
                  <ul className="mt-1 space-y-1">
                    {(data.fingerprint.list || []).map((f) => (
                      <li key={f.finger} className="flex items-center justify-between gap-2 text-xs text-gray-700">
                        <span className="truncate">{fingerName(f.finger)}</span>
                        {confirmFinger === f.finger ? (
                          <span className="flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              disabled={removing}
                              onClick={() => removeFinger(f.finger)}
                              className="rounded bg-red-600 px-2 py-0.5 font-medium text-white hover:bg-red-700 disabled:opacity-60"
                            >
                              {removing ? 'Removing…' : 'Remove'}
                            </button>
                            <button type="button" disabled={removing} onClick={() => setConfirmFinger(null)} className="rounded px-1.5 py-0.5 text-gray-600 hover:bg-gray-100">
                              Keep
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmFinger(f.finger)}
                            className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-gray-500 hover:bg-red-50 hover:text-red-700 flex-shrink-0"
                            aria-label={`Remove ${fingerName(f.finger)}`}
                          >
                            <X className="h-3 w-3" /> Remove
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="mt-0.5 text-sm text-amber-700 flex items-start gap-1.5">
                <Fingerprint className="h-4 w-4 flex-shrink-0 mt-px" />
                <span>Not enrolled — enroll on the DOLLAR &amp; Co Attendance desktop app</span>
              </p>
            )}
            <p className="mt-1 text-[11px] text-gray-500">Attendance is marked only on the desktop app.</p>
          </div>
        </div>
      )}

      {open && data && (
        <SettingsModal
          data={data}
          onClose={() => setOpen(false)}
          onSaved={(d) => {
            setData(d);
            setOpen(false);
            onSaved?.();
          }}
        />
      )}
    </SectionCard>
  );
}
