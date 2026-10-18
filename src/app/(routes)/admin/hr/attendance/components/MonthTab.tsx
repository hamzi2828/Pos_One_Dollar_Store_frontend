'use client';

// "Month" tab: employees × days grid with short coloured codes, legend and
// totals per employee (present, late, absent, leave, overtime). Click a cell
// for that day's details and corrections. CSV download for export users.
// Days closed by an approved payroll show their status with a small lock.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Loader2, Lock, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { ErrorBox, inputClass, secondaryBtn } from '@/components/admin/FormBits';
import { apiErrorMessage } from '@/lib/storeApi';
import { attendanceApi, clock, downloadSheetCsv, hoursLabel, mins, shopMonth, type Sheet, type SheetCell, type SheetEmployee } from '../services/attendanceApi';
import { CODE_STYLE, MonthPicker, cardClass, statusLabel } from './AttendanceBits';
import DayModal from './DayModal';

function cellTitle(c: SheetCell, name: string) {
  const parts = [`${name} · ${c.date}`, statusLabel(c.status)];
  if (c.shiftName) parts.push(c.shiftName);
  if (c.holidayName) parts.push(c.holidayName);
  if (c.checkIn) parts.push(`in ${clock(c.checkIn)}`);
  if (c.checkOut) parts.push(`out ${clock(c.checkOut)}`);
  if (c.lateMinutes) parts.push(`${mins(c.lateMinutes)} late`);
  if (c.locked) parts.push('locked by payroll');
  if (c.overtimeMinutes) parts.push(`OT ${mins(c.overtimeMinutes)}${c.overtimeApproved === null ? ' (waiting)' : c.overtimeApproved ? '' : ' (rejected)'}`);
  return parts.join(' · ');
}

export default function MonthTab({
  canEdit,
  canExport,
  initialMonth,
  highlightEmployee,
}: {
  canEdit: boolean;
  canExport: boolean;
  /** 'YYYY-MM' to open on (e.g. from a Payroll link). */
  initialMonth?: string | null;
  /** Employee row to highlight and scroll to. */
  highlightEmployee?: string | null;
}) {
  const thisMonth = shopMonth();
  const [month, setMonth] = useState(initialMonth && initialMonth <= thisMonth ? initialMonth : thisMonth);
  const highlightRef = useRef<HTMLTableRowElement>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);
  const [open, setOpen] = useState<{ emp: SheetEmployee; date: string } | null>(null);

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      setError(null);
      try {
        setSheet(await attendanceApi.sheet(month));
      } catch (e) {
        setError(apiErrorMessage(e, 'Could not load the month.'));
      } finally {
        setLoading(false);
      }
    },
    [month],
  );

  useEffect(() => {
    load();
  }, [load]);

  const employees = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (sheet?.employees || []).filter((e) => !q || e.name.toLowerCase().includes(q));
  }, [sheet, search]);

  const exportCsv = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await downloadSheetCsv(month);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not download the CSV.'));
    } finally {
      setExporting(false);
    }
  };

  const sameMonth = sheet?.month === month;

  // Bring the linked employee into view once the grid is there.
  useEffect(() => {
    if (highlightEmployee && sameMonth) highlightRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [highlightEmployee, sameMonth]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <MonthPicker value={month} onChange={setMonth} max={thisMonth} disabled={loading} />
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-56">
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name" className={`${inputClass} pl-9`} />
          </div>
          {canExport && (
            <button type="button" onClick={exportCsv} disabled={exporting} className={secondaryBtn}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              CSV
            </button>
          )}
        </div>
      </div>

      {error ? (
        <div className="space-y-3">
          <ErrorBox message={error} />
          <button type="button" className={secondaryBtn} onClick={() => load()}>
            Try again
          </button>
        </div>
      ) : (loading && !sameMonth) || !sheet ? (
        <div className={`${cardClass} py-14 text-center`}>
          <Loader2 className="h-7 w-7 text-honey-700 animate-spin mx-auto mb-2" />
          <p className="text-sm text-gray-500">Loading the month…</p>
        </div>
      ) : employees.length === 0 ? (
        <div className={`${cardClass} py-12 text-center text-sm text-gray-500`}>{sheet.employees.length ? 'Nobody matches the search.' : 'No attendance for this month.'}</div>
      ) : (
        <div className={`${cardClass} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="text-xs border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-gray-50 text-left font-semibold text-gray-700 px-3 py-2 border-b border-gray-200 min-w-[10rem]">Employee</th>
                  {sheet.days.map((d) => (
                    <th
                      key={d.date}
                      title={d.holidayName || undefined}
                      className={`px-0.5 py-1 border-b border-gray-200 font-medium text-center min-w-[2rem] ${
                        d.date === sheet.today ? 'bg-honey-100 text-gray-900' : d.holidayName ? 'bg-teal-50 text-teal-800' : 'bg-gray-50 text-gray-600'
                      }`}
                    >
                      <span className="block">{d.day}</span>
                      <span className="block text-[9px] font-normal text-gray-400">{d.weekday.slice(0, 2)}</span>
                    </th>
                  ))}
                  {['Present', 'Late', 'Half', 'Absent', 'No out', 'Leave', 'OT ✓', 'OT wait'].map((h) => (
                    <th key={h} className="px-2 py-2 border-b border-l border-gray-200 bg-gray-50 font-semibold text-gray-700 text-center whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => {
                  const hl = e.employeeId === highlightEmployee;
                  return (
                  <tr key={e.employeeId} ref={hl ? highlightRef : undefined} className={`group ${hl ? 'bg-honey-50' : ''}`}>
                    <td className={`sticky left-0 z-10 px-3 py-1.5 border-b border-gray-100 ${hl ? 'bg-honey-100 border-l-4 border-l-honey-500' : 'bg-white group-hover:bg-gray-50'}`}>
                      <p className="flex items-center gap-1 font-semibold text-gray-900 truncate max-w-[10rem]">
                        <span className="truncate">{e.name}</span>
                        {e.locked && <Lock className="h-3 w-3 flex-shrink-0 text-gray-400" aria-label="Month locked by payroll" />}
                      </p>
                      <p className="text-[10px] text-gray-500 truncate max-w-[10rem]">{e.designation || e.policyName}</p>
                    </td>
                    {e.cells.map((c) => {
                      const clickable = c.status !== 'not_employed' && c.date <= sheet.today;
                      return (
                        <td key={c.date} className="p-0.5 border-b border-gray-100 text-center">
                          <button
                            type="button"
                            disabled={!clickable}
                            onClick={() => setOpen({ emp: e, date: c.date })}
                            title={cellTitle(c, e.name)}
                            className={`relative w-7 h-7 rounded text-[10px] font-bold ${CODE_STYLE[c.code] ?? CODE_STYLE['']} ${clickable ? 'hover:ring-2 hover:ring-honey-500' : 'cursor-default'}`}
                          >
                            {c.code}
                            {c.overtimeMinutes > 0 && c.overtimeApproved === null && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-honey-500 ring-1 ring-white" />}
                            {c.locked && <Lock className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-sm bg-white text-gray-500" aria-hidden />}
                          </button>
                        </td>
                      );
                    })}
                    <Total v={e.totals.present + e.totals.offDaysWorked} />
                    <Total v={e.totals.late} warn />
                    <Total v={e.totals.halfDays} warn />
                    <Total v={e.totals.absent} bad />
                    <Total v={e.totals.missingOut} warn />
                    <Total v={e.totals.leave} />
                    <Total v={e.totals.overtimeApprovedMinutes ? hoursLabel(e.totals.overtimeApprovedMinutes) : 0} />
                    <Total v={e.totals.overtimePendingMinutes ? hoursLabel(e.totals.overtimePendingMinutes) : 0} warn />
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5 border-t border-gray-100 text-[11px] text-gray-600">
            {sheet.legend.map((l) => (
              <span key={l.code} className="inline-flex items-center gap-1">
                <span className={`inline-flex items-center justify-center w-6 h-5 rounded text-[10px] font-bold ${CODE_STYLE[l.code]}`}>{l.code}</span>
                {l.label}
              </span>
            ))}
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-honey-500" /> Overtime waiting
            </span>
            <span className="inline-flex items-center gap-1">
              <Lock className="h-3 w-3 text-gray-500" /> Paid month (locked)
            </span>
          </div>
        </div>
      )}

      {open && (
        <DayModal
          employeeId={open.emp.employeeId}
          employeeName={open.emp.name}
          date={open.date}
          canEdit={canEdit}
          onClose={() => setOpen(null)}
          onChanged={() => load(true)}
        />
      )}
    </div>
  );
}

function Total({ v, warn, bad }: { v: number | string; warn?: boolean; bad?: boolean }) {
  const zero = v === 0 || v === '0';
  return (
    <td
      className={`px-2 py-1.5 border-b border-l border-gray-100 text-center font-semibold whitespace-nowrap ${
        zero ? 'text-gray-300' : bad ? 'text-red-600' : warn ? 'text-amber-700' : 'text-gray-900'
      }`}
    >
      {v}
    </td>
  );
}
