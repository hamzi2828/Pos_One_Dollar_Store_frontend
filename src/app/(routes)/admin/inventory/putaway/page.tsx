'use client';

// Warehouse -> Shop. The whole flow in 3 steps:
//   1. Received (Goods Receiving)  2. In the WAREHOUSE  3. On display in the shop (rack / shelf)
// "Send to shop" moves pieces from the warehouse onto a shelf. Scan product ->
// scan shelf label -> pieces -> Enter. Every step is written to the stock
// ledger (putaway / location_move).

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRightLeft, ChevronRight, History, LayoutGrid, Loader2, MapPin, PackageCheck, Search, Warehouse } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { HelpBox, NoAccessCard } from '@/components/admin/FormBits';
import { apiErrorMessage, formatDate } from '@/lib/storeApi';
import { racksApi, type ActivityRow, type WarehouseItem, type WarehouseMeta } from '../racks/services/racksApi';
import ScanPutaway from './components/ScanPutaway';
import WarehouseList from './components/WarehouseList';
import LocationLookup from './components/LocationLookup';
import PutawayModal, { type PutawayTarget } from './components/PutawayModal';

type Tab = 'warehouse' | 'lookup';

/** One step of the Received -> Warehouse -> Shop flow. */
function FlowStep({ n, title, text, href, icon, active }: { n: number; title: string; text: string; href?: string; icon: ReactNode; active?: boolean }) {
  const body = (
    <div
      className={`h-full flex items-center gap-3 rounded-xl border p-3 transition-colors ${
        active ? 'bg-honey-50 border-honey-300' : 'bg-white border-gray-200 hover:border-honey-300'
      }`}
    >
      <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${active ? 'bg-honey-500 text-gray-900' : 'bg-gray-100 text-gray-600'}`}>
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          {icon} {title}
        </p>
        <p className="text-xs text-gray-500 truncate">{text}</p>
      </div>
      {href && <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default function PutawayPage() {
  const { can } = useAccess();
  const canView = can(['racks', 'stock_putaway'], 'view');
  const canPut = can('stock_putaway', 'create');

  const [tab, setTab] = useState<Tab>('warehouse');
  const [refreshKey, setRefreshKey] = useState(0);
  const [meta, setMeta] = useState<WarehouseMeta | null>(null);
  const [putItem, setPutItem] = useState<PutawayTarget | null>(null);
  const [activity, setActivity] = useState<ActivityRow[] | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [initialShelf, setInitialShelf] = useState<string | null>(null);
  // Step 3 of the flow: pieces on display (on shelves) in the shop.
  const [display, setDisplay] = useState<{ pieces: number; shelves: number } | null>(null);

  // ?shelf=A1-S2 (from the shelf drawer on the Racks page)
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('shelf');
    if (code) setInitialShelf(code);
  }, []);

  const loadActivity = useCallback(async () => {
    try {
      setActivityError(null);
      setActivity(await racksApi.activity(12));
    } catch (e) {
      setActivityError(apiErrorMessage(e, 'Could not load recent moves.'));
    }
  }, []);

  const loadDisplay = useCallback(async () => {
    try {
      const res = await racksApi.list();
      const racks = res.data || [];
      setDisplay({
        pieces: racks.reduce((s, r) => s + (Number(r.pieces) || 0), 0),
        shelves: racks.reduce((s, r) => s + (Number(r.usedShelves) || 0), 0),
      });
    } catch {
      setDisplay(null); // the step still links to Racks & Shelves
    }
  }, []);

  useEffect(() => {
    if (canView) {
      loadActivity();
      loadDisplay();
    }
  }, [canView, loadActivity, loadDisplay]);

  const onMeta = useCallback((m: WarehouseMeta | null) => setMeta(m), []);

  /** Something was sent to the shop / moved: refresh the list, activity and display count. */
  const changed = useCallback(() => {
    setRefreshKey((k) => k + 1);
    loadActivity();
    loadDisplay();
  }, [loadActivity, loadDisplay]);

  if (!canView) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <NoAccessCard />
      </div>
    );
  }

  const tabBtn = (t: Tab) =>
    `inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors ${
      tab === t ? 'bg-honey-500 border-honey-500 text-gray-900 font-semibold' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
    }`;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Header */}
        <div className="mb-4 sm:mb-5">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Warehouse → Shop</h1>
          <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-500">
            Everything you buy lands in the warehouse first. Send it to the shop and choose the rack &amp; shelf where it is displayed.
          </p>
        </div>

        {/* The whole flow in 3 steps */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-6">
          <FlowStep
            n={1}
            title="Received"
            text="Checked in on Goods Receiving"
            href="/admin/purchasing/receiving"
            icon={<PackageCheck className="h-4 w-4 text-gray-500" />}
          />
          <FlowStep
            n={2}
            title="In warehouse"
            text={meta ? `${meta.total.toLocaleString()} items · ${meta.totalPieces.toLocaleString()} pcs waiting` : 'Loading…'}
            active
            icon={<Warehouse className="h-4 w-4 text-honey-700" />}
          />
          <FlowStep
            n={3}
            title="On display in shop"
            text={display ? `${display.pieces.toLocaleString()} pcs on ${display.shelves} shelves` : 'See racks & shelves'}
            href="/admin/inventory/racks"
            icon={<LayoutGrid className="h-4 w-4 text-emerald-600" />}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4 sm:mb-6">
          <div className="lg:col-span-2">
            {canPut ? (
              <ScanPutaway initialShelfCode={initialShelf} onDone={changed} />
            ) : (
              <HelpBox>
                You can see the warehouse and where items are displayed. Sending stock to the shop needs the{' '}
                <strong>Put-away / Move</strong> permission.
              </HelpBox>
            )}
          </div>

          {/* Recent moves */}
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
              <History className="h-4 w-4 text-gray-400" /> Recently sent to shop
            </h2>
            {activityError ? (
              <p className="text-xs text-red-600">{activityError}</p>
            ) : activity === null ? (
              <div className="py-6 text-center">
                <Loader2 className="h-5 w-5 text-honey-700 mx-auto animate-spin" />
              </div>
            ) : activity.length === 0 ? (
              <p className="text-xs text-gray-500">Nothing yet.</p>
            ) : (
              <ul className="space-y-2.5 max-h-[22rem] overflow-y-auto">
                {activity.map((a) => (
                  <li key={a._id} className="text-xs">
                    <div className="flex items-center gap-1.5 text-gray-800">
                      {a.type === 'putaway' ? (
                        <MapPin className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                      ) : (
                        <ArrowRightLeft className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                      )}
                      <span className="truncate">
                        <strong className="tabular-nums">{a.quantity}</strong> × {a.name}
                      </span>
                    </div>
                    <p className="pl-5 text-[11px] text-gray-500">
                      <span className="font-mono">{a.from === 'WAREHOUSE' ? 'Warehouse' : a.from}</span> →{' '}
                      <span className="font-mono">{a.to === 'WAREHOUSE' ? 'Warehouse' : a.to}</span> · {formatDate(a.occurredAt, true)}
                      {a.user ? ` · ${a.user}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button type="button" className={tabBtn('warehouse')} onClick={() => setTab('warehouse')}>
            <Warehouse className="h-4 w-4" /> In the warehouse
            {meta && <span className={`text-xs ${tab === 'warehouse' ? 'text-gray-900/70' : 'text-gray-400'}`}>({meta.total})</span>}
          </button>
          <button type="button" className={tabBtn('lookup')} onClick={() => setTab('lookup')}>
            <Search className="h-4 w-4" /> Find a product
          </button>
        </div>

        {/* Keep the list mounted (filters + page survive a tab switch). */}
        <div className={tab === 'warehouse' ? '' : 'hidden'}>
          <WarehouseList
            canPut={canPut}
            refreshKey={refreshKey}
            onPut={(it: WarehouseItem) => setPutItem(it)}
            onMeta={onMeta}
          />
        </div>
        <div className={tab === 'lookup' ? '' : 'hidden'}>
          <LocationLookup canMove={canPut} refreshKey={refreshKey} onPut={(u) => setPutItem(u)} onChanged={changed} />
        </div>
      </div>

      {putItem && (
        <PutawayModal
          item={putItem}
          onClose={() => setPutItem(null)}
          onDone={() => {
            setPutItem(null);
            changed();
          }}
        />
      )}
    </div>
  );
}
