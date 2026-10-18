'use client';

// HR → Policies: the shop's attendance & pay rules. Each card shows who uses the
// policy and what it means in plain English. Exactly one policy is the default:
// everyone without their own policy follows it.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertCircle, Copy, Edit2, Eye, Loader2, Plus, ScrollText, Star, Trash2, Users } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage, formatDate } from '@/lib/storeApi';
import { HelpBox, LoadingCard, NoAccessCard, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import PolicyEditor from './components/PolicyEditor';
import AssignModal from './components/AssignModal';
import { policyApi, type Policy, type PolicyListMeta } from './services/policyApi';

const linkBtn = 'inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50';

export default function PoliciesPage() {
  const { can, loaded } = useAccess();
  const canView = can('hr_policies', 'view');
  const canCreate = can('hr_policies', 'create');
  const canEdit = can('hr_policies', 'edit');
  const canDelete = can('hr_policies', 'delete');

  const [rows, setRows] = useState<Policy[] | null>(null);
  const [meta, setMeta] = useState<PolicyListMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Policy | 'new' | null>(null);
  const [assigning, setAssigning] = useState<Policy | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const lock = useRef(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const r = await policyApi.list();
      setRows(r.rows);
      setMeta(r.meta);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load the policies.'));
    }
  }, []);
  useEffect(() => {
    if (canView) load();
  }, [canView, load]);

  const run = async (key: string, fn: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(key);
    try {
      await fn();
    } finally {
      lock.current = false;
      setBusy(null);
    }
  };

  const duplicate = (p: Policy) =>
    run(`dup:${p._id}`, async () => {
      try {
        const copy = await policyApi.duplicate(p._id);
        toast.success(`Created "${copy.name}"`);
        await load();
        setEditing(copy);
      } catch (e) {
        toast.error(apiErrorMessage(e, 'Could not copy the policy.'));
      }
    });

  const makeDefault = (p: Policy) => {
    if (!window.confirm(`Make "${p.name}" the default policy?\n\nEveryone without their own policy follows it from now on, and this month's attendance is re-checked.`)) return;
    run(`def:${p._id}`, async () => {
      try {
        await policyApi.setDefault(p._id);
        toast.success(`"${p.name}" is now the default`);
        await load();
      } catch (e) {
        toast.error(apiErrorMessage(e, 'Could not change the default.'));
      }
    });
  };

  const remove = (p: Policy) => {
    if (!window.confirm(`Delete the policy "${p.name}"?\n\nPayrolls already made keep their rules.`)) return;
    run(`del:${p._id}`, async () => {
      try {
        await policyApi.remove(p._id);
        toast.success('Policy deleted');
        await load();
      } catch (e) {
        toast.error(apiErrorMessage(e, 'Could not delete the policy.'), { duration: 6000 });
      }
    });
  };

  if (!loaded) return <LoadingCard text="Loading…" />;
  if (!canView) return <NoAccessCard />;

  const defaultName = rows?.find((r) => r.isDefault)?.name || 'the default';

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <ScrollText className="h-6 w-6 text-honey-700" /> HR Policies
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-gray-500">Attendance &amp; pay rules: grace time, late cuts, absent cuts, overtime, leave and till shortages.</p>
        </div>
        {canCreate && meta && (
          <button type="button" onClick={() => setEditing('new')} className={primaryBtn}>
            <Plus className="h-4 w-4" /> New policy
          </button>
        )}
      </div>

      <HelpBox>
        Every employee follows the <b>default</b> policy unless you assign them another one (here, or on their profile under Time &amp; pay). Changing a policy re-checks
        this month&apos;s attendance; months already paid keep their rules.
      </HelpBox>

      {error && (
        <div className="bg-white rounded-lg border border-red-200 p-4 flex items-center gap-3 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={load} className={secondaryBtn}>
            Try again
          </button>
        </div>
      )}

      {!rows && !error && <LoadingCard text="Loading policies…" />}

      {rows && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          {rows.map((p) => (
            <article key={p._id} className={`bg-white rounded-xl border shadow-sm flex flex-col ${p.isDefault ? 'border-honey-400' : 'border-gray-200'}`}>
              <div className="p-4 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-gray-900 flex flex-wrap items-center gap-2">
                      {p.name}
                      {p.isDefault && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-honey-500 text-gray-900">
                          <Star className="h-3 w-3" /> Default
                        </span>
                      )}
                    </h2>
                    {p.description && <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>}
                  </div>
                  <span className="flex-shrink-0 inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-100 rounded-full px-2 py-0.5" title="Current employees following this policy">
                    <Users className="h-3.5 w-3.5" /> {p.employeeCount}
                  </span>
                </div>
                <ul className="mt-3 space-y-1">
                  {p.summaryParts.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-honey-500" />
                      <span>{s[0].toUpperCase() + s.slice(1)}</span>
                    </li>
                  ))}
                </ul>
                {p.updatedAt && <p className="mt-3 text-[11px] text-gray-400">Last changed {formatDate(p.updatedAt)}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-1 border-t border-gray-100 px-2 py-1.5">
                {meta && (
                  <button type="button" onClick={() => setEditing(p)} className={linkBtn}>
                    {canEdit ? <Edit2 className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} {canEdit ? 'Edit' : 'View'}
                  </button>
                )}
                {canEdit && (
                  <button type="button" onClick={() => setAssigning(p)} className={linkBtn}>
                    <Users className="h-3.5 w-3.5" /> Assign staff
                  </button>
                )}
                {canCreate && (
                  <button type="button" onClick={() => duplicate(p)} disabled={!!busy} className={linkBtn}>
                    {busy === `dup:${p._id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />} Duplicate
                  </button>
                )}
                {canEdit && !p.isDefault && (
                  <button type="button" onClick={() => makeDefault(p)} disabled={!!busy} className={linkBtn}>
                    {busy === `def:${p._id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Star className="h-3.5 w-3.5" />} Make default
                  </button>
                )}
                {canDelete && !p.isDefault && (
                  <button type="button" onClick={() => remove(p)} disabled={!!busy} className={`${linkBtn} ml-auto text-red-600 hover:bg-red-50`}>
                    {busy === `del:${p._id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Delete
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {editing && meta && (
        <PolicyEditor
          policy={editing === 'new' ? null : editing}
          template={meta.template}
          limits={meta.limits}
          readOnly={editing === 'new' ? !canCreate : !canEdit}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
      {assigning && (
        <AssignModal
          policy={assigning}
          defaultName={defaultName}
          onClose={() => setAssigning(null)}
          onSaved={() => {
            setAssigning(null);
            load();
          }}
        />
      )}
    </div>
  );
}
