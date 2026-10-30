'use client';

// Sale counters (cash registers) with open / close cut-off times and the usual
// opening float. Once the shop has an active counter, every cashier must open
// a till before selling.

import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Monitor, Plus, Edit2, Trash2, Loader2, Clock, Users, AlertCircle, BellRing, LockOpen } from 'lucide-react';
import { storeApi, apiErrorMessage, formatRs } from '@/lib/storeApi';
import { useAccess } from '@/context/AccessContext';
import { Modal, Field, Toggle, ErrorBox, HelpBox, LoadingCard, NoAccessCard, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { formatTime } from '@/components/store/TillStatusBar';
import MoneyInput from '@/components/ui/MoneyInput';

interface Counter {
  _id: string;
  name: string;
  code: string;
  isActive: boolean;
  openCutoff: string;
  closeCutoff: string;
  defaultFloat: number;
  assignedUsers: { _id: string; firstName?: string; lastName?: string; email?: string }[];
  notes: string;
  openSession: { _id: string; sessionNo: string; cashierName: string; openedAt: string } | null;
}

interface StaffOption {
  _id: string;
  name: string;
  email: string;
}

interface FormState {
  name: string;
  code: string;
  isActive: boolean;
  openCutoff: string;
  closeCutoff: string;
  defaultFloat: string;
  assignedUsers: string[];
  notes: string;
}

const userName = (u: Counter['assignedUsers'][number]) => `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || 'Staff';

export default function CountersPage() {
  const { can, loaded } = useAccess();
  const canView = can('sale_counters', 'view');
  const [rows, setRows] = useState<Counter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Counter | 'new' | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const lockRef = useRef(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await storeApi.get<Counter[]>('/counters', { limit: 200 });
      setRows(res.data || []);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load counters.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canView) load();
  }, [canView, load]);

  const remove = async (c: Counter) => {
    if (lockRef.current) return;
    if (!window.confirm(`Delete ${c.name}?\n\nPast tills on this counter stay in the reports.`)) return;
    lockRef.current = true;
    setBusyId(c._id);
    try {
      await storeApi.del(`/counters/${c._id}`);
      toast.success('Counter deleted');
      await load();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not delete the counter.'));
    } finally {
      lockRef.current = false;
      setBusyId(null);
    }
  };

  const checkNow = async () => {
    if (checking) return;
    setChecking(true);
    try {
      const res = await storeApi.get<{ cutoffs: { notified: number; time: string } }>('/counters/check-cutoffs');
      const n = res.data?.cutoffs?.notified || 0;
      toast.success(n ? `${n} new cut-off alert${n > 1 ? 's' : ''} sent` : `All counters on time (${res.data?.cutoffs?.time || 'now'})`);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not check cut-offs.'));
    } finally {
      setChecking(false);
    }
  };

  if (!loaded) return <div className="max-w-7xl mx-auto px-4 py-6"><LoadingCard text="Loading…" /></div>;
  if (!canView) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <NoAccessCard />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Sale Counters</h1>
            <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-500">Cash registers, their cut-off times and usual opening float.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={checkNow} disabled={checking} className={secondaryBtn} title="Send alerts for counters that missed a cut-off">
              {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
              <span className="hidden sm:inline">Check cut-offs</span>
            </button>
            {can('sale_counters', 'create') && (
              <button type="button" onClick={() => setEditing('new')} className={primaryBtn}>
                <Plus className="h-4 w-4" /> Add counter
              </button>
            )}
          </div>
        </div>

        <div className="mb-4 sm:mb-6">
          <HelpBox>
            <strong>When the shop has an active counter, every cashier must open a till (with an opening float) before selling.</strong>{' '}
            If a counter is not opened by its open cut-off, or is still open after its close cut-off, admins with “Verify Cash Closing” get a
            notification. Times are Pakistan time.
          </HelpBox>
        </div>

        {loading && rows.length === 0 ? (
          <LoadingCard text="Loading counters…" />
        ) : error ? (
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-red-200 text-center py-10 px-4">
            <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
            <p className="text-sm text-red-700 mb-4">{error}</p>
            <button type="button" onClick={load} className={primaryBtn}>
              Try again
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 text-center py-12 px-4">
            <Monitor className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-medium text-gray-900 mb-1">No counters yet</h3>
            <p className="text-sm text-gray-500">Add “Counter 1” to start using tills and cash closing.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {rows.map((c) => (
              <div key={c._id} className={`bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5 ${c.isActive ? '' : 'opacity-70'}`}>
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-honey-50 text-honey-700 flex-shrink-0">
                    <Monitor className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-semibold text-gray-900 truncate">{c.name}</h3>
                      <span className="text-[11px] font-mono px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">{c.code}</span>
                      {!c.isActive && <span className="text-[11px] px-1.5 py-0.5 bg-gray-100 rounded text-gray-500">Off</span>}
                    </div>
                  </div>
                </div>
                <div className="mt-3 space-y-1.5 text-xs text-gray-600">
                  <p className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-gray-400" />
                    Open by <strong>{c.openCutoff || '—'}</strong> · close by <strong>{c.closeCutoff || '—'}</strong>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <LockOpen className="h-3.5 w-3.5 text-gray-400" /> Usual float <strong>{formatRs(c.defaultFloat)}</strong>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-gray-400" />
                    {c.assignedUsers.length ? c.assignedUsers.map(userName).join(', ') : 'Any cashier'}
                  </p>
                </div>
                <div className="mt-3 text-xs">
                  {c.openSession ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-50 text-green-700 border border-green-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Open by {c.openSession.cashierName} since {formatTime(c.openSession.openedAt)}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-50 text-gray-500 border border-gray-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-gray-400" /> Closed
                    </span>
                  )}
                </div>
                {(can('sale_counters', 'edit') || can('sale_counters', 'delete')) && (
                  <div className="mt-4 flex gap-2">
                    {can('sale_counters', 'edit') && (
                      <button type="button" onClick={() => setEditing(c)} className={`${secondaryBtn} !px-3 !py-1.5 text-xs`}>
                        <Edit2 className="h-3.5 w-3.5" /> Edit
                      </button>
                    )}
                    {can('sale_counters', 'delete') && (
                      <button
                        type="button"
                        onClick={() => remove(c)}
                        disabled={busyId === c._id || !!c.openSession}
                        title={c.openSession ? 'Close the till first' : 'Delete'}
                        className={`${secondaryBtn} !px-3 !py-1.5 text-xs text-red-600`}
                      >
                        {busyId === c._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <CounterModal
          counter={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

function CounterModal({ counter, onClose, onSaved }: { counter: Counter | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<FormState>({
    name: counter?.name || '',
    code: counter?.code || '',
    isActive: counter?.isActive ?? true,
    openCutoff: counter?.openCutoff || '',
    closeCutoff: counter?.closeCutoff || '',
    defaultFloat: counter ? String(counter.defaultFloat || 0) : '',
    assignedUsers: counter?.assignedUsers.map((u) => u._id) || [],
    notes: counter?.notes || '',
  });
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lockRef = useRef(false);

  // Staff logins (for "only these cashiers").
  useEffect(() => {
    let alive = true;
    setStaffLoading(true);
    storeApi
      .get<StaffOption[]>('/counters/staff-options')
      .then((r) => alive && setStaff(r.data || []))
      .catch(() => alive && setStaff([]))
      .finally(() => alive && setStaffLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const toggleUser = (id: string) =>
    set('assignedUsers', form.assignedUsers.includes(id) ? form.assignedUsers.filter((x) => x !== id) : [...form.assignedUsers, id]);

  const save = async () => {
    if (lockRef.current) return;
    if (!form.name.trim()) {
      setError('Give the counter a name, e.g. Counter 1.');
      return;
    }
    lockRef.current = true;
    setBusy(true);
    setError(null);
    const body = {
      name: form.name.trim(),
      code: form.code.trim(),
      isActive: form.isActive,
      openCutoff: form.openCutoff,
      closeCutoff: form.closeCutoff,
      defaultFloat: Number(form.defaultFloat) || 0,
      assignedUsers: form.assignedUsers,
      notes: form.notes,
    };
    try {
      if (counter) await storeApi.put(`/counters/${counter._id}`, body);
      else await storeApi.post('/counters', body);
      toast.success(counter ? 'Counter saved' : 'Counter added');
      onSaved();
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not save the counter.'));
    } finally {
      lockRef.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal
      title={counter ? `Edit ${counter.name}` : 'Add counter'}
      icon={<Monitor className="h-5 w-5" />}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={secondaryBtn}>
            Cancel
          </button>
          <button type="button" onClick={save} disabled={busy} className={primaryBtn}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Field label="Name" required>
              <input value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={60} className={inputClass} placeholder="Counter 1" disabled={busy} />
            </Field>
          </div>
          <Field label="Code" hint="Auto if empty">
            <input value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} maxLength={20} className={inputClass} placeholder="C1" disabled={busy} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Open by (cut-off)" hint="Alert if not opened by then">
            <input type="time" value={form.openCutoff} onChange={(e) => set('openCutoff', e.target.value)} className={inputClass} disabled={busy} />
          </Field>
          <Field label="Close by (cut-off)" hint="Alert if still open after">
            <input type="time" value={form.closeCutoff} onChange={(e) => set('closeCutoff', e.target.value)} className={inputClass} disabled={busy} />
          </Field>
        </div>
        <Field label="Usual opening float (Rs)" hint="Change money put in the drawer. Not part of sales.">
          <MoneyInput
            value={form.defaultFloat}
            onValue={(v) => set('defaultFloat', v)}
            className={inputClass}
            placeholder="5000"
            disabled={busy}
          />
        </Field>
        <Field label="Only these cashiers may open it" hint="Leave all unticked to allow any cashier with Till permission.">
          {staffLoading ? (
            <p className="text-xs text-gray-500 flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading staff…
            </p>
          ) : staff.length === 0 ? (
            <p className="text-xs text-gray-500">No staff logins yet.</p>
          ) : (
            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
              {staff.map((u) => (
                <label key={u._id} className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" checked={form.assignedUsers.includes(u._id)} onChange={() => toggleUser(u._id)} disabled={busy} className="accent-honey-500" />
                  <span className="truncate">{u.name}</span>
                  <span className="ml-auto text-[11px] text-gray-400 truncate">{u.email}</span>
                </label>
              ))}
            </div>
          )}
        </Field>
        <Toggle checked={form.isActive} onChange={(v) => set('isActive', v)} label="Active" hint="Switched-off counters cannot be opened and get no alerts." disabled={busy} />
        <Field label="Notes">
          <input value={form.notes} onChange={(e) => set('notes', e.target.value)} maxLength={300} className={inputClass} disabled={busy} />
        </Field>
        <ErrorBox message={error} />
      </div>
    </Modal>
  );
}
