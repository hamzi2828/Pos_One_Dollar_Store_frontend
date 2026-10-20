'use client';

// Owner-only switch: "Someone other than the buyer must check and receive the goods".
// Shown to the super admin on Receive Goods. Backend: GET/PUT /api/purchase-orders/settings.
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage, storeApi } from '@/lib/storeApi';

interface PurchasingSettings {
  requireDifferentReceiver: boolean;
  minMarginPct: number;
}

export function ReceiverRule() {
  const { isSuperAdmin } = useAccess();
  const [on, setOn] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isSuperAdmin) return;
    storeApi
      .get<PurchasingSettings>('/purchase-orders/settings')
      .then((r) => setOn(!!r.data.requireDifferentReceiver))
      .catch(() => setOn(null));
  }, [isSuperAdmin]);

  if (!isSuperAdmin || on === null) return null;

  const toggle = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const r = await storeApi.put<PurchasingSettings>('/purchase-orders/settings', { requireDifferentReceiver: !on });
      setOn(!!r.data.requireDifferentReceiver);
      toast.success(r.data.requireDifferentReceiver ? 'Now someone other than the buyer must receive the goods' : 'The buyer can now receive their own goods');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not save the rule.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3 sm:p-4">
      <ShieldCheck className={`mt-0.5 h-5 w-5 flex-shrink-0 ${on ? 'text-green-600' : 'text-gray-400'}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900">Someone other than the buyer must check and receive the goods</p>
        <p className="mt-0.5 text-xs text-gray-500">
          {on ? 'On: the person who bought can not check the boxes/packs or enter the goods of their own trip.' : 'Off: the buyer may also receive their own trip.'} Only the owner can change this.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Someone other than the buyer must receive"
        onClick={toggle}
        disabled={saving}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${on ? 'bg-honey-500' : 'bg-gray-300'}`}
      >
        {saving ? (
          <Loader2 className="mx-auto h-4 w-4 animate-spin text-gray-700" />
        ) : (
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
        )}
      </button>
    </div>
  );
}
