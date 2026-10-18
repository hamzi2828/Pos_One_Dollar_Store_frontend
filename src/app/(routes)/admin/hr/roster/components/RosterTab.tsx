'use client';

// Weekly roster: employees x 7 shop days. Each cell is the person's normal plan
// (default shift / weekly off / holiday) or a change made for that day (dot).
// Tap a cell to change it; "Select" mode picks many cells (or a whole row /
// day) for one change. Phones get a per-day list instead of the grid.
// Deep link (from Attendance → "Mark leave on roster"):
//   /admin/hr/roster?employeeId=<id>&date=YYYY-MM-DD opens that week, highlights
//   the person and opens the picker for that day (editors only).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { AlertCircle, CheckSquare, ChevronLeft, ChevronRight, Copy, Loader2, Lock, Printer, X } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage } from '@/lib/storeApi';
import { ErrorBox, HelpBox, LoadingCard, Modal, Toggle, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import CellPicker, { type PickTarget } from './CellPicker';
import {
  LEAVE_LABEL,
  addDays,
  isDayKey,
  dayLabel,
  fmtHours,
  fmtShort,
  rangeLabel,
  rosterApi,
  tint,
  weekStart,
  type RosterCell,
  type RosterDay,
  type RosterEmployee,
  type RosterGrid,
} from '../services/rosterApi';

const keyOf = (empId: string, date: string) => `${empId}|${date}`;
const selectable = (c: RosterCell) => c.employed && !c.locked;
const smallBtn = 'px-3 py-1.5';

function CellContent({ cell, wide }: { cell: RosterCell; wide?: boolean }) {
  if (!cell.employed) return <span className="text-gray-300">—</span>;
  switch (cell.type) {
    case 'shift':
      return (
        <>
          <span className="block font-bold text-gray-900 truncate">{wide ? cell.shiftName : cell.shiftCode || cell.shiftName}</span>
          <span className="block text-gray-700 whitespace-nowrap">
            {fmtShort(cell.start)}–{fmtShort(cell.end)}
          </span>
        </>
      );
    case 'off':
      return (
        <>
          <span className="block font-semibold">Off</span>
          {wide && cell.source === 'weekly_off' && <span className="block">Weekly off</span>}
        </>
      );
    case 'leave':
      return (
        <>
          <span className="block font-semibold">Leave</span>
          <span className="block">{LEAVE_LABEL[cell.leaveType || 'paid']}</span>
        </>
      );
    case 'holiday':
      return (
        <>
          <span className="block font-semibold">Holiday</span>
          <span className="block truncate">{cell.holidayName}</span>
        </>
      );
    default:
      return <span className="block">No plan</span>;
  }
}

function CellButton({
  cell,
  selected,
  clickable,
  wide,
  onClick,
}: {
  cell: RosterCell;
  selected: boolean;
  clickable: boolean;
  wide?: boolean;
  onClick: () => void;
}) {
  const typeCls = !cell.employed
    ? 'bg-gray-50 text-gray-300'
    : cell.type === 'shift'
      ? 'text-gray-900 border-l-4'
      : cell.type === 'off'
        ? 'bg-gray-100 text-gray-500'
        : cell.type === 'leave'
          ? 'bg-violet-50 text-violet-800'
          : cell.type === 'holiday'
            ? 'bg-red-50 text-red-700'
            : 'bg-white text-gray-400 border border-dashed border-gray-200';
  const style = cell.employed && cell.type === 'shift' ? { backgroundColor: tint(cell.color), borderLeftColor: cell.color } : undefined;
  const title = [
    cell.isOverride ? 'Changed for this day' : 'Normal plan',
    cell.type === 'shift' ? `${cell.shiftName} ${fmtShort(cell.start)}–${fmtShort(cell.end)} (${fmtHours(cell.workMinutes)})` : '',
    cell.holidayName && cell.type !== 'holiday' ? `Holiday: ${cell.holidayName}` : '',
    cell.note ? `Note: ${cell.note}` : '',
    cell.locked ? 'Payroll approved — locked' : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable && !cell.locked}
      title={title}
      style={style}
      aria-pressed={selected}
      className={`relative w-full min-h-[44px] rounded-md px-1.5 py-1 text-left text-[11px] leading-tight transition print:min-h-0 ${typeCls} ${
        cell.isOverride ? '' : 'opacity-90'
      } ${selected ? 'ring-2 ring-honey-500 ring-offset-1' : ''} ${clickable ? 'hover:brightness-95 cursor-pointer' : 'cursor-default'} ${cell.locked ? 'cursor-not-allowed' : ''}`}
    >
      <CellContent cell={cell} wide={wide} />
      {cell.isOverride && <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-gray-900" aria-label="Changed for this day" />}
      {cell.locked && <Lock className="absolute bottom-1 right-1 h-3 w-3 text-gray-500" aria-label="Locked" />}
      {selected && <CheckSquare className="absolute bottom-1 right-1 h-3.5 w-3.5 text-gray-900" />}
    </button>
  );
}

function CopyWeekModal({ from, onClose, onDone }: { from: string; onClose: () => void; onDone: () => void }) {
  const prev = addDays(from, -7);
  const [overwrite, setOverwrite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  const run = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const r = await rosterApi.copyWeek({ fromWeekStart: prev, toWeekStart: from, overwrite });
      if (!r.sourceCells) toast('Nothing to copy: last week everyone worked their normal plan.', { icon: 'ℹ️' });
      else if (!r.copied && !r.removed) toast('This week already matches last week.', { icon: 'ℹ️' });
      else toast.success(`Copied ${r.copied} change${r.copied === 1 ? '' : 's'}${r.removed ? `, cleared ${r.removed}` : ''}${r.skipped ? ` (${r.skipped} kept or skipped)` : ''}`);
      onDone();
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not copy the week.'));
      lock.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Copy last week"
      subtitle={`${rangeLabel(prev, addDays(prev, 6))} → ${rangeLabel(from, addDays(from, 6))}`}
      icon={<Copy className="h-5 w-5" />}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={secondaryBtn}>
            Cancel
          </button>
          <button type="button" onClick={run} disabled={busy} className={primaryBtn}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />} Copy
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <ErrorBox message={error} />
        <p className="text-sm text-gray-700">
          Copies last week&apos;s changes (shift swaps, days off, leave) onto the same weekdays of this week. Normal plans (default shift and weekly off) do not need copying.
        </p>
        <Toggle checked={overwrite} onChange={setOverwrite} disabled={busy} label="Replace changes already made this week" hint="Off: days you already changed this week stay as they are." />
      </div>
    </Modal>
  );
}

export default function RosterTab({ onOpenShifts }: { onOpenShifts: () => void }) {
  const { can } = useAccess();
  const canEdit = can('shifts', 'edit');
  const canEmployees = can('employees', 'view');

  const [grid, setGrid] = useState<RosterGrid | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [picker, setPicker] = useState<PickTarget[] | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [mobileDay, setMobileDay] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null); // employee row from a deep link
  const focus = useRef<{ employeeId: string; date: string } | null>(null);
  const reqId = useRef(0);

  const load = useCallback(async (start?: string) => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const g = await rosterApi.grid(start);
      if (id !== reqId.current) return;
      setGrid(g);
      setMobileDay((d) => (d && d >= g.from && d <= g.to ? d : g.days.find((x) => x.isToday)?.date || g.from));
    } catch (e) {
      if (id === reqId.current) setError(apiErrorMessage(e, 'Could not load the roster.'));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);

  // First load: the week of ?date= when linked to one employee day, else this week.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const employeeId = q.get('employeeId');
    const date = q.get('date');
    if (employeeId && isDayKey(date)) {
      focus.current = { employeeId, date };
      // Use the link once: a refresh should not open the picker again.
      const url = new URL(window.location.href);
      url.searchParams.delete('employeeId');
      url.searchParams.delete('date');
      window.history.replaceState(null, '', url.toString());
      load(weekStart(date));
    } else load();
  }, [load]);

  // After that week loads: scroll to the person, highlight them, open the picker for the day.
  useEffect(() => {
    const f = focus.current;
    if (!grid || !f) return;
    focus.current = null;
    const e = grid.employees.find((x) => x._id === f.employeeId);
    if (!e) {
      toast('That employee is not on the roster (only current staff are).', { icon: 'ℹ️' });
      return;
    }
    setHighlight(e._id);
    setMobileDay(f.date);
    window.setTimeout(() => {
      const rows = Array.from(document.querySelectorAll<HTMLElement>(`[data-roster-row="${e._id}"]`));
      rows.find((r) => r.offsetParent !== null)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
    const c = e.cells.find((x) => x.date === f.date);
    const day = grid.days.find((d) => d.date === f.date);
    if (!canEdit || !c || !day) return;
    if (c.locked) toast('This day is in an approved payroll and cannot change.', { icon: '🔒' });
    else if (!c.employed) toast(`${e.name} was not employed on that day.`, { icon: 'ℹ️' });
    else setPicker([{ employee: e, cell: c, day }]);
  }, [grid, canEdit]);

  const dayBy = useMemo(() => new Map((grid?.days || []).map((d) => [d.date, d])), [grid]);

  const go = (start?: string) => {
    setSelected(new Set());
    setHighlight(null);
    load(start);
  };
  const reload = () => {
    setPicker(null);
    setSelected(new Set());
    if (grid) load(grid.from);
  };

  const toggle = (keys: string[]) => {
    if (!keys.length) return;
    setSelected((prev) => {
      const next = new Set(prev);
      const allOn = keys.every((k) => next.has(k));
      keys.forEach((k) => (allOn ? next.delete(k) : next.add(k)));
      return next;
    });
  };
  const rowKeys = (e: RosterEmployee) => e.cells.filter(selectable).map((c) => keyOf(e._id, c.date));
  const dayKeys = (date: string) =>
    (grid?.employees || []).flatMap((e) => e.cells.filter((c) => c.date === date && selectable(c)).map((c) => keyOf(e._id, c.date)));

  const onCell = (e: RosterEmployee, c: RosterCell) => {
    if (!canEdit || !c.employed) return;
    if (c.locked) {
      toast('This day is in an approved payroll and cannot change.', { icon: '🔒' });
      return;
    }
    if (selectMode) toggle([keyOf(e._id, c.date)]);
    else setPicker([{ employee: e, cell: c, day: dayBy.get(c.date) as RosterDay }]);
  };

  const openBulk = () => {
    if (!grid) return;
    const targets: PickTarget[] = [];
    for (const e of grid.employees) for (const c of e.cells) if (selected.has(keyOf(e._id, c.date))) targets.push({ employee: e, cell: c, day: dayBy.get(c.date) as RosterDay });
    if (targets.length) setPicker(targets);
  };

  if (!grid && loading) return <LoadingCard text="Loading the roster…" />;
  if (!grid) {
    return (
      <div className="bg-white rounded-xl border border-red-200 text-center py-10 px-4">
        <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
        <p className="text-sm text-red-700 mb-4">{error}</p>
        <button type="button" onClick={() => load()} className={primaryBtn}>
          Try again
        </button>
      </div>
    );
  }

  const containsToday = grid.days.some((d) => d.isToday);
  const mDay = grid.days.find((d) => d.date === mobileDay) || grid.days[0];
  const nameCell = (e: RosterEmployee) => (
    <>
      <span className="block text-sm font-medium text-gray-900 truncate">{e.name}</span>
      <span className="block text-[11px] text-gray-500">
        {fmtHours(e.plannedMinutes)} · {e.workingDays} day{e.workingDays === 1 ? '' : 's'}
        {e.status === 'on_leave' ? ' · on leave' : ''}
      </span>
      {!e.defaultShift && <span className="block text-[10px] text-amber-700">No default shift</span>}
    </>
  );
  const nameBlock = (e: RosterEmployee) =>
    selectMode ? (
      <button type="button" onClick={() => toggle(rowKeys(e))} className="w-full text-left rounded hover:bg-honey-50" title="Select the whole week">
        {nameCell(e)}
      </button>
    ) : canEmployees ? (
      <Link href={`/admin/hr/employees/${e._id}`} className="block hover:underline decoration-honey-500">
        {nameCell(e)}
      </Link>
    ) : (
      <div>{nameCell(e)}</div>
    );

  return (
    <div className="space-y-3">
      {/* Print heading */}
      <div className="hidden print:block">
        <p className="text-lg font-semibold">DOLLAR &amp; Co — Roster {rangeLabel(grid.from, grid.to)}</p>
      </div>

      {grid.shifts.length === 0 && (
        <HelpBox>
          No shifts yet. Create your shifts first (e.g. Morning 10:00–18:00), then give each employee a default shift on their profile (Time &amp; pay card).{' '}
          <button type="button" onClick={onOpenShifts} className="font-semibold underline">
            Open Shifts
          </button>
        </HelpBox>
      )}

      {/* Toolbar */}
      <div className="bg-white rounded-lg border border-gray-200 p-2 sm:p-3 flex flex-wrap items-center gap-2 print:hidden">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => go(addDays(grid.from, -7))} disabled={loading} className="p-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50" aria-label="Previous week">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-2 text-sm font-semibold text-gray-900 min-w-[150px] text-center tabular-nums">{rangeLabel(grid.from, grid.to)}</span>
          <button type="button" onClick={() => go(addDays(grid.from, 7))} disabled={loading} className="p-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50" aria-label="Next week">
            <ChevronRight className="h-4 w-4" />
          </button>
          {!containsToday && (
            <button type="button" onClick={() => go()} disabled={loading} className={`${secondaryBtn} ${smallBtn} ml-1`}>
              This week
            </button>
          )}
          {loading && <Loader2 className="h-4 w-4 animate-spin text-gray-400 ml-1" />}
        </div>
        <div className="flex-1" />
        {canEdit && (
          <button
            type="button"
            onClick={() => {
              setSelectMode((v) => !v);
              setSelected(new Set());
            }}
            aria-pressed={selectMode}
            className={selectMode ? `${primaryBtn} ${smallBtn}` : `${secondaryBtn} ${smallBtn}`}
          >
            <CheckSquare className="h-4 w-4" /> {selectMode ? 'Selecting…' : 'Select days'}
          </button>
        )}
        {canEdit && (
          <button type="button" onClick={() => setCopyOpen(true)} disabled={loading} className={`${secondaryBtn} ${smallBtn}`}>
            <Copy className="h-4 w-4" /> Copy last week
          </button>
        )}
        <button type="button" onClick={() => window.print()} className={`${secondaryBtn} ${smallBtn}`}>
          <Printer className="h-4 w-4" /> Print
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500 px-1">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-gray-900" /> Changed for that day
        </span>
        <span>No dot = normal plan (default shift / weekly off)</span>
        <span className="inline-flex items-center gap-1">
          <Lock className="h-3 w-3" /> Payroll approved
        </span>
        {grid.shifts.map((s) => (
          <span key={s._id} className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} /> {s.code || s.name} = {s.name}
          </span>
        ))}
      </div>
      {error && <ErrorBox message={error} />}

      {grid.employees.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 text-center py-12 px-4 text-sm text-gray-500">
          No active employees yet.{' '}
          {canEmployees && (
            <Link href="/admin/hr/employees" className="font-medium text-honey-700 hover:underline">
              Add staff on the Employees page.
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Grid: tablets, desktops and print */}
          <div className="hidden md:block print:block bg-white rounded-xl border border-gray-200 overflow-x-auto relative">
            <table className="w-full border-collapse text-sm min-w-[880px] print:min-w-0">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="sticky left-0 z-10 bg-white text-left text-xs font-medium text-gray-500 px-3 py-2 w-48">Employee</th>
                  {grid.days.map((d) => {
                    const l = dayLabel(d.date);
                    return (
                      <th key={d.date} className={`px-1 py-2 text-center align-bottom font-normal ${d.isToday ? 'bg-honey-100' : ''}`}>
                        <button
                          type="button"
                          disabled={!selectMode}
                          onClick={() => toggle(dayKeys(d.date))}
                          className={`w-full rounded px-1 ${selectMode ? 'hover:bg-honey-50 cursor-pointer' : 'cursor-default'}`}
                          title={selectMode ? 'Select everyone on this day' : undefined}
                        >
                          <span className="block text-xs font-semibold text-gray-900">{l.dow}</span>
                          <span className="block text-[11px] text-gray-500">{l.day}</span>
                          {d.isToday && <span className="block text-[10px] font-semibold text-honey-800">Today</span>}
                          {d.holiday && (
                            <span className="block text-[10px] font-medium text-red-600 truncate" title={d.holiday.name}>
                              {d.holiday.name}
                            </span>
                          )}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {grid.employees.map((e) => (
                  <tr key={e._id} data-roster-row={e._id} className={`border-b border-gray-100 ${highlight === e._id ? 'bg-honey-50' : ''}`}>
                    <th
                      scope="row"
                      className={`sticky left-0 z-10 text-left px-3 py-1.5 font-normal align-middle max-w-[12rem] ${
                        highlight === e._id ? 'bg-honey-100 shadow-[inset_4px_0_0_#FFD60A]' : 'bg-white'
                      }`}
                    >
                      {nameBlock(e)}
                    </th>
                    {e.cells.map((c) => (
                      <td key={c.date} className={`p-1 align-top ${dayBy.get(c.date)?.isToday ? 'bg-honey-50/70' : ''}`}>
                        <CellButton cell={c} selected={selected.has(keyOf(e._id, c.date))} clickable={canEdit && selectable(c)} onClick={() => onCell(e, c)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50">
                  <th className="sticky left-0 z-10 bg-gray-50 text-left px-3 py-2 text-xs font-medium text-gray-500">Planned</th>
                  {grid.days.map((d) => (
                    <td key={d.date} className="text-center text-[11px] text-gray-600 py-2">
                      <b className="text-gray-900">{d.working}</b> on · {fmtHours(d.plannedMinutes)}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Phones: one day at a time */}
          <div className="md:hidden print:hidden space-y-2">
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
              {grid.days.map((d) => {
                const l = dayLabel(d.date);
                const active = d.date === mDay.date;
                return (
                  <button
                    key={d.date}
                    type="button"
                    onClick={() => setMobileDay(d.date)}
                    aria-pressed={active}
                    className={`relative flex-shrink-0 w-14 rounded-lg border py-1.5 text-center ${
                      active ? 'bg-gray-950 text-honey-400 border-gray-950' : d.isToday ? 'border-honey-500 bg-honey-50 text-gray-900' : 'bg-white border-gray-200 text-gray-700'
                    }`}
                  >
                    <span className="block text-[11px]">{l.dow}</span>
                    <span className="block text-sm font-semibold">{l.day.split(' ')[0]}</span>
                    {d.holiday && <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-red-500" />}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between px-1 text-xs text-gray-600">
              <span>
                {dayLabel(mDay.date).dow} {dayLabel(mDay.date).day}
                {mDay.isToday ? ' · Today' : ''}
                {mDay.holiday ? ` · ${mDay.holiday.name}` : ''}
              </span>
              <span>
                <b className="text-gray-900">{mDay.working}</b> on · {fmtHours(mDay.plannedMinutes)}
              </span>
            </div>
            {selectMode && (
              <button type="button" onClick={() => toggle(dayKeys(mDay.date))} className={`${secondaryBtn} ${smallBtn} w-full`}>
                Select everyone on this day
              </button>
            )}
            <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
              {grid.employees.map((e) => {
                const c = e.cells.find((x) => x.date === mDay.date);
                if (!c) return null;
                return (
                  <div key={e._id} data-roster-row={e._id} className={`flex items-center gap-3 p-2.5 ${highlight === e._id ? 'bg-honey-100 shadow-[inset_4px_0_0_#FFD60A]' : ''}`}>
                    <div className="min-w-0 flex-1">{nameBlock(e)}</div>
                    <div className="w-36 flex-shrink-0">
                      <CellButton cell={c} wide selected={selected.has(keyOf(e._id, c.date))} clickable={canEdit && selectable(c)} onClick={() => onCell(e, c)} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Bulk action bar */}
      {selectMode && (
        <div className="sticky bottom-2 z-30 print:hidden">
          <div className="mx-auto max-w-xl flex items-center gap-2 rounded-xl bg-gray-950 text-white px-3 py-2 shadow-lg">
            <span className="text-xs sm:text-sm flex-1">
              {selected.size ? `${selected.size} day${selected.size === 1 ? '' : 's'} selected` : 'Tap days to select them. Tap a name (or a day) for the whole row (or column).'}
            </span>
            <button type="button" onClick={openBulk} disabled={!selected.size} className="rounded-lg bg-honey-500 px-3 py-1.5 text-sm font-semibold text-gray-900 hover:bg-honey-400 disabled:opacity-40">
              Set…
            </button>
            <button type="button" onClick={() => setSelected(new Set())} disabled={!selected.size} className="rounded-lg px-2 py-1.5 text-sm text-gray-300 hover:text-white disabled:opacity-40">
              Clear
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectMode(false);
                setSelected(new Set());
              }}
              className="p-1.5 rounded-md text-gray-300 hover:text-white"
              aria-label="Stop selecting"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {picker && <CellPicker targets={picker} shifts={grid.shifts} onClose={() => setPicker(null)} onSaved={reload} />}
      {copyOpen && (
        <CopyWeekModal
          from={grid.from}
          onClose={() => setCopyOpen(false)}
          onDone={() => {
            setCopyOpen(false);
            reload();
          }}
        />
      )}
    </div>
  );
}
