'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage } from '@/lib/storeApi';
import { LoadingCard, NoAccessCard, primaryBtn } from '@/components/admin/FormBits';
import EmployeeForm from '../../components/EmployeeForm';
import { employeeApi, type Employee } from '../../services/employeeApi';

export default function EditEmployeePage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAccess();
  const allowed = can('employees', 'edit');
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setEmployee(await employeeApi.get(id));
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load the employee.'));
    }
  }, [id]);

  useEffect(() => {
    if (allowed) load();
  }, [allowed, load]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <Link href={`/admin/hr/employees/${id}`} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mb-2">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to profile
        </Link>
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-4">
          Edit employee{employee ? ` · ${employee.name}` : ''}
        </h1>
        {!allowed ? (
          <NoAccessCard />
        ) : error ? (
          <div className="bg-white rounded-xl shadow-sm border border-red-200 text-center py-10 px-4">
            <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
            <p className="text-sm text-red-700 mb-4">{error}</p>
            <button onClick={load} className={primaryBtn}>
              Try again
            </button>
          </div>
        ) : !employee ? (
          <LoadingCard text="Loading employee…" />
        ) : (
          <EmployeeForm employee={employee} />
        )}
      </div>
    </div>
  );
}
