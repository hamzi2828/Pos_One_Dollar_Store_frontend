'use client';

// Asset categories: add, edit (depreciation defaults), hide, delete unused ones.
import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Check, FolderTree, Loader2, Plus, Trash2 } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage } from '@/lib/storeApi';
import { ErrorBox, Field, Modal, Toggle, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { assetApi, type AssetCategory, type DepMethod } from '../services/assetApi';

type Draft = { _id: string | null; name: string; code: string; description: string; depreciationMethod: DepMethod; usefulLifeYears: string; isActive: boolean };

const blank: Draft = { _id: null, name: '', code: '', description: '', depreciationMethod: 'straight_line', usefulLifeYears: '5', isActive: true };
const toDraft = (c: AssetCategory): Draft => ({
  _id: c._id,
  name: c.name,
  code: c.code,
  description: c.description || '',
  depreciationMethod: c.depreciationMethod,
  usefulLifeYears: String(c.usefulLifeYears ?? ''),
  isActive: c.isActive,
});

export default function CategoriesModal({ categories, onClose, onChanged }: { categories: AssetCategory[]; onClose: () => void; onChanged: () => Promise<void> }) {
  const { can } = useAccess();
  const canCreate = can('assets', 'create');
  const canEdit = can('assets', 'edit');
  const canDelete = can('assets', 'delete');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  const save = async () => {
    if (!draft || lock.current) return;
    if (!draft.name.trim()) return setError('Enter the category name.');
    lock.current = true;
    setBusy('save');
    setError(null);
    try {
      const body = {
        name: draft.name.trim(),
        description: draft.description.trim(),
        depreciationMethod: draft.depreciationMethod,
        usefulLifeYears: draft.usefulLifeYears === '' ? 0 : Number(draft.usefulLifeYears),
        isActive: draft.isActive,
      };
      if (draft._id) await assetApi.updateCategory(draft._id, body);
      else await assetApi.createCategory({ ...body, code: draft.code.trim().toUpperCase() || undefined });
      toast.success('Category saved');
      setDraft(null);
      await onChanged();
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not save the category.'));
    } finally {
      lock.current = false;
      setBusy(null);
    }
  };

  const remove = async (c: AssetCategory) => {
    if (lock.current || !window.confirm(`Delete the category "${c.name}"?`)) return;
    lock.current = true;
    setBusy(c._id);
    setError(null);
    try {
      await assetApi.removeCategory(c._id);
      toast.success('Category deleted');
      if (draft?._id === c._id) setDraft(null);
      await onChanged();
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not delete the category.'));
    } finally {
      lock.current = false;
      setBusy(null);
    }
  };

  const editable = draft && (draft._id ? canEdit : canCreate);

  return (
    <Modal
      title="Asset categories"
      subtitle="Groups in the register, with their depreciation defaults"
      icon={<FolderTree className="h-5 w-5" />}
      onClose={onClose}
      busy={!!busy}
      wide
      footer={
        <button type="button" onClick={onClose} disabled={!!busy} className={secondaryBtn}>
          Close
        </button>
      }
    >
      <div className="space-y-4">
        <ErrorBox message={error} />
        <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
          {categories.map((c) => (
            <li key={c._id} className={`flex items-center gap-3 px-3 py-2 ${draft?._id === c._id ? 'bg-honey-50' : ''}`}>
              <button type="button" onClick={() => (canEdit ? setDraft(toDraft(c)) : undefined)} className="min-w-0 flex-1 text-left" disabled={!canEdit}>
                <span className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">{c.name}</span>
                  <span className="px-1.5 py-0.5 text-[10px] font-mono bg-gray-100 text-gray-600 rounded">{c.code}</span>
                  {!c.isActive && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">Hidden</span>}
                </span>
                <span className="block text-xs text-gray-500 truncate">
                  {c.depreciationMethod === 'none' ? 'No depreciation' : `Straight line · ${c.usefulLifeYears} yrs`} · {c.assetCount || 0} asset{c.assetCount === 1 ? '' : 's'}
                  {c.description ? ` · ${c.description}` : ''}
                </span>
              </button>
              {canDelete && (
                <button
                  type="button"
                  onClick={() => remove(c)}
                  disabled={!!busy || (c.assetCount || 0) > 0}
                  title={(c.assetCount || 0) > 0 ? 'In use — hide it instead' : 'Delete'}
                  className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent"
                  aria-label={`Delete ${c.name}`}
                >
                  {busy === c._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              )}
            </li>
          ))}
        </ul>

        {!draft && canCreate && (
          <button type="button" onClick={() => setDraft({ ...blank })} className={secondaryBtn}>
            <Plus className="h-4 w-4" /> New category
          </button>
        )}

        {draft && editable && (
          <fieldset disabled={!!busy} className="rounded-lg border border-honey-200 p-3 space-y-3">
            <p className="text-sm font-semibold text-gray-900">{draft._id ? `Edit ${draft.name || 'category'}` : 'New category'}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <Field label="Name" required>
                  <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputClass} autoFocus />
                </Field>
              </div>
              <Field label="Code" hint={draft._id ? 'Cannot be changed' : 'Optional, e.g. KIT'}>
                <input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} disabled={!!draft._id} maxLength={10} className={`${inputClass} font-mono uppercase`} />
              </Field>
              <Field label="Depreciation">
                <select value={draft.depreciationMethod} onChange={(e) => setDraft({ ...draft, depreciationMethod: e.target.value as DepMethod })} className={inputClass}>
                  <option value="straight_line">Straight line</option>
                  <option value="none">None</option>
                </select>
              </Field>
              <Field label="Useful life (years)">
                <input type="number" min={0} max={100} step="0.5" value={draft.usefulLifeYears} onChange={(e) => setDraft({ ...draft, usefulLifeYears: e.target.value })} disabled={draft.depreciationMethod === 'none'} className={inputClass} />
              </Field>
              <div className="flex items-end pb-1">
                <Toggle checked={draft.isActive} onChange={(v) => setDraft({ ...draft, isActive: v })} label="Show in lists" />
              </div>
              <div className="sm:col-span-3">
                <Field label="Description">
                  <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="What goes in this category" className={inputClass} />
                </Field>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDraft(null)} className={secondaryBtn}>
                Cancel
              </button>
              <button type="button" onClick={save} disabled={busy === 'save'} aria-busy={busy === 'save'} className={primaryBtn}>
                {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save category
              </button>
            </div>
          </fieldset>
        )}
      </div>
    </Modal>
  );
}
