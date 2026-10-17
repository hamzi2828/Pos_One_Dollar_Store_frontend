const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
import { getAuthHeader } from "@/helper/helper";
interface SettingsData {
  siteName: string;
  siteUrl: string;
  logoUrl: string;
  headerLogoWidth?: number;
  headerLogoHeight?: number;
  footerLogoUrl?: string;
  footerLogoWidth?: number;
  footerLogoHeight?: number;
  faviconUrl?: string;
  timezone: string;
  dateFormat: string;
  currency: string;
  taxRate: number;
  emailNotifications: boolean;
  marketingEmails: boolean;
  securityAlerts: boolean;
  twoFactorAuth: boolean;
  isActive: boolean;
  version: string;
  posUrl?: string;
  mobileNumber?: string;
  address?: string;
  businessHours?: string;
  youtubeUrl?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  twitterUrl?: string;
  tiktokUrl?: string;
  // SMTP Settings
  smtpHost?: string;
  smtpPort?: string;
  smtpUser?: string;
  smtpPassword?: string;
  smtpFromEmail?: string;
  smtpFromName?: string;
  smtpSecure?: boolean;
  // Stripe Settings
  stripePublishableKey?: string;
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  stripeEnabled?: boolean;
}

// Module-level dedupe: Header, Footer, DynamicFavicon and OrderSummary all
// call getPublicSettings() independently on the home page. We share a single
// in-flight promise + a short-lived result cache so they collapse into one
// network round-trip per page load.
const PUBLIC_SETTINGS_TTL_MS = 5 * 60 * 1000;
let publicSettingsPromise: Promise<SettingsData> | null = null;
let publicSettingsCache: { data: SettingsData; expires: number } | null = null;

class SettingsService {

  private getAuthHeadersForFormData() {
    const token = localStorage.getItem('token');
    return {
      'Authorization': `Bearer ${token}`,
    };
  }

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

  async uploadFooterLogo(file: File): Promise<{ footerLogoUrl: string }> {
    const formData = new FormData();
    formData.append('logo', file);
    const response = await fetch(`${API_BASE_URL}/settings/footer-logo`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: formData,
    });
    if (!response.ok) throw new Error(`Failed to upload footer logo: ${response.statusText}`);
    const data = await response.json();
    return data.data || data;
  }

  async removeFooterLogo(): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/settings/footer-logo`, {
      method: 'DELETE',
      headers: getAuthHeader(),
    });
    if (!response.ok) throw new Error(`Failed to remove footer logo: ${response.statusText}`);
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