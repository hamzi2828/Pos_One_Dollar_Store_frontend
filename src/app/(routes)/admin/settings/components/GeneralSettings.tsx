'use client';

import { useState, useEffect } from 'react';
import { Store, Globe, DollarSign, Check, Phone, MapPin, Percent, Clock } from 'lucide-react';
import { useCurrency, CurrencyCode } from '@/context/CurrencyContext';

interface GeneralSettingsProps {
  settings: any;
  onUpdate: (data: any) => void;
  isLoading?: boolean;
}

export default function GeneralSettings({ settings, onUpdate, isLoading }: GeneralSettingsProps) {
  const { setCurrencyCode } = useCurrency();

  const [formData, setFormData] = useState({
    siteName: settings?.siteName || 'Mirpur Mobile & Stationery',
    siteUrl: settings?.siteUrl || 'https://mirpur-pos.vercel.app',
    mobileNumber: settings?.mobileNumber || '',
    address: settings?.address || '',
    businessHours: settings?.businessHours || '',
    currency: settings?.currency || 'USD',
    taxRate: settings?.taxRate ?? 0,
  });

  // Sync form data when settings prop changes
  useEffect(() => {
    if (settings) {
      setFormData({
        siteName: settings.siteName || 'Mirpur Mobile & Stationery',
        siteUrl: settings.siteUrl || 'https://mirpur-pos.vercel.app',
        mobileNumber: settings.mobileNumber || '',
        address: settings.address || '',
        businessHours: settings.businessHours || '',
        currency: settings.currency || 'USD',
        taxRate: settings.taxRate ?? 0,
      });
    }
  }, [settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Ensure taxRate is sent as a number
    const dataToSend = {
      ...formData,
      taxRate: Number(formData.taxRate) || 0,
    };

    onUpdate(dataToSend);

    // Update localStorage and dispatch event to notify sidebar
    if (formData.siteName) {
      localStorage.setItem('siteName', formData.siteName);
    }

    // Store tax rate in localStorage for checkout calculations
    localStorage.setItem('taxRate', dataToSend.taxRate.toString());

    // Update global currency context
    setCurrencyCode(formData.currency as CurrencyCode);

    window.dispatchEvent(new Event('settingsUpdated'));
  };

  const handleChange = (field: string, value: string | number) => {
    if (field === 'taxRate') {
      const numValue = parseFloat(value as string) || 0;
      setFormData(prev => ({ ...prev, [field]: Math.min(100, Math.max(0, numValue)) }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const currencies = [
    { value: 'USD', label: 'USD', name: 'US Dollar', symbol: '$' },
    { value: 'GBP', label: 'GBP', name: 'British Pound', symbol: '£' },
    { value: 'PKR', label: 'PKR', name: 'Pakistani Rupee', symbol: '₨' },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6 md:space-y-8">
      {/* Site Information Section */}
      <div>
        <div className="flex items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
          <Store className="h-4 w-4 sm:h-5 sm:w-5 text-gray-700" />
          <h3 className="text-sm sm:text-base font-semibold text-gray-900">Site Information</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
          <div>
            <label htmlFor="siteName" className="block text-sm font-medium text-gray-700 mb-2">
              Site Name
            </label>
            <input
              id="siteName"
              type="text"
              value={formData.siteName}
              onChange={(e) => handleChange('siteName', e.target.value)}
              placeholder="Enter site name"
              required
              className="w-full px-4 py-2.5 text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200 placeholder:text-gray-400"
            />
          </div>

          <div>
            <label htmlFor="siteUrl" className="block text-sm font-medium text-gray-700 mb-2">
              Site URL
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                id="siteUrl"
                type="url"
                value={formData.siteUrl}
                onChange={(e) => handleChange('siteUrl', e.target.value)}
                placeholder="https://your-site.com"
                required
                className="w-full pl-10 pr-4 py-2.5 text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200 placeholder:text-gray-400"
              />
            </div>
          </div>

          <div>
            <label htmlFor="mobileNumber" className="block text-sm font-medium text-gray-700 mb-2">
              Mobile Number
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                id="mobileNumber"
                type="tel"
                value={formData.mobileNumber}
                onChange={(e) => handleChange('mobileNumber', e.target.value)}
                placeholder="+1 234 567 8900"
                className="w-full pl-10 pr-4 py-2.5 text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200 placeholder:text-gray-400"
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
              Business Address
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <textarea
                id="address"
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder="Enter your business address"
                rows={3}
                className="w-full pl-10 pr-4 py-2.5 text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200 placeholder:text-gray-400 resize-none"
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="businessHours" className="block text-sm font-medium text-gray-700 mb-2">
              Business Hours
            </label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                id="businessHours"
                type="text"
                value={formData.businessHours}
                onChange={(e) => handleChange('businessHours', e.target.value)}
                placeholder="e.g. Mon–Sat · 8am–8pm"
                className="w-full pl-10 pr-4 py-2.5 text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200 placeholder:text-gray-400"
              />
            </div>
          </div>

        </div>
      </div>

      {/* Currency & Tax Section */}
      <div className="pt-4 sm:pt-5 md:pt-6 border-t border-gray-200">
        <div className="flex items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
          <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-gray-700" />
          <h3 className="text-sm sm:text-base font-semibold text-gray-900">Currency & Tax</h3>
        </div>

        {/* Currency Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-6">
          {currencies.map((currency) => (
            <button
              key={currency.value}
              type="button"
              onClick={() => handleChange('currency', currency.value)}
              className={`relative flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg sm:rounded-xl border-2 transition-all duration-200 ${
                formData.currency === currency.value
                  ? 'border-honey-500 bg-sage-100 shadow-md'
                  : 'border-gray-200 hover:border-honey-500 hover:bg-sage-100/50 bg-white'
              }`}
            >
              <div className={`flex items-center justify-center w-10 h-10 rounded-full font-semibold ${
                formData.currency === currency.value
                  ? 'bg-honey-500 text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}>
                {currency.symbol}
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">{currency.label}</p>
                <p className="text-sm text-gray-500">{currency.name}</p>
              </div>
              {formData.currency === currency.value && (
                <div className="absolute top-2 right-2">
                  <div className="w-5 h-5 rounded-full bg-honey-500 flex items-center justify-center">
                    <Check className="h-3 w-3 text-charcoal" />
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Tax Rate */}
        <div className="max-w-xs">
          <label htmlFor="taxRate" className="block text-sm font-medium text-gray-700 mb-2">
            Tax Rate
          </label>
          <div className="relative">
            <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              id="taxRate"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={formData.taxRate}
              onChange={(e) => handleChange('taxRate', e.target.value)}
              placeholder="0"
              className="w-full pl-10 pr-12 py-2.5 text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200 placeholder:text-gray-400"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">%</span>
          </div>
          <p className="mt-1.5 text-xs text-gray-500">
            This tax rate will be applied to all orders at checkout
          </p>
        </div>
      </div>

      {/* Save Button */}
      <div className="pt-4 sm:pt-5 md:pt-6 border-t border-gray-200 flex justify-end">
        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-honey-500 rounded-lg hover:bg-honey-600 focus:ring-2 focus:ring-offset-2 focus:ring-honey-500 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              Saving...
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
