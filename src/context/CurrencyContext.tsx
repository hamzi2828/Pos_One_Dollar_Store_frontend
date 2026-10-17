'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

// Currency configuration
export const CURRENCY_CONFIG = {
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US' },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', locale: 'en-GB' },
  PKR: { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee', locale: 'en-PK' },
} as const;

export type CurrencyCode = keyof typeof CURRENCY_CONFIG;

interface CurrencyInfo {
  code: CurrencyCode;
  symbol: string;
  name: string;
  locale: string;
}

interface CurrencyContextType {
  currency: CurrencyInfo;
  isLoading: boolean;
  error: string | null;
  formatPrice: (amount: number, showSymbol?: boolean) => string;
  formatPriceShort: (amount: number) => string;
  refreshCurrency: () => Promise<void>;
  setCurrencyCode: (code: CurrencyCode) => void;
}

const defaultCurrency: CurrencyInfo = CURRENCY_CONFIG.USD;

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrency] = useState<CurrencyInfo>(defaultCurrency);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch currency from settings API (works with or without auth)
  const fetchCurrency = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Build headers - include auth token if available
      const headers: HeadersInit = {};
      const token = localStorage.getItem('auth_token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Try public settings endpoint first, then fall back to authenticated endpoint
      const endpoints = [
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/settings/public`,
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/settings`,
      ];

      let success = false;
      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, { headers });
          if (response.ok) {
            const data = await response.json();
            const settings = data.data || data;
            const currencyCode = settings.currency as CurrencyCode;

            if (currencyCode && CURRENCY_CONFIG[currencyCode]) {
              setCurrency(CURRENCY_CONFIG[currencyCode]);
              localStorage.setItem('app_currency', currencyCode);
              success = true;
              break;
            }
          }
        } catch {
          // Try next endpoint
          continue;
        }
      }

      if (!success) {
        // Use cached currency if API fails
        const cached = localStorage.getItem('app_currency') as CurrencyCode;
        if (cached && CURRENCY_CONFIG[cached]) {
          setCurrency(CURRENCY_CONFIG[cached]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch currency settings:', err);
      setError('Failed to load currency settings');

      // Try to use cached currency
      const cached = localStorage.getItem('app_currency') as CurrencyCode;
      if (cached && CURRENCY_CONFIG[cached]) {
        setCurrency(CURRENCY_CONFIG[cached]);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initialize currency on mount
  useEffect(() => {
    // First, check localStorage for cached currency (instant load)
    const cached = localStorage.getItem('app_currency') as CurrencyCode;
    if (cached && CURRENCY_CONFIG[cached]) {
      setCurrency(CURRENCY_CONFIG[cached]);
    }

    // Then fetch fresh data from API
    fetchCurrency();

    // Listen for settings updates
    const handleSettingsUpdate = () => {
      fetchCurrency();
    };

    window.addEventListener('settingsUpdated', handleSettingsUpdate);
    window.addEventListener('storage', (e) => {
      if (e.key === 'app_currency' && e.newValue) {
        const newCode = e.newValue as CurrencyCode;
        if (CURRENCY_CONFIG[newCode]) {
          setCurrency(CURRENCY_CONFIG[newCode]);
        }
      }
    });

    return () => {
      window.removeEventListener('settingsUpdated', handleSettingsUpdate);
    };
  }, [fetchCurrency]);

  // Format price with full formatting
  const formatPrice = useCallback((amount: number, showSymbol = true): string => {
    try {
      const formatted = new Intl.NumberFormat(currency.locale, {
        style: 'currency',
        currency: currency.code,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);

      return showSymbol ? formatted : formatted.replace(currency.symbol, '').trim();
    } catch {
      // Fallback formatting
      return showSymbol
        ? `${currency.symbol}${amount.toFixed(2)}`
        : amount.toFixed(2);
    }
  }, [currency]);

  // Format price short (just symbol + number)
  const formatPriceShort = useCallback((amount: number): string => {
    return `${currency.symbol}${amount.toLocaleString(currency.locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }, [currency]);

  // Manually set currency (updates localStorage too)
  const setCurrencyCode = useCallback((code: CurrencyCode) => {
    if (CURRENCY_CONFIG[code]) {
      setCurrency(CURRENCY_CONFIG[code]);
      localStorage.setItem('app_currency', code);
      // Dispatch event for other tabs/components
      window.dispatchEvent(new CustomEvent('currencyChanged', { detail: code }));
    }
  }, []);

  const value: CurrencyContextType = {
    currency,
    isLoading,
    error,
    formatPrice,
    formatPriceShort,
    refreshCurrency: fetchCurrency,
    setCurrencyCode,
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

// Custom hook to use currency context
export function useCurrency(): CurrencyContextType {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}

// Standalone format function for use outside React components
export function formatCurrencyStandalone(amount: number, currencyCode: CurrencyCode = 'USD'): string {
  const config = CURRENCY_CONFIG[currencyCode] || CURRENCY_CONFIG.USD;
  try {
    return new Intl.NumberFormat(config.locale, {
      style: 'currency',
      currency: config.code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${config.symbol}${amount.toFixed(2)}`;
  }
}
