// Payroll, advances and deductions API (backend: routes/modules/payrollRoutes.js).
// Money on payroll lines is whole rupees, calculated by the server.
import axios from 'axios';
import { getAuthHeader } from '@/helper/helper';
import { API_URL, storeApi, type PageMeta } from '@/lib/storeApi';

export type RunStatus = 'draft' | 'approved' | 'paid';
export type PayMethod = 'cash' | 'bank' | 'easypaisa' | 'jazzcash';
export type DeductionType = 'till_shortage' | 'damage' | 'other';
export type DeductionStatus = 'pending' | 'approved' | 'waived' | 'applied';
export type AdvanceStatus = 'open' | 'recovered' | 'cancelled';

export const METHOD_LABEL: Record<PayMethod, string> = {
  cash: 'Cash',
  bank: 'Bank transfer',
  easypaisa: 'Easypaisa',
  jazzcash: 'JazzCash',
};
export const METHODS = Object.keys(METHOD_LABEL) as PayMethod[];

export interface MoneyRow {
  key: string;
  label: string;
  amount: number;
  detail: string;
}

export interface Adjustment {
  _id?: string;
  label: string;
  amount: number;
  note?: string;
}

export interface AttendanceSnapshot {
  scheduledDaysInMonth: number;
  scheduledDays: number;
  presentDays: number;
  daysWorked: number;
  lateCount: number;
  lateMinutes: number;
  earlyLeaveCount: number;
  earlyLeaveMinutes: number;
  halfDays: number;
  absentDays: number;
  missingOutDays: number;
  pendingCorrections: number;
  offDays: number;
  holidayDays: number;
  offDaysWorked: number;
  leave: { paid: number; sick: number; unpaid: number; paidWithinQuota?: number; sickWithinQuota?: number; unpaidTotal?: number };
  workedMinutes: number;
  overtimeMinutesApproved: number;
  overtimeMinutesPending: number;
  overtimeMinutesPaid: number;
  overtimeMinutesOffDay: number;
  upcomingDays: number;
  notEmployedDays: number;
}

export interface AdvanceItem {
  advance: string;
  advanceNo: string;
  balance: number;
  installments: number;
  installmentNo: number;
  suggested: number;
  used: number;
}

export interface DeductionItem {
  deduction: string;
  type: DeductionType;
  refNo: string;
  amount: number;
  used: number;
}

export interface PayrollLine {
  _id: string;
  employee: string;
  name: string;
  code: string;
  designation: string;
  payType: 'monthly' | 'daily';
  policy: { _id: string; name: string; [k: string]: unknown };
  salary: number;
  dailyRate: number;
  dayRate: number;
  hourlyRate: number;
  divisor: number;
  divisorLabel: string;
  workHoursPerDay: number;
  employedDays: number;
  joinedOn: string;
  leftOn: string;
  attendance: AttendanceSnapshot;
  earnings: MoneyRow[];
  deductions: MoneyRow[];
  gross: number;
  totalDeductions: number;
  net: number;
  shortfall: number;
  notes: string[];
  bonus: number;
  bonusNote: string;
  adjustments: Adjustment[];
  advanceRecoveryOverride: number | null;
  note: string;
  advanceItems: AdvanceItem[];
  advanceSuggested: number;
  advanceRecovery: number;
  deductionItems: DeductionItem[];
  payslipNo: string;
  status: 'pending' | 'paid';
  paidAt: string | null;
  payment: string | null;
}

export interface RunTotals {
  staff: number;
  gross: number;
  deductions: number;
  net: number;
  overtime: number;
  bonus: number;
  advanceRecovery: number;
  paid: number;
  unpaid: number;
  paidCount: number;
}

export interface RunWarning {
  type: string;
  level: 'info' | 'warning';
  message: string;
  link?: string;
  linkLabel?: string;
  employee?: string | null;
  employeeName?: string;
}

export interface RunPayment {
  _id: string;
  no: number;
  date: string;
  method: PayMethod;
  reference: string;
  /** Cash paid (sum of net pay). */
  amount: number;
  /** Advances taken back on these lines. */
  advanceRecovered?: number;
  /** Posted to Expenses = salary earned = net paid + advance recovered. */
  expenseAmount?: number;
  count: number;
  lines: string[];
  expense: string | null;
  expensePosted: boolean;
  at: string;
}

export interface PayrollRunSummary {
  _id: string;
  runNo: string;
  month: string;
  monthLabel: string;
  status: RunStatus;
  totals: RunTotals;
  warningCount: number;
  generatedAt: string | null;
  approvedAt: string | null;
  paidAt: string | null;
}

export interface PayrollRun extends Omit<PayrollRunSummary, 'warningCount'> {
  from: string;
  to: string;
  daysInMonth: number;
  lines: PayrollLine[];
  warnings: RunWarning[];
  payments: RunPayment[];
  effectsDone: boolean;
  reopening: boolean;
  history: { at: string; action: string; note: string }[];
}

export interface RunListMeta extends PageMeta {
  suggestedMonth: string;
  suggestedMonthLabel: string;
  suggestedRun: { _id: string; status: RunStatus } | null;
  currentMonth: string;
}

export interface Payslip {
  payslipNo: string;
  run: { _id: string; runNo: string; month: string; monthLabel: string; status: RunStatus; from: string; to: string; daysInMonth: number };
  line: PayrollLine;
  employee: {
    _id: string;
    name: string;
    code: string;
    designation: string;
    department: string;
    cnic: string;
    phone: string;
    joiningDate: string | null;
    paymentMethod: string;
    bank: { bankName?: string | null; accountTitle?: string | null; accountNumber?: string | null; iban?: string | null };
  };
  payment: { date: string; method: PayMethod; methodLabel: string; reference: string } | null;
  letterhead: { shopName: string; shopAddress: string; shopPhone: string; logoUrl: string };
  netInWords: string;
}

export interface StaffOption {
  _id: string;
  name: string;
  code: string;
  designation: string;
  payType: 'monthly' | 'daily';
  salary: number;
  dailyRate: number;
  phone: string;
  advanceBalance: number;
}

export interface SalaryAdvance {
  _id: string;
  advanceNo: string;
  employee: string;
  employeeName: string;
  employeeCode: string;
  amount: number;
  date: string;
  method: PayMethod;
  reference: string;
  installments: number;
  note: string;
  recovered: number;
  balance: number;
  status: AdvanceStatus;
  perMonth: number;
  remainingInstallments: number;
  recoveries: { runNo: string; month: string; amount: number; at: string }[];
  cancelReason?: string;
}

export interface PayrollDeduction {
  _id: string;
  employee: string;
  employeeName: string;
  employeeCode: string;
  type: DeductionType;
  typeLabel: string;
  amount: number;
  date: string;
  refType: string;
  refNo: string;
  note: string;
  status: DeductionStatus;
  appliedMonth: string;
  link: string;
}

export type DeductionSummary = Record<'pending' | 'approved' | 'applied' | 'waived', { count: number; amount: number }>;

export const payrollApi = {
  runs: (params: { status?: string; page?: number; limit?: number } = {}) => storeApi.get<PayrollRunSummary[]>('/payroll/runs', params),
  generate: (month: string) => storeApi.post<PayrollRun>('/payroll/runs', { month }),
  run: (id: string) => storeApi.get<PayrollRun>(`/payroll/runs/${id}`),
  regenerate: (id: string) => storeApi.post<PayrollRun>(`/payroll/runs/${id}/regenerate`),
  updateLine: (id: string, lineId: string, body: Partial<Pick<PayrollLine, 'bonus' | 'bonusNote' | 'adjustments' | 'advanceRecoveryOverride' | 'note'>>) =>
    storeApi.put<PayrollRun>(`/payroll/runs/${id}/lines/${lineId}`, body),
  approve: (id: string) => storeApi.post<PayrollRun>(`/payroll/runs/${id}/approve`),
  reopen: (id: string, reason: string) => storeApi.post<PayrollRun>(`/payroll/runs/${id}/reopen`, { reason }),
  pay: (id: string, body: { lineIds?: string[]; method: PayMethod; date: string; reference: string; requestId: string }) =>
    storeApi.post<PayrollRun>(`/payroll/runs/${id}/pay`, body),
  remove: (id: string) => storeApi.del<{ deleted: boolean }>(`/payroll/runs/${id}`),
  payslip: (id: string, lineId: string) => storeApi.get<Payslip>(`/payroll/runs/${id}/lines/${lineId}/payslip`),
  staff: (search: string) => storeApi.get<StaffOption[]>('/payroll/employees', { search, limit: 30 }),

  advances: (params: { status?: string; employee?: string; search?: string; page?: number; limit?: number }) =>
    storeApi.get<SalaryAdvance[]>('/salary-advances', params),
  giveAdvance: (body: { employeeId: string; amount: number; installments: number; date: string; method: PayMethod; reference: string; note: string }) =>
    storeApi.post<SalaryAdvance>('/salary-advances', body),
  cancelAdvance: (id: string, reason: string) => storeApi.post<SalaryAdvance>(`/salary-advances/${id}/cancel`, { reason }),

  deductions: (params: { status?: string; type?: string; employee?: string; page?: number; limit?: number }) =>
    storeApi.get<PayrollDeduction[]>('/payroll-deductions', params),
  addDeduction: (body: { employeeId: string; type: 'damage' | 'other'; amount: number; date: string; note: string; approveNow: boolean }) =>
    storeApi.post<PayrollDeduction>('/payroll-deductions', body),
  approveDeduction: (id: string, amount?: number) => storeApi.post<PayrollDeduction>(`/payroll-deductions/${id}/approve`, amount ? { amount } : {}),
  waiveDeduction: (id: string, note: string) => storeApi.post<PayrollDeduction>(`/payroll-deductions/${id}/waive`, { note }),
};

/** Download the payroll register CSV (sends the login token). */
export async function downloadRegister(runId: string, fallbackName: string) {
  const res = await axios.get(`${API_URL}/payroll/runs/${runId}/export`, { headers: getAuthHeader(), responseType: 'blob' });
  const disposition = String(res.headers['content-disposition'] || '');
  const match = /filename="?([^"]+)"?/.exec(disposition);
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = match ? match[1] : fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Today in shop time (Asia/Karachi, UTC+5) as YYYY-MM-DD. */
export const todayPKT = () => new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);

export const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};

/** The last `count` months up to the current one, newest first: [{ key, label }]. */
export function recentMonths(count = 13) {
  const [y, m] = todayPKT().split('-').map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    const key = d.toISOString().slice(0, 7);
    return { key, label: monthLabel(key) };
  });
}

/** "2 h 30 min" */
export function hoursText(minutes: number) {
  const m = Math.round(minutes || 0);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h && r) return `${h} h ${r} min`;
  return h ? `${h} h` : `${r} min`;
}

/** Pakistani mobile for wa.me: 0300 1234567 / +92 300 1234567 -> 923001234567 (null when not usable). */
export function waNumber(phone: string | null | undefined): string | null {
  const digits = String(phone || '').replace(/\D/g, '');
  if (/^03\d{9}$/.test(digits)) return `92${digits.slice(1)}`;
  if (/^923\d{9}$/.test(digits)) return digits;
  if (/^00923\d{9}$/.test(digits)) return digits.slice(2);
  if (/^3\d{9}$/.test(digits)) return `92${digits}`;
  return null;
}

/** A fresh id so a retried "pay" request is not paid twice. */
export const newRequestId = () => `pay-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
