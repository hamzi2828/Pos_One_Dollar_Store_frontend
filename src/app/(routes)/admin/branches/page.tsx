'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  Building2,
  Plus,
  Search,
  X,
  Edit2,
  Trash2,
  Star,
  Users as UsersIcon,
  MapPin,
  Phone,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Check,
} from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage } from '@/helper/access';
import {
  Modal,
  Field,
  Toggle,
  ErrorBox,
  HelpBox,
  LoadingCard,
  NoAccessCard,
  inputClass,
  primaryBtn,
  secondaryBtn,
} from '@/components/admin/FormBits';
import { branchService, type Branch, type BranchPayload } from './services/branchService';

export default function BranchesPage() {
  const { isSuperAdmin, can, refresh: refreshAccess } = useAccess();
  const canSee = can('branches', 'view') || can('stock_transfers', 'view') || isSuperAdmin;

  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ open: boolean; branch: Branch | null }>({ open: false, branch: null });
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setBranches(await branchService.list());
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load branches.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return branches;
    return branches.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.code.toLowerCase().includes(q) ||
        (b.address || '').toLowerCase().includes(q) ||
        (b.phone || '').toLowerCase().includes(q),
    );
  }, [branches, search]);

  const stats = useMemo(
    () => ({
      total: branches.length,
      active: branches.filter((b) => b.isActive).length,
      staff: branches.reduce((s, b) => s + (b.staffCount || 0), 0),
    }),
    [branches],
  );

  const afterChange = async () => {
    await load();
    // Header branch switcher reads /me/access.
    refreshAccess();
  };

  const handleSave = async (payload: BranchPayload) => {
    if (modal.branch) {
      // isMain is changed with "Make main" only.
      const { isMain: _ignored, ...rest } = payload;
      void _ignored;
      await branchService.update(modal.branch.id, rest);
      toast.success('Branch saved');
    } else {
      await branchService.create(payload);
      toast.success('Branch added');
    }
    setModal({ open: false, branch: null });
    await afterChange();
  };

  const handleSetMain = async (b: Branch) => {
    if (
      !window.confirm(
        `Make "${b.name}" the main branch?\n\nThe main branch is used when "All branches" is selected and you sell or receive stock.`,
      )
    )
      return;
    try {
      setBusyId(b.id);
      await branchService.setMain(b.id);
      toast.success(`${b.name} is now the main branch`);
      await afterChange();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not change the main branch.'));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (b: Branch) => {
    if (!window.confirm(`Delete branch "${b.name}"?\n\nThis only works when the branch has no stock and no staff.`)) return;
    try {
      setBusyId(b.id);
      await branchService.remove(b.id);
      toast.success('Branch deleted');
      await afterChange();
    } catch (e) {
      // Backend explains why (main branch / still has stock / still has staff).
      toast.error(apiErrorMessage(e, 'Could not delete the branch.'), { duration: 6000 });
    } finally {
      setBusyId(null);
    }
  };

  if (!canSee) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <NoAccessCard />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Header */}
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Branches</h1>
            <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-500">Your shops. Add Branch 1, Branch 2 and so on.</p>
          </div>
          {isSuperAdmin && (
            <button onClick={() => setModal({ open: true, branch: null })} className={primaryBtn}>
              <Plus className="h-4 w-4" />
              <span>Add Branch</span>
            </button>
          )}
        </div>

        <div className="mb-4 sm:mb-6">
          <HelpBox>
            <strong>Products are shared. Each branch has its own stock, sales and staff.</strong>{' '}
            Use the branch picker at the top of the screen to see one branch or all branches. Give each branch its own
            staff logins on the{' '}
            <Link href="/admin/staff" className="font-semibold underline">
              Staff Logins
            </Link>{' '}
            page, and move stock between branches with{' '}
            <Link href="/admin/stock-transfers" className="font-semibold underline">
              Stock Transfers
            </Link>
            .
          </HelpBox>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-3 mb-4 sm:mb-6">
          <StatTile icon={<Building2 className="h-3 w-3 sm:h-4 sm:w-4 text-honey-600" />} bg="bg-honey-50" value={stats.total} label="Branches" />
          <StatTile icon={<CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />} bg="bg-green-50" value={stats.active} label="Active" />
          <StatTile icon={<UsersIcon className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />} bg="bg-blue-50" value={stats.staff} label="Staff logins" />
        </div>

        {/* Search */}
        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="relative">
            <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, code, address or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputClass} pl-8 sm:pl-10 pr-8`}
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <LoadingCard text="Loading branches…" />
        ) : error ? (
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-red-200 text-center py-10 px-4">
            <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
            <p className="text-sm text-red-700 mb-4">{error}</p>
            <button onClick={load} className={primaryBtn}>
              Try again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 text-center py-10 sm:py-14">
            <Building2 className="h-10 w-10 sm:h-12 sm:w-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-1">No branches found</h3>
            <p className="text-sm text-gray-500">{search ? 'Try a different search.' : 'Click "Add Branch" to add your first branch.'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {filtered.map((b) => (
              <div
                key={b.id}
                className={`bg-white rounded-lg sm:rounded-xl shadow-sm border overflow-hidden transition-all hover:shadow-md ${
                  b.isMain ? 'border-honey-300' : 'border-gray-200'
                } ${b.isActive ? '' : 'opacity-75'}`}
              >
                <div className="p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex items-center justify-center h-10 w-10 rounded-lg flex-shrink-0 ${
                        b.isMain ? 'bg-honey-500 text-white' : 'bg-honey-50 text-honey-600'
                      }`}
                    >
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-semibold text-gray-900 truncate">{b.name}</h3>
                        <span className="px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-gray-100 text-gray-700 rounded">{b.code}</span>
                        {b.isMain && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold bg-honey-100 text-honey-700 rounded">
                            <Star className="h-2.5 w-2.5" /> MAIN
                          </span>
                        )}
                        {b.isActive ? (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-100 text-green-700 rounded">Active</span>
                        ) : (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-200 text-gray-600 rounded">Inactive</span>
                        )}
                      </div>
                      <div className="mt-2 space-y-1 text-xs text-gray-600">
                        <p className="flex items-start gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-gray-400 mt-px flex-shrink-0" />
                          <span className="line-clamp-2">{b.address || <span className="text-gray-400">No address</span>}</span>
                        </p>
                        <p className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                          {b.phone || <span className="text-gray-400">No phone</span>}
                        </p>
                        {b.staffCount !== undefined && (
                          <p className="flex items-center gap-1.5">
                            <UsersIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                            {b.staffCount} staff login{b.staffCount === 1 ? '' : 's'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {isSuperAdmin && (
                  <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-2.5 bg-gray-50 border-t border-gray-100">
                    {!b.isMain && b.isActive ? (
                      <button
                        onClick={() => handleSetMain(b)}
                        disabled={busyId === b.id}
                        className="text-xs font-medium text-honey-700 hover:text-honey-800 inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        <Star className="h-3.5 w-3.5" /> Make main
                      </button>
                    ) : (
                      <span className="text-[11px] text-gray-400">{b.isMain ? 'Main branch' : 'Inactive branch'}</span>
                    )}
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => setModal({ open: true, branch: b })}
                        className="p-1.5 rounded-md text-gray-400 hover:text-honey-600 hover:bg-honey-50 transition-colors"
                        title="Edit branch"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(b)}
                        disabled={b.isMain || busyId === b.id}
                        className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        title={b.isMain ? 'The main branch cannot be deleted' : 'Delete branch'}
                      >
                        {busyId === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {modal.open && (
        <BranchFormModal
          branch={modal.branch}
          suggestedCode={`B${branches.length + 1}`}
          onClose={() => setModal({ open: false, branch: null })}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function BranchFormModal({
  branch,
  suggestedCode,
  onClose,
  onSave,
}: {
  branch: Branch | null;
  suggestedCode: string;
  onClose: () => void;
  onSave: (payload: BranchPayload) => Promise<void>;
}) {
  const [name, setName] = useState(branch?.name ?? '');
  const [code, setCode] = useState(branch?.code ?? suggestedCode);
  const [address, setAddress] = useState(branch?.address ?? '');
  const [phone, setPhone] = useState(branch?.phone ?? '');
  const [isActive, setIsActive] = useState(branch?.isActive ?? true);
  const [isMain, setIsMain] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!name.trim()) return setError('Please enter the branch name.');
    if (!code.trim()) return setError('Please enter a short code, e.g. B2.');
    try {
      setSaving(true);
      setError(null);
      await onSave({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        address: address.trim(),
        phone: phone.trim(),
        isActive,
        ...(branch ? {} : { isMain }),
      });
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save the branch.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={branch ? 'Edit Branch' : 'Add Branch'}
      subtitle={branch ? branch.name : 'A new shop location'}
      icon={<Building2 className="h-5 w-5" />}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className={secondaryBtn}>
            Cancel
          </button>
          <button type="button" onClick={() => submit()} disabled={saving} className={primaryBtn}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {branch ? 'Save' : 'Add Branch'}
          </button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <ErrorBox message={error} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <Field label="Branch name" required>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Branch 2 - Main Bazaar" className={inputClass} autoFocus />
            </Field>
          </div>
          <Field label="Short code" required hint="Letters/numbers, e.g. B2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="B2"
              maxLength={20}
              className={`${inputClass} font-mono uppercase`}
            />
          </Field>
        </div>
        <Field label="Address">
          <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} placeholder="Shop address" className={`${inputClass} resize-none`} />
        </Field>
        <Field label="Phone">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03xx xxxxxxx" className={inputClass} />
        </Field>
        <div className="space-y-3 pt-1">
          <Toggle
            checked={isActive}
            onChange={setIsActive}
            disabled={!!branch?.isMain}
            label="Branch is open (active)"
            hint={branch?.isMain ? 'The main branch is always active.' : 'Inactive branches are hidden from the branch picker and cannot sell.'}
          />
          {!branch && (
            <Toggle
              checked={isMain}
              onChange={setIsMain}
              label="Make this the main branch"
              hint='The main branch is used when "All branches" is picked and you sell or receive stock.'
            />
          )}
        </div>
        {branch && !branch.isActive && (
          <p className="flex items-center gap-1.5 text-[11px] text-gray-500">
            <XCircle className="h-3.5 w-3.5" /> This branch is closed right now.
          </p>
        )}
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

const StatTile: React.FC<{ icon: React.ReactNode; bg: string; value: number; label: string }> = ({ icon, bg, value, label }) => (
  <div className="bg-white rounded-lg border border-gray-200 p-1.5 sm:p-3">
    <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2">
      <div className={`p-1 sm:p-1.5 rounded-md ${bg}`}>{icon}</div>
      <div className="text-center sm:text-left">
        <p className="text-sm sm:text-lg font-semibold text-gray-900 tabular-nums">{value}</p>
        <p className="text-[8px] sm:text-[10px] text-gray-500">{label}</p>
      </div>
    </div>
  </div>
);
