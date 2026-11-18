'use client';

// Employee Portal — Attendance: month switcher, totals, one line per day.
import React, { useCallback, useEffect, useState } from 'react';
import { apiErrorMessage } from '@/lib/storeApi';
import { LateBadge, MonthPicker, StatTile, StatusChip } from '@/app/(routes)/admin/hr/attendance/components/AttendanceBits';
import { dayLabel, mins, shopMonth, type AttendanceStatus } from '@/app/(routes)/admin/hr/attendance/services/attendanceApi';
import { CalendarDays, List } from 'lucide-react';
import { Card, Empty, ErrorCard, Loading } from '../_lib/PortalBits';
import { CalendarView, DayDetails } from './CalendarView';
import { needsLateNote, planWords, portalApi, timeText, type PortalAttendance, type PortalDay } from '../_lib/portalApi';

// Left colour strip per status (same colours as the status chips).
const STRIP: Record<string, string> = {
  present: 'border-l-green-500',
  late: 'border-l-amber-500',
  half_day: 'border-l-orange-500',
  absent: 'border-l-red-500',
  missing_out: 'border-l-purple-500',
  leave: 'border-l-blue-500',
  holiday: 'border-l-teal-500',
  off: 'border-l-gray-300',
};

function DayRow({ d, onOpen }: { d: PortalDay; onOpen: (d: PortalDay) => void }) {
  const worked = d.checkIn || d.checkOut;
  return (
    <li className={`border-l-4 ${STRIP[d.status] || 'border-l-gray-200'} bg-white px-3 py-2.5`}>
      {d.lateMinutes > 0 && (
        <button
          type="button"
          onClick={() => onOpen(d)}
          className={`float-right ml-2 mt-6 rounded-md px-2 py-1 text-[11px] font-semibold ${
            needsLateNote(d) ? 'bg-red-600 text-white' : 'border border-gray-200 text-gray-600'
          }`}
        >
          {needsLateNote(d) ? 'Write why late' : 'My reason'}
        </button>
      )}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900">{dayLabel(d.date, { weekday: 'short', day: 'numeric', month: 'short' })}</p>
        <StatusChip status={d.status as AttendanceStatus} small />
      </div>
      <p className="text-xs text-gray-500 mt-0.5">{planWords(d.planned)}</p>
      {worked && (
        <p className="text-xs text-gray-700 mt-1">
          In <b>{timeText(d.checkIn)}</b> · Out <b>{timeText(d.checkOut)}</b>
          {d.workedMinutes > 0 && <span className="text-gray-500"> · {mins(d.workedMinutes)}</span>}
        </p>
      )}
      {(d.lateMinutes > 0 || d.earlyLeaveMinutes > 0 || d.overtimeMinutes > 0) && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <LateBadge minutes={d.lateMinutes} excused={d.lateExcused} small />
          {d.earlyLeaveMinutes > 0 && (
            <span className="inline-flex items-center border rounded-full px-1.5 py-0 text-[10px] font-semibold bg-orange-50 text-orange-800 border-orange-200">
              Left early {mins(d.earlyLeaveMinutes)}
            </span>
          )}
          {d.overtimeMinutes > 0 && (
            <span
              className={`inline-flex items-center border rounded-full px-1.5 py-0 text-[10px] font-semibold ${
                d.overtimeApproved ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-600 border-gray-200'
              }`}
            >
              Overtime {mins(d.overtimeMinutes)}
              {d.overtimeApproved ? ' · approved' : ' · waiting'}
            </span>
          )}
        </div>
      )}
    </li>
  );
}

export default function PortalAttendancePage() {
  const thisMonth = shopMonth();
  const [month, setMonth] = useState(thisMonth);
  const [data, setData] = useState<PortalAttendance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [picked, setPicked] = useState<PortalDay | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await portalApi.attendance(month);
      setData(res.data);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load your attendance.'));
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  const s = data?.month === month ? data.summary : null;
  // Newest day first; days still to come are left out.
  const days = data?.month === month ? [...(data.days || [])].filter((d) => d.status !== 'upcoming').reverse() : [];
  // Late days still waiting for the employee's reason.
  const missingNotes = days.filter(needsLateNote);
  const noteSaved = (date: string, text: string) => {
    const now = new Date().toISOString();
    setData((cur) => (cur ? { ...cur, days: cur.days.map((x) => (x.date === date ? { ...x, lateNote: text, lateNoteAt: now } : x)) } : cur));
    setPicked((p) => (p && p.date === date ? { ...p, lateNote: text, lateNoteAt: now } : p));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold text-gray-900">Attendance</h1>
        <MonthPicker value={month} onChange={setMonth} max={thisMonth} disabled={loading} />
      </div>

      {error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : loading && !s ? (
        <Loading text="Loading your days…" />
      ) : (
        <>
          {s && (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              <StatTile label="Present" value={s.present ?? 0} tone="green" />
              <StatTile label="Late" value={s.late ?? 0} tone="amber" />
              <StatTile label="Absent" value={s.absent ?? 0} tone="red" />
              <StatTile label="Leave" value={s.leave ?? 0} tone="blue" />
              <StatTile label="Off" value={s.off ?? 0} />
              <StatTile label="Worked" value={mins(s.workedMinutes)} tone="honey" />
            </div>
          )}
          {s && (s.lateMinutes > 0 || s.overtimeMinutes > 0) && (
            <p className="text-xs text-gray-500">
              {s.lateMinutes > 0 && <>Late in total: {mins(s.lateMinutes)}. </>}
              {s.overtimeMinutes > 0 && <>Overtime: {mins(s.overtimeMinutes)}.</>}
            </p>
          )}

          <div className="flex rounded-lg border border-gray-200 bg-white p-1 text-sm font-semibold">
            <button
              type="button"
              onClick={() => setView('calendar')}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 ${view === 'calendar' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <CalendarDays className="h-4 w-4" /> Calendar
            </button>
            <button
              type="button"
              onClick={() => setView('list')}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 ${view === 'list' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <List className="h-4 w-4" /> List
            </button>
          </div>

          {missingNotes.length > 0 && (
            <button
              type="button"
              onClick={() => setPicked(missingNotes[0])}
              className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-left text-sm text-red-800"
            >
              <b>You were late {missingNotes.length} day{missingNotes.length === 1 ? '' : 's'} without a reason.</b> Tap here (or the red ! days) and write why you
              were late — at least 100 words.
            </button>
          )}

          {view === 'calendar' && <CalendarView month={month} days={data?.month === month ? data.days || [] : []} onPick={setPicked} />}

          {view === 'list' && (
          <Card title="Days">
            {days.length ? (
              <ul className="-mx-4 divide-y divide-gray-100 border-y border-gray-100">
                {days.map((d) => (
                  <DayRow key={d.date} d={d} onOpen={setPicked} />
                ))}
              </ul>
            ) : (
              <Empty title="No days in this month" text="Your check-ins show here after you use the fingerprint machine." />
            )}
          </Card>
          )}
          {picked && <DayDetails d={picked} onClose={() => setPicked(null)} onSaved={noteSaved} />}
          <p className="text-[11px] text-gray-400 text-center">Times are shop time (Pakistan). Something wrong? Tell the shop admin.</p>
        </>
      )}
    </div>
  );
}
