'use client';

// Category Staff — give each product category one or more employees (with a
// share of its sales) and a monthly sales target. Their progress shows in
// Reports → Category Performance.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { UsersRound, Plus, Pencil, Trash2, Target, Search, Loader2 } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { storeApi, apiErrorMessage, formatRs } from '@/lib/storeApi';
import { Modal, Field, Toggle, ErrorBox, HelpBox, LoadingCard, NoAccessCard, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';

interface CategoryOption {
  name: string;
  inCatalog: boolean;
  active: boolean;
  products: number;
}
interface EmployeeOption {
  _id: string;
  name: string;
  position: string;
  department: string;
  isActive: boolean;
}
interface Assignment {
  _id: string;
  category: string;
  employees: { employee: string; name: string; position: string; isActive: boolean; sharePct: number | null; effectivePct: number }[];
  monthlyTarget: number;
  isActive: boolean;
  notes: string;
}

const keyOf = (s: string) => s.trim().toLowerCase();

export default function CategoryStaffPage() {
  const { can, loaded } = useAccess();
  const canView = can('category_assignments', 'view');
  const canEdit = can('category_assignments', 'edit');

  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [editing, setEditing] = useState<{ assignment: Assignment | null; category: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [c, a] = await Promise.all([
        storeApi.get<CategoryOption[]>('/category-assignments/categories'),
        storeApi.get<Assignment[]>('/category-assignments', { limit: 500 }),
      ]);
      setCategories(c.data || []);
      setAssignments(a.data || []);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load category staff.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canView) load();
  }, [canView, load]);

  // One row per category: catalogue + product categories + any assigned name.
  const rows = useMemo(() => {
    const map = new Map<string, { name: string; products: number; assignments: Assignment[] }>();
    for (const c of categories) map.set(keyOf(c.name), { name: c.name, products: c.products, assignments: [] });
    for (const a of assignments) {
      const k = keyOf(a.category);
      if (!map.has(k)) map.set(k, { name: a.category, products: 0, assignments: [] });
      map.get(k)!.assignments.push(a);
    }
    const q = search.trim().toLowerCase();
    return [...map.values()]
      .filter((r) => (!q || r.name.toLowerCase().includes(q)) && (!onlyOpen || r.assignments.length === 0))
      .sort((a, b) => Number(b.assignments.length > 0) - Number(a.assignments.length > 0) || a.name.localeCompare(b.name));
  }, [categories, assignments, search, onlyOpen]);

  const assignedCount = useMemo(() => new Set(assignments.map((a) => keyOf(a.category))).size, [assignments]);
  const totalTarget = assignments.filter((a) => a.isActive).reduce((s, a) => s + (a.monthlyTarget || 0), 0);

  const remove = async (a: Assignment) => {
    if (busyId) return;
    if (!window.confirm(`Remove the staff of "${a.category}"?`)) return;
    setBusyId(a._id);
    try {
      await storeApi.del(`/category-assignments/${a._id}`);
      toast.success('Assignment removed');
      await load();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not remove.'));
    } finally {
      setBusyId(null);
    }
  };

  if (!loaded) return <LoadingCard text="Loading…" />;
  if (!canView) return <NoAccessCard />;

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <UsersRound className="h-6 w-6 text-honey-700" /> Category Staff
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-gray-500">Who looks after each product category, their share of its sales and the monthly target.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can('report_category_performance', 'view') && (
            <Link href="/admin/reports/category-performance" className={secondaryBtn}>
              <Target className="h-4 w-4" /> Performance
            </Link>
          )}
          {canEdit && (
            <button type="button" onClick={() => setEditing({ assignment: null, category: '' })} className={primaryBtn}>
              <Plus className="h-4 w-4" /> Assign staff
            </button>
          )}
        </div>
      </div>

      <HelpBox>
        Each employee is credited with the category&apos;s sales × their share — leave the shares empty to split equally.
      </HelpBox>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Stat label="Categories" value={String(categories.length)} />
        <Stat label="With staff" value={`${assignedCount}`} />
        <Stat label="Monthly targets" value={formatRs(totalTarget)} />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px] sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a category" className={`${inputClass} pl-8`} />
        </div>
        <Toggle checked={onlyOpen} onChange={setOnlyOpen} label="Only categories without staff" />
      </div>

      {error && <ErrorBox message={error} />}

      {loading ? (
        <LoadingCard text="Loading categories…" />
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 text-center py-12 text-sm text-gray-500">No categories match.</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {rows.map((row) => (
            <div key={row.name} className="p-3 sm:p-4 flex flex-col lg:flex-row lg:items-start gap-3">
              <div className="lg:w-56 flex-shrink-0">
                <p className="text-sm font-semibold text-gray-900">{row.name}</p>
                <p className="text-[11px] text-gray-500">{row.products} product{row.products === 1 ? '' : 's'}</p>
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                {row.assignments.length === 0 ? (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">No staff assigned</span>
                    {canEdit && (
                      <button type="button" onClick={() => setEditing({ assignment: null, category: row.name })} className="text-xs font-medium text-honey-700 hover:underline">
                        Assign
                      </button>
                    )}
                  </div>
                ) : (
                  row.assignments.map((a) => (
                    <div key={a._id} className={`rounded-lg border p-2.5 ${a.isActive ? 'border-gray-200' : 'border-dashed border-gray-300 opacity-70'}`}>
                      <div className="flex flex-wrap items-center gap-2 justify-between">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="text-gray-600">
                            Target <b className="text-gray-900">{a.monthlyTarget ? formatRs(a.monthlyTarget) : '—'}</b> / month
                          </span>
                          {!a.isActive && <span className="text-amber-700">Paused</span>}
                        </div>
                        {canEdit && (
                          <div className="flex gap-1">
                            <button type="button" onClick={() => setEditing({ assignment: a, category: a.category })} className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100" aria-label={`Edit ${a.category}`}>
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => remove(a)} disabled={busyId === a._id} className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50" aria-label={`Remove ${a.category}`}>
                              {busyId === a._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {a.employees.map((e) => (
                          <span key={e.employee} className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs ${e.isActive ? 'bg-honey-50 text-honey-800' : 'bg-gray-100 text-gray-500 line-through'}`} title={e.position || undefined}>
                            {e.name}
                            <span className="text-[10px] opacity-70">{e.effectivePct}%</span>
                          </span>
                        ))}
                      </div>
                      {a.notes && <p className="text-[11px] text-gray-500 mt-1.5">{a.notes}</p>}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <AssignmentModal
          assignment={editing.assignment}
          category={editing.category}
          categories={categories.map((c) => c.name)}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-base sm:text-lg font-semibold text-gray-900 mt-0.5 truncate">{value}</div>
    </div>
  );
}

function AssignmentModal({
  assignment,
  category: initialCategory,
  categories,
  onClose,
  onSaved,
}: {
  assignment: Assignment | null;
  category: string;
  categories: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [category, setCategory] = useState(assignment?.category || initialCategory);
  const [picked, setPicked] = useState<Map<string, string>>(
    () => new Map((assignment?.employees || []).map((e) => [e.employee, e.sharePct === null ? '' : String(e.sharePct)])),
  );
  const [equal, setEqual] = useState(() => !assignment || assignment.employees.every((e) => e.sharePct === null));
  const [target, setTarget] = useState(assignment?.monthlyTarget ? String(assignment.monthlyTarget) : '');
  const [isActive, setIsActive] = useState(assignment ? assignment.isActive : true);
  const [notes, setNotes] = useState(assignment?.notes || '');
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [empLoading, setEmpLoading] = useState(true);
  const [empSearch, setEmpSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  // Employees of the shop.
  useEffect(() => {
    let live = true;
    setEmpLoading(true);
    storeApi
      .get<EmployeeOption[]>('/category-assignments/employees')
      .then((res) => live && setEmployees(res.data || []))
      .catch((e) => live && setError(apiErrorMessage(e, 'Could not load employees.')))
      .finally(() => live && setEmpLoading(false));
    return () => {
      live = false;
    };
  }, []);

  // Keep already-assigned people visible even if they are no longer in the list (e.g. left).
  const list = useMemo(() => {
    const extra = (assignment?.employees || [])
      .filter((e) => !employees.some((x) => x._id === e.employee))
      .map((e) => ({ _id: e.employee, name: e.name, position: e.position, department: '', isActive: e.isActive }));
    const q = empSearch.trim().toLowerCase();
    return [...employees, ...extra].filter((e) => !q || e.name.toLowerCase().includes(q) || e.position.toLowerCase().includes(q));
  }, [employees, assignment, empSearch]);

  const shareSum = [...picked.values()].reduce((s, v) => s + (Number(v) || 0), 0);
  const toggleEmp = (id: string) =>
    setPicked((prev) => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id);
      else next.set(id, '');
      return next;
    });
  const setShare = (id: string, v: string) => setPicked((prev) => new Map(prev).set(id, v));
  const splitEvenly = () => {
    const ids = [...picked.keys()];
    if (!ids.length) return;
    const base = Math.floor((100 / ids.length) * 100) / 100;
    const last = Math.round((100 - base * (ids.length - 1)) * 100) / 100;
    setPicked(new Map(ids.map((id, i) => [id, String(i === ids.length - 1 ? last : base)])));
  };

  const save = async () => {
    if (lock.current) return;
    if (!category.trim()) return setError('Pick a category.');
    if (!picked.size) return setError('Pick at least one employee.');
    if (!equal) {
      if ([...picked.values()].some((v) => v === '' || !(Number(v) >= 0))) return setError('Give every employee a share %, or switch on equal split.');
      if (Math.abs(shareSum - 100) > 0.5) return setError(`Shares must add up to 100% (now ${Math.round(shareSum * 100) / 100}%).`);
    }
    if (target && !(Number(target) >= 0)) return setError('Target must be 0 or more.');
    lock.current = true;
    setBusy(true);
    setError(null);
    const body = {
      category: category.trim(),
      employees: [...picked.entries()].map(([employee, share]) => ({ employee, sharePct: equal ? null : Number(share) })),
      monthlyTarget: target ? Number(target) : 0,
      isActive,
      notes,
    };
    try {
      if (assignment) await storeApi.put(`/category-assignments/${assignment._id}`, body);
      else await storeApi.post('/category-assignments', body);
      toast.success('Category staff saved');
      onSaved();
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not save.'));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal
      title={assignment ? 'Edit category staff' : 'Assign staff to a category'}
      subtitle={assignment ? assignment.category : undefined}
      icon={<UsersRound className="h-5 w-5" />}
      onClose={onClose}
      busy={busy}
      wide
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryBtn} disabled={busy}>
            Cancel
          </button>
          <button type="button" onClick={save} className={primaryBtn} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Category" required>
            <input list="cat-staff-categories" value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass} placeholder="e.g. Kitchen" />
            <datalist id="cat-staff-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="Monthly sales target (Rs)" hint="Pro-rated for shorter periods in the report.">
            <input type="number" min={0} inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value)} className={inputClass} placeholder="e.g. 150000" />
          </Field>
          <div className="flex items-end pb-1">
            <Toggle checked={isActive} onChange={setIsActive} label="Active" hint="Paused assignments do not count in the report." />
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <p className="text-xs font-medium text-gray-700">
              Employees <span className="text-red-500">*</span> <span className="text-gray-400 font-normal">({picked.size} picked)</span>
            </p>
            <div className="flex items-center gap-3">
              <Toggle checked={equal} onChange={setEqual} label="Equal split" />
              {!equal && (
                <button type="button" onClick={splitEvenly} className="text-xs text-honey-700 hover:underline">
                  Fill evenly
                </button>
              )}
            </div>
          </div>
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input value={empSearch} onChange={(e) => setEmpSearch(e.target.value)} placeholder="Find an employee" className={`${inputClass} pl-8`} />
          </div>
          <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto divide-y divide-gray-100">
            {empLoading ? (
              <div className="py-6 text-center">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400 mx-auto" />
              </div>
            ) : list.length === 0 ? (
              <p className="py-6 text-center text-xs text-gray-500">No employees yet. Add them under HR → Employees.</p>
            ) : (
              list.map((e) => {
                const on = picked.has(e._id);
                return (
                  <div key={e._id} className={`flex items-center gap-3 px-3 py-2 ${on ? 'bg-honey-50/50' : ''}`}>
                    <input type="checkbox" checked={on} onChange={() => toggleEmp(e._id)} className="h-4 w-4 accent-honey-500" id={`emp-${e._id}`} />
                    <label htmlFor={`emp-${e._id}`} className="flex-1 min-w-0 cursor-pointer">
                      <span className="block text-sm text-gray-900 truncate">
                        {e.name}
                        {!e.isActive && <span className="ml-1 text-[10px] text-gray-400">(inactive)</span>}
                      </span>
                      <span className="block text-[11px] text-gray-500 truncate">{[e.position, e.department].filter(Boolean).join(' · ')}</span>
                    </label>
                    {on && !equal && (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={picked.get(e._id) || ''}
                          onChange={(ev) => setShare(e._id, ev.target.value)}
                          className="w-20 px-2 py-1 text-sm border border-gray-300 rounded-md"
                          aria-label={`Share for ${e.name}`}
                        />
                        <span className="text-xs text-gray-500">%</span>
                      </div>
                    )}
                    {on && equal && <span className="text-xs text-gray-500">{Math.round((100 / picked.size) * 10) / 10}%</span>}
                  </div>
                );
              })
            )}
          </div>
          {!equal && picked.size > 0 && (
            <p className={`text-xs mt-1 ${Math.abs(shareSum - 100) <= 0.5 ? 'text-emerald-700' : 'text-amber-700'}`}>Total {Math.round(shareSum * 100) / 100}% (must be 100%)</p>
          )}
        </div>

        <Field label="Note">
          <input value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} className={inputClass} placeholder="Optional" />
        </Field>
        <ErrorBox message={error} />
      </div>
    </Modal>
  );
}
