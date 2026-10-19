'use client';

// Website: edit the shop's public marketing website (who we are, what we do,
// what you get, prices, categories, offers, gallery, FAQ, visit us, social & SEO).
// One document on the server (GET/PUT /api/website); the website reads it from
// GET /api/public/website. Contract: pos_backend/docs/WEBSITE_CMS.md.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Check, ExternalLink, Globe, Loader2, RotateCcw, Save } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage, formatDate, storeApi } from '@/lib/storeApi';
import { ErrorBox, LoadingCard, Modal, NoAccessCard, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { EditorContext } from './components/fields';
import { TabEditor, type SetSection } from './components/sections';
import {
  DEFAULT_LIMITS,
  TABS,
  editable,
  type EditableContent,
  type SectionKey,
  type SiteContent,
  type TabKey,
  type WebsiteMeta,
} from './components/types';

type SaveMeta = { refresh?: 'done' | 'failed' | 'skipped' };

// First words of a server error ("Questions, item 2, Answer: …") -> the tab to open.
const ERROR_TABS: [string, TabKey][] = [
  ['Home', 'home'],
  ['Who we are', 'about'],
  ['What we do', 'whatWeDo'],
  ['What you get', 'whatYouGet'],
  ['Prices', 'prices'],
  ['Categories', 'categories'],
  ['Gallery', 'gallery'],
  ['Questions', 'faq'],
  ['Visit us', 'visit'],
  ['Social', 'social'],
  ['SEO', 'social'],
  ['Website address', 'social'],
];

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export default function WebsitePage() {
  const { can } = useAccess();
  const canView = can('website', 'view');
  const canEdit = can('website', 'edit');

  const [content, setContent] = useState<EditableContent | null>(null);
  const [saved, setSaved] = useState<EditableContent | null>(null);
  const [info, setInfo] = useState<{ updatedAt: string | null; updatedByName: string }>({ updatedAt: null, updatedByName: '' });
  const [meta, setMeta] = useState<WebsiteMeta | null>(null);
  const [tab, setTab] = useState<TabKey>('home');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState<{ section: SectionKey; title: string } | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const lockRef = useRef(false);

  const applySaved = useCallback((data: SiteContent) => {
    const e = editable(data);
    setContent(e);
    setSaved(e);
    setInfo({ updatedAt: data.updatedAt, updatedByName: data.updatedByName || '' });
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await storeApi.get<SiteContent>('/website');
      applySaved(res.data);
      setMeta((res.meta as unknown as WebsiteMeta) || null);
    } catch (e) {
      setLoadError(apiErrorMessage(e, 'Could not load the website content.'));
    } finally {
      setLoading(false);
    }
  }, [applySaved]);

  useEffect(() => {
    if (canView) load();
    else setLoading(false);
  }, [canView, load]);

  const dirty = !!content && !!saved && !same(content, saved);
  const dirtyTabs = useMemo(() => {
    const out = new Set<TabKey>();
    if (!content || !saved) return out;
    for (const t of TABS) if (t.sections.some((s) => !same(content[s], saved[s]))) out.add(t.key);
    return out;
  }, [content, saved]);

  // Warn before leaving with unsaved changes: closing / reloading the tab, and links inside the admin.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank' || (a.getAttribute('href') || '').startsWith('#')) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      if (!window.confirm('You have unsaved changes on the website. Leave without saving?')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty]);

  const set: SetSection = useCallback((key, value) => {
    setContent((c) => (c ? { ...c, [key]: value } : c));
  }, []);

  const save = async () => {
    if (!content || !dirty || lockRef.current) return;
    lockRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await storeApi.put<SiteContent>('/website', content);
      applySaved(res.data);
      const refresh = (res.meta as SaveMeta | undefined)?.refresh;
      toast.success(refresh === 'done' ? 'Saved. The website is updated.' : 'Saved. The website shows the changes within a minute.');
    } catch (e) {
      const msg = apiErrorMessage(e, 'Could not save the website.');
      setSaveError(msg);
      toast.error(msg);
      const hit = ERROR_TABS.find(([prefix]) => msg.startsWith(prefix));
      if (hit) setTab(hit[1]);
    } finally {
      setSaving(false);
      lockRef.current = false;
    }
  };

  const confirmReset = async () => {
    if (!resetting || lockRef.current) return;
    const { section, title } = resetting;
    lockRef.current = true;
    setResetBusy(true);
    try {
      const res = await storeApi.post<SiteContent>('/website/reset', { section });
      const fresh = editable(res.data);
      // Only this section changes; unsaved edits in other sections stay.
      setContent((c) => (c ? { ...c, [section]: fresh[section] } : c));
      setSaved((s) => (s ? { ...s, [section]: fresh[section] } : s));
      setInfo({ updatedAt: res.data.updatedAt, updatedByName: res.data.updatedByName || '' });
      toast.success(`${title} is back to the default.`);
      setResetting(null);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not reset this section.'));
    } finally {
      setResetBusy(false);
      lockRef.current = false;
    }
  };

  const viewWebsite = () => {
    const url = saved?.siteUrl?.trim();
    if (!url) {
      toast('Add the website address under "Social & SEO" first, then save.', { icon: 'ℹ️' });
      setTab('social');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const editor = useMemo(
    () => ({
      canEdit,
      limits: meta?.limits || DEFAULT_LIMITS,
      siteUrl: saved?.siteUrl || '',
      requestReset: (section: SectionKey, title: string) => setResetting({ section, title }),
    }),
    [canEdit, meta, saved?.siteUrl]
  );

  if (!canView) {
    return (
      <div className="max-w-6xl mx-auto px-2 sm:px-4 py-4 sm:py-8">
        <NoAccessCard />
      </div>
    );
  }

  const status = dirty
    ? 'Unsaved changes'
    : info.updatedAt
      ? `Saved ${formatDate(info.updatedAt, true)}${info.updatedByName ? ` by ${info.updatedByName}` : ''}`
      : 'Showing the default content';

  return (
    <EditorContext.Provider value={editor}>
      <div className="max-w-6xl mx-auto px-1 sm:px-2 pb-10">
        {/* Header (sticky): title, status, View website, Save */}
        <div className="sticky top-0 z-20 -mx-1 sm:-mx-2 px-1 sm:px-2 py-2 sm:py-3 mb-3 sm:mb-4 bg-gray-100/95 backdrop-blur border-b border-gray-200">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex items-center justify-center h-10 w-10 rounded-lg bg-honey-500 text-gray-900 flex-shrink-0">
              <Globe className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-2xl font-semibold text-gray-900 leading-tight">Website</h1>
              <p className={`text-[11px] sm:text-xs truncate ${dirty ? 'text-amber-700 font-medium' : 'text-gray-500'}`}>{status}</p>
            </div>
            <button type="button" className={`${secondaryBtn} !px-3`} onClick={viewWebsite}>
              <ExternalLink className="h-4 w-4" />
              <span className="hidden sm:inline">View website</span>
              <span className="sm:hidden">View</span>
            </button>
            {canEdit && (
              <button type="button" className={`${primaryBtn} !px-3 sm:!px-4`} onClick={save} disabled={!dirty || saving || !content}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : dirty ? <Save className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <LoadingCard text="Loading the website content…" />
        ) : loadError || !content ? (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <ErrorBox message={loadError || 'Could not load the website content.'} />
            <button type="button" className={secondaryBtn} onClick={load}>
              <RotateCcw className="h-4 w-4" />
              Try again
            </button>
          </div>
        ) : (
          <div className="lg:flex lg:items-start lg:gap-5">
            {/* Tabs: chips that scroll sideways on the phone, a list on the left on desktop */}
            <nav
              aria-label="Website sections"
              className="flex lg:flex-col gap-1.5 lg:gap-0.5 overflow-x-auto lg:overflow-visible pb-2 lg:pb-2 mb-3 lg:mb-0 lg:w-56 lg:flex-shrink-0 lg:sticky lg:top-24 lg:bg-white lg:rounded-xl lg:border lg:border-gray-200 lg:p-2"
            >
              {TABS.map((t) => {
                const active = t.key === tab;
                const first = content[t.sections[0]];
                const hidden = typeof first === 'object' && first !== null && 'show' in first && first.show === false;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={(e) => {
                      setTab(t.key);
                      e.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                    }}
                    aria-current={active ? 'page' : undefined}
                    className={`flex-shrink-0 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full lg:rounded-lg px-3 py-1.5 lg:py-2 text-xs sm:text-sm text-left transition-colors border lg:border-0 ${
                      active
                        ? 'bg-honey-500 border-honey-500 text-gray-900 font-semibold'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-honey-50'
                    }`}
                  >
                    <span className="lg:flex-1">{t.label}</span>
                    {hidden && <span className={`text-[10px] ${active ? 'text-gray-800' : 'text-gray-400'}`}>hidden</span>}
                    {dirtyTabs.has(t.key) && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-label="changed" />}
                  </button>
                );
              })}
            </nav>

            <div className="flex-1 min-w-0 space-y-4">
              {saveError && <ErrorBox message={saveError} />}
              {!canEdit && <p className="text-xs text-gray-500">You can look at the website content but not change it.</p>}
              <TabEditor tab={tab} c={content} set={set} />
            </div>
          </div>
        )}
      </div>

      {resetting && (
        <Modal
          title={`Reset “${resetting.title}”?`}
          icon={<RotateCcw className="h-5 w-5" />}
          onClose={() => !resetBusy && setResetting(null)}
          busy={resetBusy}
          footer={
            <>
              <button type="button" className={secondaryBtn} onClick={() => setResetting(null)} disabled={resetBusy}>
                Cancel
              </button>
              <button type="button" className={primaryBtn} onClick={confirmReset} disabled={resetBusy}>
                {resetBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                Reset to default
              </button>
            </>
          }
        >
          <p className="text-sm text-gray-700">
            This puts <strong>{resetting.title}</strong> back to the original text and pictures and saves it on the website straight away.
            Other sections are not changed.
          </p>
        </Modal>
      )}
    </EditorContext.Provider>
  );
}
