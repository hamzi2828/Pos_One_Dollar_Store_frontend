'use client';

// Stock adjustments: count sheet (counted qty -> difference -> apply) and
// manual corrections (found / lost / opening), plus the history of sheets.

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ClipboardList, Eye, Loader2, Pencil, SlidersHorizontal, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import TablePagination from '@/components/admin/TablePagination';
import { LoadingCard, Modal, NoAccessCard, inputClass } from '@/components/admin/FormBits';
import { useAccess } from '@/context/AccessContext';
import { storeApi, apiErrorMessage, formatRs, formatDate, type PageMeta } from '@/lib/storeApi';
import { ADJUSTMENT_REASONS, adjustmentReasonLabel, type StockAdjustment } from '../movements/_shared/stockOpsApi';
import { ErrorCard, PageHeader, StatusPill, cardClass, thClass } from '../movements/_shared/StockOpsBits';
import CountSheet, { emptySheet, sheetFromAdjustment, type SheetDraft } from './components/CountSheet';

type View = 'sheet' | 'history';

export default function AdjustmentsPage() {
  const { can } = useAccess();
  const canView = can('stock_adjustments', 'view');
  const canCreate = can('stock_adjustments', 'create');

  const [view, setView] = useState<View>('sheet');
  const [sheet, setSheet] = useState<SheetDraft>(emptySheet());
  const [rows, setRows] = useState<StockAdjustment[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [status, setStatus] = useState('');
  const [reason, setReason] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [detail, setDetail] = useState<StockAdjustment | null>(null);

  useEffect(() => {
    if (!canCreate) setView('history');
  }, [canCreate]);
  useEffect(() => setPage(1), [status, reason, limit]);

  const load = useCallback(async () => {
    if (!canView || view !== 'history') return;
    setLoading(true);
    setError(null);
    try {
      const res = await storeApi.get<StockAdjustment[]>('/stock-adjustments', { status, reason, page, limit });
      setRows(res.data || []);
      setMeta(res.meta || null);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load adjustments.'));
    } finally {
      setLoading(false);
    }
  }, [canView, view, status, reason, page, limit]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (a: StockAdjustment, action: 'apply' | 'cancel') => {
    if (busy) return;
    if (action === 'apply' && !window.confirm(`Apply ${a.adjNo}? Stock changes: +${a.totals.piecesIn} / −${a.totals.piecesOut} pieces.`)) return;
    if (action === 'cancel' && !window.confirm(`Cancel draft ${a.adjNo}?`)) return;
    setBusy(a._id);
    try {
      const res = await storeApi.post<StockAdjustment>(`/stock-adjustments/${a._id}/${action}`, {});
      toast.success(res.message || 'Done');
      await load();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not update'));
      await load();
    } finally {
      setBusy(null);
    }
  };

  if (!canView) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <NoAccessCard />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <PageHeader title="Stock Adjustments" subtitle="Count the shelves, fix the difference, or add found / opening stock. Every change is written to the stock ledger." />

        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 text-sm mb-4">
          {canCreate && (
            <button type="button" onClick={() => setView('sheet')} className={`px-3 py-1.5 rounded-md font-medium inline-flex items-center gap-1.5 ${view === 'sheet' ? 'bg-honey-500 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}>
              <ClipboardList className="h-4 w-4" />
              {sheet.id ? 'Edit draft' : 'New count'}
              {sheet.lines.length > 0 && <span className="text-[10px] opacity-80">({sheet.lines.length})</span>}
            </button>
          )}
          <button type="button" onClick={() => setView('history')} className={`px-3 py-1.5 rounded-md font-medium inline-flex items-center gap-1.5 ${view === 'history' ? 'bg-honey-500 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}>
            <SlidersHorizontal className="h-4 w-4" />
            History
          </button>
        </div>

        {view === 'sheet' && canCreate ? (
          <CountSheet
            sheet={sheet}
            setSheet={setSheet}
            onSaved={(a) => {
              if (a.status === 'draft') setSheet(sheetFromAdjustment(a));
              else {
                setSheet(emptySheet());
                setView('history');
              }
            }}
          />
        ) : (
          <>
            <div className={`${cardClass} p-3 sm:p-4 mb-4`}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
                <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass} aria-label="Status">
                  <option value="">Any status</option>
                  <option value="draft">Draft</option>
                  <option value="applied">Applied</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <select value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} aria-label="Reason">
                  <option value="">Any reason</option>
                  {ADJUSTMENT_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {loading && !rows.length ? (
              <LoadingCard text="Loading adjustments…" />
            ) : error ? (
              <ErrorCard message={error} onRetry={load} />
            ) : (
              <div className={`${cardClass} overflow-hidden`}>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className={thClass}>Sheet</th>
                        <th className={thClass}>Reason</th>
                        <th className={`${thClass} text-right`}>Lines</th>
                        <th className={`${thClass} text-right`}>In / Out</th>
                        <th className={`${thClass} text-right`}>Value</th>
                        <th className={thClass}>Status</th>
                        <th className={`${thClass} text-right`}></th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-500">
                            <SlidersHorizontal className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                            No adjustments yet.
                          </td>
                        </tr>
                      ) : (
                        rows.map((a) => (
                          <tr key={a._id} className="hover:bg-gray-50">
                            <td className="px-3 sm:px-4 py-2.5 whitespace-nowrap">
                              <div className="text-sm font-semibold font-mono">{a.adjNo}</div>
                              <div className="text-xs text-gray-500">
                                {formatDate(a.createdAt, true)} · {a.createdByName || '—'}
                              </div>
                            </td>
                            <td className="px-3 sm:px-4 py-2.5 text-sm">
                              {adjustmentReasonLabel(a.reason)}
                              {a.notes && <div className="text-xs text-gray-500 max-w-[220px] truncate">{a.notes}</div>}
                            </td>
                            <td className="px-3 sm:px-4 py-2.5 text-right text-sm">{a.totals.lines}</td>
                            <td className="px-3 sm:px-4 py-2.5 text-right text-sm whitespace-nowrap">
                              <span className="text-green-700">+{a.totals.piecesIn}</span> / <span className="text-red-600">−{a.totals.piecesOut}</span>
                            </td>
                            <td className="px-3 sm:px-4 py-2.5 text-right text-xs whitespace-nowrap text-gray-600">
                              +{formatRs(a.totals.valueIn)} / −{formatRs(a.totals.valueOut)}
                            </td>
                            <td className="px-3 sm:px-4 py-2.5">
                              <StatusPill status={a.status} />
                              {a.lines.some((l) => l.error) && <div className="text-[10px] text-red-600 mt-0.5">Some lines failed</div>}
                            </td>
                            <td className="px-3 sm:px-4 py-2.5 text-right whitespace-nowrap">
                              <button type="button" onClick={() => setDetail(a)} className="p-1.5 rounded-md text-gray-400 hover:text-honey-700 hover:bg-honey-50" title="Details">
                                <Eye className="h-4 w-4" />
                              </button>
                              {a.status === 'draft' && canCreate && (
                                <>
                                  {!a.lines.some((l) => l.applied) && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSheet(sheetFromAdjustment(a));
                                        setView('sheet');
                                      }}
                                      className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                                      title="Edit draft"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </button>
                                  )}
                                  <button type="button" onClick={() => act(a, 'apply')} disabled={!!busy} className="p-1.5 rounded-md text-gray-400 hover:text-green-700 hover:bg-green-50 disabled:opacity-50" title="Apply">
                                    {busy === a._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                  </button>
                                  {!a.lines.some((l) => l.applied) && (
                                    <button type="button" onClick={() => act(a, 'cancel')} disabled={!!busy} className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50" title="Cancel draft">
                                      <XCircle className="h-4 w-4" />
                                    </button>
                                  )}
                                </>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {meta && <TablePagination page={meta.page} pages={meta.pages} total={meta.total} limit={limit} onPageChange={setPage} onLimitChange={setLimit} label="sheets" loading={loading} />}
              </div>
            )}
          </>
        )}
      </div>

      {detail && (
        <Modal title={detail.adjNo} subtitle={`${adjustmentReasonLabel(detail.reason)} · ${formatDate(detail.createdAt, true)}`} onClose={() => setDetail(null)} wide>
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={detail.status} />
              {detail.appliedAt && (
                <span className="text-xs text-gray-500">
                  Applied {formatDate(detail.appliedAt, true)} by {detail.appliedByName || '—'}
                </span>
              )}
            </div>
            {detail.notes && <p className="text-gray-700">{detail.notes}</p>}
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Item</th>
                    <th className="px-3 py-2 text-right font-medium">System</th>
                    <th className="px-3 py-2 text-right font-medium">Counted</th>
                    <th className="px-3 py-2 text-right font-medium">Diff</th>
                    <th className="px-3 py-2 text-left font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {detail.lines.map((l) => (
                    <tr key={l._id}>
                      <td className="px-3 py-2">
                        {l.productName}
                        {l.variantLabel ? ` (${l.variantLabel})` : ''}
                        <div className="text-[11px] text-gray-500 font-mono">{l.code}</div>
                      </td>
                      <td className="px-3 py-2 text-right">{l.systemQty}</td>
                      <td className="px-3 py-2 text-right">{l.countedQty ?? '—'}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${l.diff > 0 ? 'text-green-700' : l.diff < 0 ? 'text-red-600' : 'text-gray-500'}`}>{l.diff > 0 ? `+${l.diff}` : l.diff}</td>
                      <td className="px-3 py-2 text-xs">{l.error ? <span className="text-red-600">{l.error}</span> : l.applied ? <span className="text-green-700">applied</span> : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
