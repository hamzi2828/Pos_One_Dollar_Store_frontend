'use client';

// Dollar-store price points ("Rs 150", "Rs 280", "Rs 499"). Many products share
// one sale price while each one's landed cost differs: link products to a tier,
// change the tier price once to re-price all of them, and watch the margins.

import { useCallback, useEffect, useState } from 'react';
import { Tags, Plus, Loader2 } from 'lucide-react';
import { apiErrorMessage, formatRs } from '@/lib/storeApi';
import { ErrorBox, HelpBox, LoadingCard, NoAccessCard, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { useAccess } from '@/context/AccessContext';
import { PriceTier, tierApi } from './components/tierApi';
import TierForm from './components/TierForm';
import TierDetail from './components/TierDetail';

export default function PriceTiersPage() {
  const { can, loaded } = useAccess();
  const canView = can('price_tiers', 'view');
  const canCreate = can('price_tiers', 'create');
  const canEdit = can('price_tiers', 'edit');
  const canDelete = can('price_tiers', 'delete');

  const [tiers, setTiers] = useState<PriceTier[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PriceTier | 'new' | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await tierApi.list();
      setTiers(res.data || []);
      setSelectedId((cur) => (cur && res.data.some((t) => t._id === cur) ? cur : res.data[0]?._id ?? null));
      setError(null);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load price tiers'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (canView) load();
  }, [canView, load]);

  if (loaded && !canView) return <NoAccessCard />;

  const selected = tiers.find((t) => t._id === selectedId) || null;

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <Tags className="h-6 w-6 text-honey-700" />
            Price Tiers
            {refreshing && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
          </h1>
          <p className="text-xs sm:text-sm text-gray-500">Fixed sale prices shared by many products, with the margin of each product at that price.</p>
        </div>
        {canCreate && (
          <button className={primaryBtn} onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" /> New tier
          </button>
        )}
      </div>

      <ErrorBox message={error} />

      {loading ? (
        <LoadingCard text="Loading price tiers…" />
      ) : tiers.length === 0 ? (
        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-6 space-y-3 text-center">
          <Tags className="h-10 w-10 text-gray-300 mx-auto" />
          <p className="text-sm text-gray-600">No price tiers yet. Create your price points (e.g. Rs 150, Rs 280, Rs 499) and put products on them.</p>
          {canCreate && (
            <button className={secondaryBtn} onClick={() => setEditing('new')}>
              <Plus className="h-4 w-4" /> Create the first tier
            </button>
          )}
          <HelpBox>A product on a tier always sells at the tier price (all its variants). Change the tier price once and every product follows.</HelpBox>
        </div>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {tiers.map((t) => (
              <button
                key={t._id}
                onClick={() => setSelectedId(t._id)}
                className={`flex-shrink-0 min-w-[130px] text-left p-3 rounded-xl border-2 bg-white transition-all ${
                  selectedId === t._id ? 'border-honey-500 shadow-md' : 'border-gray-200 hover:border-gray-300'
                } ${t.isActive ? '' : 'opacity-60'}`}
              >
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: t.color }} />
                  <span className="text-sm font-semibold text-gray-900 truncate">{t.name}</span>
                </div>
                <div className="text-lg font-bold text-gray-900 mt-1">{formatRs(t.price)}</div>
                <div className="text-xs text-gray-500">
                  {t.productCount ?? 0} product{t.productCount === 1 ? '' : 's'}
                  {!t.isActive ? ' · off' : ''}
                </div>
              </button>
            ))}
          </div>

          {selected && (
            <TierDetail
              key={selected._id}
              tier={selected}
              canEdit={canEdit}
              canDelete={canDelete}
              onEdit={() => setEditing(selected)}
              onDeleted={() => {
                setSelectedId(null);
                load(true);
              }}
              onChanged={() => load(true)}
            />
          )}
        </>
      )}

      {editing && (
        <TierForm
          tier={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(t) => {
            setEditing(null);
            setSelectedId(t._id);
            load(true);
          }}
        />
      )}
    </div>
  );
}
