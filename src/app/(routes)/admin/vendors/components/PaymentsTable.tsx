'use client';

// Payments table (Payments page + vendor profile tab) with void action.

import React, { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Ban, Paperclip, HandCoins } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { formatRs, formatDate, BACKEND_URL } from '@/lib/storeApi';
import { vendorApi, type VendorPayment } from '../services/vendorApi';
import { Badge, ReasonModal, tdClass, thClass } from './ui';

const fileUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : `${BACKEND_URL}${u}`);

export default function PaymentsTable({
  rows,
  showVendor = true,
  onChanged,
}: {
  rows: VendorPayment[];
  showVendor?: boolean;
  onChanged: () => void;
}) {
  const { can } = useAccess();
  const [voiding, setVoiding] = useState<VendorPayment | null>(null);

  if (!rows.length) {
    return (
      <div className="px-4 py-10 text-center text-sm text-gray-500">
        <HandCoins className="h-10 w-10 text-gray-300 mx-auto mb-2" />
        No payments found.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className={thClass}>Payment</th>
              {showVendor && <th className={thClass}>Vendor</th>}
              <th className={thClass}>Method</th>
              <th className={`${thClass} text-right`}>Amount</th>
              <th className={`${thClass} hidden lg:table-cell`}>By</th>
              <th className={thClass}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((p) => {
              const voided = p.status === 'voided';
              return (
                <tr key={p._id} className={voided ? 'bg-gray-50 text-gray-400' : 'hover:bg-gray-50'}>
                  <td className={`${tdClass} whitespace-nowrap`}>
                    <p className={`font-mono text-xs ${voided ? 'line-through text-gray-400' : 'text-gray-900'}`}>{p.paymentNo}</p>
                    <p className="text-[11px] text-gray-500">{formatDate(p.date)}</p>
                    {voided && <Badge kind="voided">Voided</Badge>}
                  </td>
                  {showVendor && (
                    <td className={tdClass}>
                      <Link href={`/admin/vendors/${p.vendor}`} className="font-medium text-gray-900 hover:text-honey-700">
                        {p.vendorName}
                      </Link>
                    </td>
                  )}
                  <td className={tdClass}>
                    <p>{p.methodLabel}</p>
                    <p className="text-[11px] text-gray-500 max-w-[220px] truncate">
                      {[p.bankName, p.reference, p.notes].filter(Boolean).join(' · ')}
                    </p>
                    {p.attachments.length > 0 && (
                      <span className="inline-flex flex-wrap gap-1 mt-0.5">
                        {p.attachments.map((a, i) => (
                          <a key={a} href={fileUrl(a)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-[11px] text-blue-600 hover:underline">
                            <Paperclip className="h-3 w-3" /> Receipt {p.attachments.length > 1 ? i + 1 : ''}
                          </a>
                        ))}
                      </span>
                    )}
                    {voided && <p className="text-[11px] text-red-400">VOID: {p.voidReason}</p>}
                  </td>
                  <td className={`${tdClass} text-right whitespace-nowrap font-semibold tabular-nums ${voided ? 'line-through !text-gray-400' : 'text-gray-900'}`}>
                    {formatRs(p.amount)}
                  </td>
                  <td className={`${tdClass} hidden lg:table-cell text-xs text-gray-500`}>{p.createdByName || '—'}</td>
                  <td className={`${tdClass} text-right`}>
                    {!voided && can('vendor_payments', 'delete') && (
                      <button type="button" onClick={() => setVoiding(p)} className="p-1.5 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50" title="Void payment">
                        <Ban className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {voiding && (
        <ReasonModal
          title="Void payment"
          subtitle={`${voiding.paymentNo} · ${voiding.vendorName} · ${formatRs(voiding.amount)}`}
          confirmText="Void payment"
          onClose={() => setVoiding(null)}
          onConfirm={async (reason) => {
            await vendorApi.voidPayment(voiding._id, reason);
            toast.success(`${voiding.paymentNo} voided`);
            setVoiding(null);
            onChanged();
          }}
        >
          <p className="text-xs text-gray-600">
            The payment stays in the history (greyed out) and the vendor balance goes back up by {formatRs(voiding.amount)}.
          </p>
        </ReasonModal>
      )}
    </>
  );
}
