'use client';

// /admin/vendors/[id] — vendor profile: balance + totals, contact and bank
// details, and tabs: Ledger, Products bought, Payments, Returns, Consignment.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { ArrowLeft, Edit2, HandCoins, Undo2, Phone, MessageCircle, MapPin, Landmark, Clock, BookOpen, Package, Handshake } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage } from '@/helper/access';
import { formatRs, formatDate } from '@/lib/storeApi';
import TablePagination from '@/components/admin/TablePagination';
import { LoadingCard, NoAccessCard, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { vendorApi, type VendorDetail, type VendorPayment, type VendorReturn } from '../services/vendorApi';
import { BalanceText, Badge, ErrorCard, VendorsNav, cardClass } from '../components/ui';
import VendorFormModal from '../components/VendorFormModal';
import PaymentModal from '../components/PaymentModal';
import LedgerTab from '../components/LedgerTab';
import ProductsTab from '../components/ProductsTab';
import PaymentsTable from '../components/PaymentsTable';
import ReturnsList from '../components/ReturnsList';
import ReturnFormModal from '../components/ReturnFormModal';
import ConsignmentTab from '../components/ConsignmentTab';

type Tab = 'ledger' | 'products' | 'payments' | 'returns' | 'consignment';

const waLink = (n: string) => {
  const d = n.replace(/\D/g, '');
  return `https://wa.me/${d.startsWith('0') ? `92${d.slice(1)}` : d}`;
};

export default function VendorProfilePage() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id || '');
  const { can } = useAccess();
  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('ledger');
  const [editing, setEditing] = useState(false);
  const [paying, setPaying] = useState(false);
  const [ledgerKey, setLedgerKey] = useState(0);

  const load = useCallback(async () => {
    try {
      setError(null);
      setVendor(await vendorApi.get(id));
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load the vendor.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) load();
  }, [id, load]);

  // Something changed the account: refresh header + statement.
  const refreshAll = () => {
    load();
    setLedgerKey((k) => k + 1);
  };

  if (!can('vendors', 'view')) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <NoAccessCard />
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode; show: boolean }[] = [
    { key: 'ledger', label: 'Ledger', icon: <BookOpen className="h-4 w-4" />, show: true },
    { key: 'products', label: 'Products bought', icon: <Package className="h-4 w-4" />, show: true },
    { key: 'payments', label: 'Payments', icon: <HandCoins className="h-4 w-4" />, show: can('vendor_payments', 'view') },
    { key: 'returns', label: 'Returns', icon: <Undo2 className="h-4 w-4" />, show: can('vendor_returns', 'view') },
    { key: 'consignment', label: 'Consignment', icon: <Handshake className="h-4 w-4" />, show: can('consignment', 'view') && !!vendor?.isConsignment },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <Link href="/admin/vendors" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-3">
          <ArrowLeft className="h-4 w-4" /> All vendors
        </Link>
        <VendorsNav />

        {loading ? (
          <LoadingCard text="Loading vendor…" />
        ) : error || !vendor ? (
          <ErrorCard message={error || 'Vendor not found'} onRetry={load} />
        ) : (
          <>
            {/* Header */}
            <div className={`${cardClass} p-4 sm:p-5 mb-4`}>
              <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">{vendor.name}</h1>
                    {vendor.code && <span className="px-1.5 py-0.5 text-[11px] font-mono bg-gray-100 text-gray-600 rounded">{vendor.code}</span>}
                    {vendor.isConsignment && <Badge kind="consignment">Consignment</Badge>}
                    {!vendor.isActive && <Badge kind="inactive">Inactive</Badge>}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                    {vendor.contactPerson && <span>{vendor.contactPerson}</span>}
                    {vendor.phone && (
                      <a href={`tel:${vendor.phone}`} className="inline-flex items-center gap-1 hover:text-honey-700">
                        <Phone className="h-3.5 w-3.5" /> {vendor.phone}
                      </a>
                    )}
                    {vendor.whatsapp && (
                      <a href={waLink(vendor.whatsapp)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-green-600">
                        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                      </a>
                    )}
                    {(vendor.city || vendor.address?.street) && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" /> {[vendor.address?.street, vendor.city].filter(Boolean).join(', ')}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> {vendor.paymentTermsDays ? `${vendor.paymentTermsDays} days credit` : 'Cash on delivery'}
                    </span>
                    {vendor.bankDetails?.accountNumber && (
                      <span className="inline-flex items-center gap-1">
                        <Landmark className="h-3.5 w-3.5" /> {[vendor.bankDetails.bankName, vendor.bankDetails.accountTitle, vendor.bankDetails.accountNumber].filter(Boolean).join(' · ')}
                        {vendor.bankDetails.iban && ` · ${vendor.bankDetails.iban}`}
                      </span>
                    )}
                  </div>
                  {(vendor.categories?.length || vendor.cnic || vendor.ntn) && (
                    <p className="mt-1 text-[11px] text-gray-400">
                      {[vendor.categories?.join(', '), vendor.cnic && `CNIC ${vendor.cnic}`, vendor.ntn && `NTN ${vendor.ntn}`].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {vendor.notes && <p className="mt-1 text-xs text-gray-500 italic">{vendor.notes}</p>}
                </div>
                <div className="lg:text-right">
                  <p className="text-[11px] uppercase text-gray-500">Balance</p>
                  <BalanceText amount={vendor.balance} className="text-2xl" />
                  {vendor.lastPayment && (
                    <p className="text-[11px] text-gray-400">
                      Last paid {formatRs(vendor.lastPayment.amount)} on {formatDate(vendor.lastPayment.date)}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2 lg:justify-end">
                    {can('vendor_payments', 'create') && (
                      <button onClick={() => setPaying(true)} className={primaryBtn}>
                        <HandCoins className="h-4 w-4" /> Record payment
                      </button>
                    )}
                    {can('vendor_returns', 'create') && (
                      <Link href={`/admin/vendors/returns?new=1&vendorId=${vendor._id}`} className={secondaryBtn}>
                        <Undo2 className="h-4 w-4" /> Return goods
                      </Link>
                    )}
                    {can('vendors', 'edit') && (
                      <button onClick={() => setEditing(true)} className={secondaryBtn}>
                        <Edit2 className="h-4 w-4" /> Edit
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {[
                  ['Opening', vendor.totals.opening],
                  ['Billed', vendor.totals.billed],
                  ['Consignment sold', vendor.totals.consignment],
                  ['Paid', vendor.totals.paid],
                  ['Returned', vendor.totals.returned],
                  ['Adjustments', vendor.totals.adjustments],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
                    <p className="text-[10px] uppercase text-gray-500">{label}</p>
                    <p className="text-sm font-semibold text-gray-900 tabular-nums">{formatRs(Number(value))}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <div className="mb-3 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto">
              <div className="inline-flex gap-1 border-b border-gray-200 min-w-full">
                {tabs
                  .filter((t) => t.show)
                  .map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setTab(t.key)}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
                        tab === t.key ? 'border-honey-500 text-honey-700' : 'border-transparent text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      {t.icon}
                      {t.label}
                    </button>
                  ))}
              </div>
            </div>

            {tab === 'ledger' && <LedgerTab key={ledgerKey} vendor={vendor} onChanged={load} />}
            {tab === 'products' && <ProductsTab vendorId={vendor._id} />}
            {tab === 'payments' && (
              <VendorPaymentsTab vendorId={vendor._id} refreshKey={ledgerKey} onChanged={refreshAll} onRecord={can('vendor_payments', 'create') ? () => setPaying(true) : undefined} />
            )}
            {tab === 'returns' && <VendorReturnsTab vendorId={vendor._id} onChanged={refreshAll} />}
            {tab === 'consignment' && <ConsignmentTab vendorId={vendor._id} onChanged={refreshAll} />}
          </>
        )}
      </div>

      {editing && vendor && (
        <VendorFormModal
          vendor={vendor}
          onClose={() => setEditing(false)}
          onSaved={(v) => {
            toast.success('Vendor saved');
            setEditing(false);
            setVendor(v);
          }}
        />
      )}
      {paying && vendor && (
        <PaymentModal
          vendorId={vendor._id}
          lockVendor
          onClose={() => setPaying(false)}
          onSaved={(p) => {
            toast.success(`${p.paymentNo} recorded`);
            setPaying(false);
            refreshAll();
          }}
        />
      )}
    </div>
  );
}

function VendorPaymentsTab({
  vendorId,
  refreshKey,
  onChanged,
  onRecord,
}: {
  vendorId: string;
  refreshKey: number;
  onChanged: () => void;
  onRecord?: () => void;
}) {
  const [rows, setRows] = useState<VendorPayment[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 25, total: 0, pages: 1 });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await vendorApi.payments({ vendor: vendorId, page, limit: 25 });
      setRows(res.data);
      setMeta(res.meta);
      setTotal(res.meta.summary?.total ?? 0);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load payments.'));
    } finally {
      setLoading(false);
    }
  }, [vendorId, page]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (loading && !rows.length) return <LoadingCard text="Loading payments…" />;
  if (error) return <ErrorCard message={error} onRetry={load} />;
  return (
    <div className={`${cardClass} overflow-hidden`}>
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-gray-100">
        <p className="text-sm text-gray-600">
          Paid in total: <b className="text-gray-900">{formatRs(total)}</b>
        </p>
        {onRecord && (
          <button type="button" onClick={onRecord} className={`${primaryBtn} !py-1.5 text-xs`}>
            <HandCoins className="h-4 w-4" /> Record payment
          </button>
        )}
      </div>
      <PaymentsTable
        rows={rows}
        showVendor={false}
        onChanged={() => {
          load();
          onChanged();
        }}
      />
      <TablePagination page={meta.page} pages={meta.pages} total={meta.total} limit={meta.limit} onPageChange={setPage} label="payments" loading={loading} />
    </div>
  );
}

function VendorReturnsTab({ vendorId, onChanged }: { vendorId: string; onChanged: () => void }) {
  const [rows, setRows] = useState<VendorReturn[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 25, total: 0, pages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<VendorReturn | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await vendorApi.returns({ vendor: vendorId, page, limit: 25 });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load returns.'));
    } finally {
      setLoading(false);
    }
  }, [vendorId, page]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !rows.length) return <LoadingCard text="Loading returns…" />;
  if (error) return <ErrorCard message={error} onRetry={load} />;
  const changed = () => {
    load();
    onChanged();
  };
  return (
    <div className={`${cardClass} overflow-hidden`}>
      <ReturnsList rows={rows} showVendor={false} onEdit={setEditing} onChanged={changed} />
      <TablePagination page={meta.page} pages={meta.pages} total={meta.total} limit={meta.limit} onPageChange={setPage} label="returns" loading={loading} />
      {editing && (
        <ReturnFormModal
          draft={editing}
          onClose={() => setEditing(null)}
          onSaved={(r) => {
            toast.success(r.status === 'completed' ? `${r.returnNo} completed` : `${r.returnNo} saved`);
            setEditing(null);
            changed();
          }}
        />
      )}
    </div>
  );
}
