'use client';

// "Fix before payroll" tab: missing check-outs, absences on shift days with no
// leave, overtime waiting for approval, staff with no fingerprint enrolled or
// no schedule — each with a one-click fix (or where to fix it).
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import { AlertTriangle, CalendarOff, Check, CheckCircle2, Clock3, ExternalLink, Fingerprint, Loader2, X, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { ErrorBox, secondaryBtn } from '@/components/admin/FormBits';
import { apiErrorMessage } from '@/lib/storeApi';
import {
  attendanceApi,
  dayLabel,
  shopMonth,
  type ExceptionItem,
  type ExceptionType,
  type AttendanceFocus,
  type Exceptions,
} from '../services/attendanceApi';
import { Avatar, DesktopNote, MonthPicker, cardClass } from './AttendanceBits';
import DayModal from './DayModal';

const GROUPS: { type: ExceptionType; title: string; hint: string; Icon: ComponentType<{ className?: string }>; tone: string }[] = [
  { type: 'missing_out', title: 'Missing check-outs', hint: 'Clocked in but never clocked out.', Icon: AlertTriangle, tone: 'text-purple-700' },
  { type: 'absent', title: 'Absent on a shift day', hint: 'No punch and no leave on the roster. Add times if they worked, or mark leave.', Icon: XCircle, tone: 'text-red-600' },
  { type: 'overtime', title: 'Overtime waiting for approval', hint: 'Overtime is paid only after you approve it.', Icon: Clock3, tone: 'text-honey-700' },
  { type: 'no_fingerprint', title: 'No fingerprint enrolled', hint: 'They cannot clock in until a finger is enrolled on the attendance desktop app.', Icon: Fingerprint, tone: 'text-gray-700' },
  { type: 'no_schedule', title: 'No schedule', hint: 'No default shift and nothing on the roster, so late / absent cannot be worked out.', Icon: CalendarOff, tone: 'text-gray-700' },
];

// Payroll links: corrections = days to fix (missing check-out / absent), overtime = waiting overtime.
const FOCUS_TYPES: Record<AttendanceFocus, ExceptionType[]> = {
  corrections: ['missing_out', 'absent'],
  overtime: ['overtime'],
};
const FOCUS_LABEL: Record<AttendanceFocus, string> = { corrections: 'Days to correct', overtime: 'Overtime waiting' };

export default function ExceptionsTab({
  canEdit,
  initialMonth,
  focus: initialFocus,
  employeeId: initialEmployee,
}: {
  canEdit: boolean;
  /** 'YYYY-MM' to open on (Payroll link). */
  initialMonth?: string | null;
  /** Only these kinds of items (Payroll link). */
  focus?: AttendanceFocus | null;
  /** Only this employee's items (Payroll link). */
  employeeId?: string | null;
}) {
  const thisMonth = shopMonth();
  const [month, setMonth] = useState(initialMonth && initialMonth <= thisMonth ? initialMonth : thisMonth);
  const [focus, setFocus] = useState<AttendanceFocus | null>(initialFocus || null);
  const [employeeId, setEmployeeId] = useState<string | null>(initialEmployee || null);
  const [data, setData] = useState<Exceptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState(false);
  const [open, setOpen] = useState<ExceptionItem | null>(null);

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      setError(null);
      try {
        setData(await attendanceApi.exceptions(month));
      } catch (e) {
        setError(apiErrorMessage(e, 'Could not load the list.'));
      } finally {
        setLoading(false);
      }
    },
    [month],
  );

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(
    () => (data?.items || []).filter((it) => (!focus || FOCUS_TYPES[focus].includes(it.type)) && (!employeeId || it.employeeId === employeeId)),
    [data, focus, employeeId],
  );
  const byType = useMemo(() => {
    const m = new Map<ExceptionType, ExceptionItem[]>();
    for (const it of visible) m.set(it.type, [...(m.get(it.type) || []), it]);
    return m;
  }, [visible]);
  const filtered = !!focus || !!employeeId;
  const employeeName = employeeId ? data?.items.find((i) => i.employeeId === employeeId)?.name || 'this employee' : null;
  const clearFilter = () => {
    setFocus(null);
    setEmployeeId(null);
  };

  const decide = async (ids: string[], approved: boolean) => {
    if (!ids.length || ids.some((id) => busy.has(id))) return;
    setBusy((s) => new Set([...s, ...ids]));
    try {
      const res = await attendanceApi.overtime({ recordIds: ids, approved });
      toast.success(res.message || 'Saved');
      await load(true);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not save the decision.'));
    } finally {
      setBusy((s) => {
        const n = new Set(s);
        ids.forEach((id) => n.delete(id));
        return n;
      });
    }
  };

  const approveAll = async () => {
    const ids = (byType.get('overtime') || []).map((i) => i.recordId).filter((x): x is string => !!x);
    if (!ids.length || bulk) return;
    if (!window.confirm(`Approve all ${ids.length} overtime day${ids.length === 1 ? '' : 's'} waiting?`)) return;
    setBulk(true);
    try {
      await decide(ids, true);
    } finally {
      setBulk(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className={`${cardClass} px-4 py-3`}>
        <DesktopNote />
        {data && !data.fingerprintCheck && (
          <p className="mt-1 ml-8 text-[11px] text-gray-500">Fingerprint enrolment is not checked yet — the desktop attendance module is not installed on the server.</p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <MonthPicker value={month} onChange={setMonth} max={thisMonth} disabled={loading} />
        {data && (
          <p className="text-sm text-gray-600">
            {data.counts.total ? (
              <>
                <strong className="text-gray-900">{data.counts.total}</strong> thing{data.counts.total === 1 ? '' : 's'} to check before payroll
              </>
            ) : null}
          </p>
        )}
      </div>

      {filtered && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-honey-50 border border-honey-200 text-sm text-gray-800">
          <span>
            Showing <strong>{focus ? FOCUS_LABEL[focus] : 'everything'}</strong>
            {employeeName && (
              <>
                {' '}for <strong>{employeeName}</strong>
              </>
            )}
          </span>
          <button type="button" onClick={clearFilter} className="ml-auto text-xs font-semibold text-honey-800 hover:underline">
            Show everything
          </button>
        </div>
      )}

      {error ? (
        <div className="space-y-3">
          <ErrorBox message={error} />
          <button type="button" className={secondaryBtn} onClick={() => load()}>
            Try again
          </button>
        </div>
      ) : loading && (!data || data.month !== month) ? (
        <div className={`${cardClass} py-14 text-center`}>
          <Loader2 className="h-7 w-7 text-honey-700 animate-spin mx-auto mb-2" />
          <p className="text-sm text-gray-500">Checking the month…</p>
        </div>
      ) : data && visible.length === 0 ? (
        <div className={`${cardClass} py-12 text-center`}>
          <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-900">{filtered ? 'Nothing left to fix here' : 'All clear for this month'}</p>
          <p className="text-xs text-gray-500">
            {filtered ? 'This filter has no open items.' : 'No missing check-outs, absences, waiting overtime or setup gaps.'}
          </p>
          {filtered && data.counts.total > 0 && (
            <button type="button" onClick={clearFilter} className={`${secondaryBtn} mt-3`}>
              Show everything ({data.counts.total})
            </button>
          )}
        </div>
      ) : (
        GROUPS.filter((g) => byType.get(g.type)?.length).map((g) => {
          const items = byType.get(g.type) || [];
          return (
            <section key={g.type} className={cardClass}>
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-100">
                <div className="min-w-0">
                  <h3 className={`flex items-center gap-2 text-sm font-semibold ${g.tone}`}>
                    <g.Icon className="h-4 w-4" />
                    {g.title}
                    <span className="px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[11px]">{items.length}</span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">{g.hint}</p>
                </div>
                {g.type === 'overtime' && canEdit && items.length > 1 && (
                  <button type="button" onClick={approveAll} disabled={bulk} className={secondaryBtn}>
                    {bulk ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Approve all
                  </button>
                )}
              </div>
              <ul className="divide-y divide-gray-100">
                {items.map((it, i) => {
                  const rowBusy = !!it.recordId && busy.has(it.recordId);
                  return (
                    <li key={`${it.employeeId}-${it.date || i}`} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-4 py-2.5">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Avatar url={it.photo} name={it.name} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {it.name}
                            {it.date && <span className="ml-2 text-xs font-normal text-gray-500">{dayLabel(it.date, { weekday: 'short', day: 'numeric', month: 'short' })}</span>}
                          </p>
                          <p className="text-xs text-gray-500">{it.detail}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                        {it.actions.map((a, k) => {
                          if (a.kind === 'desktop') {
                            return (
                              <span key={k} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-brand-ink text-brand-yellow">
                                <Fingerprint className="h-3.5 w-3.5" /> {a.label}
                              </span>
                            );
                          }
                          if (a.kind === 'link' && a.href) {
                            return (
                              <Link key={k} href={a.href} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">
                                {a.label} <ExternalLink className="h-3 w-3" />
                              </Link>
                            );
                          }
                          if (a.kind === 'correct') {
                            return canEdit ? (
                              <button key={k} type="button" onClick={() => setOpen(it)} className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-honey-500 text-gray-900 hover:bg-honey-600">
                                {a.label}
                              </button>
                            ) : null;
                          }
                          if (a.kind === 'overtime' && canEdit && it.recordId) {
                            const id = it.recordId;
                            return (
                              <span key={k} className="inline-flex gap-1.5">
                                <button type="button" onClick={() => decide([id], true)} disabled={rowBusy} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 disabled:opacity-50">
                                  {rowBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approve
                                </button>
                                <button type="button" onClick={() => decide([id], false)} disabled={rowBusy} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 disabled:opacity-50">
                                  <X className="h-3.5 w-3.5" /> Reject
                                </button>
                                <button type="button" onClick={() => setOpen(it)} className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">
                                  Details
                                </button>
                              </span>
                            );
                          }
                          return null;
                        })}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}

      {open && open.date && (
        <DayModal
          employeeId={open.employeeId}
          employeeName={open.name}
          date={open.date}
          canEdit={canEdit}
          startEditing={open.type !== 'overtime'}
          onClose={() => setOpen(null)}
          onChanged={() => load(true)}
        />
      )}
    </div>
  );
}
