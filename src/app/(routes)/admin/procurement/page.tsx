'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Users, FileText, Wallet, AlertTriangle, Loader2 } from 'lucide-react';
import { procurementService, type Summary } from './services/procurementService';
import VendorsTab from './components/VendorsTab';
import PurchasesTab from './components/PurchasesTab';
import TransactionsTab from './components/TransactionsTab';

const VALID = ['vendors', 'purchases', 'transactions'] as const;
type Tab = typeof VALID[number];

export default function ProcurementPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: Tab = (VALID as readonly string[]).includes(tabParam ?? '') ? (tabParam as Tab) : 'purchases';

  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  const loadSummary = () => {
    setLoadingSummary(true);
    procurementService.getSummary()
      .then(setSummary)
      .catch(() => {})
      .finally(() => setLoadingSummary(false));
  };

  useEffect(() => { loadSummary(); }, []);

  const setTab = (t: Tab) => {
    router.push(`/admin/procurement?tab=${t}`, { scroll: false });
  };

  return (
    <div className="min-h-screen bg-gray-50 admin-page-scroll">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-base sm:text-lg md:text-xl font-bold text-gray-900">Procurement</h1>
          <p className="text-xs sm:text-sm text-gray-500">Manage vendors, purchase orders and payments</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-4">
          <SummaryCard
            icon={Users}
            label="Vendors"
            value={summary?.vendorCount ?? 0}
            loading={loadingSummary}
            tone="gray"
          />
          <SummaryCard
            icon={FileText}
            label="Purchases"
            value={summary?.purchaseCount ?? 0}
            loading={loadingSummary}
            tone="blue"
          />
          <SummaryCard
            icon={Wallet}
            label="Total Pending"
            value={summary?.totalPending ?? 0}
            loading={loadingSummary}
            tone="honey"
            currency
          />
          <SummaryCard
            icon={AlertTriangle}
            label="Overdue"
            value={summary?.byStatus.overdue ?? 0}
            loading={loadingSummary}
            tone="red"
            secondary={summary ? `${(summary.pendingByStatus.overdue ?? 0).toFixed(2)} outstanding` : undefined}
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200 mb-3">
          {VALID.map((t) => {
            // URL key kept as `transactions` for back-compat; display label is "Payments".
            const label = t === 'transactions' ? 'Payments' : t.charAt(0).toUpperCase() + t.slice(1);
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === t
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {activeTab === 'vendors' && <VendorsTab />}
        {activeTab === 'purchases' && <PurchasesTab />}
        {activeTab === 'transactions' && <TransactionsTab />}
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon, label, value, loading, tone, currency, secondary,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  loading: boolean;
  tone: 'gray' | 'blue' | 'honey' | 'red';
  currency?: boolean;
  secondary?: string;
}) {
  const toneBg = {
    gray: 'bg-gray-100 text-gray-700',
    blue: 'bg-blue-50 text-blue-700',
    honey: 'bg-amber-50 text-honey-600',
    red: 'bg-red-50 text-red-700',
  }[tone];
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`w-7 h-7 rounded-md flex items-center justify-center ${toneBg}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <p className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
      </div>
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-gray-300" />
      ) : (
        <>
          <p className="text-lg sm:text-xl font-bold text-gray-900 tabular-nums">
            {currency ? value.toFixed(2) : value.toLocaleString()}
          </p>
          {secondary && <p className="text-[10px] text-gray-400 tabular-nums">{secondary}</p>}
        </>
      )}
    </div>
  );
}
