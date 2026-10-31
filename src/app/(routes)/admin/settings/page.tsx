'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { Settings, Image as ImageIcon, RotateCcw, Zap, Loader2 } from 'lucide-react';

import GeneralSettings from './components/GeneralSettings';
import LogoSettings from './components/LogoSettings';
import { settingsService, SettingsData, SettingsBusyAction } from './services/settingsService';

const VALID_TABS = ['general', 'logo'] as const;
type TabType = typeof VALID_TABS[number];

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [settings, setSettings] = useState<SettingsData | null>(null);
  // Which async action is in flight (null = idle). The ref is a synchronous
  // lock so rapid double-clicks can't start a second request before state updates.
  const [busyAction, setBusyAction] = useState<SettingsBusyAction | null>(null);
  const busyRef = useRef(false);
  const isLoading = busyAction !== null;

  const runLocked = async (action: SettingsBusyAction, task: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusyAction(action);
    try {
      await task();
    } finally {
      busyRef.current = false;
      setBusyAction(null);
    }
  };

  const tabParam = searchParams.get('tab');
  // The desktop app download moved to its own page.
  useEffect(() => {
    if (tabParam === 'desktop') router.replace('/admin/desktop-app');
  }, [tabParam, router]);
  const activeTab: TabType = VALID_TABS.includes(tabParam as TabType) ? (tabParam as TabType) : 'general';

  const setActiveTab = (tab: TabType) => {
    router.push(`/admin/settings?tab=${tab}`, { scroll: false });
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setBusyAction('fetch');
      const data = await settingsService.getSettings();
      setSettings(data);
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setBusyAction(null);
    }
  };

  const updateSettings = (updateData: Partial<SettingsData>, action: SettingsBusyAction = 'general') =>
    runLocked(action, async () => {
      try {
        const data = await settingsService.updateSettings(updateData);
        setSettings(data);
        toast.success('Settings updated successfully');
        window.dispatchEvent(new Event('settingsUpdated'));
      } catch (error) {
        console.error('Error updating settings:', error);
        toast.error('Failed to update settings');
      }
    });

  const uploadLogo = (file: File) =>
    runLocked('uploadLogo', async () => {
      try {
        const data = await settingsService.uploadLogo(file);
        setSettings(prev => prev ? { ...prev, logoUrl: data.logoUrl } : null);
        toast.success('Logo uploaded');
        window.dispatchEvent(new Event('settingsUpdated'));
      } catch (error) {
        console.error('Error uploading logo:', error);
        toast.error('Failed to upload logo');
      }
    });

  const removeLogo = () =>
    runLocked('removeLogo', async () => {
      try {
        await settingsService.removeLogo();
        setSettings(prev => prev ? { ...prev, logoUrl: '' } : null);
        toast.success('Logo removed');
        window.dispatchEvent(new Event('settingsUpdated'));
      } catch (error) {
        console.error('Error removing logo:', error);
        toast.error('Failed to remove logo');
      }
    });

  const uploadFavicon = (file: File) =>
    runLocked('uploadFavicon', async () => {
      try {
        const data = await settingsService.uploadFavicon(file);
        setSettings(prev => prev ? { ...prev, faviconUrl: data.faviconUrl } : null);
        toast.success('Favicon uploaded');
        window.dispatchEvent(new Event('settingsUpdated'));
      } catch (error) {
        console.error('Error uploading favicon:', error);
        toast.error('Failed to upload favicon');
      }
    });

  const removeFavicon = () =>
    runLocked('removeFavicon', async () => {
      try {
        await settingsService.removeFavicon();
        setSettings(prev => prev ? { ...prev, faviconUrl: '' } : null);
        toast.success('Favicon removed');
        window.dispatchEvent(new Event('settingsUpdated'));
      } catch (error) {
        console.error('Error removing favicon:', error);
        toast.error('Failed to remove favicon');
      }
    });

  const resetCaches = async () => {
    if (busyRef.current) return;
    if (!confirm('Clear all server caches? Lists and reports will load fresh data on the next request.')) {
      return;
    }
    await runLocked('resetCaches', async () => {
      try {
        await settingsService.resetCaches();
        toast.success('All caches cleared');
      } catch (error) {
        console.error('Error clearing caches:', error);
        toast.error('Failed to clear caches');
      }
    });
  };

  const resetSettings = async () => {
    if (busyRef.current) return;
    if (!confirm('Are you sure you want to reset all settings to defaults? This action cannot be undone.')) {
      return;
    }
    await runLocked('resetSettings', async () => {
      try {
        const data = await settingsService.resetSettings();
        setSettings(data);
        toast.success('Settings reset to defaults');
        window.dispatchEvent(new Event('settingsUpdated'));
      } catch (error) {
        console.error('Error resetting settings:', error);
        toast.error('Failed to reset settings');
      }
    });
  };

  if (!settings) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-900 border-t-transparent"></div>
          <p className="text-gray-600 text-sm">Loading settings...</p>
        </div>
      </div>
    );
  }

  const tabs: { id: TabType; label: string; icon: typeof Settings }[] = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'logo', label: 'Logo & Icon', icon: ImageIcon },
  ];

  return (
    <div className="min-h-screen bg-gray-50 admin-page-scroll">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Header */}
        <div className="mb-4 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Settings</h1>
              <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-500">
                Shop details, currency, logo and browser icon
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={resetCaches}
                disabled={isLoading}
                aria-busy={busyAction === 'resetCaches'}
                className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium text-gray-900 bg-honey-500 rounded-lg hover:bg-honey-600 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
                title="Clear all server caches"
              >
                {busyAction === 'resetCaches' ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Clearing…</>
                ) : (
                  <><Zap className="h-4 w-4" />Reset All Caches</>
                )}
              </button>
              <button
                onClick={resetSettings}
                disabled={isLoading}
                aria-busy={busyAction === 'resetSettings'}
                className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {busyAction === 'resetSettings' ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Resetting…</>
                ) : (
                  <><RotateCcw className="h-4 w-4" />Reset</>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 mb-4 sm:mb-6">
          <div className="border-b border-gray-200 overflow-x-auto">
            <nav className="flex -mb-px min-w-max">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium border-b-2 transition-all duration-200 whitespace-nowrap ${
                      isActive
                        ? 'border-gray-900 text-gray-900'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-3 sm:p-6">
            {activeTab === 'general' && (
              <GeneralSettings
                settings={settings}
                onUpdate={(data) => updateSettings(data, 'general')}
                isLoading={isLoading}
                isSaving={busyAction === 'general'}
              />
            )}

            {activeTab === 'logo' && (
              <LogoSettings
                currentLogo={settings.logoUrl}
                onUploadLogo={uploadLogo}
                onRemoveLogo={removeLogo}
                currentFavicon={settings.faviconUrl || ''}
                onUploadFavicon={uploadFavicon}
                onRemoveFavicon={removeFavicon}
                isLoading={isLoading}
                busyAction={busyAction}
              />
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
