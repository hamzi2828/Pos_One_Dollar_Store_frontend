// POS header badge: Online / Offline – N sales waiting / Uploading… / N need attention.
// Clicking it opens a small panel with the sales on this PC (Retry / Remove).
'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, CloudOff, Loader2, RefreshCw, Trash2, Wifi, X, UploadCloud } from 'lucide-react';
import type { OfflineStatus } from './useOfflineStatus';
import { removeFromOutbox, retryOutboxEntry } from './outbox';

interface Props {
  status: OfflineStatus;
  symbol: string;
}

const when = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
};

export default function OfflineBadge({ status, symbol }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const { online, enabled, waiting, failed, uploading } = status;

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  let tone: string;
  let icon: React.ReactNode;
  let label: string;
  if (failed > 0) {
    tone = 'bg-red-50 text-red-700 border-red-300';
    icon = <AlertTriangle className="h-3.5 w-3.5" />;
    label = `${failed} need${failed === 1 ? 's' : ''} attention`;
  } else if (uploading) {
    tone = 'bg-blue-50 text-blue-700 border-blue-300';
    icon = <Loader2 className="h-3.5 w-3.5 animate-spin" />;
    label = 'Uploading…';
  } else if (!online) {
    tone = enabled ? 'bg-amber-50 text-amber-800 border-amber-300' : 'bg-red-50 text-red-700 border-red-300';
    icon = <CloudOff className="h-3.5 w-3.5" />;
    label = enabled ? `Offline – ${waiting} sale${waiting === 1 ? '' : 's'} waiting` : 'No internet – sales cannot be saved';
  } else if (waiting > 0) {
    tone = 'bg-amber-50 text-amber-800 border-amber-300';
    icon = <UploadCloud className="h-3.5 w-3.5" />;
    label = `${waiting} sale${waiting === 1 ? '' : 's'} waiting to upload`;
  } else {
    tone = 'bg-green-50 text-green-700 border-green-300';
    icon = <Wifi className="h-3.5 w-3.5" />;
    label = 'Online';
  }

  const retry = async (clientId: string) => {
    setBusy(clientId);
    try {
      await retryOutboxEntry(clientId);
      status.uploadNow();
    } finally {
      setBusy(null);
    }
  };

  const remove = async (clientId: string, number: string) => {
    if (!confirm(`Remove offline sale ${number} from this PC? It will NOT reach the server. Only do this if the sale was entered again by hand.`)) return;
    setBusy(clientId);
    try {
      await removeFromOutbox(clientId);
      toast.success(`${number} removed`);
    } finally {
      setBusy(null);
    }
  };

  const savedAt = status.catalog.savedAt;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold whitespace-nowrap ${tone}`}
        title={enabled ? 'Internet and offline sales' : 'Internet status'}
        aria-expanded={open}
      >
        {icon}
        {label}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[22rem] max-w-[calc(100vw-1.5rem)] rounded-lg border border-gray-200 bg-white shadow-xl">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-900">Offline sales on this PC</span>
            <button type="button" onClick={() => setOpen(false)} className="p-1 text-gray-400 hover:text-gray-600" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-3 py-2 text-xs text-gray-600 space-y-1 border-b border-gray-100">
            <div>{online ? 'Connected to the server.' : 'No connection to the server.'}</div>
            {enabled ? (
              <div>
                {savedAt
                  ? `Product list saved ${when(savedAt)} (${status.catalog.products} products).`
                  : 'Product list not saved yet: it downloads when online.'}
              </div>
            ) : (
              <div>Offline selling is off for this user (Roles → Desktop app → Sales on the counter PC).</div>
            )}
            {status.problem && <div className="text-red-600">{status.problem}</div>}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={status.uploadNow}
                disabled={!online || uploading || waiting === 0}
                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <UploadCloud className="h-3.5 w-3.5" /> Upload now
              </button>
              {enabled && (
                <button
                  type="button"
                  onClick={status.refreshCatalog}
                  disabled={!online || status.catalog.syncing}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${status.catalog.syncing ? 'animate-spin' : ''}`} /> Update product list
                </button>
              )}
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {status.entries.length === 0 ? (
              <p className="px-3 py-4 text-xs text-center text-gray-500">No sales waiting. Everything is on the server.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {status.entries.map((e) => (
                  <li key={e.clientId} className="px-3 py-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-semibold text-gray-900">{e.offlineNumber}</span>
                      <span className="text-gray-700">
                        {symbol}
                        {(e.order.bill.total || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-gray-500">
                      <span>{when(e.order.soldAt)}</span>
                      <span className={e.state === 'failed' ? 'text-red-600 font-medium' : 'text-amber-700'}>
                        {e.state === 'failed' ? 'Needs attention' : 'Waiting'}
                      </span>
                    </div>
                    {e.lastError && <div className={`mt-1 ${e.state === 'failed' ? 'text-red-600' : 'text-gray-500'}`}>{e.lastError}</div>}
                    {e.state === 'failed' && (
                      <div className="flex gap-2 mt-1.5">
                        <button
                          type="button"
                          onClick={() => retry(e.clientId)}
                          disabled={busy === e.clientId}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <RefreshCw className="h-3 w-3" /> Retry
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(e.clientId, e.offlineNumber)}
                          disabled={busy === e.clientId}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          <Trash2 className="h-3 w-3" /> Remove
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
