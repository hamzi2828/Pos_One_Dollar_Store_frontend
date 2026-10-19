'use client';

// Investment: everything partners put into the shop (racks, renovation, AC,
// signboard, opening stock...). Add partners, then one entry per bill with the
// partner who paid; the totals and each partner's share add up by themselves.
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Download, Edit2, FileText, Loader2, PiggyBank, Plus, Search, Trash2, UserPlus, Users, X } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { BACKEND_URL, apiErrorMessage, formatDate, formatRs, storeApi, type PageMeta } from '@/lib/storeApi';
import { getAuthHeader } from '@/helper/helper';
import { ErrorBox, Field, Modal, NoAccessCard, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { SERIES, TRACK } from '../adminComponents/charts';

interface PartnerRef {
  _id: string;
  name: string;
  phone?: string;
}

interface Partner extends PartnerRef {
  phone: string;
  note: string;
  invested: number;
  bills: number;
  /** % of all money invested, 1 decimal. */
  share: number;
}

interface Investment {
  _id: string;
  title: string;
  amount: number;
  date: string;
  partner: PartnerRef | null;
  billNo: string;
  paidTo: string;
  note: string;
  attachments: string[];
}

interface Summary {
  totalInvested: number;
  entries: number;
  since: string | null;
  thisMonth: number;
  filteredTotal: number;
  /** Bills saved before partners existed. */
  noPartner: number;
}

type ListMeta = PageMeta & { summary: Summary; partners: Partner[] };

const fileUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : `${BACKEND_URL}${u}`);
const isPdf = (u: string) => /\.pdf($|\?)/i.test(u);
const todayKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date());
const bills = (n: number) => `${n} bill${n === 1 ? '' : 's'}`;

export default function InvestmentsPage() {
  const { can } = useAccess();
  const canView = can('investments', 'view');
  const canCreate = can('investments', 'create');
  const [rows, setRows] = useState<Investment[]>([]);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [partner, setPartner] = useState(''); // '' = all, 'none' = no partner, else id
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Investment | 'new' | null>(null);
  const [partnerEdit, setPartnerEdit] = useState<Partner | 'new' | null>(null);
  // A partner just added from inside the investment form: the form selects it.
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await storeApi.get<Investment[]>('/investments', { search, partner, from, to, page, limit: 50 });
      setRows(res.data);
      setMeta(res.meta as unknown as ListMeta);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load investments.'));
    } finally {
      setLoading(false);
    }
  }, [search, partner, from, to, page]);

  useEffect(() => {
    if (!canView) return;
    const t = window.setTimeout(load, search ? 300 : 0);
    return () => window.clearTimeout(t);
  }, [canView, load, search]);

  const pickPartner = (id: string) => {
    setPartner((cur) => (cur === id ? '' : id));
    setPage(1);
  };

  const remove = async (row: Investment) => {
    if (deleting) return;
    if (!window.confirm(`Delete "${row.title}" (${formatRs(row.amount)})? The total will go down.`)) return;
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
      const q = new URLSearchParams(Object.entries({ search, partner, from, to }).filter(([, v]) => v) as [string, string][]);
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

  if (!canView) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <NoAccessCard />
      </div>
    );
  }

  const s = meta?.summary;
  const partners = meta?.partners || [];
  const filtered = !!(search || partner || from || to);
  const partnerName = partner === 'none' ? 'No partner' : partners.find((p) => p._id === partner)?.name;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-5">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 flex items-center gap-2">
              <PiggyBank className="h-6 w-6 text-honey-700" /> Investment
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">Money each partner put into the shop. Add each bill and the totals add up by themselves.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {can('investments', 'export') && (
              <button onClick={exportCsv} disabled={exporting} className={secondaryBtn}>
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} CSV
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

        {/* Total + partners */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-xl bg-gray-950 p-5 text-white flex flex-col justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-400">Total invested</p>
              <p className="mt-1 text-4xl sm:text-5xl font-semibold tracking-tight text-honey-400 break-words">{s ? formatRs(s.totalInvested) : '…'}</p>
              <p className="mt-2 text-sm text-gray-400">
                {s ? `${bills(s.entries)}${s.since ? ` since ${formatDate(s.since)}` : ''} · ${partners.length} partner${partners.length === 1 ? '' : 's'}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span className="text-gray-400">
                This month <span className="font-semibold text-white">{s ? formatRs(s.thisMonth) : '…'}</span>
              </span>
              {filtered && s && (
                <span className="text-gray-400">
                  Shown below <span className="font-semibold text-white">{formatRs(s.filteredTotal)}</span>
                </span>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                <Users className="h-4 w-4 text-gray-500" /> Partners
              </h2>
              {canCreate && (
                <button onClick={() => setPartnerEdit('new')} className="inline-flex items-center gap-1 text-xs font-medium text-honey-700 hover:underline">
                  <Plus className="h-3.5 w-3.5" /> Add partner
                </button>
              )}
            </div>
            {partners.length === 0 ? (
              <div className="py-4 text-center">
                <p className="text-xs text-gray-500">No partners yet. Add each person who puts money into the shop.</p>
                {canCreate && (
                  <button onClick={() => setPartnerEdit('new')} className={`${primaryBtn} mt-3`}>
                    <UserPlus className="h-4 w-4" /> Add partner
                  </button>
                )}
              </div>
            ) : (
              <ul className="space-y-3">
                {partners.map((p) => (
                  <li key={p._id} className={`group rounded-md -mx-1.5 px-1.5 py-1 ${partner === p._id ? 'bg-honey-50 ring-1 ring-honey-300' : ''}`}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <button onClick={() => pickPartner(p._id)} className="min-w-0 truncate text-left font-medium text-gray-800 hover:underline" title="Show this partner's bills">
                        {p.name}
                      </button>
                      <span className="flex-shrink-0 font-semibold text-gray-900 tabular-nums">{formatRs(p.invested)}</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded-full" style={{ backgroundColor: TRACK }}>
                      <div className="h-1.5 rounded-full" style={{ width: `${p.invested > 0 ? Math.max(2, Math.min(100, p.share)) : 0}%`, backgroundColor: SERIES }} />
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-gray-500">
                      <span>
                        {p.share}% of total · {bills(p.bills)}
                        {p.phone ? ` · ${p.phone}` : ''}
                      </span>
                      <span className="flex gap-0.5">
                        {can('investments', 'edit') && (
                          <button onClick={() => setPartnerEdit(p)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-800" aria-label={`Edit ${p.name}`}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {can('investments', 'delete') && (
                          <button onClick={() => removePartner(p)} disabled={deleting === p._id} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50" aria-label={`Remove ${p.name}`}>
                            {deleting === p._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          </button>
                        )}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {s && s.noPartner > 0 && (
              <button onClick={() => pickPartner('none')} className="mt-3 w-full rounded-md bg-amber-50 px-2.5 py-2 text-left text-xs text-amber-800 hover:bg-amber-100">
                {formatRs(s.noPartner)} has no partner yet. Show those bills and edit them to pick one.
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-3 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
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
          <select
            value={partner}
            onChange={(e) => {
              setPartner(e.target.value);
              setPage(1);
            }}
            className={`${inputClass} sm:w-52`}
            aria-label="Partner"
          >
            <option value="">All partners</option>
            {partners.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
            {(partner === 'none' || (s && s.noPartner > 0)) && <option value="none">No partner</option>}
          </select>
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className={`${inputClass} sm:w-40`} aria-label="From" />
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className={`${inputClass} sm:w-40`} aria-label="To" />
          {filtered && (
            <button onClick={() => { setSearch(''); setPartner(''); setFrom(''); setTo(''); setPage(1); }} className={secondaryBtn}>
              <X className="h-4 w-4" /> Clear
            </button>
          )}
        </div>

        {/* List */}
        <div className="bg-white rounded-xl border border-gray-200">
          {partnerName && (
            <div className="border-b border-gray-100 px-4 py-2.5 text-sm text-gray-600">
              Showing <span className="font-semibold text-gray-900">{partnerName}</span>
              {s ? <> · {formatRs(s.filteredTotal)}</> : null}
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
                  <p className="text-base font-semibold text-gray-900 tabular-nums sm:w-36 sm:text-right">{formatRs(r.amount)}</p>
                  <div className="flex gap-1">
                    {can('investments', 'edit') && (
                      <button onClick={() => setEditing(r)} className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900" aria-label="Edit">
                        <Edit2 className="h-4 w-4" />
                      </button>
                    )}
                    {can('investments', 'delete') && (
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

  // A partner was just added with "+ New partner": pick them.
  useEffect(() => {
    if (justAdded) setPartnerId(justAdded);
  }, [justAdded]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lock.current) return;
    if (!partnerId) return setError('Pick the partner who put this money in.');
    if (!title.trim()) return setError('Write what the investment was for.');
    if (!(Number(amount) > 0)) return setError('Enter an amount more than 0.');
    if (keep.length + files.length > 5) return setError('Up to 5 bills per entry.');
    lock.current = true;
    setSaving(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('partner', partnerId);
      form.append('title', title.trim());
      form.append('amount', String(Number(amount)));
      form.append('date', date);
      form.append('billNo', billNo.trim());
      form.append('paidTo', paidTo.trim());
      form.append('note', note.trim());
      if (row) form.append('keepAttachments', JSON.stringify(keep));
      files.forEach((f) => form.append('bills', f));
      if (row) await storeApi.upload(`/investments/${row._id}`, form, 'put');
      else await storeApi.upload('/investments', form);
      toast.success(row ? 'Saved' : 'Investment added');
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
            <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)} className={`${inputClass} flex-1 min-w-0`}>
              <option value="">{partners.length ? 'Pick a partner' : 'No partners yet: add one'}</option>
              {partners.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
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
          <Field label="Amount (Rs)" required>
            <input type="number" inputMode="decimal" min={1} step="any" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Date">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </Field>
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
