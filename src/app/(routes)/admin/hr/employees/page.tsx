'use client';

// Employees list: search, filters, table (desktop) / cards (mobile).
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Contact, Plus, Search, X, AlertCircle, Phone } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage, formatDate, formatRs } from '@/lib/storeApi';
import { LoadingCard, NoAccessCard, inputClass, primaryBtn } from '@/components/admin/FormBits';
import { Avatar, Pager, StatusBadge } from './components/EmployeeBits';
import {
  EMPLOYMENT_LABEL,
  STATUS_LABEL,
  employeeApi,
  type Employee,
  type EmployeeListMeta,
  type EmployeeStatus,
  type EmploymentType,
} from './services/employeeApi';
import { SearchSelect } from '@/components/ui/SearchSelect';

export default function EmployeesPage() {
  const router = useRouter();
  const { can } = useAccess();
  const canView = can('employees', 'view');
  const canCreate = can('employees', 'create');

  const [rows, setRows] = useState<Employee[]>([]);
  const [meta, setMeta] = useState<EmployeeListMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState<'' | EmployeeStatus | 'active,on_leave'>('active,on_leave');
  const [department, setDepartment] = useState('');
  const [employmentType, setEmploymentType] = useState<'' | EmploymentType>('');
  const [page, setPage] = useState(1);
  const reqId = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [debounced, status, department, employmentType]);

  const load = useCallback(async () => {
    if (!canView) return;
    const id = ++reqId.current; // ignore answers to older requests
    try {
      setLoading(true);
      setError(null);
      const res = await employeeApi.list({ search: debounced, status, department, employmentType, page, limit: 25, sort: 'name' });
      if (id !== reqId.current) return;
      setRows(res.data);
      setMeta((res.meta as EmployeeListMeta) || null);
    } catch (e) {
      if (id === reqId.current) setError(apiErrorMessage(e, 'Could not load employees.'));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [canView, debounced, status, department, employmentType, page]);

  useEffect(() => {
    load();
  }, [load]);

  if (!canView) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <NoAccessCard />
      </div>
    );
  }

  const showSalary = !!meta?.canSeeSensitive;
  const filtersOn = !!(debounced || department || employmentType || status !== 'active,on_leave');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Employees</h1>
            <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-500">
              Complete staff records, documents and contract letters.
            </p>
          </div>
          {canCreate && (
            <Link href="/admin/hr/employees/new" className={primaryBtn}>
              <Plus className="h-4 w-4" /> Add employee
            </Link>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={showSalary ? 'Name, code, phone or CNIC…' : 'Name, code or phone…'}
              className={`${inputClass} pl-9 pr-8`}
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" aria-label="Clear search">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <SearchSelect value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={inputClass} aria-label="Status">
            <option value="active,on_leave">Working (active + on leave)</option>
            <option value="">All statuses</option>
            {(Object.keys(STATUS_LABEL) as EmployeeStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </SearchSelect>
          <SearchSelect value={department} onChange={(e) => setDepartment(e.target.value)} className={inputClass} aria-label="Department">
            <option value="">All departments</option>
            {(meta?.departments || []).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </SearchSelect>
          <SearchSelect value={employmentType} onChange={(e) => setEmploymentType(e.target.value as typeof employmentType)} className={inputClass} aria-label="Employment type">
            <option value="">All employment types</option>
            {(Object.keys(EMPLOYMENT_LABEL) as EmploymentType[]).map((t) => (
              <option key={t} value={t}>
                {EMPLOYMENT_LABEL[t]}
              </option>
            ))}
          </SearchSelect>
        </div>

        {loading && !rows.length ? (
          <LoadingCard text="Loading employees…" />
        ) : error ? (
          <div className="bg-white rounded-xl shadow-sm border border-red-200 text-center py-10 px-4">
            <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
            <p className="text-sm text-red-700 mb-4">{error}</p>
            <button onClick={load} className={primaryBtn}>
              Try again
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 text-center py-12 px-4">
            <Contact className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-medium text-gray-900 mb-1">No employees found</h3>
            <p className="text-sm text-gray-500">
              {filtersOn ? 'Try a different search or filter.' : canCreate ? 'Click "Add employee" to add your first staff member.' : 'No staff records yet.'}
            </p>
          </div>
        ) : (
          <div className={`space-y-3 ${loading ? 'opacity-60 pointer-events-none' : ''}`} aria-busy={loading}>
            {/* Desktop table */}
            <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="text-left font-medium px-4 py-2.5">Employee</th>
                    <th className="text-left font-medium px-4 py-2.5">Designation</th>
                    <th className="text-left font-medium px-4 py-2.5">Joined</th>
                    {showSalary && <th className="text-right font-medium px-4 py-2.5">Salary</th>}
                    <th className="text-left font-medium px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((e) => (
                    <tr key={e._id} onClick={() => router.push(`/admin/hr/employees/${e._id}`)} className="hover:bg-honey-50/40 cursor-pointer">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <Avatar url={e.photo} name={e.name} />
                          <div className="min-w-0">
                            <Link href={`/admin/hr/employees/${e._id}`} className="font-medium text-gray-900 hover:text-honey-700" onClick={(ev) => ev.stopPropagation()}>
                              {e.name}
                            </Link>
                            <p className="text-xs text-gray-500 font-mono">{e.employeeCode || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="text-gray-900">{e.designation || e.position || '—'}</p>
                        <p className="text-xs text-gray-500">
                          {[e.department, EMPLOYMENT_LABEL[e.employmentType]].filter(Boolean).join(' · ')}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{formatDate(e.joiningDate || e.hireDate)}</td>
                      {showSalary && <td className="px-4 py-2.5 text-right tabular-nums text-gray-900">{formatRs(e.salary)}</td>}
                      <td className="px-4 py-2.5">
                        <StatusBadge status={e.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              {rows.map((e) => (
                <Link key={e._id} href={`/admin/hr/employees/${e._id}`} className="flex items-center gap-3 bg-white rounded-lg border border-gray-200 p-3 shadow-sm active:bg-gray-50">
                  <Avatar url={e.photo} name={e.name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-gray-900 truncate">{e.name}</p>
                      <StatusBadge status={e.status} />
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      <span className="font-mono">{e.employeeCode}</span> · {e.designation || e.position || 'No designation'}
                    </p>
                    {e.phone && (
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3" /> {e.phone}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>

            {meta && <Pager page={meta.page} pages={meta.pages} total={meta.total} onPage={setPage} disabled={loading} />}
          </div>
        )}
      </div>
    </div>
  );
}
