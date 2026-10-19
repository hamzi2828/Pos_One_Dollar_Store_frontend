'use client';

// /admin/vendors — vendor list with balances (payable red / receivable green),
// summary cards, search + filters, add / edit / activate / delete.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Truck, Plus, Search, X, Edit2, Trash2, Power, HandCoins, ArrowDownLeft, ArrowUpRight, Handshake, Users, Loader2, ChevronRight } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage } from '@/helper/access';
import { formatRs } from '@/lib/storeApi';
import { useDebounced } from '@/helper/useDebounced';
import TablePagination from '@/components/admin/TablePagination';
import { HelpBox, LoadingCard, NoAccessCard, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { vendorApi, type Vendor, type VendorSummary } from './services/vendorApi';
import { BalanceText, Badge, EmptyCard, ErrorCard, StatCard, VendorsNav, cardClass, tdClass, thClass } from './components/ui';
import VendorFormModal from './components/VendorFormModal';
import PaymentModal from './components/PaymentModal';
import { SearchSelect } from '@/components/ui/SearchSelect';

export default function VendorsPage() {
  const { can } = useAccess();
  const canView = can('vendors', 'view');

  const [rows, setRows] = useState<Vendor[]>([]);
  const [summary, setSummary] = useState<VendorSummary | null>(null);
  const [meta, setMeta] = useState({ page: 1, limit: 25, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | 'true' | 'false'>('true');
  const [balance, setBalance] = useState<'' | 'payable' | 'receivable'>('');
  const [consignment, setConsignment] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [modal, setModal] = useState<{ open: boolean; vendor: Vendor | null }>({ open: false, vendor: null });
  const [payFor, setPayFor] = useState<{ open: boolean; vendorId: string | null }>({ open: false, vendorId: null });
  const [busyId, setBusyId] = useState<string | null>(null);
  const rowLock = useRef(false);
  const debounced = useDebounced(search.trim(), 300);

  const load = useCallback(async () => {
    if (!canView) return;
    try {
      setLoading(true);
      setError(null);
      const res = await vendorApi.list({
        search: debounced,
        isActive: status || undefined,
        hasBalance: balance || undefined,
        isConsignment: consignment ? 'true' : undefined,
        page,
        limit,
      });
      setRows(res.data);
      setMeta(res.meta);
      setSummary(res.meta.summary || null);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load vendors.'));
    } finally {
      setLoading(false);
    }
  }, [canView, debounced, status, balance, consignment, page, limit]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debounced, status, balance, consignment, limit]);

  const runRow = async (v: Vendor, fn: () => Promise<void>) => {
    if (rowLock.current) return;
    rowLock.current = true;
    setBusyId(v._id);
    try {
      await fn();
      await load();
    } catch (e) {
      toast.error(apiErrorMessage(e), { duration: 6000 });
    } finally {
      rowLock.current = false;
      setBusyId(null);
    }
  };

  const toggle = (v: Vendor) =>
    runRow(v, async () => {
      await vendorApi.setActive(v._id, !v.isActive);
      toast.success(v.isActive ? `${v.name} deactivated` : `${v.name} activated`);
    });

  const remove = (v: Vendor) => {
    if (!window.confirm(`Delete vendor "${v.name}"?\n\nOnly possible when the balance is Rs 0. The history stays.`)) return;
    runRow(v, async () => {
      await vendorApi.remove(v._id);
      toast.success('Vendor deleted');
    });
  };

  if (!canView) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <VendorsNav />
        <NoAccessCard />
      </div>
    );
  }

  const hasFilters = !!(debounced || status !== 'true' || balance || consignment);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Vendors &amp; Ledger</h1>
            <p className="mt-0.5 text-xs sm:text-sm text-gray-500">Suppliers, what we owe them, and every len-den with each one.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {can('vendor_payments', 'create') && (
              <button onClick={() => setPayFor({ open: true, vendorId: null })} className={secondaryBtn}>
                <HandCoins className="h-4 w-4" /> Record payment
              </button>
            )}
            {can('vendors', 'create') && (
              <button onClick={() => setModal({ open: true, vendor: null })} className={primaryBtn}>
                <Plus className="h-4 w-4" /> Add Vendor
              </button>
            )}
          </div>
        </div>

        <VendorsNav />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6">
          <StatCard
            tone="rose"
            icon={<ArrowUpRight className="h-4 w-4" />}
            label="Total payable (we owe)"
            value={summary ? formatRs(summary.totalPayable) : '—'}
            hint={summary ? `${summary.payableCount} vendor${summary.payableCount === 1 ? '' : 's'}` : undefined}
          />
          <StatCard
            tone="emerald"
            icon={<ArrowDownLeft className="h-4 w-4" />}
            label="Receivable (they owe us)"
            value={summary ? formatRs(summary.totalReceivable) : '—'}
            hint={summary ? `${summary.receivableCount} vendor${summary.receivableCount === 1 ? '' : 's'}` : undefined}
          />
          <StatCard
            icon={<Users className="h-4 w-4" />}
            label="Vendors"
            value={summary ? summary.vendorCount : '—'}
            hint={summary ? `${summary.activeCount} active` : undefined}
          />
          <StatCard tone="blue" icon={<Handshake className="h-4 w-4" />} label="Consignment vendors" value={summary ? summary.consignmentCount : '—'} hint="Sale or return" />
        </div>

        <div className={`${cardClass} p-3 sm:p-4 mb-4 flex flex-col lg:flex-row gap-2`}>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, code, phone, city, CNIC…" className={`${inputClass} pl-9 pr-8`} />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" aria-label="Clear search">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:flex gap-2">
            <SearchSelect value={status} onChange={(e) => setStatus(e.target.value as '' | 'true' | 'false')} className={`${inputClass} sm:w-36`} aria-label="Status">
              <option value="true">Active</option>
              <option value="false">Inactive</option>
              <option value="">All vendors</option>
            </SearchSelect>
            <SearchSelect value={balance} onChange={(e) => setBalance(e.target.value as '' | 'payable' | 'receivable')} className={`${inputClass} sm:w-44`} aria-label="Balance">
              <option value="">Any balance</option>
              <option value="payable">We owe (payable)</option>
              <option value="receivable">They owe us</option>
            </SearchSelect>
            <label className="col-span-2 inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg bg-white cursor-pointer whitespace-nowrap">
              <input type="checkbox" checked={consignment} onChange={(e) => setConsignment(e.target.checked)} className="accent-honey-500" />
              Consignment only
            </label>
          </div>
        </div>

        {loading && !rows.length ? (
          <LoadingCard text="Loading vendors…" />
        ) : error ? (
          <ErrorCard message={error} onRetry={load} />
        ) : rows.length === 0 ? (
          <EmptyCard
            icon={<Truck className="h-12 w-12" />}
            title={hasFilters ? 'No vendors match' : 'No vendors yet'}
            text={hasFilters ? 'Try a different search or filter.' : 'Add your suppliers to track bills, payments and returns.'}
          />
        ) : (
          <div className={`${cardClass} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className={thClass}>Vendor</th>
                    <th className={`${thClass} hidden md:table-cell`}>Phone</th>
                    <th className={`${thClass} hidden lg:table-cell`}>City</th>
                    <th className={`${thClass} hidden xl:table-cell`}>Supplies</th>
                    <th className={`${thClass} text-right`}>Balance</th>
                    <th className={`${thClass} text-right`}></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((v) => (
                    <tr key={v._id} className={`hover:bg-gray-50 ${v.isActive ? '' : 'opacity-60'}`}>
                      <td className={tdClass}>
                        <Link href={`/admin/vendors/${v._id}`} className="group block min-w-0">
                          <span className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-gray-900 group-hover:text-honey-700">{v.name}</span>
                            {v.code && <span className="text-[10px] font-mono text-gray-400">{v.code}</span>}
                            {v.isConsignment && <Badge kind="consignment">Consignment</Badge>}
                            {!v.isActive && <Badge kind="inactive">Inactive</Badge>}
                          </span>
                          <span className="block text-[11px] text-gray-500 md:hidden">{[v.phone, v.city].filter(Boolean).join(' · ')}</span>
                          {v.contactPerson && <span className="hidden md:block text-[11px] text-gray-500">{v.contactPerson}</span>}
                        </Link>
                      </td>
                      <td className={`${tdClass} hidden md:table-cell whitespace-nowrap`}>{v.phone || <span className="text-gray-300">—</span>}</td>
                      <td className={`${tdClass} hidden lg:table-cell`}>{v.city || <span className="text-gray-300">—</span>}</td>
                      <td className={`${tdClass} hidden xl:table-cell text-xs text-gray-500 max-w-[220px] truncate`}>{(v.categories || []).join(', ') || '—'}</td>
                      <td className={`${tdClass} text-right whitespace-nowrap`}>
                        <BalanceText amount={v.balance} />
                      </td>
                      <td className={`${tdClass} text-right whitespace-nowrap`}>
                        <div className="inline-flex items-center gap-0.5">
                          {busyId === v._id && <Loader2 className="h-4 w-4 animate-spin text-gray-400 mr-1" />}
                          {can('vendor_payments', 'create') && v.balance > 0 && (
                            <button onClick={() => setPayFor({ open: true, vendorId: v._id })} disabled={!!busyId} className="p-1.5 rounded-md text-gray-400 hover:text-honey-700 hover:bg-honey-50" title="Record payment">
                              <HandCoins className="h-4 w-4" />
                            </button>
                          )}
                          {can('vendors', 'edit') && (
                            <>
                              <button onClick={() => setModal({ open: true, vendor: v })} disabled={!!busyId} className="p-1.5 rounded-md text-gray-400 hover:text-honey-700 hover:bg-honey-50" title="Edit">
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button onClick={() => toggle(v)} disabled={!!busyId} className="p-1.5 rounded-md text-gray-400 hover:text-amber-600 hover:bg-amber-50" title={v.isActive ? 'Deactivate' : 'Activate'}>
                                <Power className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          {can('vendors', 'delete') && (
                            <button
                              onClick={() => remove(v)}
                              disabled={!!busyId || v.balance !== 0}
                              className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
                              title={v.balance !== 0 ? 'Settle the balance before deleting' : 'Delete'}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                          <Link href={`/admin/vendors/${v._id}`} className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100" title="Open ledger">
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePagination
              page={meta.page}
              pages={meta.pages}
              total={meta.total}
              limit={limit}
              onPageChange={setPage}
              onLimitChange={setLimit}
              label="vendors"
              loading={loading}
            />
          </div>
        )}

        <div className="mt-4">
          <HelpBox>
            <strong>Red = we owe the vendor, green = the vendor owes us.</strong> Bills from purchase orders, payments, returns (debit
            notes) and consignment settlements all post to the vendor&apos;s ledger automatically. Open a vendor to see the full statement.
          </HelpBox>
        </div>
      </div>

      {modal.open && (
        <VendorFormModal
          vendor={modal.vendor}
          onClose={() => setModal({ open: false, vendor: null })}
          onSaved={(v) => {
            toast.success(modal.vendor ? 'Vendor saved' : `${v.name} added`);
            setModal({ open: false, vendor: null });
            load();
          }}
        />
      )}
      {payFor.open && (
        <PaymentModal
          vendorId={payFor.vendorId}
          lockVendor={!!payFor.vendorId}
          onClose={() => setPayFor({ open: false, vendorId: null })}
          onSaved={(p) => {
            toast.success(`${p.paymentNo} recorded`);
            setPayFor({ open: false, vendorId: null });
            load();
          }}
        />
      )}
    </div>
  );
}
