'use client';

// Big blinking alert when a scanned code is not in the shop (owner, 2026-11-08).
// Closes with OK, Enter or Esc; the search box gets the cursor back.
import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

export default function ScanAlertModal({ code, onClose }: { code: string; onClose: () => void }) {
  const okRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    okRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" role="alertdialog" aria-modal="true" aria-labelledby="scan-alert-title">
      <style>{`
        @keyframes scan-alert-blink { 0%, 100% { background-color: #fef2f2; box-shadow: 0 0 0 6px #ef4444, 0 0 40px 10px rgba(239,68,68,.6); } 50% { background-color: #fee2e2; box-shadow: 0 0 0 6px #fca5a5, 0 0 10px 2px rgba(239,68,68,.2); } }
        @keyframes scan-alert-icon { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.15); opacity: .55; } }
      `}</style>
      <div className="w-full max-w-md rounded-2xl p-6 text-center" style={{ animation: 'scan-alert-blink 0.6s ease-in-out infinite' }}>
        <AlertTriangle className="mx-auto h-16 w-16 text-red-600" style={{ animation: 'scan-alert-icon 0.6s ease-in-out infinite' }} />
        <h2 id="scan-alert-title" className="mt-3 text-2xl font-extrabold text-red-700">Product not found</h2>
        <p className="mt-2 text-sm text-gray-700">No product has this barcode:</p>
        <p className="mt-1 break-all font-mono text-xl font-bold text-gray-900">{code}</p>
        <p className="mt-3 text-xs text-gray-600">Check the sticker, or search the product by name.</p>
        <button
          ref={okRef}
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-lg bg-red-600 py-3 text-base font-bold text-white hover:bg-red-700"
        >
          OK (Enter)
        </button>
      </div>
    </div>
  );
}
