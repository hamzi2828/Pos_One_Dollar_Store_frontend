'use client';

// Vendor statement: opening balance, every len-den row with running balance,
// closing balance. Date filter, print, CSV. Voided rows stay visible, greyed.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Printer, Download, Loader2, Ban, Scale, FileText } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage } from '@/helper/access';
import { formatRs, formatDate } from '@/lib/storeApi';
import { inputClass, secondaryBtn, LoadingCard } from '@/components/admin/FormBits';
import { vendorApi, pkToday, type Statement, type LedgerRow, type VendorDetail } from '../services/vendorApi';
import { BalanceText, ErrorCard, ReasonModal, cardClass, tdClass, thClass, rangeLabel } from './ui';
import AdjustmentModal from './AdjustmentModal';

const TYPE_STYLE: Record<string, string> = {
  opening_balance: 'bg-gray-100 text-gray-700',
  bill: 'bg-rose-50 text-rose-700',
  payment: 'bg-emerald-50 text-emerald-700',
  debit_note: 'bg-orange-50 text-orange-700',
  credit_note: 'bg-rose-50 text-rose-700',
  consignment_settlement: 'bg-purple-50 text-purple-700',
  discount: 'bg-emerald-50 text-emerald-700',
  refund_received: 'bg-blue-50 text-blue-700',
  adjustment: 'bg-amber-50 text-amber-700',
};

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

const money = (n: number) => (n ? formatRs(n) : '');
const bal = (n: number) => (n === 0 ? 'Rs 0' : `${formatRs(Math.abs(n))} ${n > 0 ? 'payable' : 'receivable'}`);

/** Opens a clean printable statement in a new window. */
function printStatement(s: Statement, vendor: VendorDetail, from: string, to: string) {
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) return toast.error('Allow pop-ups to print the statement.');
  const rows = s.rows
    .map(
      (r) => `<tr class="${r.isVoided ? 'void' : ''}">
        <td>${esc(formatDate(r.date))}</td><td>${esc(r.typeLabel)}</td><td>${esc(r.refNo)}</td>
        <td>${esc(r.description)}${r.reference ? ` · ${esc(r.reference)}` : ''}${r.isVoided ? ` <b>VOID</b> ${esc(r.voidReason)}` : ''}</td>
        <td class="n">${esc(money(r.debit))}</td><td class="n">${esc(money(r.credit))}</td><td class="n">${r.isVoided ? '' : esc(bal(r.balance))}</td></tr>`,
    )
    .join('');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Statement ${esc(vendor.name)}</title>
    <style>body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:24px}h1{font-size:18px;margin:0}
    .muted{color:#666}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border-bottom:1px solid #ddd;padding:5px 6px;text-align:left;vertical-align:top}
    th{background:#f3f4f6;font-size:11px;text-transform:uppercase}.n{text-align:right;white-space:nowrap}.void td{color:#999;text-decoration:line-through}
    .tot td{font-weight:bold;border-top:2px solid #111}</style></head><body>
    <h1>Vendor statement — ${esc(vendor.name)} ${vendor.code ? `(${esc(vendor.code)})` : ''}</h1>
    <p class="muted">${esc([vendor.phone, vendor.city].filter(Boolean).join(' · '))}<br>Period: ${esc(rangeLabel(from, to))} · Printed ${esc(formatDate(new Date(), true))}</p>
    <table><thead><tr><th>Date</th><th>Type</th><th>Document</th><th>Details</th><th class="n">Debit (we owe less)</th><th class="n">Credit (we owe more)</th><th class="n">Balance</th></tr></thead>
    <tbody><tr><td colspan="6"><b>Opening balance</b></td><td class="n"><b>${esc(bal(s.opening))}</b></td></tr>${rows}
    <tr class="tot"><td colspan="4">Closing balance</td><td class="n">${esc(formatRs(s.totals.debit))}</td><td class="n">${esc(formatRs(s.totals.credit))}</td><td class="n">${esc(bal(s.closing))}</td></tr></tbody></table>
    <script>window.onload=function(){window.print();}</script></body></html>`);
  w.document.close();
}

export default function LedgerTab({ vendor, onChanged }: { vendor: VendorDetail; onChanged: () => void }) {
  const { can } = useAccess();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<Statement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [voiding, setVoiding] = useState<LedgerRow | null>(null);
  const exportLock = useRef(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setData(await vendorApi.statement(vendor._id, { from: from || undefined, to: to || undefined }));
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load the statement.'));
    } finally {
      setLoading(false);
    }
  }, [vendor._id, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const preset = (k: 'month' | '3m' | 'year' | 'all') => {
    if (k === 'all') {
      setFrom('');
      setTo('');
      return;
    }
    const today = pkToday();
    if (k === 'month') setFrom(`${today.slice(0, 8)}01`);
    if (k === '3m') setFrom(pkToday(-90));
    if (k === 'year') setFrom(`${today.slice(0, 4)}-01-01`);
    setTo('');
  };

  const exportCsv = async () => {
    if (exportLock.current) return;
    exportLock.current = true;
    setExporting(true);
    try {
      await vendorApi.downloadStatement(vendor._id, { from, to }, `ledger-${vendor.code || vendor.name}.csv`);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not download the CSV.'));
    } finally {
      exportLock.current = false;
      setExporting(false);
    }
  };

  const afterChange = () => {
    load();
    onChanged();
  };

  return (
    <div className="space-y-3">
      <div className={`${cardClass} p-3 flex flex-col lg:flex-row lg:items-end gap-2`}>
        <div className="grid grid-cols-2 gap-2 lg:w-80">
          <label className="text-[11px] text-gray-500">
            From
            <input type="date" value={from} max={to || pkToday()} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
          </label>
          <label className="text-[11px] text-gray-500">
            To
            <input type="date" value={to} min={from || undefined} max={pkToday()} onChange={(e) => setTo(e.target.value)} className={inputClass} />
          </label>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['month', 'This month'],
              ['3m', 'Last 3 months'],
              ['year', 'This year'],
              ['all', 'All'],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" onClick={() => preset(k)} className="px-2.5 py-1.5 text-xs rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50">
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 lg:ml-auto">
          {can('vendors', 'edit') && (
            <button type="button" onClick={() => setAdjusting(true)} className={secondaryBtn}>
              <Scale className="h-4 w-4" /> Adjustment
            </button>
          )}
          <button type="button" onClick={() => data && printStatement(data, vendor, from, to)} disabled={!data} className={secondaryBtn}>
            <Printer className="h-4 w-4" /> Print
          </button>
          {can('vendors', 'export') && (
            <button type="button" onClick={exportCsv} disabled={exporting} aria-busy={exporting} className={secondaryBtn}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} CSV
            </button>
          )}
        </div>
      </div>

      {loading && !data ? (
        <LoadingCard text="Loading statement…" />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : data ? (
        <div className={`${cardClass} overflow-hidden ${loading ? 'opacity-60' : ''}`}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-100 border-b border-gray-100">
            {[
              ['Opening', <BalanceText key="o" amount={data.opening} />],
              ['Debits (we owe less)', <span key="d" className="font-semibold tabular-nums">{formatRs(data.totals.debit)}</span>],
              ['Credits (we owe more)', <span key="c" className="font-semibold tabular-nums">{formatRs(data.totals.credit)}</span>],
              ['Closing', <BalanceText key="cl" amount={data.closing} />],
            ].map(([label, value]) => (
              <div key={String(label)} className="bg-white p-3">
                <p className="text-[10px] uppercase text-gray-500">{label}</p>
                <p className="text-sm">{value}</p>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className={thClass}>Date</th>
                  <th className={thClass}>Type</th>
                  <th className={thClass}>Details</th>
                  <th className={`${thClass} text-right`}>Debit</th>
                  <th className={`${thClass} text-right`}>Credit</th>
                  <th className={`${thClass} text-right`}>Balance</th>
                  <th className={thClass}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr className="bg-gray-50/60">
                  <td className={tdClass} colSpan={5}>
                    <span className="font-medium text-gray-800">Opening balance</span>
                    {data.from && <span className="ml-2 text-xs text-gray-500">before {formatDate(data.from)}</span>}
                  </td>
                  <td className={`${tdClass} text-right whitespace-nowrap`}>
                    <BalanceText amount={data.opening} />
                  </td>
                  <td />
                </tr>
                {data.rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500">
                      <FileText className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                      No transactions in this period.
                    </td>
                  </tr>
                )}
                {data.rows.map((r) => (
                  <tr key={r._id} className={r.isVoided ? 'bg-gray-50 text-gray-400' : 'hover:bg-gray-50'}>
                    <td className={`${tdClass} whitespace-nowrap ${r.isVoided ? '!text-gray-400' : ''}`}>{formatDate(r.date)}</td>
                    <td className={`${tdClass} whitespace-nowrap`}>
                      <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${r.isVoided ? 'bg-gray-200 text-gray-500 line-through' : TYPE_STYLE[r.type] || 'bg-gray-100'}`}>
                        {r.typeLabel}
                      </span>
                    </td>
                    <td className={`${tdClass} min-w-[200px] ${r.isVoided ? '!text-gray-400' : ''}`}>
                      <span className={r.isVoided ? 'line-through' : ''}>
                        {r.refNo && <span className="font-mono text-xs mr-1.5">{r.refNo}</span>}
                        {r.description}
                      </span>
                      {(r.method || r.reference) && (
                        <span className="block text-[11px] text-gray-400">
                          {[r.method && r.method.toUpperCase(), r.reference].filter(Boolean).join(' · ')}
                        </span>
                      )}
                      {r.isVoided && <span className="block text-[11px] text-red-400">VOID: {r.voidReason || '—'}</span>}
                    </td>
                    <td className={`${tdClass} text-right tabular-nums whitespace-nowrap ${r.isVoided ? '!text-gray-400 line-through' : 'text-emerald-700'}`}>{money(r.debit)}</td>
                    <td className={`${tdClass} text-right tabular-nums whitespace-nowrap ${r.isVoided ? '!text-gray-400 line-through' : 'text-rose-700'}`}>{money(r.credit)}</td>
                    <td className={`${tdClass} text-right whitespace-nowrap`}>{r.isVoided ? <span className="text-xs">—</span> : <BalanceText amount={r.balance} showLabel={false} />}</td>
                    <td className={`${tdClass} text-right`}>
                      {!r.isVoided && can('vendors', 'edit') && (r.type === 'adjustment' || r.type === 'opening_balance') && (
                        <button type="button" onClick={() => setVoiding(r)} className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50" title="Void this row">
                          <Ban className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-semibold">
                  <td className={tdClass} colSpan={3}>
                    Closing balance
                  </td>
                  <td className={`${tdClass} text-right tabular-nums`}>{formatRs(data.totals.debit)}</td>
                  <td className={`${tdClass} text-right tabular-nums`}>{formatRs(data.totals.credit)}</td>
                  <td className={`${tdClass} text-right whitespace-nowrap`}>
                    <BalanceText amount={data.closing} />
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
          {data.truncated && <p className="px-4 py-2 text-xs text-amber-700 bg-amber-50">Only the first rows are shown — pick a shorter period.</p>}
        </div>
      ) : null}

      {adjusting && (
        <AdjustmentModal
          vendorId={vendor._id}
          vendorName={vendor.name}
          balance={vendor.balance}
          onClose={() => setAdjusting(false)}
          onSaved={() => {
            toast.success('Adjustment posted');
            setAdjusting(false);
            afterChange();
          }}
        />
      )}
      {voiding && (
        <ReasonModal
          title="Void ledger row"
          subtitle={`${voiding.typeLabel} · ${formatRs(voiding.credit || voiding.debit)}`}
          confirmText="Void row"
          onClose={() => setVoiding(null)}
          onConfirm={async (reason) => {
            await vendorApi.voidEntry(vendor._id, voiding._id, reason);
            toast.success('Row voided');
            setVoiding(null);
            afterChange();
          }}
        >
          <p className="text-xs text-gray-600">The row stays in the statement (greyed out) but no longer counts in the balance.</p>
        </ReasonModal>
      )}
    </div>
  );
}
