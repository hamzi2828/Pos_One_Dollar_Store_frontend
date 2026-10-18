// HR policies (backend: routes/modules/shiftsRoutes.js -> controller/store/hrPolicyController.js).
// summaryParts() mirrors controller/store/hrPolicyRules.js so the editor can show
// the plain-English summary live while typing.
import { storeApi, formatRs } from '@/lib/storeApi';

export type LateRuleType = 'count' | 'minutes' | 'none';
export type MissingOut = 'present' | 'half_day' | 'absent';
export type DayDivisor = 'fixed' | 'month_days' | 'working_days';

export interface PolicyRules {
  attendance: {
    graceMinutes: number;
    lateRule: { type: LateRuleType; latesPerCut: number; cutDays: number };
    earlyLeaveGraceMinutes: number;
    earlyLeaveCountsAsLate: boolean;
    halfDay: { enabled: boolean; lateAfterMinutes: number; minWorkedPct: number };
    missingOutCountsAs: MissingOut;
  };
  pay: {
    dayDivisor: DayDivisor;
    fixedDays: number;
    absentCutDays: number;
    halfDayCut: number;
    paidWeeklyOff: boolean;
    paidHolidays: boolean;
  };
  overtime: { enabled: boolean; rate: number; minMinutes: number; maxMinutesPerDay: number; needsApproval: boolean };
  leave: { paidPerMonth: number; sickPerMonth: number };
  tillShortage: { deduct: boolean; needsApproval: boolean; maxPerMonth: number };
}

export interface Policy extends PolicyRules {
  _id: string;
  name: string;
  description: string;
  isDefault: boolean;
  summary: string;
  summaryParts: string[];
  employeeCount: number;
  employees?: { _id: string; name: string; code: string; designation: string }[];
  recomputed?: number;
  updatedAt?: string;
}

export type PolicyInput = PolicyRules & { name: string; description: string };

export interface FieldLimit {
  kind: 'number' | 'boolean' | 'enum';
  label: string;
  min?: number;
  max?: number;
  decimal?: boolean;
  options?: string[];
}

export interface PolicyListMeta {
  defaultId: string;
  template: PolicyRules;
  limits: Record<string, FieldLimit>;
}

export interface PolicyEmployee {
  _id: string;
  name: string;
  code: string;
  designation: string;
  photo: string | null;
  /** null = follows the default policy. */
  hrPolicy: string | null;
  policyId: string;
  policyName: string;
}

export const policyApi = {
  list: async () => {
    const r = await storeApi.get<Policy[]>('/hr-policies');
    return { rows: r.data, meta: r.meta as unknown as PolicyListMeta };
  },
  get: async (id: string) => (await storeApi.get<Policy>(`/hr-policies/${id}`)).data,
  employees: async () => (await storeApi.get<PolicyEmployee[]>('/hr-policies/employees')).data,
  create: async (body: PolicyInput) => (await storeApi.post<Policy>('/hr-policies', body)).data,
  update: async (id: string, body: Partial<PolicyInput>) => (await storeApi.put<Policy>(`/hr-policies/${id}`, body)).data,
  duplicate: async (id: string) => (await storeApi.post<Policy>(`/hr-policies/${id}/duplicate`)).data,
  setDefault: async (id: string) => (await storeApi.post<Policy>(`/hr-policies/${id}/default`)).data,
  remove: (id: string) => storeApi.del(`/hr-policies/${id}`),
  /** id 'default' = back to the default policy. exact: staff on this policy not in the list go back to the default. */
  assign: async (id: string, employeeIds: string[], exact = false) =>
    (await storeApi.post<{ assigned: number; movedToDefault: number; recomputed: number }>(`/hr-policies/${id}/assign`, { employeeIds, exact })).data,
};

// ---------- plain English (same wording as the server) ----------

const days = (n: number) => {
  const v = Number(n) || 0;
  if (v === 0.5) return 'half a day';
  if (v === 0.25) return 'a quarter day';
  return `${v} day${v === 1 ? '' : 's'}`;
};

export function summaryParts(p: PolicyRules): string[] {
  const a = p.attendance;
  const lr = a.lateRule;
  const pay = p.pay;
  const ot = p.overtime;
  const lv = p.leave;
  const ts = p.tillShortage;
  const parts: string[] = [];
  parts.push(Number(a.graceMinutes) ? `${a.graceMinutes} min grace` : 'no grace time');
  if (lr.type === 'count' && Number(lr.cutDays) > 0) parts.push(`every ${lr.latesPerCut} lates cut ${days(lr.cutDays)}`);
  else if (lr.type === 'minutes') parts.push('late minutes cut from pay');
  else parts.push('lates only noted (no cut)');
  const divisor = pay.dayDivisor === 'month_days' ? 'days in the month' : pay.dayDivisor === 'working_days' ? 'working days' : String(pay.fixedDays || 30);
  parts.push(Number(pay.absentCutDays) > 0 ? `absent cuts ${days(pay.absentCutDays)} (salary ÷ ${divisor})` : `absent not cut (day = salary ÷ ${divisor})`);
  if (ot.enabled) parts.push(`overtime ×${Number(ot.rate) || 0}${ot.needsApproval ? ' after approval' : ''}${Number(ot.minMinutes) ? ` (min ${ot.minMinutes} min)` : ''}`);
  else parts.push('no overtime pay');
  const paid = Number(lv.paidPerMonth) || 0;
  const sick = Number(lv.sickPerMonth) || 0;
  parts.push(paid || sick ? `${paid} paid + ${sick} sick leave a month` : 'no paid leave');
  if (ts.deduct) {
    const cap = Number(ts.maxPerMonth) || 0;
    parts.push(`till shortage cut${ts.needsApproval ? ' after approval' : ''}${cap ? ` (max Rs ${cap.toLocaleString('en-PK')} a month)` : ''}`);
  } else parts.push('till shortage not cut');
  return parts;
}

// ---------- live example ----------

/** Hours in a working day used for the hourly rate in the example. */
export const EXAMPLE_DAY_HOURS = 8;
/** Typical scheduled days in a month (6-day week) for the "working days" divisor. */
const EXAMPLE_WORKING_DAYS = 26;

const rs = (n: number) => formatRs(Math.round(n));

/**
 * What the rules mean in rupees for a sample salary, e.g.
 * "1 day = Rs 1,000", "3 lates → Rs 1,000 cut", "2 h approved overtime → Rs 250".
 */
export function exampleLines(p: PolicyRules, salary: number): string[] {
  const pay = p.pay;
  const now = new Date();
  const monthDays = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const divisor = pay.dayDivisor === 'month_days' ? monthDays : pay.dayDivisor === 'working_days' ? EXAMPLE_WORKING_DAYS : Number(pay.fixedDays) || 30;
  const day = salary / divisor;
  const hour = day / EXAMPLE_DAY_HOURS;
  const lr = p.attendance.lateRule;
  const out: string[] = [];
  out.push(`1 day = ${rs(day)} (salary ÷ ${divisor}${pay.dayDivisor === 'month_days' ? ', this month' : pay.dayDivisor === 'working_days' ? ' working days, e.g.' : ''})`);
  if (lr.type === 'count' && Number(lr.cutDays) > 0) out.push(`${lr.latesPerCut} lates → ${rs(day * lr.cutDays)} cut`);
  else if (lr.type === 'minutes') out.push(`30 late minutes → ${rs((hour / 60) * 30)} cut`);
  else out.push('lates → no cut');
  out.push(`1 absent day → ${rs(day * (Number(pay.absentCutDays) || 0))} cut`);
  if (p.attendance.halfDay.enabled) out.push(`1 half day → ${rs(day * (Number(pay.halfDayCut) || 0))} cut`);
  if (p.overtime.enabled) out.push(`2 h ${p.overtime.needsApproval ? 'approved ' : ''}overtime → ${rs(hour * 2 * (Number(p.overtime.rate) || 0))}`);
  else out.push('overtime → not paid');
  const leave = (Number(p.leave.paidPerMonth) || 0) + (Number(p.leave.sickPerMonth) || 0);
  out.push(leave ? `unpaid or extra leave → ${rs(day)} a day cut` : `each leave day → ${rs(day)} cut`);
  return out;
}
