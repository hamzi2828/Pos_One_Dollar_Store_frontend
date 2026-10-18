'use client';

// Contract letter templates: list, edit, make default, delete, with placeholder help.
import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Check, Copy, FilePlus2, FileSignature, Loader2, Star, Trash2 } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage } from '@/lib/storeApi';
import { ErrorBox, Field, Modal, Toggle, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { employeeApi, type ContractTemplate, type Placeholder } from '../services/employeeApi';

type Draft = { _id: string | null; name: string; body: string; isDefault: boolean; readOnly?: boolean };

export default function TemplateEditorModal({
  templates,
  placeholders,
  builtin,
  onClose,
  onChanged,
}: {
  templates: ContractTemplate[];
  placeholders: Placeholder[];
  builtin: { name: string; body: string };
  onClose: () => void;
  onChanged: (selectId?: string) => void;
}) {
  const { can } = useAccess();
  const canCreate = can('employees', 'create');
  const canEdit = can('employees', 'edit');
  const canDelete = can('employees', 'delete');

  const builtinDraft: Draft = { _id: null, name: builtin.name, body: builtin.body, isDefault: false, readOnly: true };
  const first = templates[0];
  const [draft, setDraft] = useState<Draft>(first ? { _id: first._id, name: first.name, body: first.body, isDefault: first.isDefault } : builtinDraft);
  const [saving, setSaving] = useState<'save' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const editable = !draft.readOnly && (draft._id ? canEdit : canCreate);

  const pick = (d: Draft) => {
    setError(null);
    setDraft(d);
  };

  const newFromBuiltin = () =>
    pick({ _id: null, name: templates.length ? 'New contract template' : 'Our employment contract', body: builtin.body, isDefault: !templates.some((t) => t.isDefault) });

  // Insert {{key}} where the cursor is.
  const insert = (key: string) => {
    if (!editable) return;
    const el = bodyRef.current;
    const token = `{{${key}}}`;
    if (!el) return setDraft((d) => ({ ...d, body: d.body + token }));
    const start = el.selectionStart ?? draft.body.length;
    const end = el.selectionEnd ?? start;
    const body = draft.body.slice(0, start) + token + draft.body.slice(end);
    setDraft((d) => ({ ...d, body }));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const save = async () => {
    if (lock.current || !editable) return;
    if (!draft.name.trim()) return setError('Give the template a name.');
    if (!draft.body.trim()) return setError('The template text is empty.');
    lock.current = true;
    setSaving('save');
    setError(null);
    try {
      const body = { name: draft.name.trim(), body: draft.body, isDefault: draft.isDefault };
      const saved = draft._id ? await employeeApi.updateTemplate(draft._id, body) : await employeeApi.createTemplate(body);
      setDraft({ _id: saved._id, name: saved.name, body: saved.body, isDefault: saved.isDefault });
      toast.success('Template saved');
      onChanged(saved._id);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not save the template.'));
    } finally {
      lock.current = false;
      setSaving(null);
    }
  };

  const remove = async () => {
    if (lock.current || !draft._id || !window.confirm(`Delete the template "${draft.name}"?`)) return;
    lock.current = true;
    setSaving('delete');
    try {
      await employeeApi.removeTemplate(draft._id);
      toast.success('Template deleted');
      setDraft(builtinDraft);
      onChanged('');
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not delete the template.'));
    } finally {
      lock.current = false;
      setSaving(null);
    }
  };

  return (
    <Modal
      title="Contract templates"
      subtitle="Write the letter once — employee details are filled in automatically"
      icon={<FileSignature className="h-5 w-5" />}
      onClose={onClose}
      busy={!!saving}
      wide
      footer={
        <>
          {draft._id && canDelete && (
            <button type="button" onClick={remove} disabled={!!saving} className={`${secondaryBtn} text-red-600 hover:bg-red-50 mr-auto`}>
              {saving === 'delete' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete
            </button>
          )}
          <button type="button" onClick={onClose} disabled={!!saving} className={secondaryBtn}>
            Close
          </button>
          {editable && (
            <button type="button" onClick={save} disabled={!!saving} aria-busy={saving === 'save'} className={primaryBtn}>
              {saving === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save template
            </button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {/* Template chooser */}
        <div className="flex flex-wrap gap-1.5">
          {templates.map((t) => (
            <button
              key={t._id}
              type="button"
              onClick={() => pick({ _id: t._id, name: t.name, body: t.body, isDefault: t.isDefault })}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border ${draft._id === t._id ? 'bg-honey-500 border-honey-500 text-gray-900' : 'bg-white border-gray-300 text-gray-700 hover:border-honey-400'}`}
            >
              {t.isDefault && <Star className="h-3 w-3" />} {t.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => pick(builtinDraft)}
            className={`px-2.5 py-1 text-xs rounded-full border ${draft.readOnly ? 'bg-gray-800 border-gray-800 text-white' : 'bg-white border-gray-300 text-gray-700 hover:border-gray-500'}`}
          >
            Built-in standard
          </button>
          {canCreate && (
            <button type="button" onClick={newFromBuiltin} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border border-dashed border-honey-400 text-honey-700 hover:bg-honey-50">
              <FilePlus2 className="h-3 w-3" /> New
            </button>
          )}
        </div>

        <ErrorBox message={error} />

        {draft.readOnly && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-600">
            <span>The built-in contract is used when you have no default template. Copy it to change the wording. Have it checked by your lawyer before use.</span>
            {canCreate && (
              <button type="button" onClick={newFromBuiltin} className={`${secondaryBtn} !py-1 !px-2 text-xs whitespace-nowrap`}>
                <Copy className="h-3.5 w-3.5" /> Copy & edit
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_15rem] gap-4">
          <fieldset disabled={!!saving} className="space-y-3 min-w-0">
            <Field label="Template name" required>
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} disabled={!editable} className={inputClass} maxLength={120} />
            </Field>
            <Field label="Letter text">
              <textarea
                ref={bodyRef}
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                disabled={!editable}
                rows={18}
                spellCheck
                className={`${inputClass} font-mono text-xs leading-relaxed`}
              />
            </Field>
            {editable && (
              <Toggle checked={draft.isDefault} onChange={(v) => setDraft({ ...draft, isDefault: v })} label="Default template" hint="Used when you open a contract letter." />
            )}
          </fieldset>

          <aside className="text-xs space-y-3">
            <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
              <p className="font-semibold text-gray-800 mb-1">Formatting</p>
              <ul className="space-y-0.5 text-gray-600">
                <li>
                  <code># Title</code> — heading
                </li>
                <li>
                  <code>## 1. Salary</code> — section
                </li>
                <li>
                  <code>- item</code> — bullet list
                </li>
                <li>
                  <code>**bold**</code> — bold text
                </li>
                <li>Empty line — new paragraph</li>
              </ul>
            </div>
            <div className="rounded-lg border border-gray-200 p-3">
              <p className="font-semibold text-gray-800 mb-1">Placeholders {editable && <span className="font-normal text-gray-500">(click to insert)</span>}</p>
              <ul className="space-y-1 max-h-72 overflow-y-auto pr-1">
                {placeholders.map((p) => (
                  <li key={p.key}>
                    <button
                      type="button"
                      onClick={() => insert(p.key)}
                      disabled={!editable}
                      className="text-left w-full rounded px-1 py-0.5 hover:bg-honey-50 disabled:hover:bg-transparent"
                      title={p.label}
                    >
                      <code className="text-honey-700 break-all">{`{{${p.key}}}`}</code>
                      <span className="block text-[11px] text-gray-500">{p.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </Modal>
  );
}
