'use client';

// Choose which employees follow a policy. Ticked = on this policy. For a normal
// policy, unticking sends the person back to the default policy. For the
// default policy you can only move people onto it (everyone else has their own).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Check, Loader2, Search, Users } from 'lucide-react';
import { apiErrorMessage } from '@/lib/storeApi';
import { ErrorBox, LoadingCard, Modal, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { policyApi, type Policy, type PolicyEmployee } from '../services/policyApi';

export default function AssignModal({ policy, defaultName, onClose, onSaved }: { policy: Policy; defaultName: string; onClose: () => void; onSaved: () => void }) {
  const [people, setPeople] = useState<PolicyEmployee[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  useEffect(() => {
    let live = true;
    policyApi
      .employees()
      .then((rows) => {
        if (!live) return;
        setPeople(rows);
        setPicked(new Set(rows.filter((r) => r.policyId === policy._id).map((r) => r._id)));
      })
      .catch((e) => live && setError(apiErrorMessage(e, 'Could not load the employees.')));
    return () => {
      live = false;
    };
  }, [policy._id]);

  const onPolicy = useMemo(() => new Set((people || []).filter((r) => r.policyId === policy._id).map((r) => r._id)), [people, policy._id]);
  const shown = useMemo(() => {
    const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return (people || []).filter((p) => words.every((w) => `${p.name} ${p.code} ${p.designation} ${p.policyName}`.toLowerCase().includes(w)));
  }, [people, search]);

  const added = [...picked].filter((id) => !onPolicy.has(id));
  const removed = policy.isDefault ? [] : [...onPolicy].filter((id) => !picked.has(id));
  const changed = added.length + removed.length;

  const toggle = (p: PolicyEmployee) => {
    if (policy.isDefault && onPolicy.has(p._id)) return; // already on the default
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(p._id)) next.delete(p._id);
      else next.add(p._id);
      return next;
    });
  };
  const allShown = shown.length > 0 && shown.every((p) => picked.has(p._id));
  const toggleAll = () =>
    setPicked((prev) => {
      const next = new Set(prev);
      for (const p of shown) {
        if (policy.isDefault && onPolicy.has(p._id)) continue;
        if (allShown) next.delete(p._id);
        else next.add(p._id);
      }
      return next;
    });

  const save = async () => {
    if (lock.current || !changed) return;
    lock.current = true;
    setSaving(true);
    setError(null);
    try {
      const r = policy.isDefault ? await policyApi.assign('default', added) : await policyApi.assign(policy._id, [...picked], true);
      const parts = [];
      if (r.assigned) parts.push(`${r.assigned} employee${r.assigned === 1 ? '' : 's'} moved to ${policy.name}`);
      if (r.movedToDefault) parts.push(`${r.movedToDefault} back on ${defaultName}`);
      toast.success(parts.join(' · ') || 'Saved');
      onSaved();
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not assign the policy.'));
      lock.current = false;
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Assign staff: ${policy.name}`}
      subtitle={policy.isDefault ? 'Tick people to move them back to the default policy' : `Unticked staff follow the default policy (${defaultName})`}
      icon={<Users className="h-5 w-5" />}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <span className="mr-auto text-xs text-gray-500">{changed ? `${changed} change${changed === 1 ? '' : 's'}` : 'No changes'}</span>
          <button type="button" onClick={onClose} disabled={saving} className={secondaryBtn}>
            Cancel
          </button>
          <button type="button" onClick={save} disabled={saving || !changed} className={primaryBtn}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <ErrorBox message={error} />
        {!people && !error ? (
          <LoadingCard text="Loading employees…" />
        ) : people && people.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">No active employees.</p>
        ) : people ? (
          <>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find by name, code or job" className={`${inputClass} pl-8`} />
              </div>
              <button type="button" onClick={toggleAll} disabled={saving || !shown.length} className={`${secondaryBtn} px-3`}>
                {allShown ? 'Untick all' : 'Tick all'}
              </button>
            </div>
            <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg max-h-[50vh] overflow-y-auto">
              {shown.map((p) => {
                const on = picked.has(p._id);
                const fixed = policy.isDefault && onPolicy.has(p._id);
                return (
                  <li key={p._id}>
                    <label className={`flex items-center gap-3 px-3 py-2 ${fixed ? 'opacity-60' : 'cursor-pointer hover:bg-honey-50/60'}`}>
                      <input type="checkbox" checked={on} disabled={saving || fixed} onChange={() => toggle(p)} className="h-4 w-4 accent-yellow-400" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-gray-900 truncate">{p.name}</span>
                        <span className="block text-[11px] text-gray-500 truncate">
                          {[p.code, p.designation].filter(Boolean).join(' · ') || '—'}
                        </span>
                      </span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap ${p.policyId === policy._id ? 'bg-honey-100 text-gray-900' : 'bg-gray-100 text-gray-600'}`}>
                        {p.policyName}
                        {p.hrPolicy === null ? ' (default)' : ''}
                      </span>
                    </label>
                  </li>
                );
              })}
              {shown.length === 0 && <li className="px-3 py-6 text-center text-sm text-gray-500">Nobody matches “{search}”.</li>}
            </ul>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
