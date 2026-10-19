'use client';

// Bill discount rules (owner requirement 9): an overall discount on every bill,
// or a discount above a cut-off ("spend Rs 5,000, get 10% off"). The POS
// applies them on the server: the best non-stackable rule + every stackable one.
// "Test a bill amount" shows exactly what the POS will give.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Percent, Plus, Search, Pencil, Trash2, Loader2, Calculator, Sparkles, Power, Layers } from 'lucide-react';
import { storeApi, apiErrorMessage, formatRs, formatDate, type PageMeta } from '@/lib/storeApi';
import { Modal, Field, Toggle, ErrorBox, HelpBox, LoadingCard, NoAccessCard, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { useAccess } from '@/context/AccessContext';
import TablePagination from '@/components/admin/TablePagination';
import { SearchSelect } from '@/components/ui/SearchSelect';

type RuleStatus = 'running' | 'scheduled' | 'ended' | 'off';

interface DiscountRule {
  _id: string;
  name: string;
  kind: 'overall' | 'threshold';
  valueType: 'percentage' | 'fixed';
  value: number;
  minSubtotal: number;
  maxDiscount: number | null;
  startsAt: string | null;
  endsAt: string | null;
  priority: number;
  stackable: boolean;
  isActive: boolean;
  notes: string;
  label: string;
  status: RuleStatus;
}

interface Preview {
  subtotal: number;
  applied: { name: string; label: string; amount: number; kind: string }[];
  discount: number;
  total: number;
  nextDiscount: { message: string; label: string } | null;
  runningRules: number;
}

const STATUS_STYLE: Record<RuleStatus, string> = {
  running: 'bg-green-50 text-green-700 border-green-200',
  scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
  ended: 'bg-gray-100 text-gray-500 border-gray-200',
  off: 'bg-gray-50 text-gray-500 border-gray-200',
};

const STATUS_TABS: { key: '' | RuleStatus; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'running', label: 'Running' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'ended', label: 'Ended' },
  { key: 'off', label: 'Off' },
];

// <input type="date"> value <-> ISO (start of day / end of day in local time).
const toDateInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const fromDateInput = (v: string, endOfDay = false) => (v ? new Date(`${v}T${endOfDay ? '23:59:59' : '00:00:00'}`).toISOString() : null);

export default function DiscountRulesPage() {
  const { can, loaded } = useAccess();
  const canView = can('discounts', 'view');
  const canCreate = can('discounts', 'create');
  const canEdit = can('discounts', 'edit');
  const canDelete = can('discounts', 'delete');

  const [rules, setRules] = useState<DiscountRule[]>([]);
  const [meta, setMeta] = useState<PageMeta>({ page: 1, limit: 25, total: 0, pages: 1 });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [status, setStatus] = useState<'' | RuleStatus>('');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<DiscountRule | 'new' | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [status, debounced, limit]);

  useEffect(() => {
    if (!canView) return;
    let cancelled = false;
    setLoading(true);
    storeApi
      .get<DiscountRule[]>('/discount-rules', { page, limit, status, search: debounced })
      .then((res) => {
        if (cancelled) return;
        setRules(res.data || []);
        if (res.meta) setMeta(res.meta);
        setError(null);
      })
      .catch((e) => !cancelled && setError(apiErrorMessage(e, 'Could not load discount rules')))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [canView, page, limit, status, debounced, reload]);

  const refresh = () => setReload((n) => n + 1);

  const toggleActive = async (rule: DiscountRule) => {
    if (busyId) return;
    setBusyId(rule._id);
    try {
      const res = await storeApi.patch<DiscountRule>(`/discount-rules/${rule._id}/active`, { isActive: !rule.isActive });
      setRules((prev) => prev.map((r) => (r._id === rule._id ? res.data : r)));
      toast.success(res.message || 'Saved');
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (rule: DiscountRule) => {
    if (busyId || !confirm(`Delete the rule "${rule.name}"? Old bills keep their discount.`)) return;
    setBusyId(rule._id);
    try {
      await storeApi.del(`/discount-rules/${rule._id}`);
      toast.success('Rule deleted');
      refresh();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  if (loaded && !canView) return <NoAccessCard />;

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <Percent className="h-6 w-6 text-honey-700" />
            Discount Rules
          </h1>
          <p className="text-xs sm:text-sm text-gray-500">Whole-bill discounts the POS applies automatically. Gifts never count toward a cut-off.</p>
        </div>
        {canCreate && (
          <button className={primaryBtn} onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" /> New rule
          </button>
        )}
      </div>

      <BillCalculator reloadKey={reload} />

      <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200">
        <div className="p-3 sm:p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <div className="flex gap-1 overflow-x-auto">
            {STATUS_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setStatus(t.key)}
                className={`px-3 py-1.5 text-xs sm:text-sm rounded-lg whitespace-nowrap font-medium ${status === t.key ? 'bg-honey-500 text-gray-900' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="relative sm:ml-auto sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input className={`${inputClass} pl-9`} placeholder="Search rules…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {error && (
          <div className="p-3">
            <ErrorBox message={error} />
          </div>
        )}

        {loading && rules.length === 0 ? (
          <div className="p-4">
            <LoadingCard text="Loading discount rules…" />
          </div>
        ) : rules.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Percent className="h-10 w-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No rules here yet.</p>
            {canCreate && (
              <button className={`${secondaryBtn} mt-3`} onClick={() => setEditing('new')}>
                <Plus className="h-4 w-4" /> Create the first rule
              </button>
            )}
          </div>
        ) : (
          <ul className={`divide-y divide-gray-100 ${loading ? 'opacity-60' : ''}`}>
            {rules.map((rule) => (
              <li key={rule._id} className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-sm text-gray-900">{rule.name}</span>
                    <span className={`px-2 py-0.5 rounded border text-[11px] font-medium capitalize ${STATUS_STYLE[rule.status]}`}>{rule.status}</span>
                    {rule.stackable && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-medium bg-purple-50 text-purple-700 border-purple-200">
                        <Layers className="h-3 w-3" /> Stacks
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-honey-700 font-medium mt-0.5">{rule.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                    <span>
                      {rule.startsAt || rule.endsAt ? `${rule.startsAt ? formatDate(rule.startsAt) : 'Now'} → ${rule.endsAt ? formatDate(rule.endsAt) : 'no end'}` : 'Always'}
                    </span>
                    {rule.priority ? <span>Priority {rule.priority}</span> : null}
                  </p>
                  {rule.notes && <p className="text-xs text-gray-400 mt-0.5 truncate">{rule.notes}</p>}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {canEdit && (
                    <button
                      onClick={() => toggleActive(rule)}
                      disabled={!!busyId}
                      className={`${secondaryBtn} !px-2.5 !py-1.5 text-xs`}
                      title={rule.isActive ? 'Switch off' : 'Switch on'}
                    >
                      {busyId === rule._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Power className={`h-3.5 w-3.5 ${rule.isActive ? 'text-green-600' : 'text-gray-400'}`} />}
                      {rule.isActive ? 'On' : 'Off'}
                    </button>
                  )}
                  {canEdit && (
                    <button onClick={() => setEditing(rule)} disabled={!!busyId} className={`${secondaryBtn} !px-2.5 !py-1.5 text-xs`}>
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                  )}
                  {canDelete && (
                    <button onClick={() => remove(rule)} disabled={!!busyId} className="p-2 text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-50" aria-label="Delete rule">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <TablePagination page={page} pages={meta.pages} total={meta.total} limit={limit} onPageChange={setPage} onLimitChange={setLimit} label="rules" loading={loading} />
      </div>

      {editing && (
        <RuleForm
          rule={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- calculator

function BillCalculator({ reloadKey }: { reloadKey: number }) {
  const [amount, setAmount] = useState('5000');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const value = Number(amount);
    if (!amount || !Number.isFinite(value) || value < 0) {
      setPreview(null);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      storeApi
        .get<Preview>('/discount-rules/preview', { subtotal: value })
        .then((res) => !cancelled && (setPreview(res.data), setError(null)))
        .catch((e) => !cancelled && setError(apiErrorMessage(e)))
        .finally(() => !cancelled && setLoading(false));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [amount, reloadKey]);

  return (
    <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-3">
        <Calculator className="h-5 w-5 text-honey-700" />
        <h2 className="text-sm font-semibold text-gray-900">Test a bill amount</h2>
        <span className="text-xs text-gray-400">(rules running now)</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 md:gap-6 items-start">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Bill subtotal (Rs)</label>
          <input type="number" min={0} inputMode="decimal" className={`${inputClass} text-lg font-semibold`} value={amount} onChange={(e) => setAmount(e.target.value)} />
          <div className="flex flex-wrap gap-1 mt-2">
            {[1000, 2500, 5000, 10000].map((v) => (
              <button key={v} type="button" onClick={() => setAmount(String(v))} className="px-2 py-0.5 text-[11px] rounded border border-gray-200 text-gray-600 hover:bg-gray-50">
                {formatRs(v)}
              </button>
            ))}
          </div>
        </div>
        <div className="min-h-[88px]">
          {error && <ErrorBox message={error} />}
          {loading && !preview && <p className="text-sm text-gray-400 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Calculating…</p>}
          {preview && (
            <div className={`space-y-1.5 text-sm ${loading ? 'opacity-60' : ''}`}>
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>{formatRs(preview.subtotal)}</span>
              </div>
              {preview.applied.length === 0 && <p className="text-xs text-gray-400">No rule applies to this amount.</p>}
              {preview.applied.map((d, i) => (
                <div key={i} className="flex justify-between gap-3 text-green-700">
                  <span className="truncate">{d.label} <span className="text-xs text-gray-400">({d.name})</span></span>
                  <span className="whitespace-nowrap">− {formatRs(d.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold text-gray-900 border-t pt-1.5">
                <span>Customer pays</span>
                <span>{formatRs(preview.total)}</span>
              </div>
              {preview.nextDiscount && (
                <p className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                  <Sparkles className="h-3.5 w-3.5" /> {preview.nextDiscount.message}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- form

interface FormState {
  name: string;
  kind: 'overall' | 'threshold';
  valueType: 'percentage' | 'fixed';
  value: string;
  minSubtotal: string;
  maxDiscount: string;
  startsAt: string;
  endsAt: string;
  priority: string;
  stackable: boolean;
  isActive: boolean;
  notes: string;
}

function RuleForm({ rule, onClose, onSaved }: { rule: DiscountRule | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<FormState>(() => ({
    name: rule?.name || '',
    kind: rule?.kind || 'threshold',
    valueType: rule?.valueType || 'percentage',
    value: rule ? String(rule.value) : '10',
    minSubtotal: rule && rule.minSubtotal ? String(rule.minSubtotal) : rule ? '' : '5000',
    maxDiscount: rule?.maxDiscount ? String(rule.maxDiscount) : '',
    startsAt: toDateInput(rule?.startsAt || null),
    endsAt: toDateInput(rule?.endsAt || null),
    priority: rule ? String(rule.priority || 0) : '0',
    stackable: !!rule?.stackable,
    isActive: rule ? rule.isActive : true,
    notes: rule?.notes || '',
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  // Live wording of the rule, same as the server label.
  const preview = useMemo(() => {
    const v = Number(form.value) || 0;
    const off = form.valueType === 'percentage' ? `${v}% off` : `${formatRs(v)} off`;
    const cap = form.valueType === 'percentage' && Number(form.maxDiscount) > 0 ? ` (max ${formatRs(Number(form.maxDiscount))})` : '';
    return form.kind === 'threshold' ? `Spend ${formatRs(Number(form.minSubtotal) || 0)} get ${off}${cap}` : `${off} on every bill${cap}`;
  }, [form.value, form.valueType, form.maxDiscount, form.kind, form.minSubtotal]);

  const autoName = useCallback(() => {
    if (!form.name.trim()) set('name', preview);
  }, [form.name, preview]);

  const save = async () => {
    if (lock.current) return;
    setError(null);
    const name = form.name.trim() || preview;
    const body = {
      name,
      kind: form.kind,
      valueType: form.valueType,
      value: Number(form.value),
      minSubtotal: form.kind === 'threshold' ? Number(form.minSubtotal) : 0,
      maxDiscount: form.valueType === 'percentage' && form.maxDiscount ? Number(form.maxDiscount) : null,
      startsAt: fromDateInput(form.startsAt),
      endsAt: fromDateInput(form.endsAt, true),
      priority: Number(form.priority) || 0,
      stackable: form.stackable,
      isActive: form.isActive,
      notes: form.notes.trim(),
    };
    lock.current = true;
    setSaving(true);
    try {
      if (rule) await storeApi.put(`/discount-rules/${rule._id}`, body);
      else await storeApi.post('/discount-rules', body);
      toast.success(rule ? 'Rule saved' : 'Rule created');
      onSaved();
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not save the rule'));
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  return (
    <Modal
      title={rule ? 'Edit discount rule' : 'New discount rule'}
      subtitle={preview}
      icon={<Percent className="h-5 w-5" />}
      onClose={onClose}
      busy={saving}
      wide
      footer={
        <>
          <button className={secondaryBtn} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className={primaryBtn} onClick={save} disabled={saving} aria-busy={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Saving…' : 'Save rule'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {(['threshold', 'overall'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => set('kind', k)}
              className={`p-3 rounded-lg border-2 text-left ${form.kind === k ? 'border-honey-500 bg-honey-50' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <div className="text-sm font-semibold text-gray-900">{k === 'threshold' ? 'Spend over a cut-off' : 'Every bill'}</div>
              <div className="text-xs text-gray-500">{k === 'threshold' ? 'e.g. shop for Rs 5,000, get 10% off' : 'a direct discount however much they shop'}</div>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Discount type" required>
            <SearchSelect className={inputClass} value={form.valueType} onChange={(e) => set('valueType', e.target.value as FormState['valueType'])}>
              <option value="percentage">Percent (%)</option>
              <option value="fixed">Fixed amount (Rs)</option>
            </SearchSelect>
          </Field>
          <Field label={form.valueType === 'percentage' ? 'Percent off' : 'Rupees off'} required>
            <input type="number" min={0} className={inputClass} value={form.value} onChange={(e) => set('value', e.target.value)} />
          </Field>
          {form.kind === 'threshold' && (
            <Field label="Cut-off: bill of at least (Rs)" required>
              <input type="number" min={0} className={inputClass} value={form.minSubtotal} onChange={(e) => set('minSubtotal', e.target.value)} />
            </Field>
          )}
          {form.valueType === 'percentage' && (
            <Field label="Maximum discount (Rs)" hint="Empty = no cap">
              <input type="number" min={0} className={inputClass} value={form.maxDiscount} onChange={(e) => set('maxDiscount', e.target.value)} />
            </Field>
          )}
        </div>

        <Field label="Name" hint="Shown on the bill and the receipt">
          <input className={inputClass} value={form.name} placeholder={preview} onChange={(e) => set('name', e.target.value)} onBlur={autoName} maxLength={120} />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Starts" hint="Empty = now">
            <input type="date" className={inputClass} value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)} />
          </Field>
          <Field label="Ends (last day)" hint="Empty = no end">
            <input type="date" className={inputClass} value={form.endsAt} onChange={(e) => set('endsAt', e.target.value)} />
          </Field>
          <Field label="Priority" hint="Higher shows first">
            <input type="number" className={inputClass} value={form.priority} onChange={(e) => set('priority', e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Toggle checked={form.stackable} onChange={(v) => set('stackable', v)} label="Stacks with other rules" hint="Off = only the best non-stacking rule is used" />
          <Toggle checked={form.isActive} onChange={(v) => set('isActive', v)} label="Rule is on" />
        </div>

        <Field label="Notes">
          <textarea className={inputClass} rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} maxLength={1000} />
        </Field>

        <HelpBox>
          The POS works it out on the server: gifts are left out of the subtotal, the best non-stacking rule is used, every stacking rule is added, and the
          cashier&apos;s own discount comes on top (within its limit).
        </HelpBox>
        <ErrorBox message={error} />
      </div>
    </Modal>
  );
}
