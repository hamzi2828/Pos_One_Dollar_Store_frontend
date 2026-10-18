'use client';

// Vendor profile → Consignment: pieces placed / sold / unsold per product
// (in the shop) and the settlements made.

import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Handshake, Ban } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage } from '@/helper/access';
import { formatRs, formatDate } from '@/lib/storeApi';
import { LoadingCard, primaryBtn } from '@/components/admin/FormBits';
import { vendorApi, type Settlement, type VendorStockSheet } from '../services/vendorApi';
import { Badge, EmptyCard, ErrorCard, ReasonModal, cardClass, tdClass, thClass } from './ui';
import VendorVisitModal from './VendorVisitModal';

export function SettlementsTable({ rows, onChanged, showVendor = false }: { rows: Settlement[]; onChanged: () => void; showVendor?: boolean }) {
  const { can } = useAccess();
  const [voiding, setVoiding] = useState<Settlement | null>(null);
  if (!rows.length) return <p className="px-4 py-6 text-center text-sm text-gray-500">No settlements yet.</p>;
  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className={thClass}>Settlement</th>
              {showVendor && <th className={thClass}>Vendor</th>}
              <th className={`${thClass} text-right`}>Sold pcs</th>
              <th className={`${thClass} text-right`}>Payable</th>
              <th className={`${thClass} text-right`}>Paid now</th>
              <th className={thClass}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((s) => (
              <tr key={s._id} className={s.status === 'voided' ? 'bg-gray-50 text-gray-400' : 'hover:bg-gray-50'}>
                <td className={`${tdClass} whitespace-nowrap`}>
                  <p className={`font-mono text-xs ${s.status === 'voided' ? 'line-through' : 'text-gray-900'}`}>{s.settlementNo}</p>
                  <p className="text-[11px] text-gray-500">
                    {formatDate(s.periodFrom)} → {formatDate(s.periodTo)}
                  </p>
                  {s.status === 'voided' && <Badge kind="voided">Voided</Badge>}
                </td>
                {showVendor && <td className={tdClass}>{s.vendorName}</td>}
                <td className={`${tdClass} text-right tabular-nums`}>{s.totalQty}</td>
                <td className={`${tdClass} text-right font-semibold tabular-nums whitespace-nowrap`}>{formatRs(s.total)}</td>
                <td className={`${tdClass} text-right tabular-nums whitespace-nowrap`}>{s.paidAmount ? formatRs(s.paidAmount) : '—'}</td>
                <td className={`${tdClass} text-right`}>
                  {s.status === 'active' && can('consignment', 'delete') && (
                    <button type="button" onClick={() => setVoiding(s)} className="p-1.5 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50" title="Void settlement">
                      <Ban className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {voiding && (
        <ReasonModal
          title="Void settlement"
          subtitle={`${voiding.settlementNo} · ${formatRs(voiding.total)}`}
          confirmText="Void settlement"
          onClose={() => setVoiding(null)}
          onConfirm={async (reason) => {
            await vendorApi.voidSettlement(voiding._id, reason);
            toast.success(`${voiding.settlementNo} voided`);
            setVoiding(null);
            onChanged();
          }}
        >
          <p className="text-xs text-gray-600">
            The {voiding.totalQty} sold pieces become unsettled again and the payable row is voided.
            {voiding.paidAmount > 0 && ' The payment made with it stays — void it on Vendor Payments if needed.'}
          </p>
        </ReasonModal>
      )}
    </>
  );
}

export default function ConsignmentTab({ vendorId, onChanged }: { vendorId: string; onChanged: () => void }) {
  const { can } = useAccess();
  const [sheet, setSheet] = useState<VendorStockSheet | null>(null);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visit, setVisit] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [s, list] = await Promise.all([vendorApi.vendorStock(vendorId), vendorApi.settlements({ vendor: vendorId, limit: 20 })]);
      setSheet(s);
      setSettlements(list.data);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load consignment stock.'));
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !sheet) return <LoadingCard text="Loading consignment…" />;
  if (error) return <ErrorCard message={error} onRetry={load} />;
  if (!sheet) return null;

  return (
    <div className="space-y-3">
      <div className={`${cardClass} p-3 flex flex-col sm:flex-row sm:items-center gap-2`}>
        <p className="text-sm text-gray-700 flex-1">
          <b>{sheet.totals.unsold}</b> pcs in the shop ({formatRs(sheet.totals.unsoldValue)} at vendor rate) · <b>{sheet.totals.unsettledQty}</b> sold not settled ={' '}
          <b className="text-purple-700">{formatRs(sheet.totals.unsettledAmount)}</b>
        </p>
        {can('consignment', 'create') && (
          <button type="button" onClick={() => setVisit(true)} className={primaryBtn}>
            <Handshake className="h-4 w-4" /> Vendor visit
          </button>
        )}
      </div>
      {sheet.items.length === 0 ? (
        <EmptyCard icon={<Handshake className="h-10 w-10" />} title="No consignment stock" text="Receive the vendor's pieces with a vendor visit." />
      ) : (
        <div className={`${cardClass} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className={thClass}>Product</th>
                  <th className={`${thClass} text-right`}>Rate</th>
                  <th className={`${thClass} text-right`}>Placed</th>
                  <th className={`${thClass} text-right`}>Sold</th>
                  <th className={`${thClass} text-right`}>Unsold</th>
                  <th className={`${thClass} text-right`}>To settle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sheet.items.map((i) => (
                  <tr key={i._id} className="hover:bg-gray-50">
                    <td className={tdClass}>
                      <p className="font-medium text-gray-900">
                        {i.productName}
                        {i.variantLabel && <span className="text-gray-500"> · {i.variantLabel}</span>}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        since {formatDate(i.firstIntakeAt)} · {i.currentStock ?? '?'} in stock · returned {i.qtyReturned}
                      </p>
                    </td>
                    <td className={`${tdClass} text-right whitespace-nowrap`}>{formatRs(i.rate)}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{i.placed}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{i.sold}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{i.unsold}</td>
                    <td className={`${tdClass} text-right whitespace-nowrap`}>
                      {i.unsettled > 0 ? (
                        <span className="font-semibold text-purple-700">
                          {i.unsettled} = {formatRs(i.unsettledAmount)}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div className={`${cardClass} overflow-hidden`}>
        <p className="px-4 py-2.5 text-sm font-semibold text-gray-900 border-b border-gray-100">Settlements</p>
        <SettlementsTable
          rows={settlements}
          onChanged={() => {
            load();
            onChanged();
          }}
        />
      </div>
      {visit && (
        <VendorVisitModal
          vendorId={vendorId}
          onClose={() => setVisit(false)}
          onDone={() => {
            setVisit(false);
            load();
            onChanged();
          }}
        />
      )}
    </div>
  );
}
