'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { procurementService, type Purchase } from '../services/procurementService';

interface Props {
  open: boolean;
  onClose: () => void;
  purchaseId: string | null;
  onChange: () => void;
}

const STATUS_STYLES: Record<Purchase['paymentStatus'], string> = {
  pending: 'bg-gray-100 text-gray-600',
  partial: 'bg-amber-50 text-amber-700',
  paid: 'bg-emerald-50 text-emerald-700',
  overdue: 'bg-red-50 text-red-700',
};

export default function PurchaseDetailModal({ open, onClose, purchaseId, onChange }: Props) {
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [loading, setLoading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const removingRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open || !purchaseId) { setPurchase(null); return; }
    setLoading(true);
    procurementService.getPurchase(purchaseId)
      .then(setPurchase)
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [open, purchaseId]);

  const handleRemovePayment = async (paymentId: string) => {
    if (removingRef.current) return;
    if (!purchase || !window.confirm('Remove this payment?')) return;
    if (removingRef.current) return;
    removingRef.current = paymentId;
    setRemovingId(paymentId);
    try {
      const updated = await procurementService.removePayment(purchase._id, paymentId);
      setPurchase(updated);
      onChange();
      toast.success('Payment removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove');
    } finally {
      removingRef.current = null;
      setRemovingId(null);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => { if (!removingId) onClose(); }}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">
            Purchase Details
            {purchase && <span className="ml-2 font-mono text-xs text-gray-500">{purchase.invoiceNumber}</span>}
          </h3>
          <button onClick={onClose} disabled={!!removingId} className="p-1 hover:bg-gray-100 rounded disabled:opacity-60 disabled:cursor-not-allowed"><X className="w-4 h-4 text-gray-500" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading || !purchase ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Header card */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                <InfoBox label="Vendor" value={purchase.vendorName} />
                <InfoBox label="Purchase Date" value={new Date(purchase.purchaseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} />
                <InfoBox label="Due Date" value={purchase.dueDate ? new Date(purchase.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'} />
                <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Status</p>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${STATUS_STYLES[purchase.paymentStatus]}`}>
                    {purchase.paymentStatus}
                  </span>
                </div>
              </div>

              {/* Items */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="text-left px-3 py-2">Description</th>
                      <th className="text-right px-3 py-2 w-20">Qty</th>
                      <th className="text-right px-3 py-2 w-28">Unit Price</th>
                      <th className="text-right px-3 py-2 w-28">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {purchase.items.map((it, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span>{it.description}</span>
                            {it.productId && (
                              <span
                                title={it.productSku ? `SKU: ${it.productSku}` : 'Linked product'}
                                className="text-[9px] font-semibold uppercase tracking-wider bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded"
                              >
                                Linked
                              </span>
                            )}
                          </div>
                          {it.productSku && (
                            <div className="text-[10px] text-gray-500 mt-0.5">SKU: {it.productSku}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{it.quantity}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{it.unitPrice.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold">{it.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 text-xs">
                    <tr><td colSpan={3} className="px-3 py-1 text-right text-gray-500">Subtotal</td><td className="px-3 py-1 text-right tabular-nums">{purchase.subtotal.toFixed(2)}</td></tr>
                    <tr><td colSpan={3} className="px-3 py-1 text-right text-gray-500">Tax ({purchase.taxPercent}%)</td><td className="px-3 py-1 text-right tabular-nums">{purchase.taxAmount.toFixed(2)}</td></tr>
                    <tr><td colSpan={3} className="px-3 py-1 text-right text-gray-500">Discount</td><td className="px-3 py-1 text-right tabular-nums">-{purchase.discount.toFixed(2)}</td></tr>
                    <tr className="border-t border-gray-200"><td colSpan={3} className="px-3 py-1.5 text-right font-semibold">Total</td><td className="px-3 py-1.5 text-right tabular-nums font-bold text-honey-600">{purchase.total.toFixed(2)}</td></tr>
                  </tfoot>
                </table>
              </div>

              {purchase.notes && (
                <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-xs text-gray-700 whitespace-pre-wrap">
                  <p className="font-semibold text-gray-500 uppercase tracking-wider mb-1">Notes</p>
                  {purchase.notes}
                </div>
              )}

              {/* Payments */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Payments</p>
                {!purchase.payments || purchase.payments.length === 0 ? (
                  <p className="text-xs text-gray-400 py-4 text-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
                    No payments recorded yet.
                  </p>
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        <tr>
                          <th className="text-left px-3 py-2">Date</th>
                          <th className="text-left px-3 py-2">Method</th>
                          <th className="text-left px-3 py-2">Reference</th>
                          <th className="text-right px-3 py-2">Amount</th>
                          <th className="w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {purchase.payments.map((pay) => (
                          <tr key={pay._id}>
                            <td className="px-3 py-2 text-xs">
                              {new Date(pay.paymentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </td>
                            <td className="px-3 py-2 text-xs capitalize">{pay.paymentMethod}</td>
                            <td className="px-3 py-2 text-xs text-gray-500">{pay.reference || '—'}</td>
                            <td className="px-3 py-2 text-right tabular-nums font-semibold text-emerald-600">{pay.amount.toFixed(2)}</td>
                            <td className="px-2 py-2">
                              <button
                                onClick={() => pay._id && handleRemovePayment(pay._id)}
                                disabled={!!removingId}
                                aria-busy={removingId === pay._id}
                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-60 disabled:cursor-not-allowed"
                                aria-label={removingId === pay._id ? 'Removing payment…' : 'Remove payment'}
                              >
                                {removingId === pay._id
                                  ? <Loader2 className="w-3.5 h-3.5 animate-spin text-red-600" />
                                  : <Trash2 className="w-3.5 h-3.5" />}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">{label}</p>
      <p className="text-sm font-semibold text-gray-900 truncate">{value}</p>
    </div>
  );
}
