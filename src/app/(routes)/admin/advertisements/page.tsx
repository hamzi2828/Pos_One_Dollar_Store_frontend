'use client';

// Facebook / Instagram ads (Meta): every ad with its numbers, pause / start,
// daily budget, and per-ad analytics (platform, placement, age & gender,
// region, device, day by day). Data comes live from Meta via /api/ads.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Megaphone, RefreshCw, Settings, Loader2, Play, Pause, Pencil, BarChart3, Save, Eye } from 'lucide-react';
import { storeApi, apiErrorMessage } from '@/lib/storeApi';
import { AdAnalytics, RANGES, StatusBadge, Tile, sumStats, n0, pct, rs, per, type AdRow, type AdsSettings } from './adsShared';
import { useAccess } from '@/context/AccessContext';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { Field, Modal, ErrorBox, HelpBox, LoadingCard, NoAccessCard, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function AdvertisementsPage() {
  const { can, loaded } = useAccess();
  if (!loaded) return <div className="max-w-7xl mx-auto px-4 py-6"><LoadingCard text="Loading…" /></div>;
  if (!can('advertisements', 'view')) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <NoAccessCard />
      </div>
    );
  }
  return <AdsDashboard />;
}

function AdsDashboard() {
  const { can } = useAccess();
  const canEdit = can('advertisements', 'edit');
  const [settings, setSettings] = useState<AdsSettings | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [range, setRange] = useState('last_7d');
  const [ads, setAds] = useState<AdRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onlyRunning, setOnlyRunning] = useState(false);
  const [openAd, setOpenAd] = useState<AdRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [budgetFor, setBudgetFor] = useState<AdRow | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      const res = await storeApi.get<AdsSettings>('/ads/settings');
      setSettings(res.data);
      if (!res.data.hasToken || !res.data.adAccountId) setShowSettings(true);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load settings.'));
    }
  }, []);

  const loadAds = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await storeApi.get<AdRow[]>('/ads', { preset: range });
      setAds(res.data || []);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load ads from Meta.'));
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const connected = !!settings?.hasToken && !!settings?.adAccountId;
  useEffect(() => {
    if (connected) loadAds();
  }, [connected, loadAds]);

  const shown = useMemo(() => (onlyRunning ? ads.filter((a) => a.effectiveStatus === 'ACTIVE') : ads.filter((a) => a.stats || a.effectiveStatus === 'ACTIVE')), [ads, onlyRunning]);
  const totals = useMemo(() => sumStats(ads.map((a) => a.stats)), [ads]);
  const running = ads.filter((a) => a.effectiveStatus === 'ACTIVE').length;

  const toggle = async (ad: AdRow) => {
    const next = ad.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    const msg = next === 'ACTIVE' ? `Start "${ad.name}"? It will start spending money.` : `Pause "${ad.name}"?`;
    if (!window.confirm(msg)) return;
    setBusyId(ad.id);
    try {
      await storeApi.patch(`/ads/${ad.id}/status`, { status: next });
      toast.success(next === 'ACTIVE' ? 'Ad started' : 'Ad paused');
      await loadAds();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not change the ad.'), { duration: 7000 });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-6">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1 min-w-[200px]">
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 flex items-center gap-2">
              <Megaphone className="h-6 w-6 text-honey-700" /> Advertisements
            </h1>
            <p className="mt-0.5 text-xs sm:text-sm text-gray-500">Facebook & Instagram ads, live from Meta.</p>
          </div>
          {connected && (
            <>
              <SearchSelect value={range} onChange={(e) => setRange(e.target.value)} className={`${inputClass} w-auto`}>
                {RANGES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </SearchSelect>
              <button onClick={loadAds} className={secondaryBtn} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </>
          )}
          {canEdit && (
            <button onClick={() => setShowSettings((v) => !v)} className={secondaryBtn}>
              <Settings className="h-4 w-4" /> Connection
            </button>
          )}
        </div>

        {showSettings && settings && <ConnectionCard settings={settings} canEdit={canEdit} onSaved={(s) => { setSettings(s); setShowSettings(false); }} />}
        {!connected && !showSettings && <HelpBox>Meta ads are not connected yet. Ask the owner to open <strong>Connection</strong> and add the access token.</HelpBox>}

        {connected && (
          <>
            <ErrorBox message={error} />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <Tile label="Spent" value={rs(totals.spend)} sub={`${running} ad${running === 1 ? '' : 's'} running`} />
              <Tile label="Reach" value={n0(totals.reach)} sub="people (per ad, added up)" />
              <Tile label="Impressions" value={n0(totals.impressions)} />
              <Tile label="3-sec plays" value={n0(totals.plays3s)} />
              <Tile label="15-sec plays" value={n0(totals.thruplays)} sub={`${per(totals.spend, totals.thruplays)} each`} />
              <Tile label="Watched to end" value={n0(totals.p100)} sub={`${pct(totals.p100, totals.thruplays)} of 15-sec`} />
            </div>

            <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">Ads</h2>
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <input type="checkbox" checked={onlyRunning} onChange={(e) => setOnlyRunning(e.target.checked)} /> Running only
                </label>
              </div>
              {loading && !ads.length ? (
                <div className="py-14 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-honey-700" /></div>
              ) : !shown.length ? (
                <p className="py-10 text-center text-sm text-gray-500">No ads with results in this period.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Ad</th>
                        <th className="px-3 py-2 text-left">Status</th>
                        <th className="px-3 py-2 text-right">Daily budget</th>
                        <th className="px-3 py-2 text-right">Spent</th>
                        <th className="px-3 py-2 text-right">Reach</th>
                        <th className="px-3 py-2 text-right">3-sec</th>
                        <th className="px-3 py-2 text-right">15-sec</th>
                        <th className="px-3 py-2 text-right">To end</th>
                        <th className="px-3 py-2 text-right">Per 15-sec</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {shown.map((ad) => {
                        const s = ad.stats;
                        return (
                          <tr key={ad.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2">
                              <button onClick={() => setOpenAd(ad)} className="flex items-center gap-3 text-left">
                                {ad.thumbnail ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={ad.thumbnail} alt="" className="h-10 w-10 rounded object-cover border border-gray-200" />
                                ) : (
                                  <div className="h-10 w-10 rounded bg-gray-100" />
                                )}
                                <span>
                                  <span className="block font-medium text-gray-900 hover:underline">{ad.name}</span>
                                  <span className="block text-[11px] text-gray-500">{ad.campaign?.name}</span>
                                </span>
                              </button>
                            </td>
                            <td className="px-3 py-2"><StatusBadge s={ad.effectiveStatus} /></td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {ad.adset?.dailyBudget != null ? (
                                <button
                                  disabled={!canEdit}
                                  onClick={() => setBudgetFor(ad)}
                                  className="inline-flex items-center gap-1 hover:text-honey-700 disabled:hover:text-inherit"
                                  title={canEdit ? 'Change daily budget' : undefined}
                                >
                                  {rs(ad.adset.dailyBudget)} {canEdit && <Pencil className="h-3 w-3" />}
                                </button>
                              ) : ad.adset?.lifetimeBudget != null ? (
                                <span className="text-gray-500">{rs(ad.adset.lifetimeBudget)} total</span>
                              ) : '—'}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">{s ? rs(s.spend) : '—'}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{s ? n0(s.reach) : '—'}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{s ? n0(s.plays3s) : '—'}</td>
                            <td className="px-3 py-2 text-right tabular-nums font-medium">{s ? n0(s.thruplays) : '—'}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{s ? `${n0(s.p100)} (${pct(s.p100, s.thruplays)})` : '—'}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{s ? per(s.spend, s.thruplays) : '—'}</td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">
                              <a
                                href={`/admin/advertisements/${ad.id}?range=${range}`}
                                target="_blank"
                                rel="noopener"
                                className="inline-flex p-1.5 rounded hover:bg-gray-100 text-gray-600"
                                title="Open full analytics in a new tab"
                              >
                                <Eye className="h-4 w-4" />
                              </a>
                              <button onClick={() => setOpenAd(ad)} className="p-1.5 rounded hover:bg-gray-100 text-gray-600" title="Analytics">
                                <BarChart3 className="h-4 w-4" />
                              </button>
                              {canEdit && (
                                <button
                                  onClick={() => toggle(ad)}
                                  disabled={busyId === ad.id}
                                  className={`ml-1 p-1.5 rounded hover:bg-gray-100 ${ad.status === 'ACTIVE' ? 'text-amber-600' : 'text-green-600'}`}
                                  title={ad.status === 'ACTIVE' ? 'Pause' : 'Start'}
                                >
                                  {busyId === ad.id ? <Loader2 className="h-4 w-4 animate-spin" /> : ad.status === 'ACTIVE' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {openAd && <AdDetail ad={openAd} range={range} onClose={() => setOpenAd(null)} />}
      {budgetFor && <BudgetModal ad={budgetFor} onClose={() => setBudgetFor(null)} onSaved={() => { setBudgetFor(null); loadAds(); }} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Connection settings                                                 */
/* ------------------------------------------------------------------ */

function ConnectionCard({ settings, canEdit, onSaved }: { settings: AdsSettings; canEdit: boolean; onSaved: (s: AdsSettings) => void }) {
  const [accountId, setAccountId] = useState(settings.adAccountId);
  const [version, setVersion] = useState(settings.apiVersion);
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      const res = await storeApi.put<AdsSettings>('/ads/settings', {
        adAccountId: accountId,
        apiVersion: version,
        ...(token.trim() ? { accessToken: token.trim() } : {}),
      });
      // Check the connection right away.
      await storeApi.get('/ads/account');
      toast.success('Connected to Meta');
      onSaved(res.data);
    } catch (e) {
      setErr(apiErrorMessage(e, 'Could not connect.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5 space-y-4">
      <h2 className="text-sm sm:text-base font-semibold text-gray-900">Connect Meta ads</h2>
      <HelpBox>
        In <strong>business.facebook.com → Settings → Users → System users</strong>, add a system user, give it your ad account
        (Full control), then <strong>Generate token</strong> with <code>ads_read</code> and <code>ads_management</code>. Paste it below.
        The ad account ID is the number in Ads Manager (e.g. 1436978699851558).
      </HelpBox>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="Ad account ID">
          <input className={inputClass} value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="act_1436978699851558" disabled={!canEdit} />
        </Field>
        <Field label="Access token" hint={settings.hasToken ? `Saved (${settings.token}). Leave empty to keep it.` : 'Not saved yet.'}>
          <input className={inputClass} type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder={settings.hasToken ? settings.token : 'EAA…'} disabled={!canEdit} autoComplete="off" />
        </Field>
        <Field label="API version">
          <input className={inputClass} value={version} onChange={(e) => setVersion(e.target.value)} placeholder="v23.0" disabled={!canEdit} />
        </Field>
      </div>
      <ErrorBox message={err} />
      {canEdit && (
        <div className="flex justify-end">
          <button onClick={save} disabled={saving} className={primaryBtn}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save & test
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Daily budget                                                        */
/* ------------------------------------------------------------------ */

function BudgetModal({ ad, onClose, onSaved }: { ad: AdRow; onClose: () => void; onSaved: () => void }) {
  const [value, setValue] = useState(String(ad.adset?.dailyBudget ?? ''));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const lock = useRef(false);

  const save = async () => {
    if (lock.current || !ad.adset) return;
    lock.current = true;
    setSaving(true);
    setErr(null);
    try {
      await storeApi.patch(`/ads/adsets/${ad.adset.id}/budget`, { dailyBudget: Number(value) });
      toast.success('Daily budget updated');
      onSaved();
    } catch (e) {
      setErr(apiErrorMessage(e, 'Could not change the budget.'));
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Daily budget"
      subtitle={ad.adset?.name}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button onClick={onClose} className={secondaryBtn} disabled={saving}>Cancel</button>
          <button onClick={save} className={primaryBtn} disabled={saving || !Number(value)}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Rupees per day" hint="Applies to every ad in this ad set. Meta spends up to this amount each day.">
          <input className={inputClass} type="number" min={100} step={50} value={value} onChange={(e) => setValue(e.target.value)} />
        </Field>
        <ErrorBox message={err} />
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* One ad: analytics (popup)                                           */
/* ------------------------------------------------------------------ */

function AdDetail({ ad, range, onClose }: { ad: AdRow; range: string; onClose: () => void }) {
  return (
    <Modal title={ad.name} subtitle={`${ad.campaign?.name || ''} · ${RANGES.find((r) => r.value === range)?.label}`} icon={<BarChart3 className="h-5 w-5" />} onClose={onClose} wide="xl">
      <AdAnalytics adId={ad.id} range={range} />
    </Modal>
  );
}
