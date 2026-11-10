'use client';

// Small display pieces for the Employee Portal (phone-first cards).
import React, { createContext, useContext } from 'react';
import { AlertCircle, Inbox, Loader2, RefreshCw } from 'lucide-react';
import { secondaryBtn } from '@/components/admin/FormBits';
import type { PortalProfile } from './portalApi';

/* ---------------- profile context (loaded once by the portal layout) ---------------- */

interface PortalCtx {
  profile: PortalProfile;
  reload: () => Promise<void>;
}

export const PortalContext = createContext<PortalCtx | null>(null);

export function usePortal(): PortalCtx {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error('usePortal must be used inside the portal layout');
  return ctx;
}

/* ---------------- cards ---------------- */

export const cardClass = 'bg-white rounded-xl shadow-sm border border-gray-200';

export function Card({ title, action, children, className = '' }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`${cardClass} ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-2">
          {title && <h2 className="text-sm font-semibold text-gray-900">{title}</h2>}
          {action}
        </div>
      )}
      <div className={title || action ? 'px-4 pb-4' : 'p-4'}>{children}</div>
    </section>
  );
}

/** Label on the left, value on the right. */
export function Row({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-gray-100 last:border-b-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm text-right ${strong ? 'font-bold text-gray-900' : 'font-medium text-gray-800'}`}>{value}</span>
    </div>
  );
}

export function Loading({ text = 'Loading…' }: { text?: string }) {
  return (
    <div className={`${cardClass} py-12 text-center`}>
      <Loader2 className="h-7 w-7 text-honey-700 mx-auto mb-2 animate-spin" />
      <p className="text-sm text-gray-500">{text}</p>
    </div>
  );
}

export function Empty({ title, text }: { title: string; text?: string }) {
  return (
    <div className="py-8 text-center">
      <Inbox className="h-9 w-9 text-gray-300 mx-auto mb-2" />
      <p className="text-sm font-medium text-gray-700">{title}</p>
      {text && <p className="mt-0.5 text-xs text-gray-500">{text}</p>}
    </div>
  );
}

export function ErrorCard({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className={`${cardClass} py-10 px-4 text-center`}>
      <AlertCircle className="h-9 w-9 text-red-400 mx-auto mb-2" />
      <p className="text-sm text-gray-700">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className={`${secondaryBtn} mt-4`}>
          <RefreshCw className="h-4 w-4" /> Try again
        </button>
      )}
    </div>
  );
}

/** Small coloured word for paid / not paid / open etc. */
export function Pill({ tone, children }: { tone: 'green' | 'amber' | 'gray' | 'red' | 'blue'; children: React.ReactNode }) {
  const tones = {
    green: 'bg-green-50 text-green-700 border-green-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
    gray: 'bg-gray-50 text-gray-600 border-gray-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
  };
  return <span className={`inline-flex items-center border rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${tones[tone]}`}>{children}</span>;
}

export function payTone(status: string | null | undefined): 'green' | 'amber' | 'gray' | 'red' | 'blue' {
  if (status === 'paid' || status === 'recovered' || status === 'applied') return 'green';
  if (status === 'approved' || status === 'pending' || status === 'open') return 'amber';
  if (status === 'waived') return 'blue';
  return 'gray';
}
