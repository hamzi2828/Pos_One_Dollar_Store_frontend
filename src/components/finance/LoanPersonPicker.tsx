// Pick a saved lender (people we borrow from), or add a new name with "+".
// Same list as Finance → Loans (/loan-lenders).
'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { apiErrorMessage, storeApi } from '@/lib/storeApi';
import { inputClass, primaryBtn } from '@/components/admin/FormBits';
import { SearchSelect } from '@/components/ui/SearchSelect';

interface Person {
  _id: string;
  name: string;
  phone?: string;
}

export default function LoanPersonPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (id: string, name: string) => void;
  disabled?: boolean;
}) {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    storeApi
      .get<Person[]>('/loan-lenders')
      .then((r) => {
        const list = r.data || [];
        setPeople(list);
        if (!list.length) setAdding(true);
      })
      .catch((e) => {
        setPeople([]);
        setError(apiErrorMessage(e, 'Could not load the names.'));
      });
  }, []);

  const addPerson = async () => {
    if (!newName.trim()) return setError('Write the name');
    setBusy(true);
    setError(null);
    try {
      const r = await storeApi.post<Person>('/loan-lenders', { name: newName.trim(), phone: newPhone.trim() || undefined });
      setPeople((p) => [...(p || []).filter((x) => x._id !== r.data._id), r.data].sort((a, b) => a.name.localeCompare(b.name)));
      onChange(r.data._id, r.data.name);
      setAdding(false);
      setNewName('');
      setNewPhone('');
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not save the name.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <SearchSelect
            value={value}
            onChange={(e) => onChange(e.target.value, (people || []).find((p) => p._id === e.target.value)?.name || '')}
            className={inputClass}
            disabled={disabled || !people}
          >
            <option value="">{people ? (people.length ? 'Whose money? Pick a name…' : 'No names yet: add one with +') : 'Loading…'}</option>
            {(people || []).map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
                {p.phone ? ` · ${p.phone}` : ''}
              </option>
            ))}
          </SearchSelect>
        </div>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          disabled={disabled}
          className={`inline-flex items-center justify-center rounded-lg border px-3 ${adding ? 'border-honey-400 bg-honey-50 text-honey-800' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
          title="Add a new name"
          aria-label="Add a new name"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      {adding && (
        <div className="grid grid-cols-1 gap-2 rounded-lg border border-honey-300 bg-honey-50/60 p-2 sm:grid-cols-3">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={120} className={inputClass} placeholder="Name *" />
          <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} maxLength={30} className={inputClass} placeholder="Phone (optional)" />
          <button type="button" onClick={addPerson} disabled={busy || !newName.trim()} className={primaryBtn}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save name
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

/** Two big buttons: No / Yes. */
export function YesNo({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const cls = (on: boolean) =>
    `rounded-lg border px-4 py-1.5 text-sm font-semibold ${on ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`;
  return (
    <div className="inline-flex gap-2">
      <button type="button" disabled={disabled} onClick={() => onChange(false)} className={cls(!value)}>
        No
      </button>
      <button type="button" disabled={disabled} onClick={() => onChange(true)} className={cls(value)}>
        Yes
      </button>
    </div>
  );
}
