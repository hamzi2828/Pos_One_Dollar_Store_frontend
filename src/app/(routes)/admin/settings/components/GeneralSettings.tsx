'use client';

import { useState, useEffect } from 'react';
import { Store, Banknote, Check, Phone, MapPin, Clock, Loader2 } from 'lucide-react';
import { useCurrency, CurrencyCode, CURRENCY_CONFIG, DEFAULT_CURRENCY } from '@/context/CurrencyContext';
import { SHOP_NAME } from '@/components/ui/wordmark';
import type { SettingsData } from '../services/settingsService';

interface GeneralSettingsProps {
  settings: SettingsData | null;
  onUpdate: (data: Partial<SettingsData>) => void;
  isLoading?: boolean;
  /** True only while this form's own save is in flight (drives the spinner). */
  isSaving?: boolean;
}

type FormState = {
  siteName: string;
  mobileNumber: string;
  address: string;
  businessHours: string;
  currency: CurrencyCode;
};

const inputClass =
  'w-full px-4 py-2.5 text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200 placeholder:text-gray-400';

function toForm(settings: SettingsData | null): FormState {
  const currency = settings?.currency as CurrencyCode;
  return {
    siteName: settings?.siteName || SHOP_NAME,
    mobileNumber: settings?.mobileNumber || '',
    address: settings?.address || '',
    businessHours: settings?.businessHours || '',
    currency: currency in CURRENCY_CONFIG ? currency : DEFAULT_CURRENCY,
  };
}

export default function GeneralSettings({ settings, onUpdate, isLoading, isSaving }: GeneralSettingsProps) {
  const { setCurrencyCode } = useCurrency();
  const [formData, setFormData] = useState<FormState>(() => toForm(settings));

  useEffect(() => {
    if (settings) setFormData(toForm(settings));
  }, [settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Enter-key submits must respect the parent's in-flight lock too.
    if (isLoading) return;

    const siteName = formData.siteName.trim() || SHOP_NAME;
    onUpdate({ ...formData, siteName });

    // The sidebar shows the shop name from this cache until settings reload.
    try { localStorage.setItem('siteName', siteName); } catch { /* ignore */ }
    setCurrencyCode(formData.currency);
    window.dispatchEvent(new Event('settingsUpdated'));
  };

  const handleChange = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const currencies = Object.values(CURRENCY_CONFIG);

  return (
    <form onSubmit={handleSubmit} aria-busy={isSaving} className="space-y-5 sm:space-y-6 md:space-y-8">
      {/* Shop details */}
      <div>
        <div className="flex items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
          <Store className="h-4 w-4 sm:h-5 sm:w-5 text-gray-700" />
          <h3 className="text-sm sm:text-base font-semibold text-gray-900">Shop Details</h3>
        </div>
        <p className="-mt-2 mb-4 text-xs sm:text-sm text-gray-500">
          Shown on receipts, invoices and printed documents.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
          <div>
            <label htmlFor="siteName" className="block text-sm font-medium text-gray-700 mb-2">
              Shop Name
            </label>
            <input
              id="siteName"
              type="text"
              value={formData.siteName}
              onChange={(e) => handleChange('siteName', e.target.value)}
              placeholder={SHOP_NAME}
              required
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="mobileNumber" className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                id="mobileNumber"
                type="tel"
                value={formData.mobileNumber}
                onChange={(e) => handleChange('mobileNumber', e.target.value)}
                placeholder="0300 1234567"
                className={`${inputClass} pl-10`}
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
              Shop Address
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <textarea
                id="address"
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder="Street, area, city"
                rows={3}
                className={`${inputClass} pl-10 resize-none`}
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="businessHours" className="block text-sm font-medium text-gray-700 mb-2">
              Opening Hours
            </label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                id="businessHours"
                type="text"
                value={formData.businessHours}
                onChange={(e) => handleChange('businessHours', e.target.value)}
                placeholder="e.g. Mon–Sun · 10am–11pm"
                className={`${inputClass} pl-10`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Currency */}
      <div className="pt-4 sm:pt-5 md:pt-6 border-t border-gray-200">
        <div className="flex items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
          <Banknote className="h-4 w-4 sm:h-5 sm:w-5 text-gray-700" />
          <h3 className="text-sm sm:text-base font-semibold text-gray-900">Currency</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          {currencies.map((c) => {
            const selected = formData.currency === c.code;
            return (
              <button
                key={c.code}
                type="button"
                onClick={() => handleChange('currency', c.code)}
                aria-pressed={selected}
                className={`relative flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg sm:rounded-xl border-2 transition-all duration-200 ${
                  selected
                    ? 'border-honey-500 bg-sage-100 shadow-md'
                    : 'border-gray-200 hover:border-honey-500 hover:bg-sage-100/50 bg-white'
                }`}
              >
                <div className={`flex items-center justify-center w-10 h-10 rounded-full text-sm font-semibold ${
                  selected ? 'bg-honey-500 text-gray-900' : 'bg-gray-100 text-gray-700'
                }`}>
                  {c.symbol}
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">{c.code}</p>
                  <p className="text-sm text-gray-500">{c.name}</p>
                </div>
                {selected && (
                  <div className="absolute top-2 right-2">
                    <div className="w-5 h-5 rounded-full bg-honey-500 flex items-center justify-center">
                      <Check className="h-3 w-3 text-gray-900" />
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Save Button */}
      <div className="pt-4 sm:pt-5 md:pt-6 border-t border-gray-200 flex justify-end">
        <button
          type="submit"
          disabled={isLoading}
          aria-busy={isSaving}
          className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-gray-900 bg-honey-500 rounded-lg hover:bg-honey-600 focus:ring-2 focus:ring-offset-2 focus:ring-honey-500 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              Save Changes
            </>
          )}
        </button>
      </div>
    </form>
  );
}
