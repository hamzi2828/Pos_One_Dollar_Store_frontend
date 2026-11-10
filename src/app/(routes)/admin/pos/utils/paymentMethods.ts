// POS payment methods: one place for the on-screen names.
// Owner, 2026-11-11: card and bank_transfer both go to the shop's UBL account;
// JazzCash is its own method (money goes to the JazzCash wallet, not UBL).

/** Methods where the customer sends money by phone (amount typed in, optional proof screenshot). */
export const TRANSFER_METHODS = ['bank_transfer', 'jazzcash'] as const;

/** True for Bank (UBL) and JazzCash: they work like cash (amount typed, change can be given back). */
export const isTransferMethod = (m: string | undefined | null): m is 'bank_transfer' | 'jazzcash' =>
  m === 'bank_transfer' || m === 'jazzcash';

const LABELS: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  bank_transfer: 'Bank (UBL)',
  jazzcash: 'JazzCash',
  split: 'Split',
};

/** On-screen name of a payment method ("Bank (UBL)", "JazzCash", ...). */
export const paymentMethodLabel = (m: string | undefined | null): string => {
  if (!m) return '';
  return LABELS[m] || m.charAt(0).toUpperCase() + m.slice(1).replace(/_/g, ' ');
};
