// Shifts, holidays and the weekly roster (backend: routes/modules/shiftsRoutes.js).
// Dates are shop days 'YYYY-MM-DD' in Pakistan time (UTC+5, no daylight saving).
import { storeApi } from '@/lib/storeApi';

export interface Shift {
  _id: string;
  name: string;
  code: string;
  start: string; // 'HH:mm'
  end: string;
  breakMinutes: number;
  color: string;
  isActive: boolean;
  sortOrder: number;
  spanMinutes: number;
  workMinutes: number;
  /** Ends after midnight (the shift belongs to the day it starts). */
  overnight: boolean;
  defaultFor?: number;
  upcomingDays?: number;
}

export type ShiftInput = Pick<Shift, 'name' | 'code' | 'start' | 'end' | 'breakMinutes' | 'color'>;

export type PlanType = 'shift' | 'off' | 'leave' | 'holiday' | 'none';
export type LeaveType = 'paid' | 'unpaid' | 'sick';

export interface RosterCell {
  date: string;
  type: PlanType;
  /** roster = changed for this day; default / weekly_off / holiday / legacy = their normal plan. */
  source: string;
  isOverride: boolean;
  shiftId: string | null;
  shiftName: string;
  shiftCode: string;
  color: string;
  start: string | null;
  end: string | null;
  workMinutes: number;
  leaveType: LeaveType | null;
  holidayName: string;
  note: string;
  /** In an approved payroll: cannot change. */
  locked: boolean;
  /** false = before joining / after leaving. */
  employed: boolean;
}

export interface RosterEmployee {
  _id: string;
  name: string;
  code: string;
  designation: string;
  photo: string | null;
  status: string;
  defaultShift: Shift | null;
  weeklyOff: string[];
  plannedMinutes: number;
  workingDays: number;
  cells: RosterCell[];
}

export interface RosterDay {
  date: string;
  weekday: string;
  isToday: boolean;
  holiday: { _id: string; name: string; shopClosed: boolean } | null;
  plannedMinutes: number;
  working: number;
}

export interface RosterGrid {
  from: string;
  to: string;
  today: string;
  days: RosterDay[];
  employees: RosterEmployee[];
  shifts: Shift[];
}

export interface CellChange {
  employeeId: string;
  date: string;
  type: 'shift' | 'off' | 'leave' | 'default';
  shiftId?: string;
  leaveType?: LeaveType;
  note?: string;
}

export interface Holiday {
  _id: string;
  date: string;
  weekday: string;
  name: string;
  shopClosed: boolean;
}

export const rosterApi = {
  grid: async (from?: string, days = 7) => (await storeApi.get<RosterGrid>('/roster', { from, days })).data,
  saveCells: async (cells: CellChange[]) =>
    (await storeApi.put<{ saved: number; cleared: number; skipped: number; recomputed: number }>('/roster/cells', { cells })).data,
  copyWeek: async (body: { fromWeekStart: string; toWeekStart: string; overwrite?: boolean }) =>
    (await storeApi.post<{ sourceCells: number; copied: number; removed: number; skipped: number }>('/roster/copy-week', body)).data,

  shifts: async () => (await storeApi.get<Shift[]>('/shifts')).data,
  createShift: async (body: ShiftInput) => (await storeApi.post<Shift>('/shifts', body)).data,
  /** recomputed = attendance days of this month re-checked because the times changed. */
  updateShift: async (id: string, body: Partial<ShiftInput>) => (await storeApi.put<Shift & { recomputed?: number }>(`/shifts/${id}`, body)).data,
  setShiftActive: async (id: string, active: boolean) => (await storeApi.post<Shift>(`/shifts/${id}/${active ? 'activate' : 'deactivate'}`)).data,
  removeShift: (id: string) => storeApi.del(`/shifts/${id}`),

  holidays: async (year: number) => (await storeApi.get<Holiday[]>('/holidays', { year })).data,
  createHoliday: async (body: { date: string; name: string; shopClosed: boolean }) => (await storeApi.post<Holiday>('/holidays', body)).data,
  updateHoliday: async (id: string, body: { date?: string; name?: string; shopClosed?: boolean }) =>
    (await storeApi.put<Holiday>(`/holidays/${id}`, body)).data,
  removeHoliday: (id: string) => storeApi.del(`/holidays/${id}`),
  addPakistan: async (year: number) =>
    (await storeApi.post<{ year: number; added: Holiday[]; skipped: { date: string; name: string; reason: string }[] }>('/holidays/pakistan', { year })).data,
};

// ---------- display helpers ----------

export const SHIFT_COLORS = ['#FFD60A', '#F97316', '#22C55E', '#14B8A6', '#3B82F6', '#8B5CF6', '#EC4899', '#64748B'];

export const LEAVE_LABEL: Record<LeaveType, string> = { paid: 'Paid', unpaid: 'Unpaid', sick: 'Sick' };

/** '18:30' -> '6:30 PM' */
export function fmtTime(t?: string | null): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** '18:00' -> '6pm', '09:30' -> '9:30am' (roster cells). */
export function fmtShort(t?: string | null): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, '0')}` : ''}${h < 12 ? 'am' : 'pm'}`;
}

/** 450 -> '7.5 h', 2400 -> '40 h', 30 -> '30 min' */
export function fmtHours(minutes: number): string {
  const m = Math.round(Number(minutes) || 0);
  if (m > 0 && m < 60) return `${m} min`;
  const h = m / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(1)} h`;
}

/** 450 -> '7 h 30 min' */
export function fmtDuration(minutes: number): string {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r} min`;
  return r ? `${h} h ${r} min` : `${h} h`;
}

/** Minutes from start to end; an end at or before the start ends the next day. */
export function spanMinutes(start: string, end: string): number {
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const s = toMin(start);
  const e = toMin(end);
  return e > s ? e - s : e + 24 * 60 - s;
}

const OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Today in the shop (Pakistan time). */
export const shopToday = () => new Date(Date.now() + OFFSET_MS).toISOString().slice(0, 10);

const keyDate = (key: string) => new Date(`${key}T00:00:00Z`);

export const addDays = (key: string, n: number) => new Date(keyDate(key).getTime() + n * DAY_MS).toISOString().slice(0, 10);

/** A real 'YYYY-MM-DD' day? */
export const isDayKey = (v: string | null | undefined): v is string =>
  !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(keyDate(v).getTime()) && keyDate(v).toISOString().slice(0, 10) === v;

/** Monday of the week containing the day (the roster's week start). */
export const weekStart = (key: string) => addDays(key, -((keyDate(key).getUTCDay() + 6) % 7));

/** '2026-10-13' -> { dow: 'Tue', day: '13 Oct' } */
export function dayLabel(key: string) {
  const d = keyDate(key);
  return { dow: DOW[d.getUTCDay()], day: `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`, year: d.getUTCFullYear() };
}

/** '13 – 19 Oct 2026' / '27 Oct – 2 Nov 2026' */
export function rangeLabel(from: string, to: string): string {
  const a = keyDate(from);
  const b = keyDate(to);
  const sameMonth = a.getUTCMonth() === b.getUTCMonth() && a.getUTCFullYear() === b.getUTCFullYear();
  const left = sameMonth ? `${a.getUTCDate()}` : `${a.getUTCDate()} ${MONTHS[a.getUTCMonth()]}${a.getUTCFullYear() !== b.getUTCFullYear() ? ` ${a.getUTCFullYear()}` : ''}`;
  return `${left} – ${b.getUTCDate()} ${MONTHS[b.getUTCMonth()]} ${b.getUTCFullYear()}`;
}

/** Light background for a shift colour (#RRGGBB + alpha). */
export const tint = (color: string, alpha = '33') => (/^#[0-9a-f]{6}$/i.test(color) ? `${color}${alpha}` : '#FFD60A33');
