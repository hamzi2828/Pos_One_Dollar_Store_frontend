'use client';

// Vendor returns table (Returns page + vendor profile tab): expand to see
// lines; drafts can be edited, completed or cancelled; completed ones printed.

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ChevronDown, ChevronRight, Check, Edit2, Ban, Printer, Loader2, Undo2 } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage } from '@/helper/access';
import { formatRs, formatDate } from '@/lib/storeApi';
import { vendorApi, type VendorReturn } from '../services/vendorApi';
import { Badge, ReasonModal, tdClass, thClass } from './ui';

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/** Printable debit note for the vendor. */
function printDebitNote(r: VendorReturn) {
  const w = window.open('', '_blank', 'width=800,height=700');
  if (!w) return toast.error('Allow pop-ups to print.');
  const rows = r.lines
    .map(
      (l, i) =>
        `<tr><td>${i + 1}</td><td>${esc(l.productName)}${l.variantLabel ? ` · ${esc(l.variantLabel)}` : ''}<br><small>${esc(l.code)}</small></td><td>${esc(l.reasonLabel)}</td><td class="n">${l.qty}</td><td class="n">${esc(formatRs(l.unitCost))}</td><td class="n">${esc(formatRs(l.amount))}</td></tr>`,
    )
    .join('');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(r.returnNo)}</title>
  <style>body{font-family:Arial,sans-serif;font-size:12px;margin:24px;color:#111}h1{font-size:18px;margin:0 0 4px}table{width:100%;border-collapse:collapse;margin-top:12px}
  th,td{border-bottom:1px solid #ddd;padding:6px;text-align:left}th{background:#f3f4f6;font-size:11px;text-transform:uppercase}.n{text-align:right}.tot td{font-weight:bold;border-top:2px solid #111}
  .sign{margin-top:48px;display:flex;justify-content:space-between}.sign div{border-top:1px solid #111;width:40%;padding-top:4px;text-align:center}</style></head><body>
  <h1>Debit note ${esc(r.returnNo)}</h1>
  <div>Vendor: <b>${esc(r.vendorName)}</b> · Date: ${esc(formatDate(r.completedAt || r.date))}</div>
  <table><thead><tr><th>#</th><th>Item</th><th>Reason</th><th class="n">Qty</th><th class="n">Price</th><th class="n">Amount</th></tr></thead>
  <tbody>${rows}<tr class="tot"><td colspan="3">Total returned</td><td class="n">${r.totalQty}</td><td></td><td class="n">${esc(formatRs(r.total))}</td></tr></tbody></table>
  ${r.notes ? `<p>Notes: ${esc(r.notes)}</p>` : ''}
  <div class="sign"><div>Received by vendor</div><div>For the shop</div></div>
  <script>window.onload=function(){window.print();}</script></body></html>`);
  w.document.close();
}

export default function ReturnsList({
  rows,
  showVendor = true,
  onEdit,
  onChanged,
}: {
  rows: VendorReturn[];
  showVendor?: boolean;
  onEdit?: (r: VendorReturn) => void;
  onChanged: () => void;
}) {
  const { can } = useAccess();
  const [open, setOpen] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<VendorReturn | null>(null);
  const lock = useRef(false);

  const complete = async (r: VendorReturn) => {
    if (lock.current) return;
    if (!window.confirm(`Complete ${r.returnNo}?\n\n${r.totalQty} pcs leave stock and ${r.vendorName}'s bill goes down by ${formatRs(r.total)}.`)) return;
    lock.current = true;
    setBusyId(r._id);
    try {
      const done = await vendorApi.completeReturn(r._id);
      toast.success(`${done.returnNo} completed — debit note ${formatRs(done.total)}`);
      onChanged();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not complete the return.'), { duration: 7000 });
    } finally {
      lock.current = false;
      setBusyId(null);
    }
  };

  if (!rows.length) {
    return (
      <div className="px-4 py-10 text-center text-sm text-gray-500">
        <Undo2 className="h-10 w-10 text-gray-300 mx-auto mb-2" />
        No returns found.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className={thClass}>Return</th>
              {showVendor && <th className={thClass}>Vendor</th>}
              <th className={`${thClass} text-right`}>Pieces</th>
              <th className={`${thClass} text-right`}>Debit note</th>
              <th className={thClass}>Status</th>
              <th className={thClass}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => {
              const isOpen = open === r._id;
              const partly = r.status === 'draft' && r.lines.some((l) => l.posted);
              return (
                <React.Fragment key={r._id}>
                  <tr className={`hover:bg-gray-50 ${r.status === 'cancelled' ? 'opacity-60' : ''}`}>
                    <td className={`${tdClass} whitespace-nowrap`}>
                      <button type="button" onClick={() => setOpen(isOpen ? null : r._id)} className="inline-flex items-center gap-1 text-left">
                        {isOpen ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                        <span>
                          <span className="block font-mono text-xs text-gray-900">{r.returnNo}</span>
                          <span className="block text-[11px] text-gray-500">{formatDate(r.date)}</span>
                        </span>
                      </button>
                    </td>
                    {showVendor && (
                      <td className={tdClass}>
                        <Link href={`/admin/vendors/${r.vendor}`} className="font-medium text-gray-900 hover:text-honey-700">
                          {r.vendorName}
                        </Link>
                      </td>
                    )}
                    <td className={`${tdClass} text-right tabular-nums`}>
                      {r.totalQty}
                      <span className="block text-[10px] text-gray-400">
                        {r.lines.length} item{r.lines.length === 1 ? '' : 's'}
                      </span>
                    </td>
                    <td className={`${tdClass} text-right font-semibold tabular-nums whitespace-nowrap`}>{formatRs(r.total)}</td>
                    <td className={tdClass}>
                      <Badge kind={r.status} />
                      {partly && <span className="block text-[10px] text-amber-700">partly taken out — complete it</span>}
                    </td>
                    <td className={`${tdClass} text-right whitespace-nowrap`}>
                      {busyId === r._id && <Loader2 className="inline h-4 w-4 animate-spin text-gray-400 mr-1" />}
                      {r.status === 'draft' && can('vendor_returns', 'edit') && (
                        <>
                          {onEdit && !partly && (
                            <button type="button" onClick={() => onEdit(r)} disabled={!!busyId} className="p-1.5 rounded-md text-gray-400 hover:text-honey-700 hover:bg-honey-50" title="Edit draft">
                              <Edit2 className="h-4 w-4" />
                            </button>
                          )}
                          <button type="button" onClick={() => complete(r)} disabled={!!busyId} className="p-1.5 rounded-md text-gray-400 hover:text-green-600 hover:bg-green-50" title="Complete">
                            <Check className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      {r.status === 'draft' && !partly && can('vendor_returns', 'delete') && (
                        <button type="button" onClick={() => setCancelling(r)} disabled={!!busyId} className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50" title="Cancel draft">
                          <Ban className="h-4 w-4" />
                        </button>
                      )}
                      {r.status === 'completed' && (
                        <button type="button" onClick={() => printDebitNote(r)} className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100" title="Print debit note">
                          <Printer className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-gray-50/70">
                      <td colSpan={showVendor ? 6 : 5} className="px-4 py-3">
                        <div className="space-y-1">
                          {r.lines.map((l) => (
                            <div key={l._id} className="flex items-center justify-between gap-3 text-xs">
                              <span className="min-w-0 truncate">
                                {l.posted && <Check className="inline h-3 w-3 text-green-600 mr-1" />}
                                <span className="text-gray-900">{l.productName}</span>
                                {l.variantLabel && <span className="text-gray-500"> · {l.variantLabel}</span>}
                                <span className="text-gray-400"> · {l.reasonLabel}</span>
                              </span>
                              <span className="whitespace-nowrap tabular-nums text-gray-700">
                                {l.qty} × {formatRs(l.unitCost)} = <b>{formatRs(l.amount)}</b>
                              </span>
                            </div>
                          ))}
                          <p className="pt-1 text-[11px] text-gray-500">
                            By {r.createdByName || '—'}
                            {r.completedAt && ` · completed ${formatDate(r.completedAt, true)} by ${r.completedByName || '—'}`}
                            {r.cancelReason && ` · cancelled: ${r.cancelReason}`}
                            {r.notes && ` · ${r.notes}`}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {cancelling && (
        <ReasonModal
          title="Cancel return"
          subtitle={`${cancelling.returnNo} · ${cancelling.vendorName}`}
          confirmText="Cancel return"
          required={false}
          onClose={() => setCancelling(null)}
          onConfirm={async (reason) => {
            await vendorApi.cancelReturn(cancelling._id, reason);
            toast.success(`${cancelling.returnNo} cancelled`);
            setCancelling(null);
            onChanged();
          }}
        />
      )}
    </>
  );
}
