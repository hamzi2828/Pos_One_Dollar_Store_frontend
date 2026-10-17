'use client';

import { useEffect } from 'react';
import { settingsService } from '../app/(routes)/admin/settings/services/settingsService';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

function getFullUrl(url: string) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('/')) return `${BACKEND_URL}${url}`;
  return `${BACKEND_URL}/${url}`;
}

export default function DynamicFavicon() {
  useEffect(() => {
    const setFavicon = (url: string) => {
      const fullUrl = getFullUrl(url);
      if (!fullUrl) return;

      // Remove existing favicons
      const existing = document.querySelectorAll("link[rel='icon'], link[rel='shortcut icon']");
      existing.forEach(el => el.remove());

      // Add new favicon
      const link = document.createElement('link');
      link.rel = 'icon';
      link.href = fullUrl;
      document.head.appendChild(link);
    };

    const fetchFavicon = async () => {
      try {
        const settings = await settingsService.getPublicSettings();
        if (settings.faviconUrl) {
          setFavicon(settings.faviconUrl);
        }
      } catch (error) {
        // Silently fail - default favicon will be used
      }
    };

    fetchFavicon();

    const handleSettingsUpdate = () => fetchFavicon();
    window.addEventListener('settingsUpdated', handleSettingsUpdate);
    return () => window.removeEventListener('settingsUpdated', handleSettingsUpdate);
  }, []);

  return null;
}
