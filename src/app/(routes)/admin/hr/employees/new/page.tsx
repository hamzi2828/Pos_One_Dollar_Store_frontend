'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { NoAccessCard } from '@/components/admin/FormBits';
import EmployeeForm from '../components/EmployeeForm';

export default function NewEmployeePage() {
  const { can } = useAccess();
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <Link href="/admin/hr/employees" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mb-2">
          <ArrowLeft className="h-3.5 w-3.5" /> Employees
        </Link>
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-1">Add employee</h1>
        <p className="text-xs sm:text-sm text-gray-500 mb-4">Only the first name is required — you can fill the rest later. The employee code is given automatically.</p>
        {can('employees', 'create') ? <EmployeeForm employee={null} /> : <NoAccessCard />}
      </div>
    </div>
  );
}
