'use client';

// /admin/vendors/returns — goods returned to vendors (debit notes).
// Opens the "new return" form straight away for links like
//   /admin/vendors/returns?new=1&productId=...&vendorId=...&qty=...  (slow-moving report)

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Plus, Search, Undo2, FileClock, CheckCircle2 } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage } from '@/helper/access';
import { formatRs } from '@/lib/storeApi';
import { useDebounced } from '@/helper/useDebounced';
import TablePagination from '@/components/admin/TablePagination';
import VendorPicker from '@/components/store/VendorPicker';
import { HelpBox, LoadingCard, NoAccessCard, inputClass, primaryBtn } from '@/components/admin/FormBits';
import { vendorApi, pkToday, type VendorReturn } from '../services/vendorApi';
import { ErrorCard, StatCard, VendorsNav, cardClass } from '../components/ui';
import ReturnsList from '../components/ReturnsList';
import ReturnFormModal from '../components/ReturnFormModal';

type Summary = Record<'completed' | 'draft' | 'cancelled', { count: number; total: number; qty: number }>;
type Prefill = { vendorId?: string | null; productId?: string | null; variantId?: string | null; qty?: number | null };

function ReturnsPageInner() {
  const { can, loaded } = useAccess();
  const canView = can('vendor_returns', 'view');
  const router = useRouter();
  const params = useSearchParams();
  const [rows, setRows] = useState<VendorReturn[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [meta, setMeta] = useState({ page: 1, limit: 25, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<{ open: boolean; draft: VendorReturn | null; prefill?: Prefill }>({ open: false, draft: null });
  const debounced = useDebounced(search.trim(), 300);
  const handledLink = useRef(false);

  // Deep link from other screens (slow-moving report, vendor profile).
  useEffect(() => {
    if (!loaded || handledLink.current || params.get('new') !== '1') return;
    handledLink.current = true;
    if (!can('vendor_returns', 'create')) return;
    const qty = Number(params.get('qty'));
    setForm({
      open: true,
      draft: null,
      prefill: {
        vendorId: params.get('vendorId'),
        productId: params.get('productId'),
        variantId: params.get('variantId'),
        qty: Number.isFinite(qty) && qty > 0 ? qty : null,
      },
    });
    router.replace('/admin/vendors/returns');
  }, [params, router, can, loaded]);

  const load = useCallback(async () => {
    if (!canView) return;
    try {
      setLoading(true);
      setError(null);
      const res = await vendorApi.returns({ vendor: vendorId, status, from, to, search: debounced, page, limit: 25 });
      setRows(res.data);
      setMeta(res.meta);
      setSummary(res.meta.summary || null);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load returns.'));
    } finally {
      setLoading(false);
    }
  }, [canView, vendorId, status, from, to, debounced, page]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => setPage(1), [vendorId, status, from, to, debounced]);

  if (!canView) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <VendorsNav />
        <NoAccessCard />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Vendor Returns</h1>
            <p className="mt-0.5 text-xs sm:text-sm text-gray-500">Slow movers, damaged or wrong items sent back — the vendor&apos;s bill goes down.</p>
          </div>
          {can('vendor_returns', 'create') && (
            <button onClick={() => setForm({ open: true, draft: null })} className={primaryBtn}>
              <Plus className="h-4 w-4" /> New return
            </button>
          )}
        </div>
        <VendorsNav />

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 mb-4">
          <StatCard
            tone="amber"
            icon={<Undo2 className="h-4 w-4" />}
            label="Returned (debit notes)"
            value={summary ? formatRs(summary.completed.total) : '—'}
            hint={summary ? `${summary.completed.count} returns · ${summary.completed.qty} pcs` : undefined}
          />
          <StatCard tone="gray" icon={<FileClock className="h-4 w-4" />} label="Drafts" value={summary ? summary.draft.count : '—'} hint={summary ? formatRs(summary.draft.total) : undefined} />
          <div className="col-span-2 lg:col-span-1">
            <StatCard tone="emerald" icon={<CheckCircle2 className="h-4 w-4" />} label="Completed" value={summary ? summary.completed.count : '—'} />
          </div>
        </div>

        <div className={`${cardClass} p-3 sm:p-4 mb-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-2`}>
          <div className="lg:col-span-2">
            <VendorPicker value={vendorId} onChange={(id) => setVendorId(id)} includeInactive placeholder="All vendors (search to filter)" />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass} aria-label="Status">
            <option value="">All statuses</option>
            <option value="draft">Drafts</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <div className="grid grid-cols-2 gap-2 lg:col-span-2">
            <input type="date" value={from} max={to || pkToday()} onChange={(e) => setFrom(e.target.value)} className={inputClass} aria-label="From" />
            <input type="date" value={to} min={from || undefined} max={pkToday()} onChange={(e) => setTo(e.target.value)} className={inputClass} aria-label="To" />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Return no, product…" className={`${inputClass} pl-9`} />
          </div>
        </div>

        {loading && !rows.length ? (
          <LoadingCard text="Loading returns…" />
        ) : error ? (
          <ErrorCard message={error} onRetry={load} />
        ) : (
          <div className={`${cardClass} overflow-hidden ${loading ? 'opacity-70' : ''}`}>
            <ReturnsList rows={rows} onEdit={(r) => setForm({ open: true, draft: r })} onChanged={load} />
            <TablePagination page={meta.page} pages={meta.pages} total={meta.total} limit={meta.limit} onPageChange={setPage} label="returns" loading={loading} />
          </div>
        )}

        <div className="mt-4">
          <HelpBox>
            Tip: the <b>Slow-moving</b> report lists items on the shelf 30+ days that sold under 10% — its &quot;Return to vendor&quot; button opens this form already
            filled in. Consignment pieces are given back from <b>Consignment → Vendor visit</b> instead (no debit note).
          </HelpBox>
        </div>
      </div>

      {form.open && (
        <ReturnFormModal
          draft={form.draft}
          prefill={form.prefill}
          onClose={() => setForm({ open: false, draft: null })}
          onSaved={(r) => {
            toast.success(r.status === 'completed' ? `${r.returnNo} completed — debit note ${formatRs(r.total)}` : `${r.returnNo} saved as draft`);
            setForm({ open: false, draft: null });
            load();
          }}
        />
      )}
    </div>
  );
}

export default function VendorReturnsPage() {
  return (
    <Suspense fallback={<LoadingCard text="Loading…" />}>
      <ReturnsPageInner />
    </Suspense>
  );
}
