'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { Settings, Image as ImageIcon, RotateCcw, Mail, Zap } from 'lucide-react';

import GeneralSettings from './components/GeneralSettings';
import LogoSettings from './components/LogoSettings';
import SMTPSettings from './components/SMTPSettings';
import { settingsService, SettingsData } from './services/settingsService';

const VALID_TABS = ['general', 'logo', 'smtp'] as const;
type TabType = typeof VALID_TABS[number];

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const tabParam = searchParams.get('tab');
  const activeTab: TabType = VALID_TABS.includes(tabParam as TabType) ? (tabParam as TabType) : 'general';

  const setActiveTab = (tab: TabType) => {
    router.push(`/admin/settings?tab=${tab}`, { scroll: false });
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const data = await settingsService.getSettings();
      setSettings(data);
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  const updateSettings = async (updateData: Partial<SettingsData>) => {
    try {
      setIsLoading(true);
      const data = await settingsService.updateSettings(updateData);
      setSettings(data);
      toast.success('Settings updated successfully');
      window.dispatchEvent(new Event('settingsUpdated'));
    } catch (error) {
      console.error('Error updating settings:', error);
      toast.error('Failed to update settings');
    } finally {
      setIsLoading(false);
    }
  };

  const uploadLogo = async (file: File) => {
    try {
      setIsLoading(true);
      const data = await settingsService.uploadLogo(file);
      setSettings(prev => prev ? { ...prev, logoUrl: data.logoUrl } : null);
      toast.success('Header logo uploaded');
      window.dispatchEvent(new Event('settingsUpdated'));
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error('Failed to upload logo');
    } finally {
      setIsLoading(false);
    }
  };

  const removeLogo = async () => {
    try {
      setIsLoading(true);
      await settingsService.removeLogo();
      setSettings(prev => prev ? { ...prev, logoUrl: '' } : null);
      toast.success('Header logo removed');
      window.dispatchEvent(new Event('settingsUpdated'));
    } catch (error) {
      console.error('Error removing logo:', error);
      toast.error('Failed to remove logo');
    } finally {
      setIsLoading(false);
    }
  };

  const uploadFooterLogo = async (file: File) => {
    try {
      setIsLoading(true);
      const data = await settingsService.uploadFooterLogo(file);
      setSettings(prev => prev ? { ...prev, footerLogoUrl: data.footerLogoUrl } : null);
      toast.success('Footer logo uploaded');
      window.dispatchEvent(new Event('settingsUpdated'));
    } catch (error) {
      console.error('Error uploading footer logo:', error);
      toast.error('Failed to upload footer logo');
    } finally {
      setIsLoading(false);
    }
  };

  const removeFooterLogo = async () => {
    try {
      setIsLoading(true);
      await settingsService.removeFooterLogo();
      setSettings(prev => prev ? { ...prev, footerLogoUrl: '' } : null);
      toast.success('Footer logo removed');
      window.dispatchEvent(new Event('settingsUpdated'));
    } catch (error) {
      console.error('Error removing footer logo:', error);
      toast.error('Failed to remove footer logo');
    } finally {
      setIsLoading(false);
    }
  };

  const uploadFavicon = async (file: File) => {
    try {
      setIsLoading(true);
      const data = await settingsService.uploadFavicon(file);
      setSettings(prev => prev ? { ...prev, faviconUrl: data.faviconUrl } : null);
      toast.success('Favicon uploaded');
      window.dispatchEvent(new Event('settingsUpdated'));
    } catch (error) {
      console.error('Error uploading favicon:', error);
      toast.error('Failed to upload favicon');
    } finally {
      setIsLoading(false);
    }
  };

  const removeFavicon = async () => {
    try {
      setIsLoading(true);
      await settingsService.removeFavicon();
      setSettings(prev => prev ? { ...prev, faviconUrl: '' } : null);
      toast.success('Favicon removed');
      window.dispatchEvent(new Event('settingsUpdated'));
    } catch (error) {
      console.error('Error removing favicon:', error);
      toast.error('Failed to remove favicon');
    } finally {
      setIsLoading(false);
    }
  };

  const resetCaches = async () => {
    if (!confirm('Clear all server-side caches? Public pages will refetch fresh data on the next request.')) {
      return;
    }
    try {
      setIsLoading(true);
      await settingsService.resetCaches();
      toast.success('All caches cleared');
    } catch (error) {
      console.error('Error clearing caches:', error);
      toast.error('Failed to clear caches');
    } finally {
      setIsLoading(false);
    }
  };

  const resetSettings = async () => {
    if (!confirm('Are you sure you want to reset all settings to defaults? This action cannot be undone.')) {
      return;
    }
    try {
      setIsLoading(true);
      const data = await settingsService.resetSettings();
      setSettings(data);
      toast.success('Settings reset to defaults');
    } catch (error) {
      console.error('Error resetting settings:', error);
      toast.error('Failed to reset settings');
    } finally {
      setIsLoading(false);
    }
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
    { id: 'logo', label: 'Logo', icon: ImageIcon },
    { id: 'smtp', label: 'SMTP', icon: Mail },
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
                Store preferences
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={resetCaches}
                disabled={isLoading}
                className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium text-white bg-honey-500 rounded-lg hover:bg-honey-600 transition-all duration-200 disabled:opacity-50 shadow-sm"
                title="Clear all server caches"
              >
                <Zap className="h-4 w-4" />
                Reset All Caches
              </button>
              <button
                onClick={resetSettings}
                disabled={isLoading}
                className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
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
                onUpdate={updateSettings}
                isLoading={isLoading}
              />
            )}

            {activeTab === 'logo' && (
              <LogoSettings
                currentLogo={settings.logoUrl}
                onUploadLogo={uploadLogo}
                onRemoveLogo={removeLogo}
                headerLogoWidth={settings.headerLogoWidth ?? 160}
                headerLogoHeight={settings.headerLogoHeight ?? 56}
                currentFooterLogo={settings.footerLogoUrl || ''}
                onUploadFooterLogo={uploadFooterLogo}
                onRemoveFooterLogo={removeFooterLogo}
                footerLogoWidth={settings.footerLogoWidth ?? 100}
                footerLogoHeight={settings.footerLogoHeight ?? 36}
                currentFavicon={settings.faviconUrl || ''}
                onUploadFavicon={uploadFavicon}
                onRemoveFavicon={removeFavicon}
                isLoading={isLoading}
                onSaveDimensions={(dims) => updateSettings(dims)}
              />
            )}

            {activeTab === 'smtp' && (
              <SMTPSettings
                settings={settings}
                onUpdate={updateSettings}
                isLoading={isLoading}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
