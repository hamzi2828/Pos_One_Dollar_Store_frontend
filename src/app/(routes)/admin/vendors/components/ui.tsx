'use client';

// Small shared pieces of the Vendors screens: balance text, stat cards,
// status badges, error / empty states, the section tabs and a "reason" modal
// (void / cancel).

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AlertCircle, Loader2, Truck, HandCoins, Handshake, Undo2 } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { formatRs } from '@/lib/storeApi';
import { apiErrorMessage } from '@/helper/access';
import { Modal, Field, ErrorBox, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';

export const thClass = 'px-3 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-xs font-medium tracking-wider text-left text-gray-500 uppercase whitespace-nowrap';
export const tdClass = 'px-3 sm:px-4 py-2.5 text-sm text-gray-700';
export const cardClass = 'bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200';

/** Vendor balance: > 0 we owe them (payable, red), < 0 they owe us (receivable, green). */
export function BalanceText({ amount, showLabel = true, className = '' }: { amount: number; showLabel?: boolean; className?: string }) {
  const n = Number(amount) || 0;
  if (n === 0) return <span className={`text-gray-400 tabular-nums ${className}`}>Rs 0{showLabel && <span className="ml-1 text-[10px]">settled</span>}</span>;
  const payable = n > 0;
  return (
    <span className={`tabular-nums font-semibold ${payable ? 'text-rose-600' : 'text-emerald-600'} ${className}`}>
      {formatRs(Math.abs(n))}
      {showLabel && <span className="ml-1 text-[10px] font-medium uppercase">{payable ? 'payable' : 'receivable'}</span>}
    </span>
  );
}

export function StatCard({
  icon,
  label,
  value,
  hint,
  tone = 'honey',
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: 'honey' | 'rose' | 'emerald' | 'blue' | 'gray' | 'amber';
}) {
  const bg = {
    honey: 'bg-honey-50 text-honey-700',
    rose: 'bg-rose-50 text-rose-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    gray: 'bg-gray-100 text-gray-600',
    amber: 'bg-amber-50 text-amber-600',
  }[tone];
  return (
    <div className={`${cardClass} p-3 sm:p-4`}>
      <div className="flex items-start gap-2.5">
        <div className={`p-1.5 sm:p-2 rounded-lg flex-shrink-0 ${bg}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-[10px] sm:text-xs text-gray-500">{label}</p>
          <p className="text-sm sm:text-lg font-semibold text-gray-900 tabular-nums truncate">{value}</p>
          {hint && <p className="text-[10px] sm:text-[11px] text-gray-400 truncate">{hint}</p>}
        </div>
      </div>
    </div>
  );
}

const BADGE: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  completed: 'bg-green-100 text-green-700',
  draft: 'bg-amber-100 text-amber-700',
  pending: 'bg-amber-100 text-amber-700',
  cancelled: 'bg-gray-200 text-gray-600',
  voided: 'bg-gray-200 text-gray-500 line-through',
  inactive: 'bg-gray-200 text-gray-600',
  consignment: 'bg-purple-100 text-purple-700',
  intake: 'bg-blue-100 text-blue-700',
  return: 'bg-orange-100 text-orange-700',
};

export function Badge({ kind, children }: { kind: string; children?: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded uppercase tracking-wide ${BADGE[kind] || 'bg-gray-100 text-gray-600'}`}>
      {children ?? kind}
    </span>
  );
}

export function ErrorCard({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className={`${cardClass} border-red-200 text-center py-10 px-4`}>
      <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
      <p className="text-sm text-red-700 mb-4">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className={primaryBtn}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyCard({ icon, title, text, action }: { icon: React.ReactNode; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className={`${cardClass} text-center py-10 sm:py-14 px-4`}>
      <div className="flex justify-center text-gray-300 mb-3">{icon}</div>
      <h3 className="text-base font-medium text-gray-900 mb-1">{title}</h3>
      {text && <p className="text-sm text-gray-500">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Tabs across the vendor pages (only the ones this user may open). */
export function VendorsNav() {
  const pathname = usePathname() || '';
  const { can } = useAccess();
  const tabs = [
    { href: '/admin/vendors', label: 'Vendors & Ledger', icon: Truck, perm: 'vendors' },
    { href: '/admin/vendors/payments', label: 'Payments', icon: HandCoins, perm: 'vendor_payments' },
    { href: '/admin/vendors/returns', label: 'Returns', icon: Undo2, perm: 'vendor_returns' },
    { href: '/admin/vendors/consignment', label: 'Consignment', icon: Handshake, perm: 'consignment' },
  ].filter((t) => can(t.perm, 'view'));
  if (tabs.length < 2) return null;
  const isActive = (href: string) =>
    href === '/admin/vendors'
      ? pathname === href || (/^\/admin\/vendors\/[^/]+$/.test(pathname) && !/(payments|returns|consignment)$/.test(pathname))
      : pathname.startsWith(href);
  return (
    <div className="mb-4 sm:mb-6 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto">
      <div className="inline-flex gap-1 p-1 bg-white border border-gray-200 rounded-lg shadow-sm">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = isActive(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md whitespace-nowrap transition-colors ${
                active ? 'bg-honey-500 text-gray-900 shadow' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/** Ask for a reason, then run `onConfirm(reason)`. Shows the server error inside. */
export function ReasonModal({
  title,
  subtitle,
  label = 'Reason',
  confirmText,
  danger = true,
  required = true,
  onClose,
  onConfirm,
  children,
}: {
  title: string;
  subtitle?: string;
  label?: string;
  confirmText: string;
  danger?: boolean;
  required?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  children?: React.ReactNode;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  const submit = async () => {
    if (lock.current) return;
    if (required && reason.trim().length < 3) return setError('Please write a short reason.');
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal
      title={title}
      subtitle={subtitle}
      icon={<AlertCircle className="h-5 w-5" />}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={secondaryBtn}>
            Back
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            aria-busy={busy}
            className={danger ? `${primaryBtn} !bg-red-600 hover:!bg-red-700` : primaryBtn}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmText}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <ErrorBox message={error} />
        {children}
        <Field label={label} required={required}>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            disabled={busy}
            className={`${inputClass} resize-none`}
            placeholder="e.g. Entered twice by mistake"
            autoFocus
          />
        </Field>
      </div>
    </Modal>
  );
}

/** "12 Oct 2026" style range label for print headers. */
export function rangeLabel(from?: string, to?: string) {
  if (!from && !to) return 'All dates';
  return `${from || 'start'} → ${to || 'today'}`;
}
