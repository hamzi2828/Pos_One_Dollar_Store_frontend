'use client';

import { ArrowLeftRight, ArrowRight, CheckCircle2, AlertTriangle, XCircle, Package } from 'lucide-react';
import { Modal, secondaryBtn } from '@/components/admin/FormBits';
import type { StockTransfer } from '../services/transferService';

export const formatDateTime = (iso: string | undefined) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export function TransferStatusBadge({ status }: { status: StockTransfer['status'] }) {
  if (status === 'completed')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-800 rounded-full">
        <CheckCircle2 className="h-3 w-3" /> Completed
      </span>
    );
  if (status === 'partial')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 rounded-full">
        <AlertTriangle className="h-3 w-3" /> Partly done
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-700 rounded-full">
      <XCircle className="h-3 w-3" /> Failed
    </span>
  );
}

export const byName = (t: StockTransfer) => {
  const u = t.createdBy;
  if (!u) return '—';
  return `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || '—';
};

export function TransferDetailModal({ transfer: t, onClose }: { transfer: StockTransfer; onClose: () => void }) {
  return (
    <Modal
      title={`Transfer ${t.transferNo}`}
      subtitle={formatDateTime(t.createdAt)}
      icon={<ArrowLeftRight className="h-5 w-5" />}
      onClose={onClose}
      wide
      footer={
        <button type="button" onClick={onClose} className={secondaryBtn}>
          Close
        </button>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-2 text-sm">
            <span className="px-2.5 py-1 rounded-lg bg-gray-100 font-semibold text-gray-800">{t.fromBranch?.name || '—'}</span>
            <ArrowRight className="h-4 w-4 text-honey-500" />
            <span className="px-2.5 py-1 rounded-lg bg-honey-50 font-semibold text-honey-800">{t.toBranch?.name || '—'}</span>
          </div>
          <TransferStatusBadge status={t.status} />
        </div>
        <p className="text-xs text-gray-500">
          By {byName(t)}
          {t.note ? (
            <>
              {' '}
              · Note: <span className="text-gray-700">{t.note}</span>
            </>
          ) : null}
        </p>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="px-3 py-2 text-right text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Qty</th>
                <th className="px-3 py-2 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Batches</th>
                <th className="px-3 py-2 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {t.items.map((i, idx) => (
                <tr key={idx}>
                  <td className="px-3 py-2">
                    <div className="flex items-start gap-2">
                      <Package className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-gray-900">{i.productName || 'Product'}</div>
                        {(i.variantLabel || i.sku) && (
                          <div className="text-xs text-gray-500">
                            {i.variantLabel}
                            {i.variantLabel && i.sku ? ' · ' : ''}
                            {i.sku}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{i.quantity}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">
                    {i.allocations && i.allocations.length
                      ? i.allocations.map((a) => `${a.batchNo || '—'} × ${a.quantity ?? 0}`).join(', ')
                      : i.batchNo || '—'}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {i.status === 'failed' ? (
                      <span className="text-red-700">{i.error || 'Failed'}</span>
                    ) : (
                      <span className="text-green-700 inline-flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Moved
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}
