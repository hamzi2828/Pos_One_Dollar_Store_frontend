'use client';

// Damaged stock: daily damage list (printable with barcodes, CSV), report by
// scanning, approve / reject for managers (approve takes the stock off).

import { useCallback, useEffect, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Download, Loader2, PackageX, Plus, Printer, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import TablePagination from '@/components/admin/TablePagination';
import { ErrorBox, Field, LoadingCard, Modal, NoAccessCard, Toggle, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import ProductInsightPanel from '@/components/store/ProductInsightPanel';
import { useAccess } from '@/context/AccessContext';
import { storeApi, apiErrorMessage, formatRs, formatDate, type PageMeta } from '@/lib/storeApi';
import { downloadCsv, photoUrl, reasonLabel, todayPKT, type DamageDay, type DamageRecord } from '../movements/_shared/stockOpsApi';
import { ErrorCard, PageHeader, StatCard, StatusPill, cardClass, thClass } from '../movements/_shared/StockOpsBits';
import ReportDamageModal from './components/ReportDamageModal';
import { printDamageList } from './components/printDamageList';

type Tab = 'daily' | 'pending' | 'all';

const shiftDay = (day: string, delta: number) => {
  const d = new Date(`${day}T12:00:00+05:00`);
  d.setUTCDate(d.getUTCDate() + delta);
  return new Date(d.getTime() + 5 * 3600 * 1000).toISOString().slice(0, 10);
};

export default function DamagesPage() {
  const { can, isSuperAdmin } = useAccess();
  const canView = can('damages', 'view');
  const canCreate = can('damages', 'create');
  const canApprove = can('damages', 'edit');
  const canDelete = can('damages', 'delete');
  const canExport = can('damages', 'export');

  const [tab, setTab] = useState<Tab>('daily');
  const [date, setDate] = useState(todayPKT());
  const [day, setDay] = useState<DamageDay | null>(null);
  const [list, setList] = useState<DamageRecord[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [showReport, setShowReport] = useState(false);
  const [rejecting, setRejecting] = useState<DamageRecord | null>(null);
  const [photoView, setPhotoView] = useState<string | null>(null);
  const [insight, setInsight] = useState<{ productId: string; variantId: string | null } | null>(null);
  const [autoApprove, setAutoApprove] = useState(false);
  const [savingSetting, setSavingSetting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    setError(null);
    try {
      if (tab === 'daily') {
        const res = await storeApi.get<DamageDay>('/damages/daily', { date });
        setDay(res.data);
      } else {
        const res = await storeApi.get<DamageRecord[]>('/damages', { status: tab === 'pending' ? 'pending' : undefined, page, limit });
        setList(res.data || []);
        setMeta(res.meta || null);
      }
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load damages.'));
    } finally {
      setLoading(false);
    }
  }, [canView, tab, date, page, limit]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!canView) return;
    storeApi
      .get<{ autoApprove: boolean }>('/damages/settings')
      .then((r) => setAutoApprove(!!r.data?.autoApprove))
      .catch(() => {});
  }, [canView]);

  const setRowBusy = (id: string, on: boolean) =>
    setBusy((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  const act = async (rec: DamageRecord, action: 'approve' | 'delete') => {
    if (busy.has(rec._id)) return;
    if (action === 'delete' && !window.confirm(`Delete ${rec.damageNo}?`)) return;
    setRowBusy(rec._id, true);
    try {
      if (action === 'approve') {
        const res = await storeApi.post<DamageRecord>(`/damages/${rec._id}/approve`, {});
        toast.success(res.message || 'Approved');
      } else {
        await storeApi.del(`/damages/${rec._id}`);
        toast.success('Report deleted');
      }
      await load();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not update the report'));
    } finally {
      setRowBusy(rec._id, false);
    }
  };

  const toggleAuto = async (v: boolean) => {
    if (savingSetting) return;
    setSavingSetting(true);
    try {
      const r = await storeApi.put<{ autoApprove: boolean }>('/damages/settings', { autoApprove: v });
      setAutoApprove(!!r.data.autoApprove);
      toast.success(v ? 'New reports are approved at once' : 'Reports now wait for approval');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not save'));
    } finally {
      setSavingSetting(false);
    }
  };

  const exportCsv = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await downloadCsv('/damages/daily/export', { date }, `damages-${date}.csv`);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not export'));
    } finally {
      setExporting(false);
    }
  };

  if (!canView) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <NoAccessCard />
      </div>
    );
  }

  const rows = tab === 'daily' ? day?.rows || [] : list;
  const t = day?.totals;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <PageHeader
          title="Damaged Stock"
          subtitle="Daily list of broken, expired and missing items — with barcodes and loss at cost."
          actions={
            <>
              {tab === 'daily' && day && (
                <button type="button" onClick={() => printDamageList(day) || toast.error('Allow pop-ups to print')} className={secondaryBtn}>
                  <Printer className="h-4 w-4" />
                  Print
                </button>
              )}
              {tab === 'daily' && canExport && (
                <button type="button" onClick={exportCsv} disabled={exporting} className={secondaryBtn}>
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  CSV
                </button>
              )}
              {canCreate && (
                <button type="button" onClick={() => setShowReport(true)} className={primaryBtn}>
                  <Plus className="h-4 w-4" />
                  Report damage
                </button>
              )}
            </>
          }
        />

        {/* Tabs + date */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 text-sm">
            {(
              [
                ['daily', 'Daily list'],
                ['pending', 'Waiting approval'],
                ['all', 'All reports'],
              ] as [Tab, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setTab(k);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-md font-medium ${tab === k ? 'bg-honey-500 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === 'daily' && (
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setDate((d) => shiftDay(d, -1))} className={`${secondaryBtn} px-2`} aria-label="Previous day">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <input type="date" value={date} max={todayPKT()} onChange={(e) => e.target.value && setDate(e.target.value)} className={`${inputClass} w-auto`} aria-label="Day" />
              <button type="button" onClick={() => setDate((d) => shiftDay(d, 1))} disabled={date >= todayPKT()} className={`${secondaryBtn} px-2`} aria-label="Next day">
                <ChevronRight className="h-4 w-4" />
              </button>
              {date !== todayPKT() && (
                <button type="button" onClick={() => setDate(todayPKT())} className="ml-1 text-xs font-medium text-honey-700 hover:text-honey-800">
                  Today
                </button>
              )}
            </div>
          )}
        </div>

        {tab === 'daily' && t && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-3">
              <StatCard label="Reports" value={t.reports} hint={t.rejected ? `${t.rejected} rejected (not counted)` : undefined} />
              <StatCard label="Pieces damaged" value={t.pieces} />
              <StatCard label="Loss at cost" value={formatRs(t.loss, { decimals: 2 })} tone="red" hint={t.claimableLoss ? `${formatRs(t.claimableLoss)} claimable from vendors` : undefined} />
              <StatCard label="Waiting approval" value={t.pending} tone={t.pending ? 'amber' : 'default'} />
            </div>
            {day && day.byReason.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {day.byReason.map((r) => (
                  <span key={r.reason} className="px-2 py-0.5 rounded-full bg-white border border-gray-200 text-xs text-gray-700">
                    {r.label}: <strong>{r.pieces}</strong> pcs · {formatRs(r.loss)}
                  </span>
                ))}
              </div>
            )}
          </>
        )}

        {isSuperAdmin && (
          <div className={`${cardClass} px-4 py-3 mb-4`}>
            <Toggle
              checked={autoApprove}
              onChange={toggleAuto}
              disabled={savingSetting}
              label="Approve new reports automatically"
              hint="When on, stock is taken off as soon as a damage is reported (no manager check)."
            />
          </div>
        )}

        {loading && !rows.length ? (
          <LoadingCard text="Loading damages…" />
        ) : error ? (
          <ErrorCard message={error} onRetry={load} />
        ) : (
          <div className={`${cardClass} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {tab === 'daily' && <th className={thClass}>Barcode</th>}
                    <th className={thClass}>Item</th>
                    <th className={`${thClass} text-right`}>Qty</th>
                    <th className={thClass}>Where</th>
                    <th className={thClass}>Reason</th>
                    <th className={`${thClass} text-right`}>Loss</th>
                    <th className={thClass}>Vendor</th>
                    <th className={thClass}>Status</th>
                    <th className={`${thClass} text-right`}></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={tab === 'daily' ? 9 : 8} className="px-4 py-12 text-center text-sm text-gray-500">
                        <PackageX className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                        {tab === 'daily' ? 'No damage reported on this day.' : tab === 'pending' ? 'Nothing is waiting for approval.' : 'No damage reports yet.'}
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => {
                      const rowBusy = busy.has(r._id);
                      return (
                        <tr key={r._id} className={r.status === 'rejected' ? 'bg-gray-50/60 text-gray-400' : ''}>
                          {tab === 'daily' && (
                            <td className="px-3 sm:px-4 py-2.5">
                              {r.barcodeSvg ? <div className="w-32 h-10" dangerouslySetInnerHTML={{ __html: r.barcodeSvg }} /> : <span className="font-mono text-xs">{r.code}</span>}
                            </td>
                          )}
                          <td className="px-3 sm:px-4 py-2.5 text-sm">
                            <button type="button" onClick={() => setInsight({ productId: r.product, variantId: r.variantId })} className="text-left font-medium text-gray-900 hover:text-honey-700 max-w-[220px] truncate block">
                              {r.productName}
                            </button>
                            {r.variantLabel && <div className="text-xs text-gray-500">{r.variantLabel}</div>}
                            <div className="text-[11px] text-gray-500">
                              <span className="font-mono">{r.damageNo}</span> · {formatDate(r.date, tab === 'daily' ? false : true)}
                              {tab === 'daily' && ` ${new Date(r.date).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })}`}
                            </div>
                          </td>
                          <td className="px-3 sm:px-4 py-2.5 text-right text-sm font-semibold">{r.qty}</td>
                          <td className="px-3 sm:px-4 py-2.5 text-xs whitespace-nowrap">{r.location === 'shelf' ? r.shelfCode || 'Shelf' : 'Warehouse'}</td>
                          <td className="px-3 sm:px-4 py-2.5 text-xs">
                            <div className="font-medium">{reasonLabel(r.reason)}</div>
                            {r.description && <div className="text-gray-500 max-w-[220px]">{r.description}</div>}
                            {r.photos.length > 0 && (
                              <div className="mt-1 flex gap-1">
                                {r.photos.map((ph) => (
                                  <button key={ph} type="button" onClick={() => setPhotoView(photoUrl(ph))} className="h-8 w-8 rounded overflow-hidden border border-gray-200">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={photoUrl(ph)} alt="" className="h-8 w-8 object-cover" />
                                  </button>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-3 sm:px-4 py-2.5 text-right text-xs whitespace-nowrap">
                            <div className="font-semibold text-sm">{formatRs(r.totalLoss, { decimals: 2 })}</div>
                            <div className="text-gray-500">{formatRs(r.unitCost, { decimals: 2 })} / pc</div>
                          </td>
                          <td className="px-3 sm:px-4 py-2.5 text-xs">
                            {r.vendorName || '—'}
                            {r.claimable && <div className="text-[10px] font-medium text-blue-700">Claim from vendor</div>}
                          </td>
                          <td className="px-3 sm:px-4 py-2.5 text-xs whitespace-nowrap">
                            <StatusPill status={r.status} />
                            <div className="mt-0.5 text-[10px] text-gray-500">by {r.reportedByName || '—'}</div>
                            {r.status === 'approved' && r.approvedByName && <div className="text-[10px] text-gray-500">ok {r.approvedByName}</div>}
                            {r.status === 'rejected' && r.rejectReason && <div className="text-[10px] text-gray-500 max-w-[140px] truncate" title={r.rejectReason}>{r.rejectReason}</div>}
                          </td>
                          <td className="px-3 sm:px-4 py-2.5 text-right whitespace-nowrap">
                            {r.status === 'pending' && (
                              <div className="inline-flex items-center gap-1">
                                {canApprove && (
                                  <>
                                    <button type="button" onClick={() => act(r, 'approve')} disabled={rowBusy} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-60" title="Approve — take the stock off">
                                      {rowBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                      Approve
                                    </button>
                                    <button type="button" onClick={() => setRejecting(r)} disabled={rowBusy} className="p-1.5 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 disabled:opacity-60" title="Reject">
                                      <X className="h-4 w-4" />
                                    </button>
                                  </>
                                )}
                                {canDelete && (
                                  <button type="button" onClick={() => act(r, 'delete')} disabled={rowBusy} className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-60" title="Delete report">
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            )}
                            {r.status === 'rejected' && canDelete && (
                              <button type="button" onClick={() => act(r, 'delete')} disabled={rowBusy} className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-60" title="Delete report">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {tab !== 'daily' && meta && (
              <TablePagination page={meta.page} pages={meta.pages} total={meta.total} limit={limit} onPageChange={setPage} onLimitChange={setLimit} label="reports" loading={loading} />
            )}
          </div>
        )}
      </div>

      {showReport && (
        <ReportDamageModal
          autoApprove={autoApprove}
          onClose={() => setShowReport(false)}
          onSaved={(rec) => {
            setShowReport(false);
            setTab('daily');
            setDate(todayPKT());
            if (rec) load();
          }}
        />
      )}
      {rejecting && (
        <RejectModal
          record={rejecting}
          onClose={() => setRejecting(null)}
          onDone={() => {
            setRejecting(null);
            load();
          }}
        />
      )}
      {photoView && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setPhotoView(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoView} alt="Damage photo" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
      <ProductInsightPanel productId={insight?.productId || null} variantId={insight?.variantId || null} open={!!insight} onClose={() => setInsight(null)} />
    </div>
  );
}

function RejectModal({ record, onClose, onDone }: { record: DamageRecord; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await storeApi.post(`/damages/${record._id}/reject`, { reason: reason.trim() });
      toast.success(`${record.damageNo} rejected`);
      onDone();
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not reject'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      title={`Reject ${record.damageNo}`}
      subtitle={`${record.qty} × ${record.productName}`}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className={secondaryBtn}>
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={saving} className={primaryBtn}>
            {saving ? 'Rejecting…' : 'Reject report'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Why?" hint="Stock is not changed.">
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} className={inputClass} placeholder="e.g. Item is fine, can be sold" />
        </Field>
        <ErrorBox message={error} />
      </div>
    </Modal>
  );
}
