'use client';

// Hours worked day by day behind one payroll line: status, in / out, hours,
// overtime for every day of the month, with month totals. Read live from
// attendance (GET /payroll/runs/:id/lines/:lineId/days).
import React, { useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { apiErrorMessage } from '@/lib/storeApi';
import { payrollApi, shortHours, type DayStatus, type LineDay, type LineDays } from '../../_shared/payrollApi';

const STATUS: Record<DayStatus, { label: string; cls: string }> = {
  present: { label: 'Present', cls: 'bg-green-50 text-green-700 border-green-200' },
  late: { label: 'Late', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  half_day: { label: 'Half day', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  absent: { label: 'Absent', cls: 'bg-red-50 text-red-700 border-red-200' },
  missing_out: { label: 'No check-out', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  off: { label: 'Off', cls: 'bg-gray-50 text-gray-500 border-gray-200' },
  holiday: { label: 'Holiday', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  leave: { label: 'Leave', cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  upcoming: { label: 'Not yet', cls: 'bg-white text-gray-400 border-gray-200' },
  pending: { label: 'Not yet', cls: 'bg-white text-gray-400 border-gray-200' },
  not_employed: { label: 'Not employed', cls: 'bg-white text-gray-400 border-gray-200' },
};

/** "Sat 08 Nov" */
const dayText = (key: string) =>
  new Date(`${key}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' });

/** "10:05 am" in shop time. */
const timeText = (v: string | null) =>
  v ? new Date(v).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Karachi' }).toLowerCase() : '—';

function statusOf(d: LineDay) {
  const s = STATUS[d.status] || STATUS.off;
  let label = s.label;
  // Worked on an off day / holiday.
  if ((d.status === 'present' || d.status === 'late') && (d.planned === 'off' || d.planned === 'holiday')) label = d.planned === 'holiday' ? 'Worked holiday' : 'Worked off day';
  if (d.status === 'leave' && d.leaveType) label = `${d.leaveType[0].toUpperCase()}${d.leaveType.slice(1)} leave`;
  return { label, cls: s.cls };
}

function sub(d: LineDay) {
  const bits: string[] = [];
  if (d.lateMinutes > 0) bits.push(`${shortHours(d.lateMinutes)} late`);
  if (d.earlyLeaveMinutes > 0) bits.push(`left ${shortHours(d.earlyLeaveMinutes)} early`);
  if (d.status === 'holiday' && d.holidayName) bits.push(d.holidayName);
  return bits.join(' · ');
}

function Ot({ d }: { d: LineDay }) {
  if (!(d.overtimeMinutes > 0)) return <span className="text-gray-300">—</span>;
  const tone = d.overtimeApproved === true ? 'text-green-700' : d.overtimeApproved === false ? 'text-gray-400 line-through' : 'text-amber-700';
  const title = d.overtimeApproved === true ? 'Approved' : d.overtimeApproved === false ? 'Not approved' : 'Waiting for approval';
  return (
    <span className={tone} title={title}>
      {shortHours(d.overtimeMinutes)}
      {d.overtimeApproved === null && <span className="text-[10px] ml-0.5">?</span>}
    </span>
  );
}

export default function DayHours({ runId, lineId }: { runId: string; lineId: string }) {
  const [data, setData] = useState<LineDays | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    payrollApi
      .lineDays(runId, lineId)
      .then((res) => alive && setData(res.data))
      .catch((e) => alive && setError(apiErrorMessage(e, 'Could not load the days')))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [runId, lineId, tick]);

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Hours worked, day by day</h3>
        {data && (
          <span className="text-xs font-semibold text-gray-900 tabular-nums">
            Total {shortHours(data.totals.workedMinutes)}
          </span>
        )}
      </div>

      {loading && !data ? (
        <div className="flex items-center gap-2 text-xs text-gray-500 py-4 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading days…
        </div>
      ) : error ? (
        <div className="flex items-center justify-between gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <span>{error}</span>
          <button type="button" onClick={() => setTick((t) => t + 1)} className="inline-flex items-center gap-1 font-semibold">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      ) : data ? (
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <div className="max-h-[26rem] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0 z-[1]">
                <tr className="text-[10px] uppercase tracking-wide text-gray-500">
                  <th className="text-left font-semibold px-2 py-1.5">Day</th>
                  <th className="text-left font-semibold px-2 py-1.5">Status</th>
                  <th className="text-left font-semibold px-2 py-1.5 whitespace-nowrap">In – Out</th>
                  <th className="text-right font-semibold px-2 py-1.5">Hours</th>
                  <th className="text-right font-semibold px-2 py-1.5">OT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.days.map((d) => {
                  const st = statusOf(d);
                  const note = sub(d);
                  const dim = d.status === 'upcoming' || d.status === 'pending' || d.status === 'not_employed' || d.status === 'off';
                  return (
                    <tr key={d.date} className={dim ? 'bg-gray-50/60' : ''}>
                      <td className={`px-2 py-1.5 whitespace-nowrap ${dim ? 'text-gray-400' : 'text-gray-900 font-medium'}`}>{dayText(d.date)}</td>
                      <td className="px-2 py-1.5">
                        <span className={`inline-block rounded border px-1.5 py-px text-[10px] font-semibold whitespace-nowrap ${st.cls}`}>{st.label}</span>
                        {note && <span className="block text-[10px] text-gray-500 mt-0.5">{note}</span>}
                      </td>
                      <td className="px-2 py-1.5 text-gray-600 tabular-nums">
                        {d.checkIn || d.checkOut ? (
                          <span className="whitespace-nowrap">
                            {timeText(d.checkIn)}
                            <span className="text-gray-300"> – </span>
                            {d.checkOut ? timeText(d.checkOut) : <span className="text-amber-700">no out</span>}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-gray-900 whitespace-nowrap">
                        {d.workedMinutes > 0 ? shortHours(d.workedMinutes) : <span className="text-gray-300 font-normal">—</span>}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">
                        <Ot d={d} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-gray-200 bg-honey-50 px-3 py-2 grid grid-cols-3 gap-2 text-xs">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-500">Total hours</p>
              <p className="font-bold text-gray-900 tabular-nums">{shortHours(data.totals.workedMinutes)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-500">Overtime</p>
              <p className="font-bold text-gray-900 tabular-nums">
                {shortHours(data.totals.overtimeMinutes)}
                {data.totals.overtimeMinutes > data.totals.overtimeApprovedMinutes && (
                  <span className="block text-[10px] font-normal text-gray-500">{shortHours(data.totals.overtimeApprovedMinutes)} approved</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-500">Days present</p>
              <p className="font-bold text-gray-900 tabular-nums">
                {data.totals.daysWorked}
                {data.totals.halfDays > 0 && <span className="text-[10px] font-normal text-gray-500"> ({data.totals.halfDays} half)</span>}
              </p>
            </div>
          </div>
          <p className="px-3 py-1.5 text-[10px] text-gray-500 border-t border-gray-100">
            From attendance as it is now. OT: green = approved, amber ? = waiting, struck = not approved.
          </p>
        </div>
      ) : null}
    </section>
  );
}
