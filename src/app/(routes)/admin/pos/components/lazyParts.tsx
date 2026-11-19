// POS parts that are not needed to show the screen (pop-up windows and the
// Held / Pending tabs) load in their own files, after the main screen. So the
// first load is smaller and the screen appears sooner on a slow connection.
// They are fetched straight after the page starts (see preload below), so
// they are ready (and saved by the service worker) before the cashier needs them.
'use client';

import dynamic from 'next/dynamic';

const loadCustomerSelector = () => import('./CustomerSelector');
const loadVariantSelector = () => import('./VariantSelector');
const loadPaymentModal = () => import('./PaymentModal');
const loadHeldOrders = () => import('./HeldOrders');
const loadPendingPaymentsTab = () => import('./PendingPaymentsTab');
const loadProductInsightPanel = () => import('@/components/store/ProductInsightPanel');

export const CustomerSelector = dynamic(loadCustomerSelector, { ssr: false });
export const VariantSelector = dynamic(loadVariantSelector, { ssr: false });
export const PaymentModal = dynamic(loadPaymentModal, { ssr: false });
export const HeldOrders = dynamic(loadHeldOrders, { ssr: false });
export const PendingPaymentsTab = dynamic(loadPendingPaymentsTab, { ssr: false });
export const ProductInsightPanel = dynamic(loadProductInsightPanel, { ssr: false });

// Fetch the tabs too (the pop-ups are always on the page, so they load anyway).
if (typeof window !== 'undefined') {
  const preload = () => {
    for (const load of [loadPaymentModal, loadVariantSelector, loadCustomerSelector, loadHeldOrders, loadPendingPaymentsTab, loadProductInsightPanel]) {
      load().catch(() => undefined);
    }
  };
  setTimeout(preload, 0);
}
