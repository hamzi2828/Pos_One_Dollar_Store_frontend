'use client';

// Shop holidays for a year. Fixed-date public holidays come in one tap; Eid and
// other moon-based holidays are added by hand once the dates are announced.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertCircle, CalendarHeart, Check, ChevronLeft, ChevronRight, Edit2, Flag, Loader2, Plus, Trash2 } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage } from '@/lib/storeApi';
import { ErrorBox, Field, HelpBox, LoadingCard, Modal, Toggle, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { dayLabel, rosterApi, shopToday, type Holiday } from '../services/rosterApi';

function HolidayForm({ holiday, year, onClose, onSaved }: { holiday: Holiday | null; year: number; onClose: () => void; onSaved: () => void }) {
  const today = shopToday();
  const [date, setDate] = useState(holiday?.date || (today.startsWith(String(year)) ? today : `${year}-01-01`));
  const [name, setName] = useState(holiday?.name || '');
  const [shopClosed, setShopClosed] = useState(holiday ? holiday.shopClosed : true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  const save = async () => {
    if (lock.current) return;
    if (!date) return setError('Pick a date');
    if (!name.trim()) return setError('Give the holiday a name, e.g. Eid ul-Fitr');
    lock.current = true;
    setSaving(true);
    setError(null);
    try {
      if (holiday) await rosterApi.updateHoliday(holiday._id, { date, name: name.trim(), shopClosed });
      else await rosterApi.createHoliday({ date, name: name.trim(), shopClosed });
      toast.success(holiday ? 'Holiday saved' : 'Holiday added');
      onSaved();
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not save the holiday.'));
      lock.current = false;
      setSaving(false);
    }
  };

  return (
    <Modal
      title={holiday ? 'Edit holiday' : 'Add holiday'}
      icon={<CalendarHeart className="h-5 w-5" />}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className={secondaryBtn}>
            Cancel
          </button>
          <button type="button" onClick={save} disabled={saving} className={primaryBtn}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <fieldset disabled={saving} className="space-y-4">
          <ErrorBox message={error} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Date" required>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Name" required>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Eid ul-Fitr" className={inputClass} autoFocus />
            </Field>
          </div>
          <Toggle checked={shopClosed} onChange={setShopClosed} label="Shop closed" hint="Off = the shop opens that day; staff who work get holiday treatment (extra time)." />
          <p className="text-[11px] text-gray-500">Nobody is planned to work on a holiday unless you put them on the roster for that day. Whether it is paid comes from each person&apos;s HR policy.</p>
        </fieldset>
      </form>
    </Modal>
  );
}

export default function HolidaysTab() {
  const { can } = useAccess();
  const canCreate = can('shifts', 'create');
  const canEdit = can('shifts', 'edit');
  const canDelete = can('shifts', 'delete');
  const [year, setYear] = useState(() => Number(shopToday().slice(0, 4)));
  const [rows, setRows] = useState<Holiday[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Holiday | null | 'new'>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const lock = useRef(false);
  const reqId = useRef(0);

  const load = useCallback(async (y: number) => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const data = await rosterApi.holidays(y);
      if (id === reqId.current) setRows(data);
    } catch (e) {
      if (id === reqId.current) setError(apiErrorMessage(e, 'Could not load the holidays.'));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    load(year);
  }, [load, year]);

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

  const addPakistan = () =>
    run('pk', async () => {
      try {
        const r = await rosterApi.addPakistan(year);
        if (r.added.length) toast.success(`Added ${r.added.length} public holiday${r.added.length === 1 ? '' : 's'} for ${year}`);
        else toast(`All fixed public holidays of ${year} are already there.`, { icon: 'ℹ️' });
        await load(year);
      } catch (e) {
        toast.error(apiErrorMessage(e, 'Could not add the holidays.'));
      }
    });

  const remove = (h: Holiday) => {
    if (!window.confirm(`Remove the holiday "${h.name}" on ${dayLabel(h.date).day}?`)) return;
    run(h._id, async () => {
      try {
        await rosterApi.removeHoliday(h._id);
        toast.success('Holiday removed');
        await load(year);
      } catch (e) {
        toast.error(apiErrorMessage(e, 'Could not remove the holiday.'));
      }
    });
  };

  const today = shopToday();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 p-1">
          <button type="button" onClick={() => setYear((y) => y - 1)} disabled={loading} className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-50" aria-label="Previous year">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-2 text-sm font-semibold text-gray-900 tabular-nums">{year}</span>
          <button type="button" onClick={() => setYear((y) => y + 1)} disabled={loading} className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-50" aria-label="Next year">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        {loading && rows && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
        <div className="flex-1" />
        {canCreate && (
          <button type="button" onClick={addPakistan} disabled={!!busy || loading} className={secondaryBtn}>
            {busy === 'pk' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />} Add Pakistan public holidays
          </button>
        )}
        {canCreate && (
          <button type="button" onClick={() => setEditing('new')} className={primaryBtn}>
            <Plus className="h-4 w-4" /> Add holiday
          </button>
        )}
      </div>

      <HelpBox>
        <b>Add Pakistan public holidays</b> adds the fixed dates: Kashmir Day (5 Feb), Pakistan Day (23 Mar), Labour Day (1 May), Independence Day (14 Aug), Iqbal Day (9 Nov) and
        Quaid-e-Azam Day (25 Dec). <b>Eid ul-Fitr, Eid ul-Adha, Ashura and 12 Rabi ul-Awwal</b> follow the moon — add them by hand once the dates are announced.
      </HelpBox>

      {error && (
        <div className="bg-white rounded-lg border border-red-200 p-4 flex items-center gap-3 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => load(year)} className={secondaryBtn}>
            Try again
          </button>
        </div>
      )}

      {!rows && loading ? (
        <LoadingCard text="Loading holidays…" />
      ) : rows && rows.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 text-center py-12 px-4">
          <CalendarHeart className="h-10 w-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-600">No holidays for {year} yet.</p>
        </div>
      ) : rows ? (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {rows.map((h) => {
            const l = dayLabel(h.date);
            const past = h.date < today;
            return (
              <div key={h._id} className={`p-3 flex items-center gap-3 ${past ? 'opacity-60' : ''}`}>
                <div className={`w-14 flex-shrink-0 rounded-lg border text-center py-1 ${h.date === today ? 'border-honey-500 bg-honey-50' : 'border-gray-200'}`}>
                  <span className="block text-[10px] uppercase text-gray-500">{l.dow}</span>
                  <span className="block text-sm font-semibold text-gray-900">{l.day}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{h.name}</p>
                  <p className="text-[11px] text-gray-500">{h.shopClosed ? 'Shop closed' : 'Shop open (holiday pay for those who work)'}</p>
                </div>
                <div className="flex gap-1">
                  {canEdit && (
                    <button type="button" onClick={() => setEditing(h)} disabled={!!busy} className="p-2 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-100" aria-label={`Edit ${h.name}`}>
                      <Edit2 className="h-4 w-4" />
                    </button>
                  )}
                  {canDelete && (
                    <button type="button" onClick={() => remove(h)} disabled={!!busy} className="p-2 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50" aria-label={`Remove ${h.name}`}>
                      {busy === h._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {editing && (
        <HolidayForm
          holiday={editing === 'new' ? null : editing}
          year={year}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load(year);
          }}
        />
      )}
    </div>
  );
}
