'use client';

// Bank check: upload the bank statement PDF, match every bank payment to what
// is in the POS, download a marked copy, and see earlier statements.
// No AI: the backend matches by amount, date and name (docs/BANK_CHECK.md).

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Download, FileCheck2, FileUp, Loader2, RefreshCw, Trash2, Upload, StickyNote, Check } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage, formatDate, formatRs } from '@/lib/storeApi';
import { Modal, Field, ErrorBox, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { SearchSelect } from '@/components/ui/SearchSelect';
import {
  bankCheckApi,
  bankName,
  lineStatus,
  matchHref,
  type BankLine,
  type BankStatement,
  type LineStatus,
  type Preview,
  type StatementDetail,
} from './bankCheckApi';

const STATUS: Record<LineStatus, { label: string; chip: string; tile: string }> = {
  ok: { label: 'OK', chip: 'bg-green-100 text-green-800', tile: 'border-green-200 bg-green-50 text-green-800' },
  fix: { label: 'Needs fixing', chip: 'bg-orange-100 text-orange-800', tile: 'border-orange-200 bg-orange-50 text-orange-800' },
  missing: { label: 'Not in system', chip: 'bg-red-100 text-red-800', tile: 'border-red-200 bg-red-50 text-red-800' },
  in: { label: 'Money in', chip: 'bg-sky-100 text-sky-800', tile: 'border-sky-200 bg-sky-50 text-sky-800' },
};
type Filter = 'all' | LineStatus;
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'ok', label: 'OK' },
  { key: 'fix', label: 'Needs fixing' },
  { key: 'missing', label: 'Not in system' },
  { key: 'in', label: 'Money in' },
];

const day = (v?: string | null) => (v ? String(v).slice(0, 10) : '');

function Chip({ status, manual }: { status: LineStatus; manual?: boolean }) {
  const s = STATUS[status] || STATUS.fix;
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.chip}`}>
      {s.label}
      {manual ? <span className="font-normal opacity-75">(by hand)</span> : null}
    </span>
  );
}

export default function BankCheckPanel() {
  const { can } = useAccess();
  const canCreate = can('bank_check', 'create');
  const canEdit = can('bank_check', 'edit');
  const canDelete = can('bank_check', 'delete');

  const [list, setList] = useState<BankStatement[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [detail, setDetail] = useState<StatementDetail | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [rechecking, setRechecking] = useState(false);

  // Upload flow
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [bankId, setBankId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  // Row note / delete confirm
  const [noteFor, setNoteFor] = useState<BankLine | null>(null);
  const [noteStatus, setNoteStatus] = useState<'ok' | 'fix' | 'missing'>('fix');
  const [noteText, setNoteText] = useState('');
  const [savingLine, setSavingLine] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<BankStatement | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadList = useCallback(async () => {
    try {
      const r = await bankCheckApi.list();
      setList(Array.isArray(r.data) ? r.data : []);
      setListError(null);
    } catch (e) {
      setListError(apiErrorMessage(e, 'Could not load earlier statements.'));
    }
  }, []);
  useEffect(() => {
    loadList();
  }, [loadList]);

  const open = async (id: string) => {
    setOpening(id);
    try {
      const r = await bankCheckApi.get(id);
      setDetail(r.data);
      setFilter('all');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not open this statement.'));
    } finally {
      setOpening(null);
    }
  };

  const pickFile = async (f: File | undefined | null) => {
    if (fileRef.current) fileRef.current.value = '';
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) return toast.error('Choose a PDF file');
    if (f.size > 10 * 1024 * 1024) return toast.error('The PDF is too big (10 MB max)');
    setPreviewing(true);
    try {
      const r = await bankCheckApi.preview(f);
      const p = r.data;
      setFile(f);
      setPreview(p);
      setBankId(p.bankId || '');
      setFrom(day(p.suggestedFrom || p.periodFrom));
      setTo(day(p.suggestedTo || p.periodTo));
      setRunError(null);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not read this statement.'));
    } finally {
      setPreviewing(false);
    }
  };

  const closeRun = () => {
    if (running) return;
    setPreview(null);
    setFile(null);
  };

  const run = async () => {
    if (!file || !preview) return;
    if (!bankId) return setRunError('Choose the bank');
    if (!from || !to) return setRunError('Choose both dates');
    if (from > to) return setRunError('"Check from" must be before "Check to"');
    setRunning(true);
    setRunError(null);
    try {
      const r = await bankCheckApi.run(file, bankId, from, to);
      setDetail(r.data);
      setFilter('all');
      setPreview(null);
      setFile(null);
      toast.success('Statement checked');
      loadList();
    } catch (e) {
      setRunError(apiErrorMessage(e, 'Could not check this statement.'));
    } finally {
      setRunning(false);
    }
  };

  const recheck = async () => {
    if (!detail) return;
    setRechecking(true);
    try {
      const r = await bankCheckApi.recheck(detail.statement._id);
      setDetail(r.data);
      toast.success('Checked again');
      loadList();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not check again.'));
    } finally {
      setRechecking(false);
    }
  };

  const saveLine = async (line: BankLine, status: 'ok' | 'fix' | 'missing', note: string) => {
    setSavingLine(line._id);
    try {
      const r = await bankCheckApi.setLine(line._id, status, note);
      const saved = r.data;
      setDetail((d) =>
        d
          ? {
              ...d,
              lines: d.lines.map((l) =>
                l._id === line._id
                  ? saved && saved._id
                    ? { ...l, ...saved }
                    : { ...l, manual: { status, note } }
                  : l,
              ),
            }
          : d,
      );
      setNoteFor(null);
      toast.success('Saved');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not save.'));
    } finally {
      setSavingLine(null);
    }
  };

  const openNote = (l: BankLine) => {
    const s = lineStatus(l);
    setNoteStatus(s === 'in' ? 'ok' : s);
    setNoteText(l.manual?.note || '');
    setNoteFor(l);
  };

  const remove = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await bankCheckApi.remove(toDelete._id);
      if (detail?.statement._id === toDelete._id) setDetail(null);
      setToDelete(null);
      toast.success('Statement deleted');
      loadList();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not delete.'));
    } finally {
      setDeleting(false);
    }
  };

  // Result numbers (from the lines, so manual decisions show at once)
  const lines = detail?.lines || [];
  const sum = (st: LineStatus) => {
    const ls = lines.filter((l) => lineStatus(l) === st);
    return { n: ls.length, rs: ls.reduce((t, l) => t + (Number(l.amount) || 0), 0) };
  };
  const shown = filter === 'all' ? lines : lines.filter((l) => lineStatus(l) === filter);
  const st = detail?.statement;
  const notOn = detail?.notOnStatement || st?.notOnStatement || [];
  const mi = detail?.moneyIn || st?.moneyIn;

  return (
    <div className="space-y-4">
      {/* Upload */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-gray-900">Bank check</h3>
            <p className="text-xs text-gray-500">
              Upload the bank statement (PDF). Every payment from the bank is matched with what is entered in the system.
              Dates already checked are skipped.
            </p>
          </div>
          {canCreate && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
              <button type="button" className={primaryBtn} disabled={previewing} onClick={() => fileRef.current?.click()}>
                {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {previewing ? 'Reading…' : 'Upload statement'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Result */}
      {detail && st && (
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-gray-900">
                {st.statementNo} · {bankName(st.bank)}
              </h3>
              <p className="text-xs text-gray-500">
                Checked {formatDate(st.checkFrom)} – {formatDate(st.checkTo)} · statement {formatDate(st.periodFrom)} –{' '}
                {formatDate(st.periodTo)}
                {st.counts?.reused ? ` · ${st.counts.reused} lines already checked before (reused)` : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {st.markedUrl && (
                <a href={st.markedUrl} target="_blank" rel="noopener noreferrer" className={primaryBtn}>
                  <Download className="h-4 w-4" /> Download marked PDF
                </a>
              )}
              {canEdit && (
                <button type="button" className={secondaryBtn} onClick={recheck} disabled={rechecking}>
                  <RefreshCw className={`h-4 w-4 ${rechecking ? 'animate-spin' : ''}`} /> Re-check
                </button>
              )}
              <button type="button" className={secondaryBtn} onClick={() => setDetail(null)}>
                Close
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 sm:gap-3">
            {(['ok', 'fix', 'missing', 'in'] as LineStatus[]).map((k) => {
              const v = sum(k);
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFilter(filter === k ? 'all' : k)}
                  className={`rounded-xl border p-3 text-left ${STATUS[k].tile} ${filter === k ? 'ring-2 ring-offset-1 ring-current' : ''}`}
                >
                  <span className="block text-xs font-medium">{STATUS[k].label}</span>
                  <span className="block text-xl font-bold tabular-nums">{v.n}</span>
                  <span className="block text-[11px] tabular-nums opacity-80">{formatRs(v.rs)}</span>
                </button>
              );
            })}
          </div>

          <div className="flex gap-1.5 overflow-x-auto">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium ${
                  filter === f.key ? 'border-honey-500 bg-honey-50 text-honey-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {f.label}
                <span className="ml-1 text-gray-400">
                  {f.key === 'all' ? lines.length : lines.filter((l) => lineStatus(l) === f.key).length}
                </span>
              </button>
            ))}
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-100">
            <table className="min-w-[860px] w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Paid to / from</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">In the system</th>
                  <th className="px-3 py-2 text-left">What to do</th>
                  {canEdit && <th className="px-3 py-2 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shown.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit ? 7 : 6} className="px-3 py-6 text-center text-sm text-gray-500">
                      Nothing here.
                    </td>
                  </tr>
                ) : (
                  shown.map((l) => {
                    const s = lineStatus(l);
                    const href = matchHref(l.match);
                    return (
                      <tr key={l._id} className="align-top">
                        <td className="whitespace-nowrap px-3 py-2 text-gray-700">{formatDate(l.date)}</td>
                        <td className="px-3 py-2">
                          <span className="block text-gray-900">{l.payee || (l.direction === 'in' ? 'Money in' : '—')}</span>
                          <span className="block max-w-[260px] truncate text-[11px] text-gray-400" title={l.particulars}>
                            {l.particulars}
                          </span>
                        </td>
                        <td
                          className={`whitespace-nowrap px-3 py-2 text-right tabular-nums font-medium ${
                            l.direction === 'in' ? 'text-sky-700' : 'text-gray-900'
                          }`}
                        >
                          {l.direction === 'in' ? '+ ' : ''}
                          {formatRs(l.amount)}
                        </td>
                        <td className="px-3 py-2">
                          <Chip status={s} manual={!!l.manual} />
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {l.match ? (
                            <>
                              {href ? (
                                <Link href={href} className="font-medium text-honey-800 hover:underline">
                                  {l.match.ref || 'Open'}
                                </Link>
                              ) : (
                                <span className="font-medium text-gray-800">{l.match.ref || '—'}</span>
                              )}
                              <span className="block text-gray-500">
                                {[l.match.label, l.match.date ? formatDate(l.match.date) : '', l.match.amount != null ? formatRs(l.match.amount) : '', l.match.method]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </span>
                            </>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600">
                          {l.issue || ''}
                          {l.manual?.note ? (
                            <span className="mt-0.5 block text-gray-800">
                              Note: {l.manual.note}
                              {l.manual.byName ? <span className="text-gray-400"> — {l.manual.byName}</span> : null}
                            </span>
                          ) : null}
                        </td>
                        {canEdit && (
                          <td className="whitespace-nowrap px-3 py-2 text-right">
                            <div className="inline-flex gap-1">
                              {s !== 'ok' && s !== 'in' && (
                                <button
                                  type="button"
                                  disabled={savingLine === l._id}
                                  onClick={() => saveLine(l, 'ok', l.manual?.note || '')}
                                  className="inline-flex items-center gap-1 rounded-md border border-green-200 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
                                >
                                  {savingLine === l._id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                  Mark OK
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => openNote(l)}
                                className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                              >
                                <StickyNote className="h-3 w-3" /> Note
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* In the system as bank, not on the statement */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900">In system as bank but not on statement</h4>
            <p className="mb-2 text-[11px] text-gray-500">
              These are entered as paid from the bank, but the bank statement does not show them. Check the method or the bank.
            </p>
            {notOn.length === 0 ? (
              <p className="text-xs text-green-700">None — good.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <table className="min-w-[560px] w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Record</th>
                      <th className="px-3 py-2 text-left">Who</th>
                      <th className="px-3 py-2 text-left">Method</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {notOn.map((n, i) => {
                      const href = matchHref(n);
                      return (
                        <tr key={`${n.id}-${i}`}>
                          <td className="whitespace-nowrap px-3 py-2 text-gray-700">{formatDate(n.date)}</td>
                          <td className="px-3 py-2">
                            {href ? (
                              <Link href={href} className="font-medium text-honey-800 hover:underline">
                                {n.ref || 'Open'}
                              </Link>
                            ) : (
                              n.ref || '—'
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-700">{n.who || '—'}</td>
                          <td className="px-3 py-2 capitalize text-gray-600">{n.method || '—'}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{formatRs(n.amount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Money in */}
          {mi && (
            <div>
              <h4 className="mb-2 text-sm font-semibold text-gray-900">Money in check</h4>
              <div className="grid gap-2 sm:grid-cols-2">
                <CompareBox
                  title="Card sales"
                  aLabel="Card sales in the system"
                  a={mi.cardSales || 0}
                  bLabel="Card money the bank received"
                  b={mi.cardSettled || 0}
                />
                <CompareBox
                  title="Cash"
                  aLabel="Cash counted at till closing"
                  a={mi.cashCounted || 0}
                  bLabel="Cash deposited in the bank"
                  b={mi.cashDeposited || 0}
                />
              </div>
              {mi.otherIn && mi.otherIn.length > 0 && (
                <div className="mt-2 rounded-lg border border-gray-100">
                  <p className="border-b border-gray-100 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600">Other money in</p>
                  <ul className="divide-y divide-gray-100">
                    {mi.otherIn.map((o, i) => (
                      <li key={i} className="flex items-start justify-between gap-3 px-3 py-1.5 text-xs">
                        <span className="min-w-0 text-gray-700">
                          {o.date ? `${formatDate(o.date)} · ` : ''}
                          {o.label || o.payee || o.particulars || 'Money in'}
                        </span>
                        <span className="whitespace-nowrap tabular-nums text-sky-700">{formatRs(o.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Earlier statements */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">Earlier statements</h3>
          <button type="button" onClick={loadList} className="text-xs text-gray-500 hover:text-gray-800" aria-label="Refresh">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        {listError ? (
          <div className="p-4">
            <ErrorBox message={listError} />
          </div>
        ) : !list ? (
          <div className="flex items-center gap-2 p-4 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : list.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No statement uploaded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[820px] w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">No.</th>
                  <th className="px-3 py-2 text-left">Bank</th>
                  <th className="px-3 py-2 text-left">Statement dates</th>
                  <th className="px-3 py-2 text-left">Checked dates</th>
                  <th className="px-3 py-2 text-left">Result</th>
                  <th className="px-3 py-2 text-left">Uploaded</th>
                  <th className="px-3 py-2 text-right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {list.map((s) => (
                  <tr key={s._id} className={detail?.statement._id === s._id ? 'bg-honey-50/50' : ''}>
                    <td className="whitespace-nowrap px-3 py-2 font-medium text-gray-900">{s.statementNo}</td>
                    <td className="px-3 py-2 text-gray-700">{bankName(s.bank)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-600">
                      {formatDate(s.periodFrom)} – {formatDate(s.periodTo)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-600">
                      {formatDate(s.checkFrom)} – {formatDate(s.checkTo)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1 text-[11px] font-semibold">
                        <span className={`rounded-full px-2 py-0.5 ${STATUS.ok.chip}`}>{s.counts?.ok ?? 0} OK</span>
                        <span className={`rounded-full px-2 py-0.5 ${STATUS.fix.chip}`}>{s.counts?.fix ?? 0} fix</span>
                        <span className={`rounded-full px-2 py-0.5 ${STATUS.missing.chip}`}>{s.counts?.missing ?? 0} missing</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-600">
                      {s.createdByName || '—'}
                      <span className="block text-gray-400">{formatDate(s.createdAt, true)}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          type="button"
                          onClick={() => open(s._id)}
                          disabled={opening === s._id}
                          className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          {opening === s._id ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileCheck2 className="h-3 w-3" />}
                          Open
                        </button>
                        {s.markedUrl && (
                          <a
                            href={s.markedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                            aria-label="Download marked PDF"
                            title="Download marked PDF"
                          >
                            <Download className="h-3 w-3" /> PDF
                          </a>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => setToDelete(s)}
                            className="inline-flex items-center rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                            aria-label="Delete"
                            title="Delete"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Choose bank + dates, then run */}
      {preview && file && (
        <Modal
          title="Check bank statement"
          subtitle={file.name}
          icon={<FileUp className="h-5 w-5" />}
          onClose={closeRun}
          busy={running}
          footer={
            <>
              <button type="button" className={secondaryBtn} onClick={closeRun} disabled={running}>
                Cancel
              </button>
              <button type="button" className={primaryBtn} onClick={run} disabled={running}>
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />}
                {running ? 'Checking…' : 'Check'}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-xs text-gray-600">
              Account {preview.accountNumber || '—'} · statement {formatDate(preview.periodFrom)} – {formatDate(preview.periodTo)} ·{' '}
              {preview.lineCount} lines
            </p>
            <Field label="Bank" required>
              <SearchSelect value={bankId} onChange={(e) => setBankId(e.target.value)} className={inputClass} aria-label="Bank">
                <option value="">Choose bank</option>
                {preview.banks.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name}
                    {b.accountNumber ? ` · ${b.accountNumber}` : ''}
                  </option>
                ))}
              </SearchSelect>
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Check from" required>
                <input type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />
              </Field>
              <Field label="Check to" required>
                <input type="date" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />
              </Field>
            </div>
            {preview.lastChecked ? (
              <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
                Already checked up to {formatDate(preview.lastChecked.to)} ({preview.lastChecked.statementNo}) — those lines are
                reused{preview.alreadyDone ? ` (${preview.alreadyDone} lines)` : ''}.
              </p>
            ) : (
              <p className="text-xs text-gray-500">This bank has not been checked before.</p>
            )}
            {running && (
              <p className="flex items-center gap-2 text-xs text-gray-600">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Matching every line with the system. This can take a minute…
              </p>
            )}
            <ErrorBox message={runError} />
          </div>
        </Modal>
      )}

      {/* Note / decide by hand */}
      {noteFor && (
        <Modal
          title="Add note"
          subtitle={`${formatDate(noteFor.date)} · ${noteFor.payee || noteFor.particulars} · ${formatRs(noteFor.amount)}`}
          icon={<StickyNote className="h-5 w-5" />}
          onClose={() => setNoteFor(null)}
          busy={savingLine === noteFor._id}
          footer={
            <>
              <button type="button" className={secondaryBtn} onClick={() => setNoteFor(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={primaryBtn}
                disabled={savingLine === noteFor._id}
                onClick={() => saveLine(noteFor, noteStatus, noteText.trim())}
              >
                {savingLine === noteFor._id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <Field label="Status">
              <SearchSelect
                value={noteStatus}
                onChange={(e) => setNoteStatus(e.target.value as 'ok' | 'fix' | 'missing')}
                className={inputClass}
                aria-label="Status"
              >
                <option value="ok">OK</option>
                <option value="fix">Needs fixing</option>
                <option value="missing">Not in system</option>
              </SearchSelect>
            </Field>
            <Field label="Note" hint="Kept when the statement is checked again.">
              <textarea
                className={inputClass}
                rows={3}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="e.g. Paid rent to landlord, entered late"
              />
            </Field>
          </div>
        </Modal>
      )}

      {/* Delete confirm */}
      {toDelete && (
        <Modal
          title="Delete statement?"
          subtitle={toDelete.statementNo}
          icon={<Trash2 className="h-5 w-5" />}
          onClose={() => setToDelete(null)}
          busy={deleting}
          footer={
            <>
              <button type="button" className={secondaryBtn} onClick={() => setToDelete(null)} disabled={deleting}>
                Cancel
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={deleting}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete
              </button>
            </>
          }
        >
          <p className="text-sm text-gray-700">
            Delete {toDelete.statementNo} ({bankName(toDelete.bank)}, {formatDate(toDelete.checkFrom)} – {formatDate(toDelete.checkTo)})?
            Lines used by another statement are kept. Those dates can then be checked again.
          </p>
        </Modal>
      )}
    </div>
  );
}

function CompareBox({ title, aLabel, a, bLabel, b }: { title: string; aLabel: string; a: number; bLabel: string; b: number }) {
  const diff = b - a;
  return (
    <div className="rounded-lg border border-gray-100 p-3 text-xs">
      <p className="mb-1 text-sm font-semibold text-gray-900">{title}</p>
      <div className="flex justify-between gap-2 text-gray-600">
        <span>{aLabel}</span>
        <span className="tabular-nums text-gray-900">{formatRs(a)}</span>
      </div>
      <div className="flex justify-between gap-2 text-gray-600">
        <span>{bLabel}</span>
        <span className="tabular-nums text-gray-900">{formatRs(b)}</span>
      </div>
      <div className={`mt-1 flex justify-between gap-2 border-t border-gray-100 pt-1 font-semibold ${diff === 0 ? 'text-green-700' : 'text-orange-700'}`}>
        <span>{diff === 0 ? 'Same' : diff > 0 ? 'Bank has more' : 'Bank has less'}</span>
        <span className="tabular-nums">{formatRs(Math.abs(diff))}</span>
      </div>
    </div>
  );
}
