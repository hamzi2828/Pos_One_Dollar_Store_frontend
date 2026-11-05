'use client';

// Shared admin pieces for /admin/till and /admin/reports/cash-closing:
// status badge, variance colours and the session detail (expected vs counted,
// bills, verify / dispute). Only rendered for `till_verify` users.

import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, AlertTriangle, Loader2, Lock, ShieldCheck, ShieldAlert, Clock, Receipt } from 'lucide-react';
import { storeApi, apiErrorMessage, formatRs, formatDate } from '@/lib/storeApi';
import { Modal, Field, ErrorBox, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { useAccess } from '@/context/AccessContext';
import {
  CloseTillModal,
  formatTime,
  type CashCount,
  type TillExpected,
  type TillSession,
  type TillSessionStatus,
} from '@/components/store/TillStatusBar';

export interface TillBill {
  _id: string;
  orderNumber: string;
  createdAt: string;
  customerName: string;
  total: number;
  paymentMethod: string;
  orderStatus: string;
  paymentStatus: string;
  pendingAmount: number;
  cashSale: number;
  cashCredit: number;
  nonCash: number;
  cashRefund: number;
}

export interface TillDetail extends TillSession {
  bills: TillBill[];
  voided: { _id: string; orderNumber: string; total: number; paymentMethod: string; createdAt: string; deletedAt: string }[];
  nonCash: { card: number; bank_transfer: number };
  liveExpected: TillExpected | null;
  verifiedBy?: { firstName?: string; lastName?: string } | string | null;
}

const STATUS_STYLE: Record<TillSessionStatus, { label: string; cls: string }> = {
  open: { label: 'Open', cls: 'bg-green-50 text-green-700 border-green-200' },
  closed: { label: 'To verify', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  verified: { label: 'Verified', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  disputed: { label: 'Disputed', cls: 'bg-red-50 text-red-700 border-red-200' },
};

/** Cashier wording: "closed" = waiting for the admin. */
export function StatusBadge({ status, cashierView }: { status: TillSessionStatus; cashierView?: boolean }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.closed;
  const label = cashierView && status === 'closed' ? 'Awaiting check' : s.label;
  return <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold border rounded-full whitespace-nowrap ${s.cls}`}>{label}</span>;
}

export function varianceClass(v: number | null | undefined): string {
  if (v === null || v === undefined) return 'text-gray-400';
  if (Math.abs(v) < 1) return 'text-green-700';
  return v < 0 ? 'text-red-600' : 'text-amber-600';
}

export function varianceLabel(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  if (Math.abs(v) < 1) return 'Matches';
  return v < 0 ? `Short ${formatRs(-v)}` : `Over ${formatRs(v)}`;
}

const personName = (p: unknown): string => {
  if (!p || typeof p !== 'object') return '';
  const o = p as { firstName?: string; lastName?: string };
  return `${o.firstName || ''} ${o.lastName || ''}`.trim();
};

const ACTION_LABEL: Record<string, string> = {
  open: 'Opened',
  close: 'Closed (blind count)',
  close_by_admin: 'Closed by admin',
  verify: 'Verified',
  dispute: 'Disputed',
};

function CountTable({ count }: { count: CashCount | null }) {
  const rows = Object.entries(count?.denominations || {})
    .map(([v, c]) => [Number(v), Number(c)] as const)
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[0] - a[0]);
  if (!rows.length) return <p className="text-xs text-gray-500">Nothing counted</p>;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-gray-600">
      {rows.map(([v, c]) => (
        <span key={v} className="tabular-nums">
          Rs {v.toLocaleString('en-PK')} × {c} = <strong className="text-gray-800">{formatRs(v * c)}</strong>
        </span>
      ))}
    </div>
  );
}

/** Session detail for verifiers: expected vs counted, bills, verify / dispute. */
export function SessionDetailModal({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged?: () => void }) {
  const { can, access } = useAccess();
  const canEdit = can('till_verify', 'edit');
  const [data, setData] = useState<TillDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'verify' | 'dispute' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const lockRef = useRef(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await storeApi.get<TillDetail>(`/till-sessions/${id}`);
      setData(res.data);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load this till.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const review = async (action: 'verify' | 'dispute') => {
    if (lockRef.current || !data) return;
    if (action === 'dispute' && !note.trim()) {
      setActionError('Write what is wrong before disputing.');
      return;
    }
    lockRef.current = true;
    setBusy(action);
    setActionError(null);
    try {
      await storeApi.post(`/till-sessions/${data._id}/${action}`, { note: note.trim() || undefined });
      toast.success(action === 'verify' ? 'Cash closing verified' : 'Cash closing disputed');
      setNote('');
      await load();
      onChanged?.();
    } catch (e) {
      setActionError(apiErrorMessage(e, 'Could not save.'));
    } finally {
      lockRef.current = false;
      setBusy(null);
    }
  };

  const e = data?.expected || data?.liveExpected || null;
  const isOpen = data?.status === 'open';
  const own = !!data && !!access?.user?.id && String(data.cashier) === String(access.user.id) && !access.isSuperAdmin;
  const canReview = canEdit && !!data && (data.status === 'closed' || data.status === 'disputed') && !own;

  return (
    <>
      <Modal
        title={data ? `${data.sessionNo}` : 'Till session'}
        subtitle={data ? `${data.counterName || 'No counter'} · ${data.cashierName}` : undefined}
        icon={<Receipt className="h-5 w-5" />}
        onClose={onClose}
        busy={!!busy}
        wide
        footer={
          canReview ? (
            <>
              <button type="button" onClick={() => review('dispute')} disabled={!!busy} className={secondaryBtn}>
                {busy === 'dispute' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4 text-red-600" />}
                Dispute
              </button>
              <button type="button" onClick={() => review('verify')} disabled={!!busy} className={primaryBtn}>
                {busy === 'verify' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Verify
              </button>
            </>
          ) : isOpen && canEdit ? (
            <button type="button" onClick={() => setClosing(true)} className={secondaryBtn}>
              <Lock className="h-4 w-4" /> Close this till for the cashier
            </button>
          ) : undefined
        }
      >
        {loading && !data ? (
          <div className="py-10 text-center">
            <Loader2 className="h-6 w-6 text-honey-700 animate-spin mx-auto" />
          </div>
        ) : error ? (
          <ErrorBox message={error} />
        ) : data ? (
          <div className="space-y-5">
            {/* Header facts */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
              <StatusBadge status={data.status} />
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> {formatDate(data.openedAt, true)}
                {data.closedAt ? ` → ${formatTime(data.closedAt)}` : ''}
              </span>
              {data.lateOpen && <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Late open</span>}
              {data.lateClose && <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Late close</span>}
            </div>

            {/* Till (float) and sales, kept apart */}
            {(() => {
              const floatAmt = data.openingFloat?.total ?? e?.float ?? 0;
              const drawer = data.drawerCount ?? (data.dayCash ? null : data.closingCount);
              const drawerDiff = drawer ? Math.round((drawer.total - floatAmt) * 100) / 100 : null;
              const sysCash = e ? Math.round((e.cashSales + e.cashReceivedOnCredit - e.cashRefunds) * 100) / 100 : null;
              const sysCard = data.nonCash?.card ?? e?.card ?? 0;
              const sysBank = data.nonCash?.bank_transfer ?? e?.bankTransfer ?? 0;
              const rows: { label: string; entered: number | null; system: number | null }[] = [
                { label: 'Cash', entered: data.dayCash ? data.dayCash.total : null, system: sysCash },
                { label: 'POS machine (card)', entered: data.cardTotal ?? null, system: sysCard },
                { label: 'Bank transfer', entered: data.bankTransferTotal ?? null, system: sysBank },
              ];
              const sum = (k: 'entered' | 'system') => rows.reduce((t, r) => t + (r[k] || 0), 0);
              const anyEntered = rows.some((r) => r.entered != null);
              const diffCell = (entered: number | null, system: number | null) => {
                if (entered == null || system == null) return <span className="text-gray-400">—</span>;
                const d = Math.round((entered - system) * 100) / 100;
                if (Math.abs(d) < 1) return <span className="font-semibold text-green-600">OK</span>;
                return <span className={`font-semibold ${d < 0 ? 'text-red-600' : 'text-amber-700'}`}>{d < 0 ? 'Short' : 'Over'} {formatRs(Math.abs(d))}</span>;
              };
              return (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
                  {/* Till */}
                  <div className="rounded-lg border border-gray-200 p-3 lg:col-span-2">
                    <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Till (change money)</p>
                    <dl className="space-y-1 text-sm">
                      <Row label="Opening float" value={formatRs(floatAmt)} />
                      <Row label="Left in the drawer" value={drawer ? formatRs(drawer.total) : isOpen ? 'Open' : '—'} strong />
                    </dl>
                    {drawerDiff != null && (
                      <p className={`mt-1 text-sm font-semibold ${Math.abs(drawerDiff) < 1 ? 'text-green-600' : drawerDiff < 0 ? 'text-red-600' : 'text-amber-700'}`}>
                        {Math.abs(drawerDiff) < 1 ? 'Float is complete' : `${drawerDiff < 0 ? 'Short' : 'Over'} ${formatRs(Math.abs(drawerDiff))}`}
                      </p>
                    )}
                    {drawer && (
                      <div className="mt-2">
                        <CountTable count={drawer} />
                      </div>
                    )}
                  </div>

                  {/* Sales */}
                  <div className="rounded-lg border border-gray-200 p-3 lg:col-span-3">
                    <p className="mb-2 text-xs font-semibold uppercase text-gray-500">{isOpen ? 'Sales so far' : 'Sales of the day'}</p>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="text-[11px] uppercase text-gray-500">
                          <tr>
                            <th className="py-1 text-left font-medium"></th>
                            <th className="py-1 text-right font-medium">Cashier</th>
                            <th className="py-1 text-right font-medium">System</th>
                            <th className="py-1 text-right font-medium">Difference</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {rows.map((r) => (
                            <tr key={r.label}>
                              <td className="py-1.5 pr-2 text-gray-700">{r.label}</td>
                              <td className="py-1.5 text-right tabular-nums">{r.entered != null ? formatRs(r.entered) : '—'}</td>
                              <td className="py-1.5 text-right tabular-nums text-gray-600">{r.system != null ? formatRs(r.system) : '—'}</td>
                              <td className="py-1.5 text-right tabular-nums">{diffCell(r.entered, r.system)}</td>
                            </tr>
                          ))}
                          <tr className="border-t-2 border-gray-200 font-semibold">
                            <td className="py-1.5 pr-2">Total sales</td>
                            <td className="py-1.5 text-right tabular-nums">{anyEntered ? formatRs(sum('entered')) : '—'}</td>
                            <td className="py-1.5 text-right tabular-nums">{formatRs(sum('system'))}</td>
                            <td className="py-1.5 text-right tabular-nums">{anyEntered ? diffCell(sum('entered'), sum('system')) : <span className="text-gray-400">—</span>}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    {e && (e.cashReceivedOnCredit > 0 || e.cashRefunds > 0) && (
                      <p className="mt-1 text-[11px] text-gray-500">
                        System cash = sales {formatRs(e.cashSales)} + credit received {formatRs(e.cashReceivedOnCredit)} − refunds {formatRs(e.cashRefunds)}
                      </p>
                    )}
                    {!isOpen && data.closingCount && !data.dayCash && (
                      <p className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-800">The cashier has not entered the day&apos;s cash yet.</p>
                    )}
                    {!isOpen && data.variance != null && (
                      <p className={`mt-2 text-sm font-semibold ${varianceClass(data.variance)}`}>Cash result (till + cash): {varianceLabel(data.variance)}</p>
                    )}
                  </div>
                </div>
              );
            })()}

            {data.liveExpected && !isOpen && (
              <div className="flex items-start gap-2 p-3 text-xs bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                Bills changed after this till was closed (refund / delete). Expected now: {formatRs(data.liveExpected.expectedCash)}.
              </div>
            )}

            {(data.closeNote || data.openNote || data.verifyNote) && (
              <div className="text-xs space-y-1 text-gray-600">
                {data.openNote && <p><strong>Open note:</strong> {data.openNote}</p>}
                {data.closeNote && <p><strong>Close note:</strong> {data.closeNote}</p>}
                {data.verifyNote && <p><strong>Admin note:</strong> {data.verifyNote}</p>}
              </div>
            )}

            {/* Bills */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Bills in this till ({data.bills.length})</p>
              {data.bills.length === 0 ? (
                <p className="text-sm text-gray-500">No payments taken.</p>
              ) : (
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50 text-gray-500">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Bill</th>
                        <th className="px-3 py-2 text-left font-medium">Time</th>
                        <th className="px-3 py-2 text-right font-medium">Total</th>
                        <th className="px-3 py-2 text-left font-medium">Method</th>
                        <th className="px-3 py-2 text-right font-medium">Cash in</th>
                        <th className="px-3 py-2 text-right font-medium">Refund</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.bills.map((b) => (
                        <tr key={b._id}>
                          <td className="px-3 py-1.5 font-medium text-gray-800 whitespace-nowrap">
                            {b.orderNumber}
                            {b.orderStatus === 'refunded' && <span className="ml-1 text-red-600">(refunded)</span>}
                            {b.pendingAmount > 0 && <span className="ml-1 text-amber-600">(due {formatRs(b.pendingAmount)})</span>}
                          </td>
                          <td className="px-3 py-1.5 text-gray-600 whitespace-nowrap">{formatDate(b.createdAt, true)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{formatRs(b.total)}</td>
                          <td className="px-3 py-1.5 text-gray-600 capitalize">{b.paymentMethod.replace('_', ' ')}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">
                            {formatRs(b.cashSale + b.cashCredit)}
                            {b.cashCredit > 0 && <span className="block text-[10px] text-gray-500">credit {formatRs(b.cashCredit)}</span>}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-red-600">{b.cashRefund ? `−${formatRs(b.cashRefund)}` : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {data.voided.length > 0 && (
                <div className="mt-2 p-2.5 text-xs bg-red-50 border border-red-200 rounded-lg text-red-800">
                  <strong>Deleted bills in this shift (not counted):</strong>{' '}
                  {data.voided.map((v) => `${v.orderNumber} (${formatRs(v.total)})`).join(', ')}
                </div>
              )}
            </div>

            {/* History */}
            {!!data.history?.length && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">History</p>
                <ul className="space-y-1 text-xs text-gray-600">
                  {data.history.map((h, i) => (
                    <li key={i} className="flex flex-wrap gap-x-2">
                      <span className="text-gray-400 whitespace-nowrap">{formatDate(h.at, true)}</span>
                      <span className="font-medium text-gray-800">{ACTION_LABEL[h.action] || h.action}</span>
                      {personName(h.by) && <span>by {personName(h.by)}</span>}
                      {h.note && <span className="text-gray-500">— {h.note}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {canReview && (
              <Field label="Note" hint="Required to dispute. The cashier is told the result and sees this note.">
                <textarea
                  value={note}
                  onChange={(ev) => setNote(ev.target.value)}
                  rows={2}
                  maxLength={1000}
                  disabled={!!busy}
                  className={inputClass}
                  placeholder="e.g. Rs 100 short, cashier informed"
                />
              </Field>
            )}
            {own && (data.status === 'closed' || data.status === 'disputed') && (
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> This is your own till — another admin must verify it.
              </p>
            )}
            <ErrorBox message={actionError} />
          </div>
        ) : null}
      </Modal>

      {closing && data && (
        <CloseTillModal
          title="Close till for the cashier"
          session={data}
          onClose={() => setClosing(false)}
          onClosed={async () => {
            setClosing(false);
            await load();
            onChanged?.();
          }}
        />
      )}
    </>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className={strong ? 'font-semibold text-gray-900' : 'text-gray-600'}>{label}</dt>
      <dd className={`tabular-nums ${strong ? 'font-bold text-gray-900' : 'text-gray-800'}`}>{value}</dd>
    </div>
  );
}
