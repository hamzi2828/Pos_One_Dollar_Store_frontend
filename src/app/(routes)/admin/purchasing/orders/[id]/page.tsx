'use client';

// Purchase order workspace: vendor bills (items, cartons, photos), trip charges,
// live landed-cost preview, "Close & submit builty". Read-only after close,
// with a link to its goods receipt.
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { AlertCircle, ArrowLeft, Ban, Edit2, History, PackageCheck, Plus, RotateCcw, Truck } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage, formatDate, formatRs } from '@/lib/storeApi';
import { LoadingCard, NoAccessCard, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { purchasingApi } from '../../_shared/purchasingApi';
import { Card, GRNStatusBadge, PhotoStrip, POStatusBadge, StatTile } from '../../_shared/ui';
import type { AllocationMethod, Costing, POBill, POMeta, ProductUnit, PurchaseOrder } from '../../_shared/types';
import BillCard from '../_components/BillCard';
import BillModal from '../_components/BillModal';
import { ChargesCard, CostingCard, SuggestedItems } from '../_components/PoPanels';
import { CloseModal, DetailsModal, NewProductModal } from '../_components/PoModals';

export default function PurchaseOrderPage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-6"><LoadingCard text="Loading purchase order…" /></div>}>
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

  const loadCosting = useCallback(async () => {
    const my = ++costSeq.current;
    setCostLoading(true);
    setCostError(null);
    try {
      const c = await purchasingApi.costing(id);
      if (my === costSeq.current) setCosting(c);
    } catch (e) {
      if (my === costSeq.current) setCostError(apiErrorMessage(e, 'Could not calculate landed cost.'));
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
      setError(apiErrorMessage(e, 'Could not load the purchase order.'));
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

  /** Every change returns the saved PO; refresh the cost preview after it. */
  const applyPO = useCallback(
    (next: PurchaseOrder) => {
      // Write responses carry no GRN summary: keep the loaded one.
      setPo((prev) => ({
        ...next,
        grn: next.grn ?? prev?.grn,
      }));
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
        <LoadingCard text="Loading purchase order…" />
      </div>
    );
  }
  if (error || !po) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="bg-white rounded-xl shadow-sm border border-red-200 text-center py-10 px-4">
          <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-red-700 mb-4">{error || 'Purchase order not found.'}</p>
          <div className="flex justify-center gap-2">
            <Link href="/admin/purchasing/orders" className={secondaryBtn}>Back to list</Link>
            <button onClick={load} className={primaryBtn}>Try again</button>
          </div>
        </div>
      </div>
    );
  }

  const isOpen = po.status === 'open';
  const editable = isOpen && can('purchase_orders', 'edit');
  const grnPending = !po.grn || po.grn.status === 'pending';
  const canCancel = can('purchase_orders', 'delete') && (isOpen || (po.status === 'closed' && grnPending));
  const canReopen = can('purchase_orders', 'edit') && po.status === 'closed' && grnPending;
  const canCreateProduct = can('products', 'create');

  const doCancel = async () => {
    if (busy) return;
    const reason = window.prompt(`Cancel ${po.poNumber}?${po.status === 'closed' ? '\nThe vendor bills will be voided in the vendor ledger.' : ''}\n\nReason (optional):`);
    if (reason === null) return;
    setBusy('cancel');
    try {
      await purchasingApi.cancel(po._id, reason);
      toast.success('Purchase order cancelled');
      await load();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not cancel.'));
    } finally {
      setBusy(null);
    }
  };

  const doReopen = async () => {
    if (busy) return;
    const reason = window.prompt(`Reopen ${po.poNumber} to fix it?\nThe vendor bills are voided in the ledger and posted again when you close it.\n\nReason (optional):`);
    if (reason === null) return;
    setBusy('reopen');
    try {
      await purchasingApi.reopen(po._id, reason);
      toast.success('Purchase order reopened');
      await load();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not reopen.'));
    } finally {
      setBusy(null);
    }
  };

  const setMethod = async (m: AllocationMethod) => {
    try {
      applyPO(await purchasingApi.update(po._id, { allocationMethod: m }));
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not change the method.'));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
          <div className="min-w-0">
            <Link href="/admin/purchasing/orders" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mb-1">
              <ArrowLeft className="h-3.5 w-3.5" /> Purchase orders
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">{po.poNumber}</h1>
              <POStatusBadge status={po.status} />
            </div>
            <p className="mt-0.5 text-xs sm:text-sm text-gray-500">
              Buyer {po.buyerName || '—'} · opened {formatDate(po.createdAt)}
              {po.expectedArrival && ` · expected ${formatDate(po.expectedArrival)}`}
            </p>
            {po.notes && <p className="mt-1 text-xs text-gray-600">{po.notes}</p>}
            {po.status === 'cancelled' && po.cancelReason && <p className="mt-1 text-xs text-red-600">Cancelled: {po.cancelReason}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {editable && (
              <button className={secondaryBtn} onClick={() => setShowDetails(true)}>
                <Edit2 className="h-4 w-4" /> Details
              </button>
            )}
            {canReopen && (
              <button className={secondaryBtn} onClick={doReopen} disabled={!!busy}>
                <RotateCcw className="h-4 w-4" /> {busy === 'reopen' ? 'Reopening…' : 'Reopen'}
              </button>
            )}
            {canCancel && (
              <button className={`${secondaryBtn} !text-red-600`} onClick={doCancel} disabled={!!busy}>
                <Ban className="h-4 w-4" /> {busy === 'cancel' ? 'Cancelling…' : 'Cancel PO'}
              </button>
            )}
            {editable && (
              <button className={primaryBtn} onClick={() => setShowClose(true)} disabled={!po.bills.length}>
                <Truck className="h-4 w-4" /> Close &amp; submit builty
              </button>
            )}
          </div>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          <StatTile label="Vendor bills" value={po.totals.bills} />
          <StatTile label="Cartons" value={po.totals.cartons} />
          <StatTile label="Pieces" value={po.totals.pieces} />
          <StatTile label="Goods" value={formatRs(po.totals.goods)} />
          <StatTile label="Charges" value={formatRs(po.totals.charges)} />
          <StatTile label="Total cost" value={formatRs(po.totals.grand)} tone="honey" />
        </div>

        {/* After close: builty + goods receipt */}
        {!isOpen && po.builty?.submittedAt && (
          <Card
            title={
              <span className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-honey-700" /> Builty {po.builty.builtyNo || '(photo)'}
              </span>
            }
            actions={
              po.goodsReceipt && can('goods_receiving', 'view') ? (
                <Link href={`/admin/purchasing/receiving/${po.goodsReceipt}`} className={primaryBtn}>
                  <PackageCheck className="h-4 w-4" /> {po.grnNumber || 'Goods receipt'}
                </Link>
              ) : po.grnNumber ? (
                <span className="text-xs text-gray-600">{po.grnNumber}</span>
              ) : null
            }
          >
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-600 mb-2">
              <span>Transporter: {po.builty.transporter || '—'}</span>
              <span>Date: {formatDate(po.builty.date)}</span>
              <span>Cartons: {po.builty.cartons}</span>
              <span>Freight: {formatRs(po.builty.freight)}</span>
              <span>Closed: {formatDate(po.closedAt, true)}</span>
              {po.grn && (
                <span className="flex items-center gap-1">
                  Receiving: <GRNStatusBadge status={po.grn.status} /> {po.grn.receiverName && `by ${po.grn.receiverName}`}
                </span>
              )}
            </div>
            <PhotoStrip photos={po.builty.photos || []} />
          </Card>
        )}

        {editable && suggested.length > 0 && <SuggestedItems po={po} units={suggested} onChange={applyPO} onDismiss={() => setSuggested([])} />}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
          <div className="xl:col-span-2 space-y-4">
            {po.bills.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-dashed border-gray-300 text-center py-10 px-4">
                <p className="text-sm text-gray-600 mb-3">No vendor bills yet. Add one bill per vendor you buy from on this trip.</p>
                {editable && (
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
                  editable={editable}
                  onChange={applyPO}
                  onEdit={() => setBillModal({ open: true, bill })}
                  onNewProduct={editable && canCreateProduct ? () => setNewProductBill(bill) : undefined}
                />
              ))
            )}
            {editable && po.bills.length > 0 && (
              <button className={`${secondaryBtn} w-full border-dashed`} onClick={() => setBillModal({ open: true, bill: null })}>
                <Plus className="h-4 w-4" /> Add another vendor bill
              </button>
            )}
            {editable && !canCreateProduct && (
              <p className="text-[11px] text-gray-500">
                Product not in the list? Ask someone who can create products, or{' '}
                <Link href="/admin/products/create" target="_blank" className="underline">open the product form</Link>.
              </p>
            )}
            <CostingCard po={po} meta={meta} costing={costing} loading={costLoading} error={costError} editable={editable} onMethod={setMethod} />
          </div>
          <div className="space-y-4">
            <ChargesCard po={po} meta={meta} editable={editable} onChange={applyPO} />
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
          costing={costing}
          onClose={() => setShowClose(false)}
          onClosed={(_next, grn, warnings) => {
            setShowClose(false);
            toast.success(grn ? `Closed. ${grn.grnNumber} is waiting for receiving.` : 'Purchase order closed');
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
  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <History className="h-4 w-4 text-gray-500" /> History
        </span>
      }
      actions={
        rows.length > 4 ? (
          <button type="button" className="text-xs text-gray-500 hover:text-gray-700" onClick={() => setOpen((v) => !v)}>{open ? 'Less' : 'All'}</button>
        ) : null
      }
    >
      <ul className="space-y-2">
        {(open ? rows : rows.slice(0, 4)).map((h, i) => (
          <li key={i} className="text-xs">
            <span className="font-medium text-gray-800">{h.action.replace(/_/g, ' ')}</span>
            {h.note && <span className="text-gray-600"> — {h.note}</span>}
            <p className="text-[11px] text-gray-400">{formatDate(h.at, true)} · {h.byName}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
