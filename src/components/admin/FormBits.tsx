'use client';

// Small shared form pieces for the Branches / Staff / Stock transfer screens
// (same look as the Roles modal: white card, red primary button).

import React from 'react';
import { X, Loader2, AlertCircle, Info } from 'lucide-react';

export const inputClass =
  'w-full px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-honey-500/30 focus:border-honey-500 transition-all placeholder:text-gray-400 disabled:bg-gray-50 disabled:text-gray-500';

export const primaryBtn =
  'inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-honey-500 rounded-lg hover:bg-honey-600 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed';

export const secondaryBtn =
  'inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50';

export function Modal({
  title,
  subtitle,
  icon,
  onClose,
  children,
  footer,
  busy,
  wide,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  busy?: boolean;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-3 sm:p-4">
      <div
        className={`bg-white rounded-xl shadow-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[92vh] flex flex-col overflow-hidden`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3 min-w-0">
            {icon && (
              <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-honey-50 text-honey-600 flex-shrink-0">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 truncate">{title}</h2>
              {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-gray-500">{hint}</p>}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-start gap-3 ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors mt-0.5 ${
          checked ? 'bg-honey-500' : 'bg-gray-300'
        } disabled:cursor-not-allowed`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
      <span>
        <span className="block text-sm font-medium text-gray-800">{label}</span>
        {hint && <span className="block text-[11px] text-gray-500">{hint}</span>}
      </span>
    </label>
  );
}

export function ErrorBox({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2 px-3 py-2 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg">
      <AlertCircle className="h-4 w-4 flex-shrink-0 mt-px" />
      <span>{message}</span>
    </div>
  );
}

export function HelpBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs sm:text-sm text-blue-800">
      <Info className="h-4 w-4 flex-shrink-0 mt-0.5 text-blue-600" />
      <div>{children}</div>
    </div>
  );
}

export function LoadingCard({ text }: { text: string }) {
  return (
    <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 text-center py-14">
      <Loader2 className="h-8 w-8 text-honey-500 mx-auto mb-3 animate-spin" />
      <p className="text-sm text-gray-500">{text}</p>
    </div>
  );
}

export function NoAccessCard({ text }: { text?: string }) {
  return (
    <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 text-center py-14 px-4">
      <AlertCircle className="h-10 w-10 text-gray-300 mx-auto mb-3" />
      <h3 className="text-base font-medium text-gray-900 mb-1">You cannot open this page</h3>
      <p className="text-sm text-gray-500">{text || 'Ask the super admin to give your role this permission.'}</p>
    </div>
  );
}
