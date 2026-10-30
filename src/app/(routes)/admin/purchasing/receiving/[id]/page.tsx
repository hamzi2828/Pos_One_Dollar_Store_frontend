'use client';

// Receive goods for one trip, in 3 steps:
//   1. Check boxes   — did every vendor's boxes come?
//   2. Unpack & enter — scan / search each product, pieces + cost per piece;
//                       stock goes into the warehouse at once, tags print, shelf now or later
//   3. Finish        — bill vs entered per vendor, claim the shortfall back
// Old receipts (no `boxes`, counted line by line) keep the old counting screen.
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage, formatDate } from '@/lib/storeApi';
import { LoadingCard, NoAccessCard, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { purchasingApi } from '../../_shared/purchasingApi';
import { GRNStatusBadge, StepStrip } from '../../_shared/ui';
import type { GoodsReceipt } from '../../_shared/types';
import OldCounting from './_components/OldCounting';
import BoxesStep, { firstUncheckedBill } from './_components/BoxesStep';
import UnpackStep from './_components/UnpackStep';
import FinishStep, { DoneView } from './_components/FinishStep';
import { loadTagSize, type StickerSize } from './_components/tags';

const STEPS = ['Check boxes/packs', 'Unpack & enter', 'Finish'];
type View = 0 | 1 | 2;

/** Old receipt: the server says it was counted line by line (`mode: 'lines'`), or (older servers) no boxes / counted lines. */
const isOldReceipt = (g: GoodsReceipt) => {
  if (g.mode) return g.mode === 'lines';
  return !Array.isArray(g.boxes) || g.boxes.length === 0 || (!g.boxesCheckedAt && !(g.entries || []).length && (g.lines || []).some((l) => l.receivedQty > 0));
};

/** Furthest step this receipt has reached. */
const reachedStep = (g: GoodsReceipt): View => (g.status === 'in_progress' && g.boxesCheckedAt ? 1 : 0);

export default function ReceiveGoodsPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAccess();
  const canView = can('goods_receiving', 'view');

  const [grn, setGrn] = useState<GoodsReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [tagSize, setTagSize] = useState<StickerSize>('38x25');
  const [startBill, setStartBill] = useState<string | undefined>(undefined);

  useEffect(() => setTagSize(loadTagSize()), []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const g = await purchasingApi.grnGet(id);
      setGrn(g);
      // Open on step 1 while some vendor's boxes/packs are not checked yet.
      setView((v) => (v === null ? (firstUncheckedBill(g) ? 0 : reachedStep(g)) : v));
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load this trip.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  /** Quiet refresh after a write that did not return the receipt. */
  const reload = useCallback(async () => {
    try {
      setGrn(await purchasingApi.grnGet(id));
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not refresh.'));
    }
  }, [id]);

  useEffect(() => {
    if (canView) load();
  }, [load, canView]);

  // Keep the page at the top when moving between steps (phones).
  useEffect(() => {
    if (view !== null) window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [view]);

  if (!canView) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <NoAccessCard />
      </div>
    );
  }
  if (loading && !grn) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <LoadingCard text="Loading…" />
      </div>
    );
  }
  if (error || !grn) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="bg-white rounded-xl shadow-sm border border-red-200 text-center py-10 px-4">
          <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-red-700 mb-4">{error || 'Not found.'}</p>
          <div className="flex justify-center gap-2">
            <Link href="/admin/purchasing/receiving" className={secondaryBtn}>
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

  if (isOldReceipt(grn)) return <OldCounting grn={grn} setGrn={setGrn} />;

  const mayEdit = can('goods_receiving', 'edit') && grn.canVerify;
  const done = grn.status === 'completed';
  const cancelled = grn.status === 'cancelled';
  const reached = reachedStep(grn);
  const current: View = view ?? reached;
  const vendors = [...new Set((grn.boxes || []).map((b) => b.vendorName))];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4">
        <div className="min-w-0">
          <Link href="/admin/purchasing/receiving" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mb-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Receive goods
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">{grn.poNumber || grn.grnNumber}</h1>
            <GRNStatusBadge status={grn.status} />
          </div>
          <p className="mt-0.5 text-xs sm:text-sm text-gray-500">
            {vendors.length > 3 ? `${vendors.length} vendors` : vendors.join(', ') || '—'} · bought by {grn.buyerName || '—'}
            {grn.receiverName && ` · receiving: ${grn.receiverName}`}
            {can('purchase_orders', 'view') && grn.purchaseOrder?._id && (
              <>
                {' · '}
                <Link href={`/admin/purchasing/orders/${grn.purchaseOrder._id}`} className="underline hover:text-gray-700">
                  trip
                </Link>
              </>
            )}
          </p>
          {cancelled && <p className="mt-1 text-xs text-red-600">This trip was cancelled{grn.completedAt ? ` on ${formatDate(grn.completedAt)}` : ''}.</p>}
        </div>

        {!cancelled && (
          <StepStrip
            steps={STEPS}
            current={done ? STEPS.length : current}
            reached={done ? undefined : reached}
            onPick={done ? undefined : (i) => setView(i as View)}
          />
        )}

        {done ? (
          <DoneView grn={grn} />
        ) : cancelled ? null : current === 0 ? (
          <BoxesStep
            key={`${grn._id}-${startBill || ''}`}
            grn={grn}
            mayEdit={mayEdit}
            startBill={startBill}
            onSaved={(g, bill) => {
              setGrn(g);
              setStartBill(bill);
              setView(1);
              const name = (g.boxes || []).find((b) => b.bill === bill)?.vendorName || 'this vendor';
              toast.success(`Boxes/packs checked. Now unpack ${name}.`);
            }}
            onGo={(bill) => {
              setStartBill(bill);
              setView(1);
            }}
          />
        ) : current === 1 ? (
          <UnpackStep
            grn={grn}
            mayEdit={mayEdit}
            tagSize={tagSize}
            onTagSize={setTagSize}
            onChanged={setGrn}
            onReload={reload}
            onFinish={() => setView(2)}
            startBill={startBill}
            onCheckNext={(bill) => {
              setStartBill(bill);
              setView(0);
            }}
          />
        ) : (
          <FinishStep
            grn={grn}
            mayEdit={mayEdit}
            onBack={() => setView(1)}
            onDone={(g) => {
              setGrn(g);
              toast.success('Finished. Well done!');
              // The finish response may not carry everything the done screen shows.
              reload();
            }}
          />
        )}
      </div>
    </div>
  );
}
