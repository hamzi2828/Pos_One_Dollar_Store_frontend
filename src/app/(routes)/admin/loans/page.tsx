'use client';

// Loans the company has taken and has to give back (owner 2026-11-06).
// Lender: a vendor, customer or employee (one dropdown), or any other person.
// Paid back in parts; "Left" is what we still owe.
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { HandCoins, Loader2, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage, formatDate, formatRs, storeApi } from '@/lib/storeApi';
import { ErrorBox, Field, Modal, NoAccessCard, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { SearchSelect } from '@/components/ui/SearchSelect';
import MoneyInput from '@/components/ui/MoneyInput';

type LenderType = 'vendor' | 'customer' | 'employee' | 'other';
interface Repayment {
  _id: string;
  amount: number;
  date: string;
  method: string;
  note?: string;
  byName?: string;
}
interface Loan {
  _id: string;
  loanNo: string;
  lenderType: LenderType;
  lender: string | null;
  lenderName: string;
  lenderPhone?: string;
  amount: number;
  date: string;
  method: string;
  dueDate?: string | null;
  notes?: string;
  repayments: Repayment[];
  paid: number;
  left: number;
  status: 'open' | 'paid';
  createdByName?: string;
}
interface Summary {
  loans: number;
  taken: number;
  paidBack: number;
  left: number;
  open: number;
}

const METHODS = ['Cash', 'Bank Transfer', 'Easypaisa', 'JazzCash', 'Cheque', 'Other'];
const TYPE_LABEL: Record<LenderType, string> = { vendor: 'Vendor', customer: 'Customer', employee: 'Employee', other: 'Other' };
const TYPE_STYLE: Record<LenderType, string> = {
  vendor: 'bg-sky-50 text-sky-700',
  customer: 'bg-violet-50 text-violet-700',
  employee: 'bg-emerald-50 text-emerald-700',
  other: 'bg-gray-100 text-gray-700',
};
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date());

export default function LoansPage() {
  const { can } = useAccess();
  const canView = can('loans', 'view');
  const [rows, setRows] = useState<Loan[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [status, setStatus] = useState<'all' | 'open' | 'paid'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await storeApi.get<Loan[]>('/loans', { status: status === 'all' ? undefined : status, search: search.trim() || undefined });
      setRows(r.data || []);
      setSummary((r.meta?.summary as Summary | undefined) || null);
      setError(null);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load the loans.'));
    } finally {
      setLoading(false);
    }
  }, [status, search]);

  useEffect(() => {
    if (!canView) return;
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load, canView]);

  if (!canView) return <NoAccessCard text="You do not have access to Loans." />;
  const open = rows.find((r) => r._id === openId) || null;

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-3 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-honey-100 text-honey-800">
            <HandCoins className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Loans</h1>
            <p className="text-sm text-gray-500">Money the company has borrowed and has to give back.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={load} className={secondaryBtn} aria-label="Refresh">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </button>
          {can('loans', 'create') && (
            <button type="button" onClick={() => setAdding(true)} className={primaryBtn}>
              <Plus className="h-4 w-4" /> Add loan
            </button>
          )}
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card label="Loans taken" value={formatRs(summary.taken)} hint={`${summary.loans} loan${summary.loans === 1 ? '' : 's'}`} />
          <Card label="Paid back" value={formatRs(summary.paidBack)} tone="text-green-700" />
          <Card label="Still to give back" value={formatRs(summary.left)} tone={summary.left > 0 ? 'text-red-600' : 'text-gray-900'} strong />
          <Card label="Open loans" value={String(summary.open)} />
        </div>
      )}

      <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search lender, loan no or note…" className={`${inputClass} pl-9`} />
        </div>
        <div className="sm:w-48">
          <SearchSelect value={status} onChange={(e) => setStatus(e.target.value as 'all' | 'open' | 'paid')} className={inputClass}>
            <option value="all">All loans</option>
            <option value="open">Still to give back</option>
            <option value="paid">Paid back</option>
          </SearchSelect>
        </div>
      </div>

      <ErrorBox message={error} />

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-[11px] uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2 text-left font-semibold">Loan</th>
              <th className="px-4 py-2 text-left font-semibold">Lender</th>
              <th className="px-4 py-2 text-left font-semibold">Date</th>
              <th className="px-4 py-2 text-right font-semibold">Loan</th>
              <th className="px-4 py-2 text-right font-semibold">Paid back</th>
              <th className="px-4 py-2 text-right font-semibold">Left</th>
              <th className="px-4 py-2 text-left font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                  No loans yet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r._id} onClick={() => setOpenId(r._id)} className="cursor-pointer hover:bg-gray-50">
                <td className="px-4 py-2 whitespace-nowrap font-medium text-gray-900">{r.loanNo}</td>
                <td className="px-4 py-2">
                  <span className="font-medium text-gray-900">{r.lenderName}</span>
                  <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold ${TYPE_STYLE[r.lenderType]}`}>{TYPE_LABEL[r.lenderType]}</span>
                  {r.notes && <span className="block truncate text-xs text-gray-500 max-w-xs">{r.notes}</span>}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-600">
                  {formatDate(r.date)}
                  {r.dueDate && <span className="block text-amber-700">due {formatDate(r.dueDate)}</span>}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{formatRs(r.amount)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-green-700">{r.paid ? formatRs(r.paid) : '—'}</td>
                <td className={`px-4 py-2 text-right tabular-nums font-semibold ${r.left > 0 ? 'text-red-600' : 'text-gray-400'}`}>{formatRs(r.left)}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.status === 'paid' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                    {r.status === 'paid' ? 'Paid back' : 'Open'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adding && (
        <AddLoanModal
          onClose={() => setAdding(false)}
          onSaved={(l) => {
            setAdding(false);
            load();
            setOpenId(l._id);
          }}
        />
      )}
      {open && <LoanModal loan={open} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
}

function Card({ label, value, hint, tone = 'text-gray-900', strong }: { label: string; value: string; hint?: string; tone?: string; strong?: boolean }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${strong ? 'border-honey-300 bg-honey-50' : 'border-gray-200 bg-white'}`}>
      <p className="text-[11px] uppercase text-gray-500">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${tone}`}>{value}</p>
      {hint && <p className="text-[11px] text-gray-500">{hint}</p>}
    </div>
  );
}

function AddLoanModal({ onClose, onSaved }: { onClose: () => void; onSaved: (l: Loan) => void }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [method, setMethod] = useState('Cash');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (busy) return;
    setError(null);
    if (!name.trim()) return setError('Write who gave the loan');
    if (!(Number(amount) > 0)) return setError('Enter the loan amount');
    setBusy(true);
    try {
      const r = await storeApi.post<Loan>('/loans', {
        lenderType: 'other',
        lenderName: name.trim(),
        amount: Number(amount),
        date,
        method,
        dueDate: dueDate || undefined,
        notes: notes.trim() || undefined,
      });
      toast.success('Loan added');
      onSaved(r.data);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not save the loan.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Add loan"
      subtitle="Money the company borrowed"
      icon={<HandCoins className="h-5 w-5" />}
      onClose={onClose}
      busy={busy}
      wide
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={secondaryBtn}>
            Cancel
          </button>
          <button type="button" onClick={save} disabled={busy} className={primaryBtn}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save loan
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Loan from" required>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus className={inputClass} placeholder="Name of the person" />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Amount" required>
            <MoneyInput value={amount} onValue={setAmount} className={`${inputClass} text-right font-semibold`} placeholder="0" />
          </Field>
          <Field label="Date received" required>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Received by">
            <SearchSelect value={method} onChange={(e) => setMethod(e.target.value)} className={inputClass}>
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </SearchSelect>
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Give back by (optional)">
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Note">
              <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} className={inputClass} placeholder="e.g. For the Lahore stock trip" />
            </Field>
          </div>
        </div>
        <ErrorBox message={error} />
      </div>
    </Modal>
  );
}

function LoanModal({ loan, onClose, onChanged }: { loan: Loan; onClose: () => void; onChanged: () => void }) {
  const { can } = useAccess();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [method, setMethod] = useState('Cash');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pay = async () => {
    if (busy) return;
    if (!(Number(amount) > 0)) return setError('Enter the amount paid back');
    setBusy('pay');
    setError(null);
    try {
      await storeApi.post(`/loans/${loan._id}/repayments`, { amount: Number(amount), date, method, note: note.trim() || undefined });
      toast.success('Payment saved');
      setAmount('');
      setNote('');
      onChanged();
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not save the payment.'));
    } finally {
      setBusy(null);
    }
  };

  const undo = async (r: Repayment) => {
    if (busy || !window.confirm(`Remove the payment of ${formatRs(r.amount)}?`)) return;
    setBusy(r._id);
    try {
      await storeApi.del(`/loans/${loan._id}/repayments/${r._id}`);
      toast.success('Payment removed');
      onChanged();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not remove it.'));
    } finally {
      setBusy(null);
    }
  };

  const del = async () => {
    if (busy || !window.confirm(`Delete loan ${loan.loanNo} from ${loan.lenderName}?`)) return;
    setBusy('del');
    try {
      await storeApi.del(`/loans/${loan._id}`);
      toast.success('Loan deleted');
      onChanged();
      onClose();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not delete it.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal
      title={`${loan.loanNo} · ${loan.lenderName}`}
      subtitle={`${TYPE_LABEL[loan.lenderType]}${loan.lenderPhone ? ` · ${loan.lenderPhone}` : ''} · received ${formatDate(loan.date)} by ${loan.method}`}
      icon={<HandCoins className="h-5 w-5" />}
      onClose={onClose}
      busy={!!busy}
      wide
      footer={
        can('loans', 'delete') ? (
          <button type="button" onClick={del} disabled={!!busy} className={secondaryBtn}>
            <Trash2 className="h-4 w-4 text-red-600" /> Delete loan
          </button>
        ) : undefined
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Card label="Loan" value={formatRs(loan.amount)} />
          <Card label="Paid back" value={formatRs(loan.paid)} tone="text-green-700" />
          <Card label="Left" value={formatRs(loan.left)} tone={loan.left > 0 ? 'text-red-600' : 'text-gray-900'} strong />
        </div>
        {(loan.notes || loan.dueDate) && (
          <p className="text-sm text-gray-600">
            {loan.notes}
            {loan.dueDate ? `${loan.notes ? ' · ' : ''}Give back by ${formatDate(loan.dueDate)}` : ''}
          </p>
        )}

        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Paid back ({loan.repayments.length})</p>
          {loan.repayments.length === 0 ? (
            <p className="text-sm text-gray-500">Nothing paid back yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 text-sm">
              {loan.repayments.map((r) => (
                <li key={r._id} className="flex items-start justify-between gap-3 px-3 py-2">
                  <span>
                    <span className="font-semibold tabular-nums text-green-700">{formatRs(r.amount)}</span>
                    <span className="ml-2 text-gray-600">
                      {formatDate(r.date)} · {r.method}
                    </span>
                    {(r.note || r.byName) && (
                      <span className="block text-[11px] text-gray-500">
                        {r.note}
                        {r.byName ? `${r.note ? ' · ' : ''}by ${r.byName}` : ''}
                      </span>
                    )}
                  </span>
                  {can('loans', 'delete') && (
                    <button type="button" onClick={() => undo(r)} disabled={!!busy} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600" title="Remove this payment">
                      {busy === r._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {loan.left > 0 && can('loans', 'edit') && (
          <div className="rounded-lg border border-honey-300 bg-honey-50/60 p-3">
            <p className="mb-2 text-sm font-semibold text-gray-900">Pay back</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
              <MoneyInput value={amount} onValue={setAmount} className={`${inputClass} text-right font-semibold`} placeholder={`max ${loan.left}`} />
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
              <SearchSelect value={method} onChange={(e) => setMethod(e.target.value)} className={inputClass}>
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </SearchSelect>
              <button type="button" onClick={pay} disabled={!!busy} className={primaryBtn}>
                {busy === 'pay' && <Loader2 className="h-4 w-4 animate-spin" />} Save payment
              </button>
            </div>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className={`${inputClass} mt-2`} placeholder="Note (optional)" />
            <button type="button" onClick={() => setAmount(String(loan.left))} className="mt-1 text-xs font-medium text-honey-800 hover:underline">
              Pay all that is left ({formatRs(loan.left)})
            </button>
          </div>
        )}
        <ErrorBox message={error} />
      </div>
    </Modal>
  );
}
