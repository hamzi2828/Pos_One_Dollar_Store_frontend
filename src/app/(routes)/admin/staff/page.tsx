'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  UserCog,
  Plus,
  Search,
  X,
  Edit2,
  Trash2,
  KeyRound,
  Loader2,
  AlertCircle,
  Crown,
  Shield,
  Check,
  Eye,
  EyeOff,
} from 'lucide-react';
import TablePagination from '@/components/admin/TablePagination';
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
import { assignableRoles as pickAssignableRoles, staffService, type StaffUser, type StaffPayload } from './services/staffService';
import { roleService } from '../roles/service/roleService';
import type { Role } from '../roles/rolesStore';
import { SearchSelect } from '@/components/ui/SearchSelect';

const MIN_PASSWORD = 8;

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return 'Never';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function StaffPage() {
  const { access, isSuperAdmin, can } = useAccess();
  const myId = access?.user?.id;
  const canView = can('staff', 'view');
  const canCreate = can('staff', 'create');
  const canEdit = can('staff', 'edit');
  const canDelete = can('staff', 'delete');

  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | 'true' | 'false'>('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  const [roles, setRoles] = useState<Role[]>([]);

  const [editing, setEditing] = useState<{ open: boolean; user: StaffUser | null }>({ open: false, user: null });
  const [resetFor, setResetFor] = useState<StaffUser | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyKind, setBusyKind] = useState<'delete' | 'status' | null>(null);
  // Row actions lock synchronously so a fast double click can't fire twice.
  const rowLockRef = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debounced, roleFilter, statusFilter, limit]);

  // Roles (for the filter and the form).
  useEffect(() => {
    if (!canView) return;
    roleService
      .getRoles({ limit: 200 })
      .then(({ items }) => setRoles(items))
      .catch(() => setRoles([]));
  }, [canView]);

  const load = useCallback(async () => {
    if (!canView) return;
    try {
      setLoading(true);
      setError(null);
      const { items, pagination: p } = await staffService.list({
        search: debounced,
        staffRole: roleFilter,
        isActive: statusFilter,
        page,
        limit,
      });
      setStaff(items);
      setPagination({ page: p.page || page, limit: p.limit || limit, total: p.total || 0, totalPages: p.totalPages || 0 });
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load staff logins.'));
    } finally {
      setLoading(false);
    }
  }, [canView, debounced, roleFilter, statusFilter, page, limit]);

  useEffect(() => {
    load();
  }, [load]);

  /** Roles this user may hand out (the backend checks again). */
  const assignableRoles = useMemo(() => pickAssignableRoles(roles, access, isSuperAdmin), [roles, isSuperAdmin, access]);

  const handleDelete = async (u: StaffUser) => {
    if (rowLockRef.current) return;
    if (!window.confirm(`Delete the login of ${u.name} (${u.email})?\n\nThey will not be able to sign in any more.`)) return;
    if (rowLockRef.current) return;
    rowLockRef.current = true;
    try {
      setBusyId(u.id);
      setBusyKind('delete');
      await staffService.remove(u.id);
      toast.success('Staff login deleted');
      await load();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not delete the staff login.'), { duration: 6000 });
    } finally {
      rowLockRef.current = false;
      setBusyId(null);
      setBusyKind(null);
    }
  };

  const handleToggleActive = async (u: StaffUser) => {
    if (rowLockRef.current) return;
    rowLockRef.current = true;
    try {
      setBusyId(u.id);
      setBusyKind('status');
      await staffService.update(u.id, { isActive: !u.isActive });
      toast.success(u.isActive ? 'Login turned off' : 'Login turned on');
      await load();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not change the status.'), { duration: 6000 });
    } finally {
      rowLockRef.current = false;
      setBusyId(null);
      setBusyKind(null);
    }
  };

  if (!canView) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <NoAccessCard />
      </div>
    );
  }

  const thClass = 'px-3 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-xs font-medium tracking-wider text-left text-gray-500 uppercase';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Header */}
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Staff Logins</h1>
            <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-500">
              Each staff member gets their own email + password and one role.
            </p>
          </div>
          {canCreate && (
            <button onClick={() => setEditing({ open: true, user: null })} className={primaryBtn}>
              <Plus className="h-4 w-4" />
              <span>Add Staff Login</span>
            </button>
          )}
        </div>

        <div className="mb-4 sm:mb-6">
          <HelpBox>
            What a staff login can do comes from its{' '}
            <Link href="/admin/roles" className="font-semibold underline">
              role
            </Link>{' '}
            (Manager, Cashier, Warehouse Assistant, Purchaser…). A <strong>super admin</strong> can do everything — give
            this only to the owner.
            <span className="block mt-1">
              Tip: create logins from an employee&apos;s{' '}
              <Link href="/admin/hr/employees" className="font-semibold underline">
                profile
              </Link>{' '}
              to link them.
            </span>
          </HelpBox>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-3">
            <div className="relative md:col-span-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search name, email, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`${inputClass} pl-8 pr-8`}
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <SearchSelect value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={inputClass} aria-label="Role">
              <option value="">All roles</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </SearchSelect>
            <SearchSelect
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as '' | 'true' | 'false')}
              className={inputClass}
              aria-label="Status"
            >
              <option value="">Active and inactive</option>
              <option value="true">Active only</option>
              <option value="false">Inactive only</option>
            </SearchSelect>
          </div>
        </div>

        {loading && staff.length === 0 ? (
          <LoadingCard text="Loading staff logins…" />
        ) : error ? (
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-red-200 text-center py-10 px-4">
            <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
            <p className="text-sm text-red-700 mb-4">{error}</p>
            <button onClick={load} className={primaryBtn}>
              Try again
            </button>
          </div>
        ) : (
          <div className="overflow-hidden bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className={thClass}>Staff</th>
                    <th className={thClass}>Role</th>
                    <th className={thClass}>Status</th>
                    <th className={thClass}>Last sign in</th>
                    <th className={`${thClass} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {staff.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500">
                        <UserCog className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                        No staff logins found.
                      </td>
                    </tr>
                  ) : (
                    staff.map((u) => {
                      const isMe = !!myId && u.id === myId;
                      const busy = busyId === u.id;
                      return (
                        <tr key={u.id} className={`hover:bg-gray-50 ${u.isActive ? '' : 'bg-gray-50/60'}`}>
                          <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div
                                className={`flex items-center justify-center w-9 h-9 rounded-full text-sm font-semibold flex-shrink-0 ${
                                  u.isSuperAdmin ? 'bg-purple-600 text-white' : 'bg-honey-500 text-gray-900'
                                }`}
                              >
                                {(u.firstName?.charAt(0) || u.email.charAt(0)).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                                  {u.name || u.email}
                                  {isMe && <span className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-600 rounded">You</span>}
                                </div>
                                <div className="text-xs text-gray-500">{u.email}</div>
                                {u.phone && <div className="text-[11px] text-gray-400">{u.phone}</div>}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                            {u.isSuperAdmin ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-purple-100 text-purple-700 rounded-full">
                                <Crown className="h-3 w-3" /> Super admin
                              </span>
                            ) : u.staffRole ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-honey-50 text-honey-700 border border-honey-200 rounded-full">
                                <Shield className="h-3 w-3" /> {u.staffRole.name || 'Role'}
                              </span>
                            ) : (
                              <span className="text-xs text-amber-700">No role</span>
                            )}
                          </td>
                          <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleToggleActive(u)}
                              disabled={!canEdit || isMe || busy}
                              aria-busy={busy && busyKind === 'status'}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full transition-colors disabled:cursor-not-allowed ${
                                busy ? 'opacity-60' : ''
                              } ${
                                u.isActive ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              }`}
                              title={canEdit && !isMe ? 'Click to turn this login on/off' : undefined}
                            >
                              {busy && busyKind === 'status' && <Loader2 className="h-3 w-3 animate-spin" />}
                              {busy && busyKind === 'status' ? 'Saving…' : u.isActive ? 'Active' : 'Inactive'}
                            </button>
                          </td>
                          <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-xs text-gray-500">{formatDate(u.lastLogin)}</td>
                          <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-right">
                            <div className="inline-flex items-center gap-0.5">
                              {canEdit && (isSuperAdmin || !isMe) && (
                                <>
                                  <button
                                    onClick={() => setEditing({ open: true, user: u })}
                                    disabled={busy}
                                    className="p-1.5 rounded-md text-gray-400 hover:text-honey-700 hover:bg-honey-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    title="Edit"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => setResetFor(u)}
                                    disabled={busy}
                                    className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    title="Set a new password"
                                  >
                                    <KeyRound className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                              {canDelete && !isMe && (
                                <button
                                  onClick={() => handleDelete(u)}
                                  disabled={busy}
                                  aria-busy={busy && busyKind === 'delete'}
                                  className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                  title={busy && busyKind === 'delete' ? 'Deleting…' : 'Delete login'}
                                >
                                  {busy && busyKind === 'delete' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <TablePagination
              page={pagination.page}
              pages={Math.max(1, pagination.totalPages)}
              total={pagination.total}
              limit={limit}
              onPageChange={setPage}
              onLimitChange={setLimit}
              label="staff logins"
              loading={loading}
            />
          </div>
        )}
      </div>

      {editing.open && (
        <StaffFormModal
          user={editing.user}
          isSuperAdmin={isSuperAdmin}
          roles={assignableRoles}
          onClose={() => setEditing({ open: false, user: null })}
          onSaved={async (msg) => {
            toast.success(msg);
            setEditing({ open: false, user: null });
            await load();
          }}
        />
      )}

      {resetFor && (
        <ResetPasswordModal
          user={resetFor}
          onClose={() => setResetFor(null)}
          onDone={() => {
            toast.success('New password saved. Tell the staff member their new password.');
            setResetFor(null);
          }}
        />
      )}
    </div>
  );
}

/* ---------------- Add / edit staff ---------------- */
function StaffFormModal({
  user,
  isSuperAdmin,
  roles,
  onClose,
  onSaved,
}: {
  user: StaffUser | null;
  isSuperAdmin: boolean;
  roles: Role[];
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const isEdit = !!user;
  const defaultRole =
    roles.find((r) => r.name.toLowerCase() === 'cashier')?.id || roles.find((r) => !r.isSystem)?.id || '';

  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [roleId, setRoleId] = useState<string>(user?.staffRole?.id ?? defaultRole);
  const [isActive, setIsActive] = useState(user?.isActive ?? true);
  const [makeSuper, setMakeSuper] = useState(user?.isSuperAdmin ?? false);
  const [saving, setSaving] = useState(false);
  const saveLockRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  // If the role list arrives after the modal opened, pick a default.
  useEffect(() => {
    if (!roleId && defaultRole && !isEdit) setRoleId(defaultRole);
  }, [defaultRole, roleId, isEdit]);

  const submit = async () => {
    if (saveLockRef.current) return;
    if (!firstName.trim() || !lastName.trim()) return setError('Please enter first and last name.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Please enter a valid email.');
    if (!isEdit && password.length < MIN_PASSWORD) return setError(`Password must be at least ${MIN_PASSWORD} characters.`);
    if (!makeSuper && !roleId) return setError('Please choose a role.');

    const payload: StaffPayload = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      isActive,
    };
    if (!isEdit) payload.password = password;
    if (makeSuper) {
      payload.isSuperAdmin = true;
    } else {
      payload.staffRole = roleId;
      if (isSuperAdmin) payload.isSuperAdmin = false;
    }

    saveLockRef.current = true;
    try {
      setSaving(true);
      setError(null);
      if (isEdit && user) {
        await staffService.update(user.id, payload);
        await onSaved('Staff login saved');
      } else {
        await staffService.create(payload);
        await onSaved('Staff login created. They can now sign in with this email and password.');
      }
    } catch (e) {
      // e.g. "Email already in use", "Only the super admin can assign a role with staff permission",
      // "This is the last active super admin..."
      setError(apiErrorMessage(e, 'Could not save the staff login.'));
    } finally {
      saveLockRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Modal
      title={isEdit ? 'Edit Staff Login' : 'Add Staff Login'}
      subtitle={isEdit ? user?.email : 'Create a sign-in for a staff member'}
      icon={<UserCog className="h-5 w-5" />}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className={secondaryBtn}>
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={saving} aria-busy={saving} className={primaryBtn}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? (isEdit ? 'Saving…' : 'Creating…') : isEdit ? 'Save' : 'Create Login'}
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <fieldset disabled={saving} className="min-w-0 space-y-4">
        <ErrorBox message={error} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="First name" required>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} autoFocus />
          </Field>
          <Field label="Last name" required>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
          </Field>
        </div>
        <Field label="Email (used to sign in)" required>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" className={inputClass} autoComplete="off" />
        </Field>
        {!isEdit && (
          <Field label="Password" required hint={`At least ${MIN_PASSWORD} characters. Tell it to the staff member.`}>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputClass} pr-10`}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>
        )}
        <Field label="Phone">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03xx xxxxxxx" className={inputClass} />
        </Field>

        {!makeSuper && (
          <Field label="Role" required hint="What this person may do.">
            <SearchSelect value={roleId} onChange={(e) => setRoleId(e.target.value)} className={inputClass}>
              <option value="">Choose a role…</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
              {user?.staffRole && !roles.some((r) => r.id === user.staffRole?.id) && (
                <option value={user.staffRole.id}>{user.staffRole.name}</option>
              )}
            </SearchSelect>
          </Field>
        )}

        <div className="space-y-3 pt-1">
          <Toggle
            checked={isActive}
            onChange={setIsActive}
            label="Login is active"
            hint="Turn off to stop this person signing in (their history stays)."
          />
          {isSuperAdmin && (
            <Toggle
              checked={makeSuper}
              onChange={setMakeSuper}
              label="Super admin"
              hint="Can do everything, including managing staff and roles. Only for the owner."
            />
          )}
        </div>
        <button type="submit" className="hidden" />
        </fieldset>
      </form>
    </Modal>
  );
}

/* ---------------- Reset password ---------------- */
function ResetPasswordModal({ user, onClose, onDone }: { user: StaffUser; onClose: () => void; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveLockRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (saveLockRef.current) return;
    if (password.length < MIN_PASSWORD) return setError(`Password must be at least ${MIN_PASSWORD} characters.`);
    if (password !== confirm) return setError('The two passwords are not the same.');
    saveLockRef.current = true;
    try {
      setSaving(true);
      setError(null);
      await staffService.resetPassword(user.id, password);
      onDone();
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not change the password.'));
    } finally {
      saveLockRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Set New Password"
      subtitle={`${user.name} · ${user.email}`}
      icon={<KeyRound className="h-5 w-5" />}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className={secondaryBtn}>
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={saving} aria-busy={saving} className={primaryBtn}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? 'Saving…' : 'Save Password'}
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <fieldset disabled={saving} className="min-w-0 space-y-4">
        <ErrorBox message={error} />
        <Field label="New password" required hint={`At least ${MIN_PASSWORD} characters.`}>
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputClass} pr-10`}
              autoComplete="new-password"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600"
              aria-label={show ? 'Hide password' : 'Show password'}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>
        <Field label="Type it again" required>
          <input type={show ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} autoComplete="new-password" />
        </Field>
        <button type="submit" className="hidden" />
        </fieldset>
      </form>
    </Modal>
  );
}
