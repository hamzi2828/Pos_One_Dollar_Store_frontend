'use client';

// Investment: everything partners put into the shop (racks, renovation, AC,
// signboard, opening stock...). Add partners, then one entry per bill with the
// partner who paid. A bill can be paid in full or in parts: "Pay" adds a
// payment (amount + date) until the balance is 0. Totals and each partner's
// share are worked out from the money actually paid.
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Download, Edit2, FileDown, FileText, Loader2, PiggyBank, Plus, Search, Trash2, UserPlus, Users, Wallet, X } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { BACKEND_URL, apiErrorMessage, formatDate, formatRs, storeApi, type PageMeta } from '@/lib/storeApi';
import { getAuthHeader } from '@/helper/helper';
import { ErrorBox, Field, Modal, NoAccessCard, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { Chips } from '../purchasing/_shared/ui';
import { TRACK } from '../adminComponents/charts';
import { SearchSelect } from '@/components/ui/SearchSelect';
import MoneyInput from '@/components/ui/MoneyInput';
import { buildInvestmentPdf, partnerColor } from './investmentPdf';

interface PartnerRef {
  _id: string;
  name: string;
  phone?: string;
}

interface Partner extends PartnerRef {
  phone: string;
  note: string;
  /** Money this partner has paid in. */
  invested: number;
  /** Still to pay on their bills. */
  balance: number;
  bills: number;
  /** % of all money paid in, 1 decimal. */
  share: number;
}

interface Payment {
  _id: string;
  amount: number;
  date: string;
  note: string;
  createdAt?: string;
}

interface Investment {
  _id: string;
  title: string;
  /** Bill total. */
  amount: number;
  paidAmount: number;
  balance: number;
  /** Oldest first. */
  payments: Payment[];
  date: string;
  partner: PartnerRef | null;
  billNo: string;
  paidTo: string;
  note: string;
  attachments: string[];
}

interface Summary {
  /** Money actually paid in. */
  totalInvested: number;
  billsTotal: number;
  balance: number;
  dueBills: number;
  entries: number;
  since: string | null;
  /** Paid this month (by payment date). */
  thisMonth: number;
  filteredTotal: number;
  filteredBillsTotal: number;
  filteredBalance: number;
  /** Bills saved before partners existed. */
  noPartner: number;
  noPartnerBills: number;
}

type ListMeta = PageMeta & { summary: Summary; partners: Partner[] };
type Status = '' | 'due' | 'paid';
type PayMode = 'full' | 'part';

const fileUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : `${BACKEND_URL}${u}`);
const isPdf = (u: string) => /\.pdf($|\?)/i.test(u);
const todayKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date());
const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const bills = (n: number) => `${n} bill${n === 1 ? '' : 's'}`;
const payments = (n: number) => `${n} payment${n === 1 ? '' : 's'}`;
const STATUS_LABEL: Record<Exclude<Status, ''>, string> = { due: 'Bills with a balance', paid: 'Paid in full' };
const PAY_MODES: { value: PayMode; label: string }[] = [
  { value: 'full', label: 'Paid in full' },
  { value: 'part', label: 'Paid part (balance left)' },
];
const payBtn =
  'inline-flex items-center gap-1 rounded-md bg-honey-500 px-2.5 py-1.5 text-xs font-semibold text-gray-900 hover:bg-honey-600 transition-colors disabled:opacity-60';

export default function InvestmentsPage() {
  const { can } = useAccess();
  const canView = can('investments', 'view');
  const canCreate = can('investments', 'create');
  const canEdit = can('investments', 'edit');
  const canDelete = can('investments', 'delete');
  const [rows, setRows] = useState<Investment[]>([]);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [partner, setPartner] = useState(''); // '' = all, 'none' = no partner, else id
  const [status, setStatus] = useState<Status>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Investment | 'new' | null>(null);
  const [paying, setPaying] = useState<Investment | null>(null);
  const [partnerEdit, setPartnerEdit] = useState<Partner | 'new' | null>(null);
  // A partner just added from inside the investment form: the form selects it.
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await storeApi.get<Investment[]>('/investments', { search, partner, status, from, to, page, limit: 50 });
      setRows(res.data);
      setMeta(res.meta as unknown as ListMeta);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load investments.'));
    } finally {
      setLoading(false);
    }
  }, [search, partner, status, from, to, page]);

  useEffect(() => {
    if (!canView) return;
    const t = window.setTimeout(load, search ? 300 : 0);
    return () => window.clearTimeout(t);
  }, [canView, load, search]);

  const pickPartner = (id: string) => {
    setPartner((cur) => (cur === id ? '' : id));
    setPage(1);
  };

  const pickStatus = (v: Status) => {
    setStatus(v);
    setPage(1);
  };

  const remove = async (row: Investment) => {
    if (deleting) return;
    const paidNote = row.paidAmount > 0 ? ` and its ${payments(row.payments.length)} (${formatRs(row.paidAmount)} paid)` : '';
    if (!window.confirm(`Delete "${row.title}" (${formatRs(row.amount)})${paidNote}? The totals will go down.`)) return;
    setDeleting(row._id);
    try {
      await storeApi.del(`/investments/${row._id}`);
      toast.success('Deleted');
      await load();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not delete.'));
    } finally {
      setDeleting(null);
    }
  };

  const removePartner = async (p: Partner) => {
    if (deleting) return;
    if (p.bills > 0) {
      toast.error(`${p.name} has ${bills(p.bills)}. Move them to another partner or delete them first.`);
      return;
    }
    if (!window.confirm(`Remove partner "${p.name}"?`)) return;
    setDeleting(p._id);
    try {
      await storeApi.del(`/investment-partners/${p._id}`);
      toast.success('Partner removed');
      if (partner === p._id) setPartner('');
      await load();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not remove the partner.'));
    } finally {
      setDeleting(null);
    }
  };

  const exportCsv = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const q = new URLSearchParams(Object.entries({ search, partner, status, from, to }).filter(([, v]) => v) as [string, string][]);
      const res = await fetch(`${BACKEND_URL}/api/investments/export?${q}`, { headers: getAuthHeader() });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `investments-${todayKey()}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not download the CSV.'));
    } finally {
      setExporting(false);
    }
  };

  // Full report (filters are ignored): fetches every bill, then one page per partner.
  const exportPdf = async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      const all: Investment[] = [];
      let first: ListMeta | null = null;
      for (let pg = 1, pages = 1; pg <= pages; pg++) {
        const res = await storeApi.get<Investment[]>('/investments', { page: pg, limit: 200 });
        const m = res.meta as unknown as ListMeta;
        if (!first) first = m;
        pages = m.pages;
        all.push(...res.data);
      }
      if (!first) throw new Error('No data');
      let storeName = 'DOLLAR & Co';
      try {
        storeName = localStorage.getItem('siteName') || storeName;
      } catch {}
      const doc = buildInvestmentPdf({ storeName, summary: first.summary, partners: first.partners, bills: all });
      doc.save(`investment-report-${todayKey()}.pdf`);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not make the PDF.'));
    } finally {
      setPdfBusy(false);
    }
  };

  if (!canView) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <NoAccessCard />
      </div>
    );
  }

  const s = meta?.summary;
  const partners = meta?.partners || [];
  const filtered = !!(search || partner || status || from || to);
  const partnerName = partner === 'none' ? 'No partner' : partners.find((p) => p._id === partner)?.name;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-5">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 flex items-center gap-2">
              <PiggyBank className="h-6 w-6 text-honey-700" /> Investment
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">Money each partner put into the shop. Add each bill, paid in full or in parts, and the totals add up by themselves.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {can('investments', 'export') && (
              <button onClick={exportCsv} disabled={exporting} className={secondaryBtn}>
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} CSV
              </button>
            )}
            {can('investments', 'export') && (
              <button onClick={exportPdf} disabled={pdfBusy || !meta} className={secondaryBtn} title="One page per partner with all their bills">
                {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} {pdfBusy ? 'Making PDF…' : 'PDF report'}
              </button>
            )}
            {canCreate && (
              <button onClick={() => setPartnerEdit('new')} className={secondaryBtn}>
                <UserPlus className="h-4 w-4" /> Add partner
              </button>
            )}
            {canCreate && (
              <button onClick={() => setEditing('new')} className={primaryBtn}>
                <Plus className="h-4 w-4" /> Add investment
              </button>
            )}
          </div>
        </header>

        {/* Total, with every partner's share on one bar */}
        <section className="rounded-xl bg-gray-950 p-5 sm:p-6 text-white space-y-5">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-400">Total invested (paid)</p>
              <p className="mt-1 text-4xl sm:text-5xl font-semibold tracking-tight text-honey-400 break-words tabular-nums">{s ? formatRs(s.totalInvested) : '…'}</p>
              <p className="mt-2 text-sm text-gray-400">
                {s
                  ? `${bills(s.entries)} worth ${formatRs(s.billsTotal)}${s.since ? ` since ${formatDate(s.since)}` : ''} · ${partners.length} partner${partners.length === 1 ? '' : 's'}`
                  : ''}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm md:min-w-[22rem]">
              <div className="rounded-lg bg-white/5 px-3 py-2">
                <p className="text-xs text-gray-400">Paid this month</p>
                <p className="font-semibold tabular-nums">{s ? formatRs(s.thisMonth) : '…'}</p>
              </div>
              {s && s.balance > 0 ? (
                <button
                  onClick={() => pickStatus(status === 'due' ? '' : 'due')}
                  className={`rounded-lg px-3 py-2 text-left transition-colors hover:bg-amber-400/20 ${status === 'due' ? 'bg-amber-400/20 ring-1 ring-amber-300/60' : 'bg-amber-400/10'}`}
                  title="Show the bills that still have a balance"
                >
                  <p className="text-xs text-amber-300">Balance to pay · {bills(s.dueBills)}</p>
                  <p className="font-semibold tabular-nums text-amber-200">{formatRs(s.balance)}</p>
                </button>
              ) : (
                <div className="rounded-lg bg-white/5 px-3 py-2">
                  <p className="text-xs text-gray-400">Balance to pay</p>
                  <p className="font-semibold text-green-400">{s && s.entries > 0 ? 'All paid' : '…'}</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-200">
                <Users className="h-4 w-4 text-gray-400" /> Partners · share of money paid
              </h2>
              {canCreate && (
                <button onClick={() => setPartnerEdit('new')} className="inline-flex items-center gap-1 text-xs font-medium text-honey-300 hover:underline">
                  <Plus className="h-3.5 w-3.5" /> Add partner
                </button>
              )}
            </div>

            {partners.length === 0 ? (
              <div className="rounded-lg bg-white/5 py-5 text-center">
                <p className="text-sm text-gray-400">No partners yet. Add each person who puts money into the shop.</p>
                {canCreate && (
                  <button onClick={() => setPartnerEdit('new')} className={`${primaryBtn} mt-3`}>
                    <UserPlus className="h-4 w-4" /> Add partner
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* One bar, one coloured piece per partner. Click a piece to see their bills. */}
                <div className="flex h-4 w-full overflow-hidden rounded-full bg-white/10" role="img" aria-label="Share of money paid by each partner">
                  {s &&
                    s.totalInvested > 0 &&
                    partners.map((p, i) =>
                      p.invested > 0 ? (
                        <button
                          key={p._id}
                          onClick={() => pickPartner(p._id)}
                          title={`${p.name}: ${formatRs(p.invested)} (${p.share}%)`}
                          className={`h-full border-r border-gray-950 last:border-r-0 transition-opacity ${partner && partner !== p._id ? 'opacity-30' : 'hover:opacity-80'}`}
                          style={{ width: `${(p.invested / s.totalInvested) * 100}%`, backgroundColor: partnerColor(i) }}
                        />
                      ) : null,
                    )}
                  {s && s.noPartner > 0 && s.totalInvested > 0 && (
                    <button
                      onClick={() => pickPartner('none')}
                      title={`No partner: ${formatRs(s.noPartner)}`}
                      className="h-full bg-gray-500"
                      style={{ width: `${(s.noPartner / s.totalInvested) * 100}%` }}
                    />
                  )}
                </div>

                <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {partners.map((p, i) => (
                    <li
                      key={p._id}
                      className={`group rounded-lg px-3 py-2.5 transition-colors ${partner === p._id ? 'bg-white/15 ring-1 ring-honey-400/70' : 'bg-white/5 hover:bg-white/10'}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: partnerColor(i) }} />
                        <button onClick={() => pickPartner(p._id)} className="min-w-0 flex-1 truncate text-left text-sm font-medium text-gray-100 hover:underline" title="Show this partner's bills">
                          {p.name}
                        </button>
                        <span className="flex gap-0.5">
                          {canEdit && (
                            <button onClick={() => setPartnerEdit(p)} className="rounded p-1 text-gray-500 hover:bg-white/10 hover:text-white" aria-label={`Edit ${p.name}`}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {canDelete && (
                            <button onClick={() => removePartner(p)} disabled={deleting === p._id} className="rounded p-1 text-gray-500 hover:bg-red-500/20 hover:text-red-300 disabled:opacity-50" aria-label={`Remove ${p.name}`}>
                              {deleting === p._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            </button>
                          )}
                        </span>
                      </div>
                      <div className="mt-1 flex items-baseline justify-between gap-2">
                        <span className="text-lg font-semibold tabular-nums text-white">{formatRs(p.invested)}</span>
                        <span className="text-sm font-semibold tabular-nums" style={{ color: partnerColor(i) }}>{p.share}%</span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-gray-400">
                        {bills(p.bills)}
                        {p.balance > 0 && <span className="text-amber-300"> · {formatRs(p.balance)} to pay</span>}
                        {p.phone ? ` · ${p.phone}` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {s && s.noPartnerBills > 0 && (
              <button onClick={() => pickPartner('none')} className="mt-3 w-full rounded-lg bg-amber-400/10 px-3 py-2 text-left text-xs text-amber-200 hover:bg-amber-400/20">
                {bills(s.noPartnerBills)} ({formatRs(s.noPartner)} paid) {s.noPartnerBills === 1 ? 'has' : 'have'} no partner yet. Show them and edit each to pick one.
              </button>
            )}
          </div>

          {filtered && s && (
            <p className="border-t border-white/10 pt-3 text-sm text-gray-400">
              Shown below <span className="font-semibold text-white">{formatRs(s.filteredTotal)}</span> paid
              {s.filteredBalance > 0 && <> · {formatRs(s.filteredBalance)} balance</>}
            </p>
          )}
        </section>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-3 flex flex-col md:flex-row md:flex-wrap gap-2">
          <div className="relative md:flex-1 md:min-w-[14rem]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search what, partner, bill no, paid to…"
              className={`${inputClass} pl-9`}
            />
          </div>
          <SearchSelect
            value={partner}
            onChange={(e) => {
              setPartner(e.target.value);
              setPage(1);
            }}
            className={`${inputClass} md:w-40`}
            aria-label="Partner"
          >
            <option value="">All partners</option>
            {partners.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
            {(partner === 'none' || (s && s.noPartnerBills > 0)) && <option value="none">No partner</option>}
          </SearchSelect>
          <SearchSelect value={status} onChange={(e) => pickStatus(e.target.value as Status)} className={`${inputClass} md:w-40`} aria-label="Paid or balance left">
            <option value="">All bills</option>
            <option value="due">Balance left</option>
            <option value="paid">Paid in full</option>
          </SearchSelect>
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className={`${inputClass} md:w-36`} aria-label="From" />
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className={`${inputClass} md:w-36`} aria-label="To" />
          {filtered && (
            <button onClick={() => { setSearch(''); setPartner(''); setStatus(''); setFrom(''); setTo(''); setPage(1); }} className={secondaryBtn}>
              <X className="h-4 w-4" /> Clear
            </button>
          )}
        </div>

        {/* List */}
        <div className="bg-white rounded-xl border border-gray-200">
          {(partnerName || status) && s && (
            <div className="border-b border-gray-100 px-4 py-2.5 text-sm text-gray-600">
              Showing {partnerName && <span className="font-semibold text-gray-900">{partnerName}</span>}
              {partnerName && status && ' · '}
              {status && <span className="font-semibold text-gray-900">{STATUS_LABEL[status]}</span>} · {formatRs(s.filteredTotal)} paid
              {s.filteredBalance > 0 && <span className="text-amber-700"> · {formatRs(s.filteredBalance)} balance</span>}
            </div>
          )}
          {error && <div className="p-4"><ErrorBox message={error} /></div>}
          {loading ? (
            <div className="py-16 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-honey-700" />
            </div>
          ) : rows.length === 0 ? (
            <div className="py-14 text-center px-4">
              <PiggyBank className="mx-auto h-10 w-10 text-gray-300" />
              <p className="mt-2 text-sm font-medium text-gray-700">{filtered ? 'Nothing matches these filters' : 'No investments yet'}</p>
              {!filtered && canCreate && (
                <p className="mt-1 text-xs text-gray-500">{partners.length ? 'Add the first bill.' : 'First add a partner, then add their bills.'}</p>
              )}
              {!filtered && canCreate && (
                <button onClick={() => (partners.length ? setEditing('new') : setPartnerEdit('new'))} className={`${primaryBtn} mt-4`}>
                  {partners.length ? <Plus className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                  {partners.length ? 'Add the first bill' : 'Add partner'}
                </button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {rows.map((r) => (
                <li key={r._id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 py-3 hover:bg-gray-50">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 truncate">{r.title}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
                      <span>{formatDate(r.date)}</span>
                      {r.partner ? (
                        <span className="rounded-full bg-honey-50 px-2 py-0.5 font-medium text-honey-800">{r.partner.name}</span>
                      ) : (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800">No partner</span>
                      )}
                      {r.billNo && <span>Bill {r.billNo}</span>}
                      {r.paidTo && <span>· {r.paidTo}</span>}
                    </p>
                    {r.note && <p className="mt-0.5 text-xs text-gray-400 truncate">{r.note}</p>}
                  </div>
                  {r.attachments.length > 0 && (
                    <div className="flex gap-1.5">
                      {r.attachments.map((u, i) => (
                        <a key={u} href={fileUrl(u)} target="_blank" rel="noreferrer" title={`Bill ${i + 1}`} className="block h-10 w-10 overflow-hidden rounded-md border border-gray-200 bg-gray-50">
                          {isPdf(u) ? (
                            <span className="flex h-full w-full items-center justify-center text-red-600"><FileText className="h-5 w-5" /></span>
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={fileUrl(u)} alt={`Bill ${i + 1}`} className="h-full w-full object-cover" />
                          )}
                        </a>
                      ))}
                    </div>
                  )}
                  <div className="sm:w-52 sm:text-right">
                    <p className="text-base font-semibold text-gray-900 tabular-nums">{formatRs(r.amount)}</p>
                    <PaidLine row={r} onOpen={() => setPaying(r)} />
                  </div>
                  <div className="flex items-center gap-1">
                    {canEdit && r.balance > 0 && (
                      <button onClick={() => setPaying(r)} className={payBtn} aria-label={`Pay ${r.title}`}>
                        <Wallet className="h-3.5 w-3.5" /> Pay
                      </button>
                    )}
                    {canEdit && (
                      <button onClick={() => setEditing(r)} className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900" aria-label="Edit">
                        <Edit2 className="h-4 w-4" />
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => remove(r)} disabled={deleting === r._id} className="rounded-md p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50" aria-label="Delete">
                        {deleting === r._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {meta && meta.pages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm">
              <span className="text-gray-500">Page {meta.page} of {meta.pages}</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className={secondaryBtn}>Previous</button>
                <button disabled={page >= meta.pages} onClick={() => setPage((p) => p + 1)} className={secondaryBtn}>Next</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {editing && (
        <InvestmentForm
          row={editing === 'new' ? null : editing}
          partners={partners}
          defaultPartner={partner && partner !== 'none' ? partner : ''}
          justAdded={justAdded}
          canAddPartner={canCreate}
          onAddPartner={() => setPartnerEdit('new')}
          onClose={() => {
            setEditing(null);
            setJustAdded(null);
          }}
          onSaved={async () => {
            setEditing(null);
            setJustAdded(null);
            await load();
          }}
        />
      )}

      {paying && (
        <PaymentsModal
          row={paying}
          canPay={canEdit}
          canRemove={canDelete}
          onClose={() => setPaying(null)}
          onChanged={load}
        />
      )}

      {/* After the investment form so it opens on top of it. */}
      {partnerEdit && (
        <PartnerForm
          row={partnerEdit === 'new' ? null : partnerEdit}
          onClose={() => setPartnerEdit(null)}
          onSaved={async (saved, isNew) => {
            setPartnerEdit(null);
            if (isNew && editing) setJustAdded(saved._id);
            await load();
          }}
        />
      )}
    </div>
  );
}

/** Under the bill total: paid in full / paid + balance. Opens the payment history. */
function PaidLine({ row, onOpen }: { row: Investment; onOpen: () => void }) {
  const n = row.payments.length;
  return (
    <button type="button" onClick={onOpen} className="mt-0.5 text-xs text-gray-500 hover:underline sm:text-right" title="Payment history">
      {row.balance <= 0 ? (
        <span className="font-medium text-green-700">Paid in full{n > 1 ? ` · ${payments(n)}` : ''}</span>
      ) : row.paidAmount > 0 ? (
        <>
          Paid {formatRs(row.paidAmount)} · <span className="font-semibold text-amber-700">Balance {formatRs(row.balance)}</span>
        </>
      ) : (
        <span className="font-semibold text-amber-700">Not paid yet · Balance {formatRs(row.balance)}</span>
      )}
    </button>
  );
}

function MoneyTile({ label, value, tone = 'plain' }: { label: string; value: string; tone?: 'plain' | 'green' | 'due' }) {
  const box = tone === 'due' ? 'bg-honey-50' : 'bg-gray-50';
  const text = tone === 'green' ? 'text-green-700' : 'text-gray-900';
  return (
    <div className={`rounded-lg px-2 py-2 text-center ${box}`}>
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className={`text-sm font-semibold tabular-nums ${text}`}>{value}</p>
    </div>
  );
}

/** A bill's payments: pay part (or all) of the balance, see each payment, fix or undo a wrong one. */
function PaymentsModal({
  row,
  canPay,
  canRemove,
  onClose,
  onChanged,
}: {
  row: Investment;
  canPay: boolean;
  canRemove: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [bill, setBill] = useState(row);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayKey());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  // Payment being fixed in the history (amount / date / note).
  const [edit, setEdit] = useState<{ id: string; amount: string; date: string; note: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const busy = saving || !!removing;
  const num = Number(amount);
  const valid = num > 0 && num <= bill.balance;
  const after = round2(bill.balance - (valid ? num : 0));
  const pct = bill.amount > 0 ? Math.min(100, (bill.paidAmount / bill.amount) * 100) : 0;

  // Balance after each payment (payments come oldest first).
  let left = bill.amount;
  const history = bill.payments.map((p) => {
    left = round2(left - p.amount);
    return { ...p, after: left };
  });

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lock.current) return;
    if (!(num > 0)) return setError('Enter the amount you paid.');
    if (num > bill.balance) return setError(`Only ${formatRs(bill.balance)} is left to pay on this bill.`);
    if (date > todayKey()) return setError('The payment date cannot be in the future.');
    lock.current = true;
    setSaving(true);
    setError(null);
    try {
      const res = await storeApi.post<Investment>(`/investments/${bill._id}/payments`, { amount: num, date, note: note.trim() });
      setBill(res.data);
      setAmount('');
      setNote('');
      setDate(todayKey());
      toast.success(res.data.balance > 0 ? `${formatRs(num)} paid. Balance ${formatRs(res.data.balance)}` : `${formatRs(num)} paid. The bill is paid in full`);
      onChanged();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save the payment.'));
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  const startEdit = (p: Payment) => {
    setError(null);
    setEdit({ id: p._id, amount: String(p.amount), date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date(p.date)), note: p.note || '' });
  };

  const saveEdit = async (p: Payment) => {
    if (!edit || lock.current) return;
    const n = Number(edit.amount);
    const most = round2(bill.amount - bill.paidAmount + p.amount);
    if (!(n > 0)) return setError('Enter the amount paid (more than 0).');
    if (n > most) return setError(`At most ${formatRs(most)} for this payment (bill total ${formatRs(bill.amount)}).`);
    if (edit.date > todayKey()) return setError('The payment date cannot be in the future.');
    lock.current = true;
    setSaving(true);
    setError(null);
    try {
      const res = await storeApi.put<Investment>(`/investments/${bill._id}/payments/${p._id}`, { amount: n, date: edit.date, note: edit.note.trim() });
      setBill(res.data);
      setEdit(null);
      toast.success(res.data.balance > 0 ? `Payment saved. Balance ${formatRs(res.data.balance)}` : 'Payment saved. The bill is paid in full');
      onChanged();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save the payment.'));
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  const removePayment = async (p: Payment) => {
    if (busy) return;
    if (!window.confirm(`Remove the payment of ${formatRs(p.amount)} on ${formatDate(p.date)}? The balance goes up by ${formatRs(p.amount)}.`)) return;
    setRemoving(p._id);
    setError(null);
    try {
      const res = await storeApi.del<Investment>(`/investments/${bill._id}/payments/${p._id}`);
      setBill(res.data);
      toast.success('Payment removed');
      onChanged();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not remove the payment.'));
    } finally {
      setRemoving(null);
    }
  };

  return (
    <Modal
      title={bill.balance > 0 && canPay ? 'Pay' : 'Payments'}
      subtitle={`${bill.title}${bill.partner ? ` · ${bill.partner.name}` : ''}`}
      icon={<Wallet className="h-5 w-5" />}
      onClose={onClose}
      busy={busy}
      footer={
        <button type="button" onClick={onClose} disabled={busy} className={secondaryBtn}>
          Close
        </button>
      }
    >
      <div className="space-y-4">
        {error && <ErrorBox message={error} />}
        <div>
          <div className="grid grid-cols-3 gap-2">
            <MoneyTile label="Bill total" value={formatRs(bill.amount)} />
            <MoneyTile label="Paid" value={formatRs(bill.paidAmount)} tone="green" />
            {bill.balance > 0 ? <MoneyTile label="Balance" value={formatRs(bill.balance)} tone="due" /> : <MoneyTile label="Balance" value="Paid in full" tone="green" />}
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full" style={{ backgroundColor: TRACK }}>
            <div className="h-1.5 rounded-full bg-green-600" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {bill.balance > 0 && canPay && (
          <form onSubmit={pay} className="rounded-lg border border-honey-200 p-3 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Amount paid (Rs)" required>
                <div className="flex gap-2">
                  <MoneyInput
                    value={amount}
                    onValue={setAmount}
                    placeholder="0"
                    className={`${inputClass} text-base font-semibold`}
                    autoFocus
                  />
                  <button type="button" onClick={() => setAmount(String(bill.balance))} className={`${secondaryBtn} !px-2 text-xs whitespace-nowrap`}>
                    All
                  </button>
                </div>
              </Field>
              <Field label="Date paid">
                <input type="date" value={date} max={todayKey()} onChange={(e) => setDate(e.target.value)} className={inputClass} />
              </Field>
            </div>
            <Field label="Note">
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Cash, bank transfer, cheque no." className={inputClass} maxLength={300} />
            </Field>
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">
              <p className="text-xs text-gray-600">
                {!valid
                  ? `Balance ${formatRs(bill.balance)}. Pay all of it or a part.`
                  : after > 0
                    ? <>Balance after this payment: <span className="font-semibold text-amber-700">{formatRs(after)}</span></>
                    : <span className="font-semibold text-green-700">This pays the bill in full.</span>}
              </p>
              <button type="submit" disabled={busy} className={primaryBtn}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? 'Saving…' : num > 0 ? `Pay ${formatRs(num)}` : 'Pay'}
              </button>
            </div>
          </form>
        )}

        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Payment history</h3>
          {history.length === 0 ? (
            <p className="rounded-lg bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">No payments yet.</p>
          ) : (
            <ol className="divide-y divide-gray-100 rounded-lg border border-gray-200">
              {history.map((p, i) =>
                edit?.id === p._id ? (
                  <li key={p._id} className="space-y-2 bg-honey-50/40 px-3 py-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Field label={`Payment ${i + 1}: amount (Rs)`} required>
                        <MoneyInput
                          value={edit.amount}
                          onValue={(v) => setEdit({ ...edit, amount: v })}
                          className={inputClass}
                          autoFocus
                        />
                      </Field>
                      <Field label="Date paid">
                        <input type="date" value={edit.date} max={todayKey()} onChange={(e) => setEdit({ ...edit, date: e.target.value })} className={inputClass} />
                      </Field>
                    </div>
                    <input value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} placeholder="Note" className={inputClass} maxLength={300} aria-label="Note" />
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setEdit(null)} disabled={saving} className={`${secondaryBtn} !py-1.5`}>
                        Cancel
                      </button>
                      <button type="button" onClick={() => saveEdit(p)} disabled={saving} className={`${primaryBtn} !py-1.5`}>
                        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                        Save
                      </button>
                    </div>
                  </li>
                ) : (
                  <li key={p._id} className="flex items-center gap-2 px-3 py-2.5">
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-semibold text-gray-600">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-500">
                        <span className="font-semibold text-gray-900 tabular-nums">{formatRs(p.amount)}</span> paid on {formatDate(p.date)}
                      </p>
                      <p className="truncate text-[11px] text-gray-500">
                        {p.after > 0 ? <>Balance after: <span className="text-amber-700">{formatRs(p.after)}</span></> : <span className="text-green-700">Paid in full</span>}
                        {p.note ? ` · ${p.note}` : ''}
                      </p>
                    </div>
                    {canPay && (
                      <button
                        type="button"
                        onClick={() => startEdit(p)}
                        disabled={busy}
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-50"
                        aria-label={`Edit the payment of ${formatRs(p.amount)}`}
                        title="Edit this payment"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    )}
                    {canRemove && (
                      <button
                        type="button"
                        onClick={() => removePayment(p)}
                        disabled={busy}
                        className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        aria-label={`Remove the payment of ${formatRs(p.amount)}`}
                        title="Remove this payment (if saved by mistake)"
                      >
                        {removing === p._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    )}
                  </li>
                ),
              )}
            </ol>
          )}
        </div>
      </div>
    </Modal>
  );
}

function PartnerForm({
  row,
  onClose,
  onSaved,
}: {
  row: Partner | null;
  onClose: () => void;
  onSaved: (saved: PartnerRef, isNew: boolean) => void;
}) {
  const [name, setName] = useState(row?.name || '');
  const [phone, setPhone] = useState(row?.phone || '');
  const [note, setNote] = useState(row?.note || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (lock.current) return;
    if (!name.trim()) return setError("Write the partner's name.");
    lock.current = true;
    setSaving(true);
    setError(null);
    try {
      const body = { name: name.trim(), phone: phone.trim(), note: note.trim() };
      const res = row
        ? await storeApi.put<PartnerRef>(`/investment-partners/${row._id}`, body)
        : await storeApi.post<PartnerRef>('/investment-partners', body);
      toast.success(row ? 'Partner saved' : `${res.data.name} added`);
      onSaved(res.data, !row);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save the partner.'));
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  return (
    <Modal
      title={row ? 'Edit partner' : 'Add partner'}
      subtitle="A person who puts money into the shop"
      icon={<UserPlus className="h-5 w-5" />}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className={secondaryBtn}>
            Cancel
          </button>
          <button type="submit" form="partner-form" disabled={saving} className={primaryBtn}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Saving…' : row ? 'Save' : 'Add partner'}
          </button>
        </>
      }
    >
      <form id="partner-form" onSubmit={submit} className="space-y-3">
        {error && <ErrorBox message={error} />}
        <Field label="Name" required>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Usman" className={inputClass} autoFocus maxLength={120} />
        </Field>
        <Field label="Phone">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="03xx-xxxxxxx" className={inputClass} maxLength={40} />
        </Field>
        <Field label="Note">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={inputClass} maxLength={500} />
        </Field>
      </form>
    </Modal>
  );
}

function InvestmentForm({
  row,
  partners,
  defaultPartner,
  justAdded,
  canAddPartner,
  onAddPartner,
  onClose,
  onSaved,
}: {
  row: Investment | null;
  partners: Partner[];
  defaultPartner: string;
  justAdded: string | null;
  canAddPartner: boolean;
  onAddPartner: () => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(row?.title || '');
  const [amount, setAmount] = useState(row ? String(row.amount) : '');
  // A bill paid in one go (or not at all) edits "paid" here; one paid in parts
  // changes its payments in the payment history.
  const simple = !row || row.payments.length <= 1;
  const [payMode, setPayMode] = useState<PayMode>(row && row.balance > 0 ? 'part' : 'full');
  const [paidNow, setPaidNow] = useState(row && row.balance > 0 ? String(row.paidAmount) : '');
  const [date, setDate] = useState(row ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date(row.date)) : todayKey());
  const [partnerId, setPartnerId] = useState(row ? row.partner?._id || '' : defaultPartner || (partners.length === 1 ? partners[0]._id : ''));
  const [billNo, setBillNo] = useState(row?.billNo || '');
  const [paidTo, setPaidTo] = useState(row?.paidTo || '');
  const [note, setNote] = useState(row?.note || '');
  const [keep, setKeep] = useState<string[]>(row?.attachments || []);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  const total = round2(Number(amount) || 0);
  const paid = !simple && row ? row.paidAmount : payMode === 'full' ? total : round2(Number(paidNow) || 0);
  const balance = round2(total - paid);

  // A partner was just added with "+ New partner": pick them.
  useEffect(() => {
    if (justAdded) setPartnerId(justAdded);
  }, [justAdded]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lock.current) return;
    if (!partnerId) return setError('Pick the partner who put this money in.');
    if (!title.trim()) return setError('Write what the investment was for.');
    if (!(total > 0)) return setError('Enter the bill total (more than 0).');
    if (simple && payMode === 'part' && Number(paidNow) < 0) return setError('Paid cannot be less than 0.');
    if (simple && paid > total) return setError(`Paid (${formatRs(paid)}) is more than the bill total (${formatRs(total)}).`);
    if (!simple && row && total < row.paidAmount) {
      return setError(`${formatRs(row.paidAmount)} is already paid on this bill, so the total cannot be less. Change a payment in the payment history first.`);
    }
    if (keep.length + files.length > 5) return setError('Up to 5 bills per entry.');
    lock.current = true;
    setSaving(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('partner', partnerId);
      form.append('title', title.trim());
      form.append('amount', String(total));
      if (simple) form.append('paidAmount', String(paid));
      form.append('date', date);
      form.append('billNo', billNo.trim());
      form.append('paidTo', paidTo.trim());
      form.append('note', note.trim());
      if (row) form.append('keepAttachments', JSON.stringify(keep));
      files.forEach((f) => form.append('bills', f));
      if (row) await storeApi.upload(`/investments/${row._id}`, form, 'put');
      else await storeApi.upload('/investments', form);
      toast.success(row ? 'Saved' : balance > 0 ? `Investment added. Balance ${formatRs(balance)}` : 'Investment added');
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save.'));
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  return (
    <Modal
      title={row ? 'Edit investment' : 'Add investment'}
      subtitle="One entry per bill"
      icon={<PiggyBank className="h-5 w-5" />}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className={secondaryBtn}>
            Cancel
          </button>
          <button type="submit" form="investment-form" disabled={saving} className={primaryBtn}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <form id="investment-form" onSubmit={submit} className="space-y-3">
        {error && <ErrorBox message={error} />}
        <Field label="Partner" required>
          <div className="flex gap-2">
            <SearchSelect value={partnerId} onChange={(e) => setPartnerId(e.target.value)} className={`${inputClass} flex-1 min-w-0`}>
              <option value="">{partners.length ? 'Pick a partner' : 'No partners yet: add one'}</option>
              {partners.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </SearchSelect>
            {canAddPartner && (
              <button type="button" onClick={onAddPartner} className={`${secondaryBtn} flex-shrink-0`}>
                <UserPlus className="h-4 w-4" /> New
              </button>
            )}
          </div>
        </Field>
        <Field label="What was it for?" required>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Steel racks for the shop" className={inputClass} autoFocus={!!partners.length} maxLength={200} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Bill total (Rs)" required>
            <MoneyInput value={amount} onValue={setAmount} placeholder="0" className={`${inputClass} text-base font-semibold`} />
          </Field>
          <Field label="Date">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </Field>
        </div>

        <div className="rounded-lg border border-gray-200 p-3 space-y-3">
          {!simple && row ? (
            <p className="text-xs text-gray-600">
              {formatRs(row.paidAmount)} paid in {payments(row.payments.length)}. To change what was paid, close this and use{' '}
              <span className="font-semibold">Pay</span> or the payment history on the bill (edit or remove a payment).
            </p>
          ) : (
            <>
              <Field label="Paid?">
                <Chips options={PAY_MODES} value={payMode} onChange={setPayMode} disabled={saving} />
              </Field>
              {payMode === 'part' && (
                <Field
                  label={row ? 'Paid (Rs)' : 'Paid now (Rs)'}
                  hint="Money paid on this bill so far. 0 = nothing paid yet. Pay the rest later with the Pay button."
                >
                  <MoneyInput value={paidNow} onValue={setPaidNow} placeholder="0" className={inputClass} autoFocus={!row} />
                </Field>
              )}
            </>
          )}
          {total > 0 && (
            <div className="grid grid-cols-3 gap-2">
              <MoneyTile label="Bill total" value={formatRs(total)} />
              <MoneyTile label={row ? 'Paid' : 'Paid now'} value={formatRs(paid)} tone="green" />
              {balance > 0 ? (
                <MoneyTile label="Balance" value={formatRs(balance)} tone="due" />
              ) : balance === 0 ? (
                <MoneyTile label="Balance" value="Paid in full" tone="green" />
              ) : (
                <MoneyTile label="Balance" value={simple ? 'Paid too much' : 'Total too low'} tone="due" />
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Bill no">
            <input value={billNo} onChange={(e) => setBillNo(e.target.value)} className={inputClass} maxLength={80} />
          </Field>
          <Field label="Paid to">
            <input value={paidTo} onChange={(e) => setPaidTo(e.target.value)} placeholder="Shop / person" className={inputClass} maxLength={120} />
          </Field>
        </div>
        <Field label="Note">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={inputClass} maxLength={1000} />
        </Field>
        <Field label="Bills (photo or PDF, up to 5)">
          <div className="flex flex-wrap gap-2">
            {keep.map((u) => (
              <span key={u} className="relative block h-16 w-16 overflow-hidden rounded-md border border-gray-200 bg-gray-50">
                {isPdf(u) ? (
                  <span className="flex h-full w-full items-center justify-center text-red-600"><FileText className="h-6 w-6" /></span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fileUrl(u)} alt="Bill" className="h-full w-full object-cover" />
                )}
                <button type="button" onClick={() => setKeep((k) => k.filter((x) => x !== u))} className="absolute right-0.5 top-0.5 rounded bg-white/90 p-0.5 text-gray-600 hover:text-red-600" aria-label="Remove bill">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
            {files.map((f, i) => (
              <span key={`${f.name}-${i}`} className="relative flex h-16 w-24 items-center justify-center rounded-md border border-dashed border-honey-400 bg-honey-50 px-1 text-center text-[10px] text-gray-700">
                <span className="line-clamp-3 break-all">{f.name}</span>
                <button type="button" onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))} className="absolute right-0.5 top-0.5 rounded bg-white/90 p-0.5 text-gray-600 hover:text-red-600" aria-label="Remove file">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
            {keep.length + files.length < 5 && (
              <label className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-gray-300 text-gray-500 hover:border-honey-400 hover:text-gray-800">
                <Plus className="h-5 w-5" />
                <span className="text-[10px]">Add</span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const list = Array.from(e.target.files || []);
                    setFiles((fs) => [...fs, ...list].slice(0, Math.max(0, 5 - keep.length)));
                    e.target.value = '';
                  }}
                />
              </label>
            )}
          </div>
        </Field>
      </form>
    </Modal>
  );
}
