'use client';

// /admin/vendors/payments — all vendor payments with filters (vendor, method,
// dates) + summary, record payment, void.

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Search, Wallet, Ban, Banknote } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage } from '@/helper/access';
import { formatRs } from '@/lib/storeApi';
import { useDebounced } from '@/helper/useDebounced';
import TablePagination from '@/components/admin/TablePagination';
import VendorPicker from '@/components/store/VendorPicker';
import { LoadingCard, NoAccessCard, inputClass, primaryBtn } from '@/components/admin/FormBits';
import { vendorApi, pkToday, PAYMENT_METHODS, type PaymentSummary, type VendorPayment } from '../services/vendorApi';
import { ErrorCard, StatCard, VendorsNav, cardClass } from '../components/ui';
import PaymentModal from '../components/PaymentModal';
import PaymentsTable from '../components/PaymentsTable';

export default function VendorPaymentsPage() {
  const { can } = useAccess();
  const canView = can('vendor_payments', 'view');
  const [rows, setRows] = useState<VendorPayment[]>([]);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [meta, setMeta] = useState({ page: 1, limit: 25, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [method, setMethod] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState(pkToday(-30));
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [recording, setRecording] = useState(false);
  const debounced = useDebounced(search.trim(), 300);

  const load = useCallback(async () => {
    if (!canView) return;
    try {
      setLoading(true);
      setError(null);
      const res = await vendorApi.payments({ vendor: vendorId, method, status, from, to, search: debounced, page, limit });
      setRows(res.data);
      setMeta(res.meta);
      setSummary(res.meta.summary || null);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load payments.'));
    } finally {
      setLoading(false);
    }
  }, [canView, vendorId, method, status, from, to, debounced, page, limit]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => setPage(1), [vendorId, method, status, from, to, debounced, limit]);

  if (!canView) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <VendorsNav />
        <NoAccessCard />
      </div>
    );
  }

  const top = summary
    ? Object.entries(summary.byMethod)
        .sort((a, b) => b[1].amount - a[1].amount)
        .slice(0, 2)
    : [];
  const label = (m: string) => PAYMENT_METHODS.find((x) => x.value === m)?.label || m;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Vendor Payments</h1>
            <p className="mt-0.5 text-xs sm:text-sm text-gray-500">Money paid to vendors. Each payment lowers the vendor&apos;s balance.</p>
          </div>
          {can('vendor_payments', 'create') && (
            <button onClick={() => setRecording(true)} className={primaryBtn}>
              <Plus className="h-4 w-4" /> Record payment
            </button>
          )}
        </div>
        <VendorsNav />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-4">
          <StatCard icon={<Wallet className="h-4 w-4" />} label="Paid (filtered)" value={summary ? formatRs(summary.total) : '—'} hint={summary ? `${summary.count} payments` : undefined} />
          {top.map(([m, v]) => (
            <StatCard key={m} tone="emerald" icon={<Banknote className="h-4 w-4" />} label={label(m)} value={formatRs(v.amount)} hint={`${v.count} payments`} />
          ))}
          {top.length < 2 && <StatCard tone="gray" icon={<Banknote className="h-4 w-4" />} label="Other methods" value="—" />}
          <StatCard tone="gray" icon={<Ban className="h-4 w-4" />} label="Voided" value={summary ? summary.voidedCount : '—'} hint={summary && summary.voidedAmount ? formatRs(summary.voidedAmount) : undefined} />
        </div>

        <div className={`${cardClass} p-3 sm:p-4 mb-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-2`}>
          <div className="lg:col-span-2">
            <VendorPicker value={vendorId} onChange={(id) => setVendorId(id)} includeInactive placeholder="All vendors (search to filter)" />
          </div>
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputClass} aria-label="Method">
            <option value="">All methods</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass} aria-label="Status">
            <option value="">Active + voided</option>
            <option value="active">Active only</option>
            <option value="voided">Voided only</option>
          </select>
          <div className="grid grid-cols-2 gap-2 lg:col-span-2">
            <input type="date" value={from} max={to || pkToday()} onChange={(e) => setFrom(e.target.value)} className={inputClass} aria-label="From" />
            <input type="date" value={to} min={from || undefined} max={pkToday()} onChange={(e) => setTo(e.target.value)} className={inputClass} aria-label="To" />
          </div>
          <div className="relative md:col-span-2 lg:col-span-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search payment no, cheque / transaction ref, notes…" className={`${inputClass} pl-9`} />
          </div>
        </div>

        {loading && !rows.length ? (
          <LoadingCard text="Loading payments…" />
        ) : error ? (
          <ErrorCard message={error} onRetry={load} />
        ) : (
          <div className={`${cardClass} overflow-hidden ${loading ? 'opacity-70' : ''}`}>
            <PaymentsTable rows={rows} onChanged={load} />
            <TablePagination page={meta.page} pages={meta.pages} total={meta.total} limit={limit} onPageChange={setPage} onLimitChange={setLimit} label="payments" loading={loading} />
          </div>
        )}
      </div>
      {recording && (
        <PaymentModal
          vendorId={vendorId}
          onClose={() => setRecording(false)}
          onSaved={(p) => {
            toast.success(`${p.paymentNo} recorded`);
            setRecording(false);
            load();
          }}
        />
      )}
    </div>
  );
}
