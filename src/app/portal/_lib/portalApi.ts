// Employee Portal API (GET /api/me/portal/...): a staff login sees ONLY its own
// HR record — attendance, payslips, money (advances / deductions / tips /
// bonuses) and profile. Read-only. The server finds the employee from the
// login; we never send an employee id.
//
// Response convention is the same as other store APIs: { success, data }.
import axios from 'axios';
import { storeApi } from '@/lib/storeApi';
import { clock, type AttendanceStatus, type PlanType } from '@/app/(routes)/admin/hr/attendance/services/attendanceApi';

export const NO_EMPLOYEE_MESSAGE = 'No employee record is linked to this login. Ask the shop admin.';

/* ---------------- types ---------------- */

export interface PortalPlan {
  type: PlanType;
  shiftName?: string | null;
  start?: string | null;
  end?: string | null;
  leaveType?: string | null;
  holidayName?: string | null;
}

export interface MonthSummary {
  month?: string;
  present: number;
  absent: number;
  late: number;
  leave: number;
  off: number;
  workedMinutes: number;
  lateMinutes: number;
  overtimeMinutes: number;
}

export interface LeaveBalance {
  type?: string;
  label?: string;
  allowed?: number | null;
  used?: number | null;
  left?: number | null;
}

export interface PortalEmployee {
  _id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  code?: string;
  designation?: string;
  department?: string | null;
  photo?: string | null;
  phone?: string | null;
  email?: string | null;
  joiningDate?: string | null;
  employmentType?: string | null;
  payType?: 'monthly' | 'daily';
  salary?: number;
  dailyRate?: number;
  salaryBreakdown?: { basic?: number | null; allowances?: { name: string; amount: number }[] | null } | null;
  salaryPayDay?: number | null;
  salaryPaymentMethod?: string | null;
  status?: string;
  shift?: string | { name?: string } | null;
  shiftName?: string | null;
  /** Masked by the server (only last 4 digits). We mask again to be safe. */
  bank?: {
    bankName?: string | null;
    accountTitle?: string | null;
    accountNumber?: string | null;
    iban?: string | null;
  } | null;
  /** This month's leave from the HR policy quotas. */
  leave?: {
    month?: string;
    paidPerMonth?: number; paidUsed?: number; paidLeft?: number;
    sickPerMonth?: number; sickUsed?: number; sickLeft?: number;
    unpaid?: number;
  } | null;
}

export interface PortalToday {
  date: string;
  status: AttendanceStatus | string;
  checkIn: string | null;
  checkOut: string | null;
  planned: PortalPlan | null;
}

export interface LastPayslip {
  runId: string;
  lineId?: string;
  month: string;
  net: number;
  status: string;
  paidAt: string | null;
}

export interface PortalProfile {
  employee: PortalEmployee;
  today: PortalToday | null;
  thisMonth: MonthSummary | null;
  lastPayslip: LastPayslip | null;
  openAdvanceBalance: number;
  tipsThisMonth: number;
  /** This month's money in plain words (null on an old server or when it could not be worked out). */
  pay?: PortalPay | null;
}

export interface PortalPay {
  month: string;
  salary: number;
  earned: number;
  payableNow: number;
  overtime: {
    normalMinutes: number;
    normalAmount: number;
    doubleMinutes: number;
    doubleAmount: number;
    doubleAfterHours: number;
    waitingMinutes: number;
  };
  deductions: { id: string; type: string; label: string; amount: number; date: string; note: string; status: 'pending' | 'approved' | 'applied' | 'waived' }[];
  tips: { amount: number; day: string; toSalary: boolean; note: string }[];
}

export interface PortalDay {
  date: string;
  status: AttendanceStatus | 'upcoming' | 'not_employed' | string;
  planned: PortalPlan | null;
  checkIn: string | null;
  checkOut: string | null;
  workedMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  overtimeApproved?: boolean;
  lateExcused?: boolean;
  /** Employee's own reason for being late (at least 100 words). */
  lateNote?: string;
  lateNoteAt?: string | null;
}

export interface PortalAttendance {
  month: string;
  summary: MonthSummary;
  days: PortalDay[];
}

export interface PayslipRow {
  runId: string;
  runNo?: string;
  month: string;
  lineId?: string;
  payslipNo?: string;
  gross: number;
  totalDeductions: number;
  net: number;
  bonus?: number;
  status: string;
  paidAt: string | null;
}

export interface MoneyRow {
  key?: string;
  label: string;
  amount: number;
  detail?: string;
}

export interface PayslipDetail {
  runNo?: string;
  month: string;
  line: {
    earnings: MoneyRow[];
    deductions: MoneyRow[];
    gross: number;
    totalDeductions: number;
    net: number;
    bonus?: number;
    bonusNote?: string;
    adjustments?: { label: string; amount: number; note?: string }[];
    advanceRecovery?: number;
    attendance?: Record<string, unknown> | null;
    employedDays?: number;
    payslipNo?: string;
    status: string;
    paidAt: string | null;
  };
}

export interface PortalAdvance {
  advanceNo?: string;
  date: string;
  amount: number;
  installments?: number;
  recovered: number;
  balance: number;
  status: string;
  note?: string;
}

export interface PortalDeduction {
  type: string;
  amount: number;
  date: string;
  status: string;
  note?: string;
}

export interface PortalTip {
  tipNo?: string;
  day: string;
  amount: number;
  method?: string;
  note?: string;
}

export interface PortalBonus {
  month: string;
  amount: number;
  note?: string;
}

export interface PortalMoney {
  advances: PortalAdvance[];
  deductions: PortalDeduction[];
  tips: PortalTip[];
  bonuses: PortalBonus[];
}

/* ---------------- calls ---------------- */

/* ---------------- admin preview (/portal?as=<employeeId>) ---------------- */
const PREVIEW_KEY = 'portal_preview_as';
/** Employee id an admin is previewing in this tab (null = own portal). */
export function previewAs(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const q = new URLSearchParams(window.location.search).get('as');
    if (q && /^[a-f\d]{24}$/i.test(q)) {
      sessionStorage.setItem(PREVIEW_KEY, q);
      return q;
    }
    return sessionStorage.getItem(PREVIEW_KEY);
  } catch {
    return null;
  }
}
export function endPreview() {
  try {
    sessionStorage.removeItem(PREVIEW_KEY);
  } catch {
    /* ignore */
  }
}
const asParam = () => {
  const as = previewAs();
  return as ? { as } : {};
};

export const portalApi = {
  profile: () => storeApi.get<PortalProfile>('/me/portal/profile', asParam()),
  attendance: (month?: string) => storeApi.get<PortalAttendance>('/me/portal/attendance', { month, ...asParam() }),
  payslips: () => storeApi.get<{ payslips: PayslipRow[] }>('/me/portal/payslips', asParam()),
  payslip: (runId: string) => storeApi.get<PayslipDetail>(`/me/portal/payslips/${encodeURIComponent(runId)}`, asParam()),
  money: () => storeApi.get<PortalMoney>('/me/portal/money', asParam()),
  saveLateNote: (date: string, text: string) =>
    storeApi.put<{ date: string; lateNote: string; lateNoteAt: string; words: number }>(`/me/portal/attendance/${encodeURIComponent(date)}/late-note`, { text }),
};

/** Words in a text (same count as the server). */
export const wordCount = (t: string) => (String(t || '').trim().match(/\S+/g) || []).length;
export const LATE_NOTE_MIN_WORDS = 100;
/** A late day the employee still has to explain. */
export const needsLateNote = (d: { lateMinutes: number; lateNote?: string; status: string; lateExcused?: boolean }) =>
  d.lateMinutes > 0 && !d.lateExcused && !d.lateNote && d.status !== 'upcoming';

/** True when the server says this login has no employee record (404). */
export const isNoEmployee = (e: unknown) => axios.isAxiosError(e) && e.response?.status === 404;

/* ---------------- display helpers ---------------- */

/** "9:58 am" for an ISO instant (shop time) or a plain "HH:mm". */
export function timeText(v: string | null | undefined): string {
  if (!v) return '—';
  const m = /^(\d{1,2}):(\d{2})$/.exec(v);
  if (m) {
    const h = Number(m[1]);
    return `${h % 12 || 12}:${m[2]} ${h >= 12 ? 'pm' : 'am'}`;
  }
  return clock(v);
}

/** "Morning · 10:00 am – 6:00 pm" / "Day off" / "Sick leave". */
export function planWords(p: PortalPlan | null | undefined): string {
  if (!p) return 'No plan';
  if (p.type === 'shift') return `${p.shiftName || 'Shift'} · ${timeText(p.start)} – ${timeText(p.end)}`;
  if (p.type === 'leave') return p.leaveType ? `${p.leaveType[0].toUpperCase()}${p.leaveType.slice(1)} leave` : 'Leave';
  if (p.type === 'holiday') return p.holidayName ? `Holiday · ${p.holidayName}` : 'Holiday';
  if (p.type === 'off') return 'Day off';
  return 'No plan';
}

/** "basic" / "houseRent" / "house_rent" -> "Basic" / "House rent". */
export function humanize(key: string): string {
  const s = key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase();
  return s ? s[0].toUpperCase() + s.slice(1) : key;
}

/** Keep only the last 4 characters: "•••• 1234". */
export function maskTail(v: string | null | undefined): string {
  if (!v) return '';
  const clean = String(v).replace(/\s+/g, '');
  const tail = clean.replace(/[^0-9A-Za-z]/g, '').slice(-4);
  return tail ? `•••• ${tail}` : '';
}

/** 1 -> "1st", 22 -> "22nd". */
export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

const STATUS_WORD: Record<string, string> = {
  approved: 'Ready',
  paid: 'Paid',
  pending: 'Not paid yet',
  open: 'Open',
  recovered: 'Paid back',
  waived: 'Waived',
  applied: 'Taken from salary',
};

export const moneyStatus = (s: string | null | undefined) => (s ? STATUS_WORD[s] || humanize(s) : '—');
