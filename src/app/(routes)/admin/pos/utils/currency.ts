// Currency symbol helper for POS
// Keeps symbols consistent with HK's CurrencyContext (PKR uses ₨)
const CURRENCY_SYMBOLS: Record<string, string> = {
  PKR: '₨',
  USD: '$',
  GBP: '£',
  EUR: '€',
};

export function getCurrencySymbol(code?: string): string {
  if (!code) return '₨';
  return CURRENCY_SYMBOLS[code.toUpperCase()] || code + ' ';
}
