'use client';

// Shared admin pieces for /admin/till and /admin/reports/cash-closing:
// status badge, variance colours and the session detail (expected vs counted,
// bills, verify / dispute). Only rendered for `till_verify` users.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
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
  discounts?: { _id: string; orderNumber: string; createdAt: string; subtotal: number; discount: number; total: number; reason: string }[];
  expenses?: { _id: string; title: string; amount: number; paymentMethod: string; createdAt: string; shopUse: boolean }[];
}

/** Modal, or a plain full page (opened in its own tab from the cash closing report). */
function PageShell({
  title,
  subtitle,
  icon,
  footer,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  onClose?: () => void;
  busy?: boolean;
  wide?: boolean | 'xl';
}) {
  return (
    <div className="mx-auto max-w-7xl space-y-4 p-3 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-honey-100 text-honey-800">{icon}</span>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">{children}</div>
      {footer && <div className="flex flex-wrap justify-end gap-2">{footer}</div>}
    </div>
  );
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
export function SessionDetailModal({ id, onClose, onChanged, asPage = false }: { id: string; onClose: () => void; onChanged?: () => void; asPage?: boolean }) {
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
  const Shell = asPage ? PageShell : Modal;

  return (
    <>
      <Shell
        title={data ? `${data.sessionNo}` : 'Till session'}
        subtitle={data ? `${data.counterName || 'No counter'} · ${data.cashierName}` : undefined}
        icon={<Receipt className="h-5 w-5" />}
        onClose={onClose}
        busy={!!busy}
        wide="xl"
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
              // Sales as billed (discounts already off). The day's expenses come out of the cash.
              const expensesAmt = e?.expenses || 0;
              const discountAmt = (data.discounts || []).reduce((t, d) => t + d.discount, 0);
              const sysCash = e ? Math.round((e.cashSales + e.cashReceivedOnCredit - e.cashRefunds) * 100) / 100 : null;
              const sysCard = data.nonCash?.card ?? e?.card ?? 0;
              const sysBank = data.nonCash?.bank_transfer ?? e?.bankTransfer ?? 0;
              const rows: { label: string; entered: number | null; system: number | null; target?: number | null; hint?: string }[] = [
                {
                  label: 'Cash',
                  entered: data.dayCash ? data.dayCash.total : null,
                  system: sysCash,
                  target: sysCash != null ? Math.round((sysCash - expensesAmt) * 100) / 100 : null,
                  hint: expensesAmt ? 'after expenses' : undefined,
                },
                { label: 'POS machine (card)', entered: data.cardTotal ?? null, system: sysCard },
                { label: 'Bank transfer', entered: data.bankTransferTotal ?? null, system: sysBank },
              ];
              const sum = (k: 'entered' | 'system') => rows.reduce((t, r) => t + (r[k] || 0), 0);
              const shouldGive = Math.round((sum('system') - expensesAmt) * 100) / 100;
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
                    <table className="w-full text-sm">
                      <thead className="text-[11px] text-gray-500">
                        <tr>
                          <th className="py-1 text-left font-medium"></th>
                          <th className="py-1 text-right font-medium">Cashier gave</th>
                          <th className="py-1 text-right font-medium">Sales were</th>
                          <th className="py-1 text-right font-medium"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {rows.map((r) => (
                          <tr key={r.label}>
                            <td className="py-1.5 pr-2 text-gray-700">{r.label}</td>
                            <td className="py-1.5 text-right tabular-nums">{r.entered != null ? formatRs(r.entered) : '—'}</td>
                            <td className="py-1.5 text-right tabular-nums text-gray-600">{r.system != null ? formatRs(r.system) : '—'}</td>
                            <td className="py-1.5 pl-2 text-right text-xs tabular-nums">
                              {diffCell(r.entered, r.target !== undefined ? r.target : r.system)}
                              {r.hint && r.entered != null && <span className="block text-[10px] font-normal text-gray-400">{r.hint}</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="text-sm">
                        {discountAmt > 0 && (
                          <>
                            <tr className="border-t-2 border-gray-300">
                              <td className="py-1.5 pr-2 text-gray-600">Sales at full price</td>
                              <td />
                              <td className="py-1.5 text-right tabular-nums text-gray-600">{formatRs(sum('system') + discountAmt)}</td>
                              <td />
                            </tr>
                            <tr>
                              <td className="py-1.5 pr-2 text-gray-600">− Discounts ({(data.discounts || []).length})</td>
                              <td />
                              <td className="py-1.5 text-right tabular-nums text-rose-700">−{formatRs(discountAmt)}</td>
                              <td />
                            </tr>
                          </>
                        )}
                        <tr className={`font-semibold ${discountAmt > 0 ? '' : 'border-t-2 border-gray-300'}`}>
                          <td className="py-1.5 pr-2 text-gray-900">= Total sales</td>
                          <td className="py-1.5 text-right tabular-nums text-gray-900">{anyEntered ? formatRs(sum('entered')) : '—'}</td>
                          <td className="py-1.5 text-right tabular-nums text-gray-900">{formatRs(sum('system'))}</td>
                          <td />
                        </tr>
                        {expensesAmt > 0 && (
                          <tr>
                            <td className="py-1.5 pr-2 text-gray-600">− Expenses ({(data.expenses || []).length})</td>
                            <td />
                            <td className="py-1.5 text-right tabular-nums text-gray-700">−{formatRs(expensesAmt)}</td>
                            <td />
                          </tr>
                        )}
                        <tr className="border-t border-gray-300 bg-gray-50 font-bold">
                          <td className="py-2 pr-2 text-gray-900">= Rest (to hand over)</td>
                          <td className="py-2 text-right tabular-nums text-gray-900">{anyEntered ? formatRs(sum('entered')) : '—'}</td>
                          <td className="py-2 text-right tabular-nums text-gray-900">{formatRs(shouldGive)}</td>
                          <td className="py-2 pl-2 text-right text-xs tabular-nums">{anyEntered ? diffCell(sum('entered'), shouldGive) : <span className="text-gray-400">—</span>}</td>
                        </tr>
                      </tfoot>
                    </table>
                    {(() => {
                      // Cash short and card/bank over by about the same: payments saved under the wrong method.
                      const cashT = rows[0].target ?? rows[0].system;
                      const cashD = rows[0].entered != null && cashT != null ? rows[0].entered - cashT : 0;
                      const otherD = rows.slice(1).reduce((t, r) => t + (r.entered != null && r.system != null ? r.entered - r.system : 0), 0);
                      const mixed = Math.abs(cashD) >= 100 && Math.abs(otherD) >= 100 && Math.sign(cashD) !== Math.sign(otherD) && Math.abs(cashD + otherD) < 0.5 * Math.max(Math.abs(cashD), Math.abs(otherD));
                      return mixed ? (
                        <p className="mt-2 rounded-md bg-sky-50 px-2 py-1.5 text-xs text-sky-800">
                          Cash is {cashD < 0 ? 'short' : 'over'} and card / bank is {otherD > 0 ? 'over' : 'short'} by about the same. Some bills were probably saved with the wrong payment
                          type (e.g. card sale saved as cash).
                        </p>
                      ) : null;
                    })()}
                    {e && (e.cashReceivedOnCredit > 0 || e.cashRefunds > 0 || (e.expenses || 0) > 0) && (
                      <p className="mt-1 text-[11px] text-gray-500">
                        Cash should be = cash sales {formatRs(e.cashSales)}
                        {e.cashReceivedOnCredit > 0 ? ` + credit received ${formatRs(e.cashReceivedOnCredit)}` : ''}
                        {e.cashRefunds > 0 ? ` − refunds ${formatRs(e.cashRefunds)}` : ''}
                        {(e.expenses || 0) > 0 ? ` − expenses of the day ${formatRs(e.expenses || 0)}` : ''}
                      </p>
                    )}
                    {!isOpen && sum('system') === 0 && !anyEntered && (
                      <p className="mt-2 rounded-md bg-gray-50 px-2 py-1.5 text-xs text-gray-600">No sales on this till.</p>
                    )}
                    {!isOpen && data.closingCount && !data.dayCash && sum('system') > 0 && (
                      <p className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-800">The cashier has not entered the day&apos;s cash yet.</p>
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

            {/* Discounts and expenses */}
            {(() => {
              const disc = data.discounts || [];
              const exp = data.expenses || [];
              const discTotal = disc.reduce((t, d) => t + d.discount, 0);
              const money = exp.filter((x) => !x.shopUse);
              const cashExp = money.filter((x) => /cash/i.test(x.paymentMethod));
              const otherExp = money.filter((x) => !/cash/i.test(x.paymentMethod));
              const shopUse = exp.filter((x) => x.shopUse);
              const sumOf = (l: typeof exp) => l.reduce((t, x) => t + x.amount, 0);
              return (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <div className="rounded-lg border border-gray-200 p-3">
                    <div className="mb-2 flex items-baseline justify-between">
                      <p className="text-xs font-semibold uppercase text-gray-500">
                        Discounts given ({disc.length} {disc.length === 1 ? 'bill' : 'bills'})
                      </p>
                      <p className="text-lg font-bold tabular-nums text-rose-700">{formatRs(discTotal)}</p>
                    </div>
                    {disc.length === 0 ? (
                      <p className="text-sm text-gray-500">No discounts.</p>
                    ) : (
                      <table className="w-full text-xs">
                        <thead className="text-gray-500">
                          <tr>
                            <th className="py-1 text-left font-medium">Bill</th>
                            <th className="py-1 text-right font-medium">Price</th>
                            <th className="py-1 text-right font-medium">Discount</th>
                            <th className="py-1 text-right font-medium">Paid</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {disc.map((d) => (
                            <tr key={d._id}>
                              <td className="py-1.5 pr-2">
                                <span className="font-medium text-gray-800">{d.orderNumber}</span>
                                <span className="block text-[10px] text-gray-500">
                                  {formatTime(d.createdAt)}
                                  {d.reason ? ` · ${d.reason}` : ''}
                                </span>
                              </td>
                              <td className="py-1.5 text-right tabular-nums text-gray-600">{formatRs(d.subtotal)}</td>
                              <td className="py-1.5 text-right tabular-nums font-semibold text-rose-700">−{formatRs(d.discount)}</td>
                              <td className="py-1.5 text-right tabular-nums">{formatRs(d.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                  <div className="rounded-lg border border-gray-200 p-3">
                    <div className="mb-2 flex items-baseline justify-between">
                      <p className="text-xs font-semibold uppercase text-gray-500">Expenses of the day ({exp.length}) · taken off the cash</p>
                      <p className="text-lg font-bold tabular-nums text-gray-900">{formatRs(sumOf(money))}</p>
                    </div>
                    {exp.length === 0 ? (
                      <p className="text-sm text-gray-500">No expenses.</p>
                    ) : (
                      <>
                        <ul className="divide-y divide-gray-100 text-xs">
                          {exp.map((x) => (
                            <li key={x._id} className="flex items-start justify-between gap-2 py-1.5">
                              <span>
                                <span className="font-medium text-gray-800">{x.title}</span>
                                <span className="block text-[10px] text-gray-500">
                                  {formatTime(x.createdAt)} · {x.shopUse ? 'shop use (own stock, no money)' : x.paymentMethod || '—'}
                                </span>
                              </span>
                              <span className={`tabular-nums font-semibold ${x.shopUse ? 'text-gray-400' : 'text-gray-900'}`}>{formatRs(x.amount)}</span>
                            </li>
                          ))}
                        </ul>
                        <p className="mt-2 text-[11px] text-gray-500">
                          Cash {formatRs(sumOf(cashExp))} · other {formatRs(sumOf(otherExp))}
                          {shopUse.length ? ` · shop use ${formatRs(sumOf(shopUse))} (not money)` : ''}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Result of the day: cashier gave vs sales were (cash after expenses + POS + bank) */}
            {(() => {
              const ex = data.expected || data.liveExpected || null;
              const sys =
                (ex ? ex.cashSales + ex.cashReceivedOnCredit - ex.cashRefunds - (ex.expenses || 0) : 0) +
                (data.nonCash?.card ?? ex?.card ?? 0) +
                (data.nonCash?.bank_transfer ?? ex?.bankTransfer ?? 0);
              if (!data.dayCash && data.cardTotal == null && data.bankTransferTotal == null) return null;
              // Cash left in the drawer above the float is sales cash too.
              const drawerTotal = data.drawerCount?.total ?? data.closingCount?.total ?? 0;
              const extra = Math.round((drawerTotal - (data.openingFloat?.total || 0)) * 100) / 100;
              const gave = (data.dayCash?.total || 0) + extra + (data.cardTotal || 0) + (data.bankTransferTotal || 0);
              const d = Math.round((gave - sys) * 100) / 100;
              const ok = Math.abs(d) < 1;
              return (
                <div className={`rounded-lg px-4 py-3 ${ok ? 'bg-green-50 ring-1 ring-green-200' : d < 0 ? 'bg-red-50 ring-1 ring-red-200' : 'bg-amber-50 ring-1 ring-amber-200'}`}>
                  <p className={`text-2xl font-bold tabular-nums ${ok ? 'text-green-700' : d < 0 ? 'text-red-700' : 'text-amber-800'}`}>
                    {ok ? 'All sales match' : `${d < 0 ? 'Short' : 'Over'} ${formatRs(Math.abs(d))}`}
                  </p>
                  <p className="text-sm text-gray-600">
                    Cashier gave {formatRs(gave)} · sales were {formatRs(Math.round(sys * 100) / 100)}
                  </p>
                  {Math.abs(extra) >= 1 && (
                    <p className="text-[11px] text-gray-500">
                      Includes {formatRs(Math.abs(extra))} {extra > 0 ? 'extra' : 'missing'} in the drawer (counted {formatRs(drawerTotal)}, float {formatRs(data.openingFloat?.total || 0)})
                    </p>
                  )}
                </div>
              );
            })()}

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
      </Shell>

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
