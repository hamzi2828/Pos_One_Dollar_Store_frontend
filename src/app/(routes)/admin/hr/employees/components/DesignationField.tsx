'use client';

// Designation picker: the shop's roles (Roles page) + designations already used,
// loaded from GET /employees/designations. "Other" lets you type a new one;
// "+" opens the Roles page to add a role.
import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { inputClass } from '@/components/admin/FormBits';
import { useAccess } from '@/context/AccessContext';
import { storeApi } from '@/lib/storeApi';

interface Choice {
  name: string;
  source: 'role' | 'used';
}

const OTHER = '__other__';

export default function DesignationField({
  value,
  onChange,
  className = inputClass,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const { can } = useAccess();
  const [choices, setChoices] = useState<Choice[] | null>(null);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    let live = true;
    storeApi
      .get<Choice[]>('/employees/designations')
      .then((r) => live && setChoices(r.data || []))
      .catch(() => live && setChoices([]));
    return () => {
      live = false;
    };
  }, []);

  const known = (choices || []).some((c) => c.name.toLowerCase() === value.trim().toLowerCase());
  // A saved value that is not in the list (old text) is typed by hand.
  const showInput = typing || (!!value && choices !== null && !known);
  const roles = (choices || []).filter((c) => c.source === 'role');
  const used = (choices || []).filter((c) => c.source === 'used');

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <SearchSelect
            value={showInput ? OTHER : value}
            onChange={(e) => {
              const v = e.target.value;
              if (v === OTHER) {
                setTyping(true);
                if (known) onChange('');
              } else {
                setTyping(false);
                onChange(v);
              }
            }}
            className={className}
            aria-label="Designation"
          >
            <option value="">{choices === null ? 'Loading…' : 'Choose a designation'}</option>
            {roles.length > 0 && (
              <optgroup label="Roles">
                {roles.map((c) => (
                  <option key={`r-${c.name}`} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            )}
            {used.length > 0 && (
              <optgroup label="Used before">
                {used.map((c) => (
                  <option key={`u-${c.name}`} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            )}
            <option value={OTHER}>Other (type it)</option>
          </SearchSelect>
        </div>
        {can('roles', 'view') && (
          <a
            href="/admin/roles"
            target="_blank"
            rel="noreferrer"
            title="Add a role"
            className="inline-flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
          >
            <Plus className="h-4 w-4" />
          </a>
        )}
      </div>
      {showInput && (
        <input value={value} onChange={(e) => onChange(e.target.value)} className={className} placeholder="Type the designation" autoFocus={typing} />
      )}
    </div>
  );
}
