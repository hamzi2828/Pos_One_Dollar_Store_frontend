'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

// The shop sells in Pakistani rupees. Other codes stay selectable in Settings
// in case the owner ever needs them, but PKR is the default everywhere.
export const CURRENCY_CONFIG = {
  PKR: { code: 'PKR', symbol: 'Rs', name: 'Pakistani Rupee', locale: 'en-PK' },
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US' },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', locale: 'en-GB' },
} as const;

export type CurrencyCode = keyof typeof CURRENCY_CONFIG;

export const DEFAULT_CURRENCY: CurrencyCode = 'PKR';

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

const STORAGE_KEY = 'app_currency';

function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === 'string' && value in CURRENCY_CONFIG;
}

function readCachedCurrency(): CurrencyCode | null {
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    return isCurrencyCode(cached) ? cached : null;
  } catch {
    return null;
  }
}

/** "Rs 1,250" / "Rs 99.50" — whole amounts drop the decimals, like the receipts. */
function formatAmount(amount: number, config: CurrencyInfo, showSymbol = true): string {
  const n = Number(amount) || 0;
  const decimals = Number.isInteger(Math.round(n * 100) / 100) ? 0 : 2;
  const number = n.toLocaleString(config.locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return showSymbol ? `${config.symbol} ${number}` : number;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrency] = useState<CurrencyInfo>(CURRENCY_CONFIG[DEFAULT_CURRENCY]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Read the currency from the settings API (public endpoint first, so the
  // login page works too), falling back to the last value we saw.
  const fetchCurrency = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const headers: HeadersInit = {};
    try {
      const token = localStorage.getItem('auth_token');
      if (token) headers['Authorization'] = `Bearer ${token}`;
    } catch {
      // Storage blocked — carry on without a token.
    }

    const base = process.env.NEXT_PUBLIC_BACKEND_URL;
    const endpoints = [`${base}/settings/public`, `${base}/settings`];

    try {
      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, { headers });
          if (!response.ok) continue;
          const data = await response.json();
          const code = (data?.data || data)?.currency;
          if (isCurrencyCode(code)) {
            setCurrency(CURRENCY_CONFIG[code]);
            try { localStorage.setItem(STORAGE_KEY, code); } catch { /* ignore */ }
            return;
          }
        } catch {
          // Try the next endpoint.
        }
      }

      const cached = readCachedCurrency();
      if (cached) setCurrency(CURRENCY_CONFIG[cached]);
    } catch (err) {
      console.error('Failed to fetch currency settings:', err);
      setError('Failed to load currency settings');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Cached value first (instant), then the fresh one from the API.
    const cached = readCachedCurrency();
    if (cached) setCurrency(CURRENCY_CONFIG[cached]);
    fetchCurrency();

    const handleSettingsUpdate = () => fetchCurrency();
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && isCurrencyCode(e.newValue)) {
        setCurrency(CURRENCY_CONFIG[e.newValue]);
      }
    };

    window.addEventListener('settingsUpdated', handleSettingsUpdate);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('settingsUpdated', handleSettingsUpdate);
      window.removeEventListener('storage', handleStorage);
    };
  }, [fetchCurrency]);

  const formatPrice = useCallback(
    (amount: number, showSymbol = true): string => formatAmount(amount, currency, showSymbol),
    [currency]
  );

  const formatPriceShort = useCallback(
    (amount: number): string => formatAmount(amount, currency),
    [currency]
  );

  const setCurrencyCode = useCallback((code: CurrencyCode) => {
    if (!isCurrencyCode(code)) return;
    setCurrency(CURRENCY_CONFIG[code]);
    try { localStorage.setItem(STORAGE_KEY, code); } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent('currencyChanged', { detail: code }));
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

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextType {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}

/** Format outside React components (defaults to PKR: "Rs 1,250"). */
export function formatCurrencyStandalone(amount: number, currencyCode: CurrencyCode = DEFAULT_CURRENCY): string {
  return formatAmount(amount, CURRENCY_CONFIG[currencyCode] || CURRENCY_CONFIG[DEFAULT_CURRENCY]);
}
