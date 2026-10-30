'use client';

// "Buyer" of a purchase trip: pick a staff login (or type a name for someone
// without a login, e.g. a driver). The "+" opens Staff → Add Staff Login in a
// new tab; the list reloads when you come back to this tab.
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { Field, inputClass } from '@/components/admin/FormBits';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { purchasingApi } from './purchasingApi';
import type { BuyerOption } from './types';

/** Dropdown value for "someone without a login" (type the name). */
export const OTHER_BUYER = '__other__';

export function useBuyers() {
  const [buyers, setBuyers] = useState<BuyerOption[] | null>(null);
  const [failed, setFailed] = useState(false);

  const reload = useCallback(async () => {
    try {
      setBuyers(await purchasingApi.buyers());
      setFailed(false);
    } catch {
      setFailed(true);
      setBuyers((b) => b ?? []);
    }
  }, []);

  useEffect(() => {
    void reload();
    // Back from adding a staff login in another tab: show the new person.
    const onFocus = () => void reload();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [reload]);

  return { buyers, failed };
}

/**
 * What to send to the API for the picked buyer.
 * Staff → { buyerId }; other person → { buyerId: null, buyerName }; nothing picked → {}.
 */
export function buyerPayload(choice: string, otherName: string): { buyerId?: string | null; buyerName?: string } {
  if (choice === OTHER_BUYER) return { buyerId: null, buyerName: otherName.trim() };
  return choice ? { buyerId: choice } : {};
}

/** Error to show before saving, or null. */
export function buyerProblem(choice: string, otherName: string): string | null {
  return choice === OTHER_BUYER && !otherName.trim() ? "Type the buyer's name." : null;
}

export function BuyerField({
  buyers,
  failed,
  choice,
  onChoice,
  otherName,
  onOtherName,
  hint,
}: {
  buyers: BuyerOption[] | null;
  failed?: boolean;
  choice: string;
  onChoice: (v: string) => void;
  otherName: string;
  onOtherName: (v: string) => void;
  hint?: string;
}) {
  const { can, access } = useAccess();
  const myId = access?.user?.id;
  const canAddStaff = can('staff', 'create');
  const loading = buyers === null;

  return (
    <Field label="Buyer" hint={failed ? 'Could not load the staff list. You can still type a name.' : hint}>
      <div className="flex gap-2">
        <div className="flex-1 min-w-0">
          <SearchSelect
            value={choice}
            onChange={(e) => onChoice(e.target.value)}
            disabled={loading}
            placeholder={loading ? 'Loading staff…' : 'Pick the buyer'}
            searchable
            aria-label="Buyer"
            className={inputClass}
          >
            {(buyers || []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
                {b.role ? ` · ${b.role}` : ''}
                {b.id === myId ? ' (you)' : ''}
              </option>
            ))}
            <option value={OTHER_BUYER}>Someone else, no login (type the name)</option>
          </SearchSelect>
        </div>
        {canAddStaff && (
          <Link
            href="/admin/staff?add=1"
            target="_blank"
            rel="noopener"
            title="Add a staff member (opens in a new tab)"
            aria-label="Add a staff member"
            className="inline-flex items-center justify-center w-11 flex-shrink-0 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900"
          >
            <Plus className="h-5 w-5" />
          </Link>
        )}
      </div>
      {choice === OTHER_BUYER && (
        <input
          value={otherName}
          onChange={(e) => onOtherName(e.target.value)}
          className={`${inputClass} mt-2`}
          placeholder="e.g. Ali (driver)"
          autoFocus
        />
      )}
    </Field>
  );
}
