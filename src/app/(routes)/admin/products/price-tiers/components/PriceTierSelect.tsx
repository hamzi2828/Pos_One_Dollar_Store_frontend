'use client';

// Optional "Price tier" field of the product form. Picking a tier locks the
// sale price to the tier price; the link itself is saved after the product
// with syncProductTier() (POST /api/price-tiers/:id/assign or /unassign).
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Tags, Lock } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage, formatRs } from '@/lib/storeApi';
import { PriceTier, tierApi } from './tierApi';

export type TierChoice = Pick<PriceTier, '_id' | 'name' | 'price' | 'color'> | null;

interface Props {
  /** Edit mode: the product's current tier is loaded from the server. */
  productId?: string;
  value: TierChoice;
  /** `initial` = the tier the product already had (not a change by the user). */
  onChange: (tier: TierChoice, initial: boolean) => void;
  isVariant?: boolean;
}

export default function PriceTierSelect({ productId, value, onChange, isVariant = false }: Props) {
  const { can } = useAccess();
  const canView = can('price_tiers', 'view');
  const canEdit = can('price_tiers', 'edit');
  const [tiers, setTiers] = useState<PriceTier[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!canView) return undefined;
    let cancelled = false;
    setLoading(true);
    Promise.all([tierApi.list({ isActive: 'true' }), productId ? tierApi.ofProduct(productId) : Promise.resolve(null)])
      .then(([list, current]) => {
        if (cancelled) return;
        const active = list.data || [];
        const cur = current && current.data ? current.data : null;
        // Keep the current tier selectable even when it was switched off.
        setTiers(cur && !active.some((t) => t._id === cur._id) ? [...active, cur] : active);
        if (cur) onChange({ _id: cur._id, name: cur.name, price: cur.price, color: cur.color }, true);
      })
      .catch((e) => console.error('Could not load price tiers:', e))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, productId]);

  if (!canView) return null;

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        <Tags className="inline h-3.5 w-3.5 mr-1 text-gray-400" />
        Price tier <span className="text-gray-400 font-normal">(optional)</span>
      </label>
      <select
        className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-500"
        value={value?._id || ''}
        disabled={!canEdit || loading}
        onChange={(e) => {
          const t = tiers.find((x) => x._id === e.target.value);
          onChange(t ? { _id: t._id, name: t.name, price: t.price, color: t.color } : null, false);
        }}
      >
        <option value="">{loading ? 'Loading…' : 'No tier (own price)'}</option>
        {tiers.map((t) => (
          <option key={t._id} value={t._id}>
            {t.name} — {formatRs(t.price)}
            {!t.isActive ? ' (off)' : ''}
          </option>
        ))}
      </select>
      {value && (
        <p className="mt-1 text-xs text-gray-500 flex items-center gap-1">
          <Lock className="h-3 w-3" />
          Sells at {formatRs(value.price)}
          {isVariant ? ' (every variant)' : ''} — change it on the tier
        </p>
      )}
    </div>
  );
}

/**
 * After the product is saved: link it to `tierId` (re-prices it) or unlink it.
 * Does nothing when the tier did not change. Never throws (warns instead).
 */
export async function syncProductTier(productId: string | undefined, tierId: string | null, previousTierId: string | null) {
  if (!productId || tierId === previousTierId) return;
  try {
    if (tierId) await tierApi.assign(tierId, [productId]);
    else await tierApi.unassign([productId]);
  } catch (e) {
    toast.error(`Product saved, but the price tier was not changed: ${apiErrorMessage(e)}`);
  }
}
