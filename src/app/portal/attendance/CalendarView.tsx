'use client';

// Portal attendance — Calendar view (owner, 2026-11-17): the same coloured day
// boxes as the admin month grid. Tap a day for its details in a popup.
import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { apiErrorMessage } from '@/lib/storeApi';
import { CODE_STYLE, LATE_EXCUSED_STYLE, StatusChip } from '@/app/(routes)/admin/hr/attendance/components/AttendanceBits';
import { dayLabel, mins, type AttendanceStatus } from '@/app/(routes)/admin/hr/attendance/services/attendanceApi';
import { Card } from '../_lib/PortalBits';
import { LATE_NOTE_MIN_WORDS, needsLateNote, planWords, portalApi, previewAs, timeText, wordCount, type PortalDay } from '../_lib/portalApi';

const CODE: Record<string, string> = {
  present: 'P',
  late: 'L',
  half_day: 'H',
  absent: 'A',
  missing_out: 'M',
  leave: 'LV',
  holiday: 'HO',
  off: 'O',
};
const WEEK = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const LEGEND: [string, string][] = [
  ['P', 'Present'],
  ['L', 'Late'],
  ['H', 'Half day'],
  ['A', 'Absent'],
  ['M', 'No check-out'],
  ['LV', 'Leave'],
  ['O', 'Off'],
];

const pkToday = () => new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);

function hoursShort(m: number) {
  const n = Math.round(Number(m) || 0);
  if (n <= 0) return '';
  if (n < 60) return `${n}m`;
  return `${Math.round((n / 60) * 10) / 10}h`;
}

function underText(d: PortalDay, today: string): { text: string; tone: string } | null {
  if (d.checkIn && !d.checkOut) {
    return d.date === today && d.status !== 'missing_out' ? { text: 'in', tone: 'text-green-700' } : { text: 'in only', tone: 'text-purple-700' };
  }
  const t = hoursShort(d.workedMinutes);
  return t ? { text: t, tone: 'text-gray-500' } : null;
}

export function CalendarView({ month, days, onPick }: { month: string; days: PortalDay[]; onPick: (d: PortalDay) => void }) {
  const today = pkToday();
  const byDate = new Map(days.map((d) => [d.date, d]));
  const [y, m] = month.split('-').map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const firstDow = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // Monday first
  const cells: (string | null)[] = Array(firstDow).fill(null);
  for (let i = 1; i <= count; i++) cells.push(`${month}-${String(i).padStart(2, '0')}`);

  return (
    <Card>
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center">
        {WEEK.map((w) => (
          <div key={w} className="text-[10px] font-semibold uppercase text-gray-400">
            {w}
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={`b${i}`} />;
          const d = byDate.get(date);
          const future = !d || d.status === 'upcoming' || d.status === 'not_employed';
          // Excused late shows as L with a tick (same as the admin grid).
          const code = d && !future ? (d.lateExcused ? 'L' : CODE[d.status] || '') : '';
          const under = d && !future ? underText(d, today) : null;
          const otWaiting = !!d && d.overtimeMinutes > 0 && d.overtimeApproved == null;
          return (
            <button
              key={date}
              type="button"
              disabled={future}
              onClick={() => d && onPick(d)}
              className={`flex flex-col items-center rounded-lg py-1 ${date === today ? 'bg-honey-100' : ''} ${future ? 'cursor-default' : 'hover:bg-gray-50'}`}
            >
              <span className="text-[11px] text-gray-500">{Number(date.slice(8))}</span>
              <span
                className={`relative mt-0.5 flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold ${
                  d?.lateExcused && !future ? LATE_EXCUSED_STYLE : CODE_STYLE[code] ?? CODE_STYLE['']
                }`}
              >
                {code}
                {d?.lateExcused && !future && <span className="absolute -top-1 -left-0.5 text-[9px] leading-none text-emerald-700">✓</span>}
                {otWaiting && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-honey-500 ring-1 ring-white" />}
                {d && !future && needsLateNote(d) && (
                  <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-white ring-1 ring-white">!</span>
                )}
              </span>
              <span className={`mt-0.5 h-3 text-[10px] leading-3 ${d && !future && needsLateNote(d) ? 'font-semibold text-red-600' : under?.tone || ''}`}>
                {d && !future && needsLateNote(d) ? 'why late?' : under?.text || ''}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-gray-600">
        {LEGEND.map(([c, l]) => (
          <span key={c} className="inline-flex items-center gap-1">
            <span className={`inline-flex h-5 w-6 items-center justify-center rounded text-[10px] font-bold ${CODE_STYLE[c]}`}>{c}</span>
            {l}
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-honey-500" /> Overtime waiting
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-white">!</span> Write why late
        </span>
      </div>
      <p className="mt-2 text-[11px] text-gray-400">Tap a day to see its details.</p>
    </Card>
  );
}

function DetailRow({ label, value, tone = 'text-gray-900' }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-gray-100 last:border-b-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-semibold text-right ${tone}`}>{value}</span>
    </div>
  );
}

/** Late reason box: the employee writes why they were late (at least 100 words). */
function LateNoteBox({ d, onSaved }: { d: PortalDay; onSaved: (date: string, text: string) => void }) {
  const preview = !!previewAs();
  const [editing, setEditing] = useState(!d.lateNote);
  const [text, setText] = useState(d.lateNote || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const words = wordCount(text);
  const enough = words >= LATE_NOTE_MIN_WORDS;

  const save = async () => {
    if (!enough || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await portalApi.saveLateNote(d.date, text.trim());
      onSaved(d.date, res.data.lateNote);
      setEditing(false);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not save. Try again.'));
    } finally {
      setSaving(false);
    }
  };

  if (!editing || preview) {
    return (
      <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-gray-700">Why I was late</p>
          {!preview && d.lateNote && (
            <button type="button" onClick={() => setEditing(true)} className="text-xs font-semibold text-honey-700">
              Edit
            </button>
          )}
        </div>
        <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{d.lateNote || 'Not written yet.'}</p>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
      <p className="text-sm font-semibold text-amber-900">Why were you late? (required)</p>
      <p className="text-[11px] text-amber-800">Write at least {LATE_NOTE_MIN_WORDS} words.</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        maxLength={5000}
        className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-honey-500 focus:outline-none focus:ring-2 focus:ring-honey-500/30"
        placeholder="Write what happened, why you came late and what you will do next time…"
      />
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className={`text-xs font-semibold ${enough ? 'text-green-700' : 'text-gray-500'}`}>
          {words} / {LATE_NOTE_MIN_WORDS} words
        </span>
        <button
          type="button"
          onClick={save}
          disabled={!enough || saving}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}

export function DayDetails({ d, onClose, onSaved }: { d: PortalDay; onClose: () => void; onSaved: (date: string, text: string) => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const otWord = d.overtimeApproved === true ? 'approved' : d.overtimeApproved === false ? 'not approved' : 'waiting for approval';
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
          <div>
            <p className="text-base font-bold text-gray-900">{dayLabel(d.date, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            <p className="text-xs text-gray-500">{planWords(d.planned)}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-4 py-2">
          <DetailRow label="Status" value={<StatusChip status={d.status as AttendanceStatus} small />} />
          <DetailRow label="Came in" value={timeText(d.checkIn)} />
          <DetailRow label="Went out" value={timeText(d.checkOut)} />
          <DetailRow label="Hours worked" value={d.workedMinutes > 0 ? mins(d.workedMinutes) : '—'} />
          {d.lateMinutes > 0 && (
            <DetailRow label="Late" value={`${mins(d.lateMinutes)}${d.lateExcused ? ' (excused)' : ''}`} tone={d.lateExcused ? 'text-emerald-700' : 'text-amber-700'} />
          )}
          {d.earlyLeaveMinutes > 0 && <DetailRow label="Left early" value={mins(d.earlyLeaveMinutes)} tone="text-orange-700" />}
          {d.overtimeMinutes > 0 && (
            <DetailRow label="Overtime" value={`${mins(d.overtimeMinutes)} · ${otWord}`} tone={d.overtimeApproved === true ? 'text-green-700' : 'text-gray-600'} />
          )}
          {d.workedMinutes > 12 * 60 && <DetailRow label="Over 12 hours" value={mins(d.workedMinutes - 12 * 60)} tone="text-green-700" />}
          {d.lateMinutes > 0 && <LateNoteBox d={d} onSaved={onSaved} />}
        </div>
        <div className="px-4 pb-4">
          <button type="button" onClick={onClose} className="w-full rounded-lg bg-gray-900 py-2.5 text-sm font-semibold text-white">
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
