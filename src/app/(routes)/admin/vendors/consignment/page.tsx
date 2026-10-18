'use client';

// /admin/vendors/consignment — sale-or-return vendors: pieces placed / sold /
// unsold and what we owe on the next visit. "Vendor visit" settles sold
// pieces (+ pay now), takes old pieces back and receives new designs.
// ?vendorId=... opens the visit for that vendor.

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Handshake, Package, ShoppingBag, Wallet, Users, ChevronRight, RefreshCw } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage } from '@/helper/access';
import { formatRs, formatDate } from '@/lib/storeApi';
import TablePagination from '@/components/admin/TablePagination';
import VendorPicker from '@/components/store/VendorPicker';
import { HelpBox, LoadingCard, NoAccessCard, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { vendorApi, type ConsignmentDoc, type ConsignmentTotals, type ConsignmentVendorRow, type Settlement } from '../services/vendorApi';
import { BalanceText, Badge, EmptyCard, ErrorCard, StatCard, VendorsNav, cardClass, tdClass, thClass } from '../components/ui';
import VendorVisitModal from '../components/VendorVisitModal';
import { SettlementsTable } from '../components/ConsignmentTab';

function ConsignmentPageInner() {
  const { can, loaded } = useAccess();
  const canView = can('consignment', 'view');
  const router = useRouter();
  const params = useSearchParams();
  const [rows, setRows] = useState<ConsignmentVendorRow[]>([]);
  const [totals, setTotals] = useState<ConsignmentTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visitFor, setVisitFor] = useState<string | null>(null);
  const [pickVendor, setPickVendor] = useState<string | null>(null);
  const [historyKey, setHistoryKey] = useState(0);
  const handledLink = useRef(false);

  const load = useCallback(async () => {
    if (!canView) return;
    try {
      setLoading(true);
      setError(null);
      const res = await vendorApi.consignmentSummary();
      setRows(res.data);
      setTotals(res.totals || null);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load consignment.'));
    } finally {
      setLoading(false);
    }
  }, [canView]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!loaded || handledLink.current) return;
    const id = params.get('vendorId');
    if (!id) return;
    handledLink.current = true;
    if (can('consignment', 'create') || can('consignment', 'view')) setVisitFor(id);
    router.replace('/admin/vendors/consignment');
  }, [loaded, params, router, can]);

  if (!canView) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <VendorsNav />
        <NoAccessCard />
      </div>
    );
  }

  const active = rows.filter((r) => r.products > 0 || r.unsettledAmount > 0);
  const idle = rows.filter((r) => !(r.products > 0 || r.unsettledAmount > 0));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="mb-4">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Consignment (sale or return)</h1>
          <p className="mt-0.5 text-xs sm:text-sm text-gray-500">Vendors put stock on display; we pay their fixed rate only for what sells.</p>
        </div>
        <VendorsNav />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-4">
          <StatCard icon={<Users className="h-4 w-4" />} label="Consignment vendors" value={totals ? totals.vendors : '—'} />
          <StatCard tone="blue" icon={<Package className="h-4 w-4" />} label="Pieces in shop (unsold)" value={totals ? totals.unsold : '—'} hint={totals ? `${formatRs(totals.unsoldValue)} at vendor rate` : undefined} />
          <StatCard tone="emerald" icon={<ShoppingBag className="h-4 w-4" />} label="Pieces sold" value={totals ? totals.sold : '—'} hint={totals ? `of ${totals.placed} placed` : undefined} />
          <StatCard tone="rose" icon={<Wallet className="h-4 w-4" />} label="Sold, not settled" value={totals ? formatRs(totals.unsettledAmount) : '—'} hint="Payable on next visits" />
        </div>

        {can('consignment', 'create') && (
          <div className={`${cardClass} p-3 sm:p-4 mb-4 flex flex-col sm:flex-row sm:items-center gap-2`}>
            <p className="text-sm font-medium text-gray-800 whitespace-nowrap">Vendor is here?</p>
            <div className="flex-1">
              <VendorPicker value={pickVendor} onChange={(id) => setPickVendor(id)} placeholder="Pick the vendor (any vendor can start consignment)…" />
            </div>
            <button type="button" disabled={!pickVendor} onClick={() => pickVendor && setVisitFor(pickVendor)} className={primaryBtn}>
              <Handshake className="h-4 w-4" /> Start vendor visit
            </button>
          </div>
        )}

        {loading && !rows.length ? (
          <LoadingCard text="Loading consignment vendors…" />
        ) : error ? (
          <ErrorCard message={error} onRetry={load} />
        ) : rows.length === 0 ? (
          <EmptyCard
            icon={<Handshake className="h-12 w-12" />}
            title="No consignment vendors yet"
            text='Mark a vendor as "Consignment vendor" on the Vendors page, or start a vendor visit above and receive their pieces.'
          />
        ) : (
          <div className={`${cardClass} overflow-hidden mb-4 ${loading ? 'opacity-70' : ''}`}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-900">Vendors</p>
              <button type="button" onClick={load} className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100" title="Refresh">
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className={thClass}>Vendor</th>
                    <th className={`${thClass} text-right`}>Placed</th>
                    <th className={`${thClass} text-right`}>Sold</th>
                    <th className={`${thClass} text-right hidden sm:table-cell`}>Unsold</th>
                    <th className={`${thClass} text-right`}>To settle</th>
                    <th className={`${thClass} text-right hidden md:table-cell`}>Account</th>
                    <th className={thClass}></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[...active, ...idle].map((v) => (
                    <tr key={v._id} className={`hover:bg-gray-50 ${v.isActive ? '' : 'opacity-60'}`}>
                      <td className={tdClass}>
                        <Link href={`/admin/vendors/${v._id}`} className="font-medium text-gray-900 hover:text-honey-700">
                          {v.name}
                        </Link>
                        <p className="text-[11px] text-gray-500">
                          {[v.phone, `${v.products} product${v.products === 1 ? '' : 's'}`, v.lastSettledAt ? `settled ${formatDate(v.lastSettledAt)}` : v.lastIntakeAt ? `since ${formatDate(v.lastIntakeAt)}` : '']
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </td>
                      <td className={`${tdClass} text-right tabular-nums`}>{v.placed}</td>
                      <td className={`${tdClass} text-right tabular-nums`}>{v.sold}</td>
                      <td className={`${tdClass} text-right tabular-nums hidden sm:table-cell`}>{v.unsold}</td>
                      <td className={`${tdClass} text-right whitespace-nowrap`}>
                        {v.unsettledAmount > 0 ? <span className="font-semibold text-purple-700">{formatRs(v.unsettledAmount)}</span> : <span className="text-gray-300">—</span>}
                        {v.unsettledQty > 0 && <span className="block text-[10px] text-gray-400">{v.unsettledQty} pcs</span>}
                      </td>
                      <td className={`${tdClass} text-right whitespace-nowrap hidden md:table-cell`}>
                        <BalanceText amount={v.balance} />
                      </td>
                      <td className={`${tdClass} text-right whitespace-nowrap`}>
                        {can('consignment', 'create') && (
                          <button type="button" onClick={() => setVisitFor(v._id)} className={`${secondaryBtn} !px-2.5 !py-1.5 text-xs`}>
                            <Handshake className="h-3.5 w-3.5" /> Visit
                          </button>
                        )}
                        <Link href={`/admin/vendors/${v._id}`} className="inline-flex p-1.5 ml-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100" title="Open vendor">
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <History refreshKey={historyKey} onChanged={load} />

        <div className="mt-4">
          <HelpBox>
            <b>How it works:</b> receiving puts the vendor&apos;s pieces in stock at their fixed rate (no bill). Every sale or gift of those pieces counts as sold
            (refunds count back). On the vendor&apos;s visit, settle what sold — that amount becomes payable — then give back old designs and receive new ones.
          </HelpBox>
        </div>
      </div>

      {visitFor && (
        <VendorVisitModal
          vendorId={visitFor}
          onClose={() => setVisitFor(null)}
          onDone={() => {
            setVisitFor(null);
            setPickVendor(null);
            load();
            setHistoryKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

/** Recent settlements and stock in / out documents. */
function History({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const { can } = useAccess();
  const [retrying, setRetrying] = useState<string | null>(null);
  const [tab, setTab] = useState<'settlements' | 'docs'>('settlements');
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [docs, setDocs] = useState<ConsignmentDoc[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 15, total: 0, pages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      if (tab === 'settlements') {
        const res = await vendorApi.settlements({ page, limit: 15 });
        setSettlements(res.data);
        setMeta(res.meta);
      } else {
        const res = await vendorApi.consignments({ page, limit: 15 });
        setDocs(res.data);
        setMeta(res.meta);
      }
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load history.'));
    } finally {
      setLoading(false);
    }
  }, [tab, page]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);
  useEffect(() => setPage(1), [tab]);

  return (
    <div className={`${cardClass} overflow-hidden`}>
      <div className="flex gap-1 px-3 pt-2 border-b border-gray-100">
        {(
          [
            ['settlements', 'Settlements'],
            ['docs', 'Stock in / out'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === k ? 'border-honey-500 text-honey-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {loading && !(tab === 'settlements' ? settlements.length : docs.length) ? (
        <p className="px-4 py-6 text-sm text-gray-500">Loading…</p>
      ) : error ? (
        <div className="p-3">
          <ErrorCard message={error} onRetry={load} />
        </div>
      ) : tab === 'settlements' ? (
        <SettlementsTable
          rows={settlements}
          showVendor
          onChanged={() => {
            load();
            onChanged();
          }}
        />
      ) : docs.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-gray-500">Nothing received or given back yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className={thClass}>Document</th>
                <th className={thClass}>Vendor</th>
                <th className={thClass}>Items</th>
                <th className={`${thClass} text-right`}>Pieces</th>
                <th className={`${thClass} text-right`}>Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {docs.map((d) => (
                <tr key={d._id} className="hover:bg-gray-50">
                  <td className={`${tdClass} whitespace-nowrap`}>
                    <p className="font-mono text-xs text-gray-900">{d.consignmentNo}</p>
                    <p className="text-[11px] text-gray-500">{formatDate(d.date)}</p>
                    <Badge kind={d.kind}>{d.kind === 'intake' ? 'Received' : 'Given back'}</Badge>
                    {d.status === 'pending' && (
                      <span className="ml-1 inline-flex items-center gap-1">
                        <Badge kind="pending">Not finished</Badge>
                        {can('consignment', 'create') && (
                          <button
                            type="button"
                            disabled={!!retrying}
                            onClick={async () => {
                              setRetrying(d._id);
                              try {
                                await vendorApi.retryConsignment(d._id);
                                toast.success(`${d.consignmentNo} finished`);
                                load();
                                onChanged();
                              } catch (e) {
                                toast.error(apiErrorMessage(e), { duration: 7000 });
                              } finally {
                                setRetrying(null);
                              }
                            }}
                            className="text-[11px] font-medium text-honey-700 hover:underline disabled:opacity-50"
                          >
                            {retrying === d._id ? 'Retrying…' : 'Retry'}
                          </button>
                        )}
                      </span>
                    )}
                  </td>
                  <td className={tdClass}>{d.vendorName}</td>
                  <td className={`${tdClass} text-xs text-gray-600 max-w-[280px]`}>
                    {d.items
                      .slice(0, 3)
                      .map((i) => `${i.productName}${i.variantLabel ? ` (${i.variantLabel})` : ''} ×${i.qty}`)
                      .join(', ')}
                    {d.items.length > 3 && ` +${d.items.length - 3} more`}
                  </td>
                  <td className={`${tdClass} text-right tabular-nums`}>{d.totalQty}</td>
                  <td className={`${tdClass} text-right whitespace-nowrap`}>{formatRs(d.totalValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <TablePagination page={meta.page} pages={meta.pages} total={meta.total} limit={meta.limit} onPageChange={setPage} label={tab === 'settlements' ? 'settlements' : 'documents'} loading={loading} />
    </div>
  );
}

export default function ConsignmentPage() {
  return (
    <Suspense fallback={<LoadingCard text="Loading…" />}>
      <ConsignmentPageInner />
    </Suspense>
  );
}
