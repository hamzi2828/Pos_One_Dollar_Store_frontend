'use client';

// "Today" tab: who is in now, who is late / not in yet / absent, with times
// (fingerprint or corrected), late minutes and overtime. Managers correct
// times (reason required) and approve overtime. Refreshes every minute on today.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Loader2, Lock, Pencil, RefreshCw, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { ErrorBox, inputClass, secondaryBtn } from '@/components/admin/FormBits';
import { apiErrorMessage } from '@/lib/storeApi';
import { attendanceApi, clock, fileUrl, mins, planText, shopDay, type Board, type BoardRow } from '../services/attendanceApi';
import { Avatar, DayPicker, PhotoViewer, SourceTag, StatTile, StatusChip, cardClass } from './AttendanceBits';
import DayModal from './DayModal';

type Filter = 'all' | 'scheduled' | 'in' | 'late' | 'pending' | 'absent' | 'missing_out' | 'leave' | 'off' | 'holiday' | 'overtime';

const FILTERS: Record<Filter, (r: BoardRow) => boolean> = {
  all: () => true,
  scheduled: (r) => r.plan.type === 'shift',
  in: (r) => r.inNow,
  late: (r) => r.lateMinutes > 0,
  pending: (r) => r.status === 'pending',
  absent: (r) => r.status === 'absent',
  missing_out: (r) => r.status === 'missing_out',
  leave: (r) => r.status === 'leave',
  off: (r) => r.status === 'off',
  holiday: (r) => r.status === 'holiday',
  overtime: (r) => r.overtimeMinutes > 0 && r.overtimeApproved === null,
};

// Who needs attention first on the list.
const ORDER: Record<string, number> = { missing_out: 0, absent: 1, pending: 2, late: 3, half_day: 4, present: 5, leave: 6, holiday: 7, off: 8 };

export default function TodayTab({ canEdit }: { canEdit: boolean }) {
  const today = shopDay();
  const [date, setDate] = useState(today);
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [dayOf, setDayOf] = useState<{ row: BoardRow; edit: boolean } | null>(null);
  const [photo, setPhoto] = useState<{ url: string; caption: string } | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const reqId = useRef(0);

  const load = useCallback(
    async (quiet = false) => {
      const id = ++reqId.current;
      if (!quiet) setLoading(true);
      try {
        const b = await attendanceApi.board(date);
        if (id !== reqId.current) return; // a newer request is on its way
        setBoard(b);
        setError(null);
      } catch (e) {
        if (id === reqId.current && !quiet) setError(apiErrorMessage(e, 'Could not load attendance.'));
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    [date],
  );

  useEffect(() => {
    load();
  }, [load]);

  // Live board: refresh every minute while looking at today.
  useEffect(() => {
    if (date !== today) return;
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') load(true);
    }, 60_000);
    return () => clearInterval(t);
  }, [date, today, load]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (board?.rows || [])
      .filter(FILTERS[filter])
      .filter((r) => !q || r.employee.name.toLowerCase().includes(q) || r.employee.designation.toLowerCase().includes(q))
      .sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9) || a.employee.name.localeCompare(b.employee.name));
  }, [board, filter, search]);

  const decide = async (row: BoardRow, approved: boolean) => {
    if (!row.recordId || busy.has(row.recordId)) return;
    const id = row.recordId;
    setBusy((s) => new Set(s).add(id));
    try {
      const res = await attendanceApi.overtime({ recordIds: [id], approved });
      toast.success(res.message || 'Saved');
      await load(true);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not save the decision.'));
    } finally {
      setBusy((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }
  };

  const c = board?.counts;
  const tile = (f: Filter, label: string, value: number | undefined, tone: Parameters<typeof StatTile>[0]['tone']) => (
    <StatTile label={label} value={value ?? '—'} tone={tone} active={filter === f} onClick={() => setFilter(filter === f ? 'all' : f)} />
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <DayPicker value={date} onChange={(d) => setDate(d > today ? today : d)} max={today} />
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => load()} disabled={loading} className={secondaryBtn} aria-label="Refresh">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {board?.holiday && (
        <div className="px-3 py-2 rounded-lg bg-teal-50 border border-teal-200 text-sm text-teal-800">
          Holiday: <strong>{board.holiday.name}</strong>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {tile('scheduled', 'Scheduled', c?.scheduled, 'gray')}
        {tile('in', board?.isToday ? 'In now' : 'Checked in', board?.isToday ? c?.inNow : c?.checkedIn, 'green')}
        {tile('late', 'Late', c?.late, 'amber')}
        {tile('pending', 'Not in yet', c?.notInYet, 'gray')}
        {tile('absent', 'Absent', c?.absent, 'red')}
        {tile('leave', 'On leave', c?.onLeave, 'blue')}
        {tile('off', 'Off', c?.off, 'gray')}
        {tile('holiday', 'Holiday', c?.holiday, 'teal')}
      </div>
      {!!c && (c.missingOut > 0 || c.overtimePending > 0) && (
        <div className="flex flex-wrap gap-2 text-xs">
          {c.missingOut > 0 && (
            <button type="button" onClick={() => setFilter('missing_out')} className="px-2.5 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-700 font-medium">
              {c.missingOut} without check-out
            </button>
          )}
          {c.overtimePending > 0 && (
            <button type="button" onClick={() => setFilter('overtime')} className="px-2.5 py-1 rounded-full bg-honey-50 border border-honey-300 text-honey-800 font-medium">
              {c.overtimePending} overtime waiting
            </button>
          )}
        </div>
      )}

      <div className={cardClass}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-3 sm:px-4 py-3 border-b border-gray-100">
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name" className={`${inputClass} pl-9`} />
          </div>
          {filter !== 'all' && (
            <button type="button" onClick={() => setFilter('all')} className="text-xs font-medium text-honey-700 hover:underline self-start sm:self-auto">
              Show everyone
            </button>
          )}
        </div>

        {error ? (
          <div className="p-4 space-y-3">
            <ErrorBox message={error} />
            <button type="button" className={secondaryBtn} onClick={() => load()}>
              Try again
            </button>
          </div>
        ) : loading && !board ? (
          <div className="py-14 text-center">
            <Loader2 className="h-7 w-7 text-honey-700 animate-spin mx-auto mb-2" />
            <p className="text-sm text-gray-500">Loading attendance…</p>
          </div>
        ) : rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-500">{board?.rows.length ? 'Nobody matches this filter.' : 'No employees yet. Add staff under HR → Employees.'}</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {rows.map((r) => {
              const rowBusy = !!r.recordId && busy.has(r.recordId);
              return (
                <li key={r.employee._id} className="px-3 sm:px-4 py-3 md:grid md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto] md:items-center md:gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar url={r.employee.photo} name={r.employee.name} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{r.employee.name}</p>
                      <p className="text-xs text-gray-500 truncate">{r.employee.designation || r.employee.code || '—'}</p>
                      {r.lastCorrection && (
                        <p className="text-[11px] text-honey-800 truncate" title={`Corrected by ${r.lastCorrection.byName || 'manager'}: ${r.lastCorrection.reason}`}>
                          Corrected by {r.lastCorrection.byName || 'manager'}: {r.lastCorrection.reason}
                        </p>
                      )}
                    </div>
                  </div>

                  <p className="mt-1 md:mt-0 text-xs text-gray-600 truncate pl-[3.25rem] md:pl-0">{planText(r.plan)}</p>

                  <div className="mt-1 md:mt-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm pl-[3.25rem] md:pl-0">
                    <span className="inline-flex items-center gap-1 text-gray-900">
                      <span className="text-[10px] font-semibold text-green-700">IN</span>
                      {r.checkIn ? clock(r.checkIn) : '—'}
                      <SourceTag source={r.inSource} />
                    </span>
                    <span className="inline-flex items-center gap-1 text-gray-900">
                      <span className="text-[10px] font-semibold text-blue-700">OUT</span>
                      {r.checkOut ? clock(r.checkOut) : '—'}
                      <SourceTag source={r.outSource} />
                    </span>
                  </div>

                  <div className="mt-1.5 md:mt-0 flex flex-wrap items-center gap-1.5 pl-[3.25rem] md:pl-0">
                    <StatusChip status={r.status} />
                    {r.inNow && <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-green-600 text-white">IN NOW</span>}
                    {r.lateMinutes > 0 && <span className="text-xs text-amber-700 font-medium">{mins(r.lateMinutes)} late</span>}
                    {r.earlyLeaveMinutes > 0 && <span className="text-xs text-amber-700">left {mins(r.earlyLeaveMinutes)} early</span>}
                    {r.workedMinutes > 0 && <span className="text-xs text-gray-500">worked {mins(r.workedMinutes)}</span>}
                    {r.overtimeMinutes > 0 && (
                      <span
                        className={`text-xs font-medium ${r.overtimeApproved === true ? 'text-green-700' : r.overtimeApproved === false ? 'text-gray-400 line-through' : 'text-honey-700'}`}
                      >
                        OT {mins(r.overtimeMinutes)}
                        {r.overtimeApproved === null ? ' · waiting' : ''}
                      </span>
                    )}
                    {r.locked && <Lock className="h-3.5 w-3.5 text-gray-400" aria-label="Locked by payroll" />}
                  </div>

                  <div className="mt-2 md:mt-0 flex items-center justify-end gap-1.5 pl-[3.25rem] md:pl-0">
                    {r.photos.slice(0, 2).map((p, i) => (
                      <button key={i} type="button" onClick={() => setPhoto({ url: p.url, caption: `${r.employee.name} · ${p.kind === 'in' ? 'In' : 'Out'} ${clock(p.at)}` })}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={fileUrl(p.url)} alt={`${r.employee.name} ${p.kind}`} className="h-9 w-9 rounded-md object-cover border border-gray-200" />
                      </button>
                    ))}
                    {canEdit && r.overtimeMinutes > 0 && r.overtimeApproved === null && !r.locked && (
                      <>
                        <button type="button" onClick={() => decide(r, true)} disabled={rowBusy} className="p-2 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 disabled:opacity-50" title="Approve overtime" aria-label="Approve overtime">
                          {rowBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        </button>
                        <button type="button" onClick={() => decide(r, false)} disabled={rowBusy} className="p-2 rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 disabled:opacity-50" title="Reject overtime" aria-label="Reject overtime">
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    {canEdit && !r.locked ? (
                      <button type="button" onClick={() => setDayOf({ row: r, edit: true })} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">
                        <Pencil className="h-3.5 w-3.5" /> Correct times
                      </button>
                    ) : (
                      <button type="button" onClick={() => setDayOf({ row: r, edit: false })} className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">
                        Details
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {dayOf && board && (
        <DayModal
          employeeId={dayOf.row.employee._id}
          employeeName={dayOf.row.employee.name}
          date={board.date}
          canEdit={canEdit}
          startEditing={dayOf.edit}
          onClose={() => setDayOf(null)}
          onChanged={() => load(true)}
        />
      )}
      {photo && <PhotoViewer url={photo.url} caption={photo.caption} onClose={() => setPhoto(null)} />}
    </div>
  );
}
