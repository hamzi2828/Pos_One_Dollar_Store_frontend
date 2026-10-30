'use client';

// Purchase trip: Buy (vendor bills: amount, boxes, paid now; items optional)
// -> Send to warehouse -> Receive goods (check boxes/packs, unpack & enter) -> Done.
// After "Send to warehouse" the trip costs, builty and details lock, but vendor
// bills can still be added (owner keeps buying for the same trip); new bills show
// up in Receive Goods. Bills already being unpacked are locked by the backend (409).
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { AlertCircle, ArrowLeft, Ban, Edit2, History, Loader2, PackageCheck, Plus, RotateCcw, Truck } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage, formatDate, formatRs } from '@/lib/storeApi';
import { LoadingCard, NoAccessCard, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { purchasingApi } from '../../_shared/purchasingApi';
import { Card, Disclosure, PhotoStrip, POStatusBadge, StatTile, StepStrip, billTotalOf, paidOf } from '../../_shared/ui';
import type { AllocationMethod, BillWarehouseStatus, Costing, POBill, POMeta, ProductUnit, PurchaseOrder } from '../../_shared/types';
import BillCard from '../_components/BillCard';
import BillModal from '../_components/BillModal';
import { ChargesCard, CostingCard, SuggestedItems } from '../_components/PoPanels';
import { CloseModal, DetailsModal, NewProductModal } from '../_components/PoModals';

const STEPS = ['Buy', 'Send to warehouse', 'Receive goods', 'Done'];
const TRIP_STATUS_KEYS = ['buy', 'send', 'receive', 'done'] as const;
/** Put ?status=<key> in the URL without reloading (other params kept). */
const setUrlStatus = (key: string) => {
  const q = new URLSearchParams(window.location.search);
  q.set('status', key);
  window.history.replaceState(window.history.state, '', `${window.location.pathname}?${q.toString()}`);
};

/** Which step a trip is at (index into STEPS; STEPS.length = all done). */
function tripStep(po: PurchaseOrder) {
  if (po.status === 'received') return STEPS.length;
  if (po.status === 'closed' || po.status === 'receiving') return 2;
  const ready = po.bills.length > 0 && po.bills.every((b) => billTotalOf(b) > 0) && po.bills.some((b) => b.cartons > 0);
  return ready ? 1 : 0;
}

export default function PurchaseTripPage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-6"><LoadingCard text="Loading purchase trip…" /></div>}>
      <Workspace />
    </Suspense>
  );
}

function Workspace() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const { can } = useAccess();
  const canView = can('purchase_orders', 'view');

  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [meta, setMeta] = useState<POMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [costing, setCosting] = useState<Costing | null>(null);
  const [costLoading, setCostLoading] = useState(false);
  const [costError, setCostError] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<ProductUnit[]>([]);
  const [billModal, setBillModal] = useState<{ open: boolean; bill: POBill | null }>({ open: false, bill: null });
  const [newProductBill, setNewProductBill] = useState<POBill | null>(null);
  const [showClose, setShowClose] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const costSeq = useRef(0);
  const lock = useRef(false);

  const loadCosting = useCallback(async () => {
    const my = ++costSeq.current;
    setCostLoading(true);
    setCostError(null);
    try {
      const c = await purchasingApi.costing(id);
      if (my === costSeq.current) setCosting(c);
    } catch (e) {
      if (my === costSeq.current) setCostError(apiErrorMessage(e, 'Could not work out the cost per piece.'));
    } finally {
      if (my === costSeq.current) setCostLoading(false);
    }
  }, [id]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, m] = await Promise.all([purchasingApi.get(id), purchasingApi.meta()]);
      setPo(p);
      setMeta(m);
      loadCosting();
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load the purchase trip.'));
    } finally {
      setLoading(false);
    }
  }, [id, loadCosting]);

  useEffect(() => {
    if (canView) load();
  }, [load, canView]);

  // Suggested items from the demand report (?productIds=a,b)
  const productIds = params.get('productIds') || '';
  useEffect(() => {
    const ids = productIds.split(',').map((s) => s.trim()).filter(Boolean);
    if (!ids.length || !canView) return;
    purchasingApi.productsByIds(ids).then(setSuggested).catch(() => setSuggested([]));
  }, [productIds, canView]);

  // The step is kept in the URL (?status=buy|send|receive|done). Opening a link with
  // ?status=buy scrolls to the vendor bills; otherwise the URL shows where the trip is.
  const urlDone = useRef(false);
  useEffect(() => {
    if (!po || urlDone.current) return;
    urlDone.current = true;
    const q = new URLSearchParams(window.location.search);
    const asked = q.get('status');
    if (asked && TRIP_STATUS_KEYS.includes(asked as (typeof TRIP_STATUS_KEYS)[number])) {
      if (asked === 'buy') setTimeout(() => document.getElementById('trip-bills')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
      return;
    }
    setUrlStatus(TRIP_STATUS_KEYS[Math.min(tripStep(po), TRIP_STATUS_KEYS.length - 1)]);
  }, [po]);

  /** Every change returns the saved trip; refresh the cost preview after it. */
  const applyPO = useCallback(
    (next: PurchaseOrder) => {
      // Write responses carry no receipt summary: keep the loaded one.
      setPo((prev) => ({ ...next, grn: next.grn ?? prev?.grn }));
      loadCosting();
    },
    [loadCosting],
  );

  if (!canView) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <NoAccessCard />
      </div>
    );
  }
  if (loading && !po) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <LoadingCard text="Loading purchase trip…" />
      </div>
    );
  }
  if (error || !po) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="bg-white rounded-xl shadow-sm border border-red-200 text-center py-10 px-4">
          <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-red-700 mb-4">{error || 'Purchase trip not found.'}</p>
          <div className="flex justify-center gap-2">
            <Link href="/admin/purchasing/orders" className={secondaryBtn}>
              Back to list
            </Link>
            <button onClick={load} className={primaryBtn}>
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isOpen = po.status === 'open';
  const editable = isOpen && can('purchase_orders', 'edit');
  /** Vendor bills stay open for adding/editing until the trip is fully received. */
  const sent = po.status === 'closed' || po.status === 'receiving';
  const canBuy = (isOpen || sent) && can('purchase_orders', 'edit');
  const grnPending = !po.grn || po.grn.status === 'pending';
  const canCancel = can('purchase_orders', 'delete') && (isOpen || (po.status === 'closed' && grnPending));
  const canReopen = can('purchase_orders', 'edit') && po.status === 'closed' && grnPending;
  const canCreateProduct = can('products', 'create');
  const step = tripStep(po);
  const goods = po.bills.reduce((s, b) => s + billTotalOf(b), 0);
  const paid = po.bills.reduce((s, b) => s + paidOf(b), 0);
  const boxes = po.bills.reduce((s, b) => s + (b.cartons || 0), 0);
  const canReceive = !!po.goodsReceipt && can('goods_receiving', 'view');
  /** Warehouse progress per vendor bill, shown on each bill card once the trip is sent. */
  const warehouseByBill = new Map<string, BillWarehouseStatus>(
    sent || po.status === 'received' ? (po.grn?.byBill || []).map((r) => [r.bill, r]) : [],
  );

  const act = async (key: 'cancel' | 'reopen', fn: (reason: string) => Promise<unknown>, question: string, done: string, fail: string) => {
    if (lock.current) return;
    const reason = window.prompt(question);
    if (reason === null) return;
    lock.current = true;
    setBusy(key);
    try {
      await fn(reason);
      toast.success(done);
      await load();
    } catch (e) {
      toast.error(apiErrorMessage(e, fail));
    } finally {
      lock.current = false;
      setBusy(null);
    }
  };

  const doCancel = () =>
    act(
      'cancel',
      (r) => purchasingApi.cancel(po._id, r),
      `Cancel ${po.poNumber}?\nThe vendor bills and payments made at the market will be taken out of the vendor accounts.\n\nReason (optional):`,
      'Trip cancelled',
      'Could not cancel.',
    );
  const doReopen = () =>
    act(
      'reopen',
      (r) => purchasingApi.reopen(po._id, r),
      `Reopen ${po.poNumber} to fix it?\nThe vendor bills stay in the vendor accounts; any change you make updates them.\n\nReason (optional):`,
      'Trip reopened',
      'Could not reopen.',
    );

  const setMethod = async (m: AllocationMethod) => {
    try {
      applyPO(await purchasingApi.update(po._id, { allocationMethod: m }));
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not change it.'));
    }
  };

  const sendBtn = editable && (
    <button className={primaryBtn} onClick={() => setShowClose(true)} disabled={!po.bills.length}>
      <Truck className="h-4 w-4" /> Send to warehouse
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
          <div className="min-w-0">
            <Link href="/admin/purchasing/orders" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mb-1">
              <ArrowLeft className="h-3.5 w-3.5" /> Purchase trips
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">{po.poNumber}</h1>
              <POStatusBadge status={po.status} />
            </div>
            <p className="mt-0.5 text-xs sm:text-sm text-gray-500">
              Buyer {po.buyerName || '—'} · started {formatDate(po.createdAt)}
              {po.expectedArrival && ` · arriving ${formatDate(po.expectedArrival)}`}
            </p>
            {po.notes && <p className="mt-1 text-xs text-gray-600">{po.notes}</p>}
            {po.status === 'cancelled' && <p className="mt-1 text-xs text-red-600">Cancelled{po.cancelReason ? `: ${po.cancelReason}` : ''}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {editable && (
              <button className={secondaryBtn} onClick={() => setShowDetails(true)}>
                <Edit2 className="h-4 w-4" /> Details
              </button>
            )}
            {canReopen && (
              <button className={secondaryBtn} onClick={doReopen} disabled={!!busy}>
                {busy === 'reopen' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} {busy === 'reopen' ? 'Reopening…' : 'Reopen'}
              </button>
            )}
            {canCancel && (
              <button className={`${secondaryBtn} !text-red-600`} onClick={doCancel} disabled={!!busy}>
                {busy === 'cancel' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />} {busy === 'cancel' ? 'Cancelling…' : 'Cancel trip'}
              </button>
            )}
            {sendBtn}
          </div>
        </div>

        {po.status !== 'cancelled' && (
          <StepStrip
            steps={STEPS}
            current={step}
            onPick={(i) => {
              setUrlStatus(TRIP_STATUS_KEYS[i]);
              document.getElementById(i === 0 ? 'trip-bills' : 'trip-sent')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          />
        )}

        {/* What to do next */}
        {po.status === 'open' && (
          <p className="text-xs sm:text-sm text-gray-600">
            {po.bills.length === 0
              ? 'Add a bill for every vendor you buy from: bill amount, boxes/packs and what you paid.'
              : step === 1
                ? 'All bills have an amount. When the goods leave the market, press “Send to warehouse”.'
                : 'Every bill needs a bill amount and the number of boxes/packs.'}
          </p>
        )}

        {/* Totals */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          <StatTile label="Vendor bills" value={po.bills.length} />
          <StatTile label="Boxes/packs" value={boxes} />
          <StatTile label="Bills total" value={formatRs(goods)} />
          <StatTile label="Paid now" value={formatRs(paid)} tone="green" />
          <StatTile label="Still owed" value={formatRs(Math.max(0, goods - paid))} tone="amber" />
          <StatTile label="Trip costs" value={formatRs(po.totals.charges)} sub={`All in ${formatRs(goods + po.totals.charges)}`} />
        </div>

        {/* After sending: where the goods are */}
        {!isOpen && po.status !== 'cancelled' && (
          <div id="trip-sent" className="scroll-mt-4">
          <Card
            title={
              <span className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-honey-700" /> Sent to warehouse
              </span>
            }
            actions={
              canReceive ? (
                <Link href={`/admin/purchasing/receiving/${po.goodsReceipt}?status=receive`} className={primaryBtn}>
                  <PackageCheck className="h-4 w-4" /> {po.status === 'received' ? 'View receiving' : 'Open in Receive Goods'}
                </Link>
              ) : null
            }
          >
            <p className="text-sm text-gray-700 mb-2">
              {po.status === 'closed' && 'Waiting for the boxes/packs to be checked at the warehouse.'}
              {po.status === 'receiving' && 'Boxes/packs are being unpacked and entered.'}
              {po.status === 'received' && `All done${po.receivedAt ? ` on ${formatDate(po.receivedAt)}` : ''}. Goods are in the warehouse or on shelves.`}
              {po.grn?.receiverName && ` Receiver: ${po.grn.receiverName}.`}
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-600 mb-2">
              <span>Boxes/packs: {po.builty?.cartons || boxes}</span>
              {po.builty?.builtyNo && <span>Builty: {po.builty.builtyNo}</span>}
              {po.builty?.transporter && <span>Transporter: {po.builty.transporter}</span>}
              {po.builty?.freight > 0 && <span>Freight: {formatRs(po.builty.freight)}</span>}
              <span>Sent: {formatDate(po.closedAt, true)}</span>
            </div>
            <PhotoStrip photos={po.builty?.photos || []} />
          </Card>
          </div>
        )}

        {editable && suggested.length > 0 && <SuggestedItems po={po} units={suggested} onChange={applyPO} onDismiss={() => setSuggested([])} />}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
          <div id="trip-bills" className="xl:col-span-2 space-y-4 scroll-mt-4">
            {sent && (
              <p className="text-xs sm:text-sm text-gray-600">
                {canBuy
                  ? 'Sent to the warehouse. You can still add more vendor bills; new ones show up there to check and unpack.'
                  : 'Sent to the warehouse. These are the vendor bills on this trip.'}
              </p>
            )}
            {/* Same button above the bills too, so a long list needs no scrolling (owner, 2026-10-30). */}
            {canBuy && po.bills.length > 0 && (
              <button className={`${secondaryBtn} w-full border-dashed !py-3`} onClick={() => setBillModal({ open: true, bill: null })}>
                <Plus className="h-4 w-4" /> Add another vendor bill
              </button>
            )}
            {po.bills.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-dashed border-gray-300 text-center py-10 px-4">
                <p className="text-sm text-gray-600 mb-3">No vendor bills yet. Add one bill for each vendor you buy from on this trip.</p>
                {canBuy && (
                  <button className={primaryBtn} onClick={() => setBillModal({ open: true, bill: null })}>
                    <Plus className="h-4 w-4" /> Add vendor bill
                  </button>
                )}
              </div>
            ) : (
              po.bills.map((bill) => (
                <BillCard
                  key={bill._id}
                  poId={po._id}
                  bill={bill}
                  warehouse={warehouseByBill.get(bill._id)}
                  editable={canBuy}
                  onChange={applyPO}
                  onEdit={() => setBillModal({ open: true, bill })}
                  onNewProduct={canBuy && canCreateProduct ? () => setNewProductBill(bill) : undefined}
                />
              ))
            )}
            {canBuy && po.bills.length > 0 && (
              <button className={`${secondaryBtn} w-full border-dashed !py-3`} onClick={() => setBillModal({ open: true, bill: null })}>
                <Plus className="h-4 w-4" /> Add another vendor bill
              </button>
            )}
            {editable && po.bills.length > 0 && <div className="sm:hidden [&>button]:w-full [&>button]:!py-3">{sendBtn}</div>}
            {canBuy && !canCreateProduct && (
              <p className="text-[11px] text-gray-500">
                Product not in the list? Ask someone who can create products, or{' '}
                <Link href="/admin/products/create" target="_blank" className="underline">
                  open the product form
                </Link>
                .
              </p>
            )}
          </div>
          <div className="space-y-4">
            <ChargesCard po={po} meta={meta} editable={editable} onChange={applyPO} />
            <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 px-4 py-1">
              <Disclosure title="Advanced">
                <div className="pb-3 -mx-4">
                  <CostingCard po={po} meta={meta} costing={costing} loading={costLoading} error={costError} editable={editable} onMethod={setMethod} className="!border-0 !shadow-none" />
                </div>
              </Disclosure>
            </div>
            <HistoryCard po={po} />
          </div>
        </div>
      </div>

      {billModal.open && (
        <BillModal
          poId={po._id}
          bill={billModal.bill}
          onClose={() => setBillModal({ open: false, bill: null })}
          onSaved={(next) => {
            applyPO(next);
            setBillModal({ open: false, bill: null });
            toast.success('Bill saved');
          }}
        />
      )}
      {newProductBill && (
        <NewProductModal
          po={po}
          bill={newProductBill}
          categories={meta?.categories || []}
          onClose={() => setNewProductBill(null)}
          onSaved={(next) => {
            applyPO(next);
            setNewProductBill(null);
            toast.success('Product created and added');
          }}
        />
      )}
      {showDetails && (
        <DetailsModal
          po={po}
          onClose={() => setShowDetails(false)}
          onSaved={(next) => {
            applyPO(next);
            setShowDetails(false);
          }}
        />
      )}
      {showClose && (
        <CloseModal
          po={po}
          onClose={() => setShowClose(false)}
          onClosed={(_next, grn, warnings) => {
            setShowClose(false);
            toast.success(grn ? 'Sent to the warehouse. The boxes/packs are waiting to be checked.' : 'Sent to the warehouse');
            warnings.forEach((w) => toast(w, { icon: '⚠️', duration: 6000 }));
            load();
          }}
        />
      )}
    </div>
  );
}

function HistoryCard({ po }: { po: PurchaseOrder }) {
  const [open, setOpen] = useState(false);
  const rows = [...(po.history || [])].reverse();
  if (!rows.length) return null;
  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <History className="h-4 w-4 text-gray-500" /> History
        </span>
      }
      actions={
        rows.length > 4 ? (
          <button type="button" className="text-xs text-gray-500 hover:text-gray-700" onClick={() => setOpen((v) => !v)}>
            {open ? 'Less' : 'All'}
          </button>
        ) : null
      }
    >
      <ul className="space-y-2">
        {(open ? rows : rows.slice(0, 4)).map((h, i) => (
          <li key={i} className="text-xs">
            <span className="font-medium text-gray-800">{h.action.replace(/_/g, ' ')}</span>
            {h.note && <span className="text-gray-600"> — {h.note}</span>}
            <p className="text-[11px] text-gray-400">
              {formatDate(h.at, true)} · {h.byName}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
