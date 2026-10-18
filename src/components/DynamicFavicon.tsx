'use client';

import { useEffect } from 'react';
import { settingsService } from '../app/(routes)/admin/settings/services/settingsService';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

// Uploaded favicons live on the backend (/uploads/...); other paths are files of this app.
function getFullUrl(url: string) {
  if (!url) return '';
  if (/^https?:\/\//.test(url)) return url;
  if (url.startsWith('/uploads')) return `${BACKEND_URL}${url}`;
  if (url.startsWith('/')) return url;
  return `${BACKEND_URL}/${url}`;
}

export default function DynamicFavicon() {
  useEffect(() => {
    const setFavicon = (url: string) => {
      const fullUrl = getFullUrl(url);
      if (!fullUrl) return;

      // Replace the default icon links with the uploaded one.
      const existing = document.querySelectorAll("link[rel='icon'], link[rel='shortcut icon']");
      existing.forEach(el => el.remove());

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
      } catch {
        // Keep the built-in /favicon.ico.
      }
    };

    fetchFavicon();

    const handleSettingsUpdate = () => fetchFavicon();
    window.addEventListener('settingsUpdated', handleSettingsUpdate);
    return () => window.removeEventListener('settingsUpdated', handleSettingsUpdate);
  }, []);

  return null;
}
