'use client';

// Create / edit one HR policy. Rules are grouped Attendance · Pay · Overtime ·
// Leave · Till shortage; the box on top shows the plain-English summary and a
// live example in rupees for a sample salary while you type.
import React, { useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Banknote, Check, Clock, Loader2, ScrollText, Timer, Umbrella, Wallet } from 'lucide-react';
import { apiErrorMessage } from '@/lib/storeApi';
import { ErrorBox, Field, Modal, Toggle, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { EXAMPLE_DAY_HOURS, exampleLines, policyApi, summaryParts, type FieldLimit, type Policy, type PolicyInput, type PolicyRules } from '../services/policyApi';

type Obj = Record<string, unknown>;
const getAt = (o: unknown, path: string): unknown => path.split('.').reduce<unknown>((x, k) => (x && typeof x === 'object' ? (x as Obj)[k] : undefined), o);
function setAt<T>(o: T, path: string, v: unknown): T {
  const copy = structuredClone(o) as unknown as Obj;
  const keys = path.split('.');
  let cur = copy;
  for (const k of keys.slice(0, -1)) cur = cur[k] as Obj;
  cur[keys[keys.length - 1]] = v;
  return copy as unknown as T;
}

const SECTIONS = [
  { id: 'pol-attendance', label: 'Attendance' },
  { id: 'pol-pay', label: 'Pay' },
  { id: 'pol-overtime', label: 'Overtime' },
  { id: 'pol-leave', label: 'Leave' },
  { id: 'pol-till', label: 'Till shortage' },
];

function Section({ id, icon, title, children }: { id: string; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="rounded-lg border border-gray-200 scroll-mt-48">
      <h3 className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50 rounded-t-lg text-sm font-semibold text-gray-900">
        <span className="text-honey-700">{icon}</span>
        {title}
      </h3>
      <div className="p-3 space-y-3">{children}</div>
    </section>
  );
}

export default function PolicyEditor({
  policy,
  template,
  limits,
  readOnly,
  onClose,
  onSaved,
}: {
  policy: Policy | null;
  template: PolicyRules;
  limits: Record<string, FieldLimit>;
  readOnly?: boolean;
  onClose: () => void;
  onSaved: (p: Policy) => void;
}) {
  const [form, setForm] = useState<PolicyInput>(() => {
    const src = policy || template;
    return structuredClone({
      name: policy?.name || '',
      description: policy?.description || '',
      attendance: src.attendance,
      pay: src.pay,
      overtime: src.overtime,
      leave: src.leave,
      tillShortage: src.tillShortage,
    });
  });
  const [salary, setSalary] = useState(30000);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const off = !!readOnly || saving;

  const set = (path: string, v: unknown) => setForm((f) => setAt(f, path, v));
  const summary = useMemo(() => summaryParts(form), [form]);
  const example = useMemo(() => exampleLines(form, Math.max(0, salary) || 0), [form, salary]);

  // ----- field builders (plain functions, so inputs keep focus) -----
  const num = (path: string, label: string, opts: { suffix?: string; hint?: string; step?: number } = {}) => {
    const lim = limits[path] || { kind: 'number', label };
    const v = getAt(form, path) as number;
    return (
      <Field label={label} hint={opts.hint}>
        <div className="relative">
          <input
            type="number"
            inputMode="decimal"
            min={lim.min}
            max={lim.max}
            step={opts.step ?? (lim.decimal ? 0.5 : 1)}
            value={Number.isFinite(v) ? v : ''}
            onChange={(e) => set(path, e.target.value === '' ? NaN : Number(e.target.value))}
            disabled={off}
            className={`${inputClass} ${opts.suffix ? 'pr-16' : ''}`}
          />
          {opts.suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">{opts.suffix}</span>}
        </div>
      </Field>
    );
  };
  const tog = (path: string, label: string, hint?: string) => (
    <Toggle checked={!!getAt(form, path)} onChange={(v) => set(path, v)} label={label} hint={hint} disabled={off} />
  );
  const sel = (path: string, label: string, options: [string, string][], hint?: string) => (
    <Field label={label} hint={hint}>
      <select value={String(getAt(form, path))} onChange={(e) => set(path, e.target.value)} disabled={off} className={inputClass}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </Field>
  );

  const validate = (): string | null => {
    if (!form.name.trim()) return 'Give the policy a name, e.g. Standard staff';
    for (const [path, lim] of Object.entries(limits)) {
      if (lim.kind !== 'number') continue;
      const v = Number(getAt(form, path));
      const min = lim.min ?? 0;
      const max = lim.max ?? Infinity;
      if (!Number.isFinite(v) || v < min || v > max) return `${lim.label} must be between ${min} and ${max}`;
    }
    return null;
  };

  const save = async () => {
    if (lock.current || readOnly) return;
    const problem = validate();
    if (problem) return setError(problem);
    lock.current = true;
    setSaving(true);
    setError(null);
    try {
      const body = { ...form, name: form.name.trim(), description: form.description.trim() };
      const saved = policy ? await policyApi.update(policy._id, body) : await policyApi.create(body);
      toast.success(policy ? 'Policy saved' : 'Policy created');
      if (saved.recomputed) toast(`This month's attendance re-checked (${saved.recomputed} day${saved.recomputed === 1 ? '' : 's'}).`, { icon: 'ℹ️' });
      onSaved(saved);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not save the policy.'));
      lock.current = false;
      setSaving(false);
    }
  };

  const a = form.attendance;
  return (
    <Modal
      title={readOnly ? form.name : policy ? `Edit policy` : 'New HR policy'}
      subtitle={policy?.isDefault ? 'Default policy — everyone without their own policy follows it' : policy ? `${policy.employeeCount} employee${policy.employeeCount === 1 ? '' : 's'} use it` : undefined}
      icon={<ScrollText className="h-5 w-5" />}
      onClose={onClose}
      busy={saving}
      wide
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className={secondaryBtn}>
            {readOnly ? 'Close' : 'Cancel'}
          </button>
          {!readOnly && (
            <button type="button" onClick={save} disabled={saving} className={primaryBtn}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save policy
            </button>
          )}
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="space-y-4"
      >
        {/* Live summary + example */}
        <div className="sm:sticky sm:-top-5 z-10 -mx-5 -mt-5 px-5 pt-4 pb-3 bg-white/95 backdrop-blur border-b border-gray-100 space-y-2">
          <div className="rounded-lg bg-honey-50 border border-honey-200 p-3">
            <p className="text-xs text-gray-800">{summary.join(' · ')}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-700">
              <span className="font-semibold text-gray-900">On</span>
              <span className="inline-flex items-center gap-1">
                Rs
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1000}
                  value={salary || ''}
                  onChange={(e) => setSalary(Number(e.target.value))}
                  className="w-24 rounded border border-honey-300 bg-white px-1.5 py-0.5 text-xs text-gray-900"
                  aria-label="Example monthly salary"
                />
              </span>
              <span className="font-semibold text-gray-900">salary:</span>
              <span>{example.join('; ')}</span>
            </div>
            <p className="mt-1 text-[10px] text-gray-500">Example only. Hourly rate = 1 day ÷ {EXAMPLE_DAY_HOURS} h.</p>
          </div>
          <nav className="flex gap-1 overflow-x-auto" aria-label="Policy sections">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="flex-shrink-0 rounded-full border border-gray-200 px-2.5 py-1 text-[11px] font-medium text-gray-600 hover:border-honey-500 hover:text-gray-900"
              >
                {s.label}
              </button>
            ))}
          </nav>
        </div>

        <ErrorBox message={error} />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-1">
            <Field label="Policy name" required>
              <input value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={80} placeholder="Standard staff" disabled={off} className={inputClass} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Description">
              <input value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={500} placeholder="Who is this for? e.g. Cashiers and sales staff" disabled={off} className={inputClass} />
            </Field>
          </div>
        </div>

        <Section id="pol-attendance" icon={<Clock className="h-4 w-4" />} title="Attendance">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {num('attendance.graceMinutes', 'Grace time', { suffix: 'min', hint: 'Checking in this many minutes after the shift starts is still on time.' })}
            {sel('attendance.lateRule.type', 'Late rule', [
              ['count', 'Count lates (every few lates cut pay)'],
              ['minutes', 'Cut every late minute'],
              ['none', 'Only note lates (no cut)'],
            ])}
          </div>
          {a.lateRule.type === 'count' && (
            <div className="grid grid-cols-2 gap-3">
              {num('attendance.lateRule.latesPerCut', 'Every … lates', { suffix: 'lates', hint: 'Counted per month.' })}
              {num('attendance.lateRule.cutDays', '… cut this much pay', { suffix: 'days', step: 0.5 })}
            </div>
          )}
          {a.lateRule.type === 'minutes' && <p className="text-[11px] text-gray-500">Each late minute is cut at the person&apos;s minute rate.</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {num('attendance.earlyLeaveGraceMinutes', 'Early leave grace', { suffix: 'min', hint: 'Leaving earlier than this before the shift ends is an early leave.' })}
            {sel(
              'attendance.missingOutCountsAs',
              'Forgot to check out counts as',
              [
                ['present', 'Present (manager fixes the time)'],
                ['half_day', 'Half day'],
                ['absent', 'Absent'],
              ],
              'Until a manager corrects the day.'
            )}
          </div>
          {tog('attendance.earlyLeaveCountsAsLate', 'Leaving early counts as a late', 'Early leaves are added to the lates for the late rule.')}
          {tog('attendance.halfDay.enabled', 'Half day rule', 'Very late or a short day counts as half a day.')}
          {a.halfDay.enabled && (
            <div className="grid grid-cols-2 gap-3">
              {num('attendance.halfDay.lateAfterMinutes', 'Half day when late more than', { suffix: 'min' })}
              {num('attendance.halfDay.minWorkedPct', 'or worked less than', { suffix: '% of shift' })}
            </div>
          )}
        </Section>

        <Section id="pol-pay" icon={<Wallet className="h-4 w-4" />} title="Pay">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {sel(
              'pay.dayDivisor',
              'One day of pay =',
              [
                ['fixed', 'Salary ÷ a fixed number of days'],
                ['month_days', 'Salary ÷ days in that month'],
                ['working_days', "Salary ÷ the person's working days that month"],
              ],
              'Used for every cut and for overtime.'
            )}
            {form.pay.dayDivisor === 'fixed' && num('pay.fixedDays', 'Salary divided by', { suffix: 'days' })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {num('pay.absentCutDays', 'Cut per absent day', { suffix: 'days', step: 0.5, hint: '1 = one day of pay.' })}
            {num('pay.halfDayCut', 'Cut per half day', { suffix: 'of a day', step: 0.25, hint: '0.5 = half a day of pay.' })}
          </div>
          {tog('pay.paidWeeklyOff', 'Weekly off is paid', 'Monthly staff are paid for their weekly off (daily-wage staff never are).')}
          {tog('pay.paidHolidays', 'Holidays are paid')}
        </Section>

        <Section id="pol-overtime" icon={<Timer className="h-4 w-4" />} title="Overtime">
          {tog('overtime.enabled', 'Pay overtime', 'Time worked after the shift ends (or on an off day / holiday).')}
          {form.overtime.enabled && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {num('overtime.rate', 'Rate', { suffix: '× hourly', step: 0.25, hint: '1 = normal hourly rate, 1.5 = time and a half.' })}
                {num('overtime.minMinutes', 'Ignore less than', { suffix: 'min' })}
                {num('overtime.maxMinutesPerDay', 'Most per day', { suffix: 'min', hint: '0 = no limit.' })}
              </div>
              {tog('overtime.needsApproval', 'A manager approves overtime first', 'Unapproved overtime is not paid.')}
            </>
          )}
        </Section>

        <Section id="pol-leave" icon={<Umbrella className="h-4 w-4" />} title="Leave">
          <div className="grid grid-cols-2 gap-3">
            {num('leave.paidPerMonth', 'Paid leave a month', { suffix: 'days' })}
            {num('leave.sickPerMonth', 'Sick leave a month', { suffix: 'days' })}
          </div>
          <p className="text-[11px] text-gray-500">Leave is marked on the roster. More leave than this in a month is unpaid.</p>
        </Section>

        <Section id="pol-till" icon={<Banknote className="h-4 w-4" />} title="Till shortage">
          {tog('tillShortage.deduct', "Cut till shortages from the cashier's pay", 'When a cash closing is short.')}
          {form.tillShortage.deduct && (
            <>
              {tog('tillShortage.needsApproval', 'A manager approves each cut first')}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{num('tillShortage.maxPerMonth', 'Most cut a month', { suffix: 'Rs', step: 100, hint: '0 = no limit.' })}</div>
            </>
          )}
        </Section>
      </form>
    </Modal>
  );
}
