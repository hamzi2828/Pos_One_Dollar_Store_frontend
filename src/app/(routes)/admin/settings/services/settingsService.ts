const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
import { getAuthHeader } from "@/helper/helper";

/** Which settings action is currently in flight (drives per-button spinners). */
export type SettingsBusyAction =
  | 'fetch'
  | 'general'
  | 'uploadLogo'
  | 'removeLogo'
  | 'uploadFavicon'
  | 'removeFavicon'
  | 'resetCaches'
  | 'resetSettings';

interface SettingsData {
  siteName: string;
  logoUrl: string;
  faviconUrl?: string;
  timezone: string;
  dateFormat: string;
  currency: string;
  isActive: boolean;
  version: string;
  mobileNumber?: string;
  address?: string;
  businessHours?: string;
}

// DynamicFavicon, the currency context and the sidebar all read the public
// settings on load. Share one in-flight promise + a short-lived cache so they
// collapse into a single request.
const PUBLIC_SETTINGS_TTL_MS = 5 * 60 * 1000;
let publicSettingsPromise: Promise<SettingsData> | null = null;
let publicSettingsCache: { data: SettingsData; expires: number } | null = null;

class SettingsService {
  async getPublicSettings(): Promise<SettingsData> {
    if (publicSettingsCache && publicSettingsCache.expires > Date.now()) {
      return publicSettingsCache.data;
    }
    if (publicSettingsPromise) {
      return publicSettingsPromise;
    }

    publicSettingsPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/settings/public`, {
          method: 'GET',
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch public settings: ${response.statusText}`);
        }

        const json = await response.json();
        const data = (json.data || json) as SettingsData;
        publicSettingsCache = { data, expires: Date.now() + PUBLIC_SETTINGS_TTL_MS };
        return data;
      } catch (error) {
        console.error('Error fetching public settings:', error);
        throw error;
      } finally {
        publicSettingsPromise = null;
      }
    })();

    return publicSettingsPromise;
  }

  invalidatePublicSettingsCache() {
    publicSettingsCache = null;
    publicSettingsPromise = null;
  }

  async getSettings(): Promise<SettingsData> {
    try {
      const response = await fetch(`${API_BASE_URL}/settings`, {
        method: 'GET',
        headers: getAuthHeader(),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch settings: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data || data;
    } catch (error) {
      console.error('Error fetching settings:', error);
      throw error;
    }
  }

  async updateSettings(updateData: Partial<SettingsData>): Promise<SettingsData> {
    try {
      const response = await fetch(`${API_BASE_URL}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        throw new Error(`Failed to update settings: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data || data;
    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
    }
  }

  async uploadLogo(file: File): Promise<{ logoUrl: string }> {
    try {
      const formData = new FormData();
      formData.append('logo', file);

      const response = await fetch(`${API_BASE_URL}/settings/logo`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Failed to upload logo: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error uploading logo:', error);
      throw error;
    }
  }

  async removeLogo(): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/settings/logo`, {
        method: 'DELETE',
        headers: getAuthHeader(),
      });

      if (!response.ok) {
        throw new Error(`Failed to remove logo: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error removing logo:', error);
      throw error;
    }
  }

  async uploadFavicon(file: File): Promise<{ faviconUrl: string }> {
    const formData = new FormData();
    formData.append('favicon', file);
    const response = await fetch(`${API_BASE_URL}/settings/favicon`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: formData,
    });
    if (!response.ok) throw new Error(`Failed to upload favicon: ${response.statusText}`);
    const data = await response.json();
    return data.data || data;
  }

  async removeFavicon(): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/settings/favicon`, {
      method: 'DELETE',
      headers: getAuthHeader(),
    });
    if (!response.ok) throw new Error(`Failed to remove favicon: ${response.statusText}`);
  }

  async resetCaches(): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/settings/cache/reset`, {
      method: 'POST',
      headers: getAuthHeader(),
    });
    if (!response.ok) {
      throw new Error(`Failed to reset caches: ${response.statusText}`);
    }
  }

  async resetSettings(): Promise<SettingsData> {
    try {
      const response = await fetch(`${API_BASE_URL}/settings/reset`, {
        method: 'POST',
        headers: getAuthHeader(),
      });

      if (!response.ok) {
        throw new Error(`Failed to reset settings: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data || data;
    } catch (error) {
      console.error('Error resetting settings:', error);
      throw error;
    }
  }
}

// Export a singleton instance
export const settingsService = new SettingsService();
export type { SettingsData };

if (typeof window !== 'undefined') {
  window.addEventListener('settingsUpdated', () => {
    settingsService.invalidatePublicSettingsCache();
  });
}