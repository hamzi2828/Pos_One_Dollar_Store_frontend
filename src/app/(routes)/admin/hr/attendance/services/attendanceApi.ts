// Attendance API (/api/attendance/...) + small shop-time helpers.
// Staff punch only with their fingerprint on the DOLLAR & Co Attendance desktop
// app; this web side shows the days and lets managers correct them (reason required).
// Shop time is Asia/Karachi (UTC+5 all year) whatever the device's own zone is.
import axios from 'axios';
import { storeApi, API_URL, BACKEND_URL } from '@/lib/storeApi';
import { getAuthHeader } from '@/helper/helper';

export const SHOP_TZ = 'Asia/Karachi';
const PKT_MS = 5 * 60 * 60 * 1000;

/* ---------------- types ---------------- */

export type AttendanceStatus =
  | 'pending'
  | 'present'
  | 'late'
  | 'half_day'
  | 'absent'
  | 'missing_out'
  | 'leave'
  | 'off'
  | 'holiday';

export type PlanType = 'shift' | 'off' | 'leave' | 'holiday' | 'none';
/** Where a time came from: fingerprint desktop app, a manager's correction, or old web punches. */
export type PunchSource = 'device' | 'corrected' | 'kiosk' | 'manual';

export interface EmployeeRef {
  _id: string;
  name: string;
  code: string;
  designation: string;
  photo: string | null;
}

export interface DayPlan {
  type: PlanType;
  source?: string;
  shiftName: string;
  shiftCode?: string;
  color?: string;
  start: string | null;
  end: string | null;
  breakMinutes?: number;
  leaveType: string | null;
  holidayName: string;
}

export interface Punch {
  at: string;
  kind: 'in' | 'out';
  source: 'kiosk' | 'manual' | 'device';
  photo: string | null;
  note: string;
  by?: string;
}

export interface Correction {
  at: string;
  byName: string;
  field: 'checkIn' | 'checkOut' | 'overtime' | 'status' | string;
  from: string | boolean | null;
  to: string | boolean | null;
  reason: string;
}

export interface BoardRow {
  employee: EmployeeRef;
  plan: DayPlan;
  recordId: string | null;
  checkIn: string | null;
  checkOut: string | null;
  inSource: PunchSource | null;
  outSource: PunchSource | null;
  /** Latest time correction: shown as "Corrected by X: reason". */
  lastCorrection: { at: string; byName: string; reason: string; field: string } | null;
  inNow: boolean;
  status: AttendanceStatus;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  workedMinutes: number;
  overtimeMinutes: number;
  overtimeApproved: boolean | null;
  locked: boolean;
  /** Locked placeholder written by payroll approval on a day with no record (no times). */
  payrollLock: boolean;
  punches: Punch[];
  photos: { url: string; at: string; kind: 'in' | 'out' }[];
  corrections: number;
  note: string;
}

export interface BoardCounts {
  total: number;
  scheduled: number;
  inNow: number;
  checkedIn: number;
  late: number;
  halfDay: number;
  notInYet: number;
  absent: number;
  missingOut: number;
  onLeave: number;
  off: number;
  holiday: number;
  overtimePending: number;
}

export interface Board {
  date: string;
  today: string;
  isToday: boolean;
  holiday: { name: string; shopClosed: boolean } | null;
  counts: BoardCounts;
  rows: BoardRow[];
}

export interface DayDetail extends Omit<BoardRow, 'corrections'> {
  date: string;
  policyName: string;
  corrections: number;
  correctionLog: Correction[];
  notEmployed: boolean;
}

export interface SheetCell {
  date: string;
  code: string;
  status: AttendanceStatus | 'upcoming' | 'not_employed';
  planned: PlanType | null;
  shiftName: string;
  leaveType: string | null;
  holidayName: string;
  checkIn: string | null;
  checkOut: string | null;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  workedMinutes: number;
  overtimeMinutes: number;
  overtimeApproved: boolean | null;
  extra: boolean;
  /** Day closed by an approved payroll. */
  locked: boolean;
}

export interface SheetTotals {
  scheduled: number;
  scheduledInMonth: number;
  present: number;
  late: number;
  lateMinutes: number;
  halfDays: number;
  absent: number;
  missingOut: number;
  earlyLeaves: number;
  offDays: number;
  holidays: number;
  offDaysWorked: number;
  leave: number;
  leavePaid: number;
  leaveSick: number;
  leaveUnpaid: number;
  workedMinutes: number;
  overtimeApprovedMinutes: number;
  overtimePendingMinutes: number;
  daysWorked: number;
}

export interface SheetEmployee {
  employeeId: string;
  name: string;
  code: string;
  designation: string;
  photo: string | null;
  policyName: string;
  /** Month paid: payroll locked its days. */
  locked: boolean;
  cells: SheetCell[];
  totals: SheetTotals;
}

export interface Sheet {
  month: string;
  from: string;
  to: string;
  daysInMonth: number;
  today: string;
  days: { date: string; day: number; weekday: string; holidayName: string }[];
  legend: { code: string; status: string; label: string }[];
  employees: SheetEmployee[];
}

export type ExceptionType = 'missing_out' | 'absent' | 'overtime' | 'no_fingerprint' | 'no_schedule';

export interface ExceptionAction {
  /** desktop = done on the attendance desktop app (no web link). */
  kind: 'correct' | 'overtime' | 'link' | 'desktop';
  label: string;
  href?: string;
}

export interface ExceptionItem {
  type: ExceptionType;
  employeeId: string;
  name: string;
  designation: string;
  photo: string | null;
  date: string | null;
  recordId?: string | null;
  shiftName?: string;
  checkIn?: string | null;
  checkOut?: string | null;
  overtimeMinutes?: number;
  detail: string;
  actions: ExceptionAction[];
}

export interface Exceptions {
  month: string;
  today: string;
  /** false while the desktop fingerprint module is not installed (no enrolment check). */
  fingerprintCheck: boolean;
  counts: { missingOut: number; absent: number; overtime: number; noFingerprint: number; noSchedule: number; total: number };
  items: ExceptionItem[];
}

/* ---------------- API ---------------- */

export const attendanceApi = {
  board: async (date?: string) => (await storeApi.get<Board>('/attendance/board', { date })).data,
  day: async (employeeId: string, date: string) => (await storeApi.get<DayDetail>('/attendance/day', { employeeId, date })).data,
  sheet: async (month: string) => (await storeApi.get<Sheet>('/attendance/sheet', { month })).data,
  exceptions: async (month: string) => (await storeApi.get<Exceptions>('/attendance/exceptions', { month })).data,
  correct: (body: { employeeId: string; date: string; checkIn?: string | null; checkOut?: string | null; reason: string }) =>
    storeApi.put<DayDetail>('/attendance/day', body),
  overtime: (body: { recordIds: string[]; approved: boolean; reason?: string }) =>
    storeApi.post<{ approved: boolean; updated: { _id: string }[]; skipped: number }>('/attendance/overtime', body),
};

/** Download the month sheet as CSV (the server sets the file name). */
export async function downloadSheetCsv(month: string) {
  const res = await axios.get(`${API_URL}/attendance/sheet/export`, { params: { month }, headers: getAuthHeader(), responseType: 'blob' });
  const disposition = String(res.headers['content-disposition'] || '');
  const match = /filename="?([^"]+)"?/.exec(disposition);
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = match ? match[1] : `attendance-${month}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------------- shop-time helpers ---------------- */

/** Absolute URL for an uploaded file (local /uploads paths live on the backend). */
export const fileUrl = (u?: string | null) => (!u ? '' : /^https?:\/\//.test(u) || u.startsWith('blob:') || u.startsWith('data:') ? u : `${BACKEND_URL}${u}`);

const pkt = (v: string | Date) => new Date(new Date(v).getTime() + PKT_MS);

/** 'YYYY-MM-DD' shop day of an instant (default now). */
export const shopDay = (v: string | Date = new Date()) => pkt(v).toISOString().slice(0, 10);
/** 'YYYY-MM' shop month (default now). */
export const shopMonth = (v: string | Date = new Date()) => shopDay(v).slice(0, 7);
/** 'HH:mm' (24 h) shop time of an instant. */
export const shopHHmm = (v: string | Date) => pkt(v).toISOString().slice(11, 16);
/** ISO instant for a shop day + 'HH:mm'. */
export const shopIso = (day: string, hhmm: string) => `${day}T${hhmm}:00+05:00`;

/** "9:58 am" (shop time). */
export function clock(v: string | Date | null | undefined): string {
  if (!v) return '—';
  const d = pkt(v);
  const h = d.getUTCHours();
  return `${h % 12 || 12}:${String(d.getUTCMinutes()).padStart(2, '0')} ${h >= 12 ? 'pm' : 'am'}`;
}

/** "9:58" without am/pm (small badges). */
export function clockShort(v: string | Date | null | undefined): string {
  return v ? clock(v).replace(/ (am|pm)$/, '') : '—';
}

/** 24 -> "24 min", 455 -> "7 h 35 m". */
export function mins(m: number | null | undefined): string {
  const n = Math.max(0, Math.round(Number(m) || 0));
  const h = Math.floor(n / 60);
  if (!h) return `${n} min`;
  return n % 60 ? `${h} h ${n % 60} m` : `${h} h`;
}

/** Hours with one decimal, e.g. 7.5 h. */
export const hoursLabel = (m: number) => `${Math.round(((Number(m) || 0) / 60) * 10) / 10} h`;

/** 'YYYY-MM-DD' + n days. */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 'YYYY-MM' + n months. */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

/** "Mon 19 Oct 2026" for a shop day key. */
export function dayLabel(day: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) {
  return new Date(`${day}T12:00:00+05:00`).toLocaleDateString('en-GB', { ...opts, timeZone: SHOP_TZ });
}

/** "October 2026". */
export const monthLabel = (month: string) => new Date(`${month}-15T12:00:00+05:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: SHOP_TZ });

export const PLAN_LABEL: Record<PlanType, string> = {
  shift: 'Shift',
  off: 'Day off',
  leave: 'Leave',
  holiday: 'Holiday',
  none: 'No schedule',
};

/** "Morning · 10:00 am – 6:00 pm" / "Day off" / "Sick leave". */
export function planText(p: DayPlan | null | undefined): string {
  if (!p) return '—';
  if (p.type === 'shift') return `${p.shiftName || 'Shift'} · ${clock(p.start)} – ${clock(p.end)}`;
  if (p.type === 'leave') return `${p.leaveType ? `${p.leaveType[0].toUpperCase()}${p.leaveType.slice(1)} leave` : 'Leave'}`;
  if (p.type === 'holiday') return p.holidayName ? `Holiday · ${p.holidayName}` : 'Holiday';
  return PLAN_LABEL[p.type] || '—';
}

/** The one-line note shown where staff used to clock in on the web. */
export const DESKTOP_NOTE = 'Staff clock in with their fingerprint on the DOLLAR & Co Attendance desktop app.';

export const SOURCE_LABEL: Record<PunchSource, string> = {
  device: 'Fingerprint',
  corrected: 'Corrected',
  kiosk: 'Web (old)',
  manual: 'By hand (old)',
};

/** What a link from Payroll asks for: ?view=corrections|overtime|month|today|fix&month=YYYY-MM&employee=<id>. */
export type AttendanceFocus = 'corrections' | 'overtime';
export interface AttendanceLink {
  tab: 'today' | 'month' | 'fix';
  month: string | null;
  employeeId: string | null;
  focus: AttendanceFocus | null;
}

/** Read the page's query string (and the old #month / #fix hash). */
export function readAttendanceLink(search: string, hash: string): AttendanceLink {
  const q = new URLSearchParams(search);
  const view = (q.get('view') || hash.replace('#', '') || '').toLowerCase();
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(q.get('month') || '') ? (q.get('month') as string) : null;
  const employee = q.get('employee') || q.get('employeeId');
  const employeeId = employee && /^[0-9a-f]{24}$/i.test(employee) ? employee : null;
  if (view === 'corrections' || view === 'overtime') return { tab: 'fix', month, employeeId, focus: view };
  if (view === 'month' || view === 'fix' || view === 'today') return { tab: view, month, employeeId, focus: null };
  return { tab: month ? 'month' : 'today', month, employeeId, focus: null };
}
