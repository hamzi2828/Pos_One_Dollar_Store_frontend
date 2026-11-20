'use client';

// One ad's full analytics on its own page (opened from the eye icon on
// /admin/advertisements, in a new browser tab).

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft, Megaphone } from 'lucide-react';
import { storeApi } from '@/lib/storeApi';
import { useAccess } from '@/context/AccessContext';
import { LoadingCard, NoAccessCard, inputClass } from '@/components/admin/FormBits';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { AdAnalytics, RANGES, StatusBadge, rs, type AdRow } from '../adsShared';

export default function AdAnalyticsPage() {
  const { can, loaded } = useAccess();
  if (!loaded) return <div className="max-w-7xl mx-auto px-4 py-6"><LoadingCard text="Loading…" /></div>;
  if (!can('advertisements', 'view')) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <NoAccessCard />
      </div>
    );
  }
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-6"><LoadingCard text="Loading…" /></div>}>
      <AdPage />
    </Suspense>
  );
}

function AdPage() {
  const params = useParams();
  const search = useSearchParams();
  const adId = String(params?.adId ?? '');
  const [range, setRange] = useState(() => {
    const r = search?.get('range') || 'last_7d';
    return RANGES.some((x) => x.value === r) ? r : 'last_7d';
  });
  const [ad, setAd] = useState<AdRow | null>(null);

  useEffect(() => {
    let alive = true;
    storeApi
      .get<AdRow[]>('/ads', { preset: range })
      .then((res) => alive && setAd((res.data || []).find((a) => a.id === adId) || null))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [adId, range]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4">
        <Link href="/admin/advertisements" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800">
          <ArrowLeft className="h-3.5 w-3.5" /> All ads
        </Link>
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-[220px]">
            {ad?.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ad.thumbnail} alt="" className="h-14 w-14 rounded-lg object-cover border border-gray-200" />
            ) : (
              <div className="h-14 w-14 rounded-lg bg-honey-50 text-honey-700 flex items-center justify-center">
                <Megaphone className="h-6 w-6" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-semibold text-gray-900 truncate">{ad?.name || 'Ad analytics'}</h1>
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                {ad && <StatusBadge s={ad.effectiveStatus} />}
                {ad?.campaign?.name && <span>{ad.campaign.name}</span>}
                {ad?.adset?.dailyBudget != null && <span>· {rs(ad.adset.dailyBudget)} / day</span>}
              </div>
            </div>
          </div>
          <SearchSelect value={range} onChange={(e) => setRange(e.target.value)} className={`${inputClass} w-auto`}>
            {RANGES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </SearchSelect>
        </div>
        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
          <AdAnalytics adId={adId} range={range} />
        </div>
      </div>
    </div>
  );
}
