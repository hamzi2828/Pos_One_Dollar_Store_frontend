'use client';

// Small display pieces shared by the employee list, profile and form pages.
import React from 'react';
import { ChevronLeft, ChevronRight, User } from 'lucide-react';
import { STATUS_LABEL, STATUS_STYLE, fileUrl, type EmployeeStatus } from '../services/employeeApi';

export function StatusBadge({ status }: { status: EmployeeStatus }) {
  return (
    <span className={`inline-flex px-2 py-0.5 text-[11px] font-medium rounded-full whitespace-nowrap ${STATUS_STYLE[status] || STATUS_STYLE.active}`}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

export function Avatar({ url, name, size = 'md' }: { url?: string | null; name: string; size?: 'sm' | 'md' | 'lg' }) {
  const box = size === 'lg' ? 'h-20 w-20 sm:h-24 sm:w-24 text-2xl' : size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm';
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={fileUrl(url)} alt={name} className={`${box} rounded-full object-cover border border-gray-200 bg-gray-100 flex-shrink-0`} />
    );
  }
  return (
    <div className={`${box} rounded-full bg-honey-50 text-honey-700 font-semibold flex items-center justify-center flex-shrink-0 border border-honey-100`}>
      {initials || <User className="h-4 w-4" />}
    </div>
  );
}

export function SectionCard({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200">
      <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-gray-100">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          {icon && <span className="text-honey-700">{icon}</span>}
          {title}
        </h2>
        {action}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

/** Label / value pair; empty values show a dash. */
export function InfoRow({ label, value }: { label: string; value?: React.ReactNode }) {
  const empty = value === undefined || value === null || value === '';
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className={`mt-0.5 text-sm break-words ${empty ? 'text-gray-400' : 'text-gray-900'}`}>{empty ? '—' : value}</dd>
    </div>
  );
}

export function Pager({
  page,
  pages,
  total,
  onPage,
  disabled,
}: {
  page: number;
  pages: number;
  total: number;
  onPage: (p: number) => void;
  disabled?: boolean;
}) {
  if (pages <= 1) return <p className="text-xs text-gray-500 px-1">{total} record{total === 1 ? '' : 's'}</p>;
  return (
    <div className="flex items-center justify-between gap-2 px-1">
      <p className="text-xs text-gray-500">
        Page {page} of {pages} · {total} records
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={disabled || page <= 1}
          className="p-1.5 rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={disabled || page >= pages}
          className="p-1.5 rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
