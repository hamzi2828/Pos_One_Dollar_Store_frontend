'use client';

// HR → Attendance: Today (who's in, late, absent; corrections, overtime) ·
// Month (employees × days grid + CSV) · Fix before payroll.
// Staff punch only with their fingerprint on the desktop app. Rules (grace,
// late, half day, overtime) come from each employee's HR policy on the server —
// this page only shows and corrects (with a reason).
// Links from Payroll: ?view=corrections|overtime&month=YYYY-MM&employee=<id>
// open "Fix before payroll" filtered; ?view=month highlights the employee.
import { useEffect, useState } from 'react';
import { CalendarDays, Clock3, ListChecks } from 'lucide-react';
import { NoAccessCard } from '@/components/admin/FormBits';
import { useAccess } from '@/context/AccessContext';
import TodayTab from './components/TodayTab';
import MonthTab from './components/MonthTab';
import ExceptionsTab from './components/ExceptionsTab';
import { DesktopNote } from './components/AttendanceBits';
import { readAttendanceLink, type AttendanceLink } from './services/attendanceApi';

type Tab = 'today' | 'month' | 'fix';
const TABS: { key: Tab; label: string; Icon: typeof Clock3 }[] = [
  { key: 'today', label: 'Today', Icon: Clock3 },
  { key: 'month', label: 'Month', Icon: CalendarDays },
  { key: 'fix', label: 'Fix before payroll', Icon: ListChecks },
];

export default function AttendancePage() {
  const { can } = useAccess();
  const canView = can('attendance', 'view');
  const canEdit = can('attendance', 'edit');
  const canExport = can('attendance', 'export');
  const [tab, setTab] = useState<Tab>('today');
  // The link this page was opened with (read once in the browser, then tabs mount).
  const [link, setLink] = useState<AttendanceLink | null>(null);

  useEffect(() => {
    const l = readAttendanceLink(window.location.search, window.location.hash);
    setLink(l);
    setTab(l.tab);
  }, []);
  // Switching tabs by hand drops the Payroll filter and keeps the tab in the hash.
  const pick = (t: Tab) => {
    setTab(t);
    setLink((l) => (l ? { ...l, focus: null, employeeId: null } : l));
    try {
      window.history.replaceState(null, '', t === 'today' ? window.location.pathname : `${window.location.pathname}#${t}`);
    } catch {}
  };

  if (!canView) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <NoAccessCard />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Attendance</h1>
          <p className="text-sm text-gray-500 mt-0.5">Who is in, late or absent — fix times and approve overtime before payroll.</p>
          <DesktopNote className="mt-2" />
        </div>

        <div className="mb-4 overflow-x-auto">
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 text-sm" role="tablist">
            {TABS.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => pick(key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium whitespace-nowrap ${tab === key ? 'bg-honey-500 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {link && tab === 'today' && <TodayTab canEdit={canEdit} />}
        {link && tab === 'month' && <MonthTab canEdit={canEdit} canExport={canExport} initialMonth={link.month} highlightEmployee={link.employeeId} />}
        {link && tab === 'fix' && <ExceptionsTab canEdit={canEdit} initialMonth={link.month} focus={link.focus} employeeId={link.employeeId} />}
      </div>
    </div>
  );
}
