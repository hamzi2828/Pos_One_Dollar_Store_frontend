'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import {
  Shield,
  Plus,
  Search,
  X,
  Edit2,
  Trash2,
  Users as UsersIcon,
  Key,
  Check,
  Lock,
  ChevronRight,
  Package,
  Loader2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { type Role } from './rolesStore';
import { roleService } from './service/roleService';
import { usePermissionCatalogue } from './useCatalogue';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage } from '@/helper/access';

export default function RolesPage() {
  const { isSuperAdmin } = useAccess();
  const { groups: catalogueGroups } = usePermissionCatalogue();
  const totalPossible = catalogueGroups.reduce((a, g) => a + g.actions.length, 0);
  const [roles, setRoles] = useState<Role[]>([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const deleteLockRef = useRef(false);
  const [addingDefaults, setAddingDefaults] = useState(false);
  const defaultsLockRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchRoles = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      setLoading(true);
      setError(null);
      const { items } = await roleService.getRoles({ limit: 200 }, controller.signal);
      setRoles(items);
    } catch (e: unknown) {
      if (axios.isCancel(e)) return;
      console.error(e);
      setError('Failed to load roles. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
    return () => abortRef.current?.abort();
  }, [fetchRoles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter(
      (r) => r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q),
    );
  }, [roles, search]);

  const stats = useMemo(() => {
    const totalPerms = roles.reduce(
      (sum, r) => sum + Object.values(r.permissions).reduce((a, b) => a + b.length, 0),
      0,
    );
    return {
      total: roles.length,
      system: roles.filter((r) => r.isSystem).length,
      custom: roles.filter((r) => !r.isSystem).length,
      totalPerms,
    };
  }, [roles]);

  /** Adds the ready-made shop roles that are missing, then reloads the list. */
  const addDefaultRoles = async () => {
    if (defaultsLockRef.current) return;
    defaultsLockRef.current = true;
    setAddingDefaults(true);
    try {
      const { created, skipped } = await roleService.createDefaultRoles();
      if (created.length) {
        toast.success(
          `Added: ${created.join(', ')}${skipped.length ? `. Already there: ${skipped.join(', ')}` : ''}.`,
          { duration: 6000 },
        );
      } else {
        toast.success(
          skipped.length ? `All default roles are already there (${skipped.join(', ')}).` : 'Nothing to add.',
          { duration: 5000 },
        );
      }
      await fetchRoles();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not add the default roles.'), { duration: 6000 });
    } finally {
      defaultsLockRef.current = false;
      setAddingDefaults(false);
    }
  };

  const openCreate = () => {
    setEditingRole(null);
    setModalOpen(true);
  };

  const openEdit = (role: Role) => {
    setEditingRole(role);
    setModalOpen(true);
  };

  const handleDelete = async (role: Role) => {
    if (role.isSystem || deleteLockRef.current) return;
    if (typeof window === 'undefined' || !window.confirm(`Delete role "${role.name}"?`)) return;
    if (deleteLockRef.current) return;
    deleteLockRef.current = true;
    try {
      setDeletingId(role.id);
      await roleService.deleteRole(role.id);
      setRoles((all) => all.filter((r) => r.id !== role.id));
    } catch (e) {
      console.error(e);
      const msg = axios.isAxiosError(e) ? e.response?.data?.message : undefined;
      alert(msg || 'Failed to delete role.');
    } finally {
      deleteLockRef.current = false;
      setDeletingId(null);
    }
  };

  const handleSave = async (data: { name: string; description: string }) => {
    try {
      if (editingRole) {
        const updated = await roleService.updateRole(editingRole.id, data);
        setRoles((all) => all.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
      } else {
        const created = await roleService.createRole(data);
        setRoles((all) => [created, ...all]);
      }
      setModalOpen(false);
      setEditingRole(null);
    } catch (e) {
      console.error(e);
      const msg = axios.isAxiosError(e) ? e.response?.data?.message : undefined;
      throw new Error(msg || 'Failed to save role.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Header */}
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Roles & Permissions</h1>
            <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-500">
              A role is a set of things a staff login may do (for example Manager or Cashier). Create a role,
              click it to tick its permissions, then give it to staff on the Staff Logins page.
            </p>
            {!isSuperAdmin && (
              <p className="mt-1 text-xs text-amber-700">Only the super admin can change roles. You can only look.</p>
            )}
          </div>
          {isSuperAdmin && (
            <div className="flex flex-col sm:flex-row gap-2 sm:flex-shrink-0">
              <button
                type="button"
                onClick={addDefaultRoles}
                disabled={addingDefaults}
                aria-busy={addingDefaults}
                title="Adds Manager, Cashier, Warehouse Assistant and Purchaser if they are missing"
                className="inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-sm font-semibold text-honey-700 bg-white border border-honey-300 rounded-lg hover:bg-honey-50 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {addingDefaults ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                <span>{addingDefaults ? 'Adding…' : 'Add default roles'}</span>
              </button>
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-sm font-semibold text-gray-900 bg-honey-500 rounded-lg hover:bg-honey-600 transition-all duration-200 shadow-md hover:shadow-lg"
              >
                <Plus className="h-4 w-4" />
                <span>Create Role</span>
              </button>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 sm:gap-3 mb-4 sm:mb-6">
          <StatTile
            icon={<Shield className="h-3 w-3 sm:h-4 sm:w-4 text-honey-700" />}
            bg="bg-honey-50"
            value={stats.total}
            label="Total Roles"
          />
          <StatTile
            icon={<Lock className="h-3 w-3 sm:h-4 sm:w-4 text-purple-600" />}
            bg="bg-purple-50"
            value={stats.system}
            label="System Roles"
          />
          <StatTile
            icon={<Key className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />}
            bg="bg-blue-50"
            value={stats.custom}
            label="Custom Roles"
          />
          <StatTile
            icon={<Check className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />}
            bg="bg-green-50"
            value={stats.totalPerms}
            label="Permissions Assigned"
          />
        </div>

        {/* Search */}
        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="relative">
            <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search roles by name or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 sm:pl-10 pr-8 sm:pr-10 py-2 sm:py-2.5 text-xs sm:text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-honey-500/30 focus:border-honey-500 transition-all duration-200 placeholder:text-gray-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* States */}
        {loading ? (
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 text-center py-14">
            <Loader2 className="h-8 w-8 text-honey-700 mx-auto mb-3 animate-spin" />
            <p className="text-sm text-gray-500">Loading roles…</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-red-200 text-center py-10">
            <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
            <p className="text-sm text-red-700 mb-4">{error}</p>
            <button
              onClick={fetchRoles}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-900 bg-honey-500 rounded-lg hover:bg-honey-600"
            >
              Try again
            </button>
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {filtered.map((role) => (
              <RoleCard
                key={role.id}
                role={role}
                totalPossible={totalPossible}
                canManage={isSuperAdmin}
                deleting={deletingId === role.id}
                onEdit={() => openEdit(role)}
                onDelete={() => handleDelete(role)}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 text-center py-10 sm:py-14">
            <Shield className="h-10 w-10 sm:h-12 sm:w-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-1">No roles found</h3>
            <p className="text-sm text-gray-500">
              {search
                ? 'Try a different search term.'
                : isSuperAdmin
                  ? 'Click "Add default roles" for Manager, Cashier, Warehouse Assistant and Purchaser, or "Create Role".'
                  : 'No roles yet.'}
            </p>
          </div>
        )}
      </div>

      {modalOpen && (
        <RoleFormModal
          role={editingRole}
          onClose={() => {
            setModalOpen(false);
            setEditingRole(null);
          }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

/* ---------------- Role Card ---------------- */
const RoleCard: React.FC<{
  role: Role;
  totalPossible: number;
  canManage: boolean;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ role, totalPossible, canManage, deleting, onEdit, onDelete }) => {
  const permCount = Object.values(role.permissions).reduce((a, b) => a + b.length, 0);
  const moduleCount = Object.keys(role.permissions).filter(
    (k) => role.permissions[k]?.length > 0,
  ).length;
  const coverage = totalPossible === 0 ? 0 : Math.min(100, Math.round((permCount / totalPossible) * 100));

  return (
    <div className="group bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md hover:border-honey-300 transition-all">
      <Link href={`/admin/roles/${role.id}`} className="block p-4 sm:p-5 cursor-pointer">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div
              className={`flex items-center justify-center h-10 w-10 rounded-lg flex-shrink-0 ${
                role.isSystem ? 'bg-purple-50 text-purple-600' : 'bg-honey-50 text-honey-700'
              }`}
            >
              {role.isSystem ? <Lock className="h-5 w-5" /> : <Shield className="h-5 w-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-gray-900 truncate group-hover:text-honey-700 transition-colors">
                  {role.name}
                </h3>
                {role.isSystem && (
                  <span className="px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-700 rounded">
                    SYSTEM
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5 line-clamp-2">
                {role.description || 'No description'}
              </p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-honey-700 flex-shrink-0 transition-colors" />
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
            <span>Permission coverage</span>
            <span className="font-semibold text-gray-700 tabular-nums">{coverage}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                coverage === 100
                  ? 'bg-green-500'
                  : coverage >= 50
                  ? 'bg-honey-500'
                  : coverage > 0
                  ? 'bg-blue-500'
                  : 'bg-gray-200'
              }`}
              style={{ width: `${coverage}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-4 pt-4 border-t border-gray-100">
          <MiniStat icon={<UsersIcon className="h-3.5 w-3.5" />} value={role.userCount} label="Users" />
          <MiniStat icon={<Package className="h-3.5 w-3.5" />} value={moduleCount} label="Modules" />
          <MiniStat icon={<Key className="h-3.5 w-3.5" />} value={permCount} label="Permissions" />
        </div>
      </Link>

      <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 bg-gray-50 border-t border-gray-100">
        <Link
          href={`/admin/roles/${role.id}`}
          className="text-xs font-medium text-honey-700 hover:text-honey-800 inline-flex items-center gap-1"
        >
          {canManage && !role.isSystem ? 'Manage permissions' : 'View permissions'}
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
        {canManage && (
        <div className="flex items-center gap-0.5">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEdit();
            }}
            disabled={role.isSystem || deleting}
            className="p-1.5 rounded-md text-gray-400 hover:text-honey-700 hover:bg-honey-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title={role.isSystem ? 'System role cannot be edited' : 'Rename role'}
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete();
            }}
            disabled={role.isSystem || deleting}
            aria-busy={deleting}
            className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title={role.isSystem ? 'System role cannot be deleted' : deleting ? 'Deleting…' : 'Delete role'}
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        </div>
        )}
      </div>
    </div>
  );
};

/* ---------------- Create/Rename Modal ---------------- */
const RoleFormModal: React.FC<{
  role: Role | null;
  onClose: () => void;
  onSave: (data: { name: string; description: string }) => Promise<void>;
}> = ({ role, onClose, onSave }) => {
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const saveLockRef = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saveLockRef.current) return;
    if (!name.trim()) {
      setError('Role name is required.');
      return;
    }
    saveLockRef.current = true;
    try {
      setSaving(true);
      setError(null);
      await onSave({ name: name.trim(), description: description.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save role.');
    } finally {
      saveLockRef.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-honey-50 text-honey-700">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">
                {role ? 'Rename Role' : 'Create New Role'}
              </h2>
              <p className="text-xs text-gray-500">
                {role ? 'Update the role details.' : 'You can assign permissions after creating.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5">
          <fieldset disabled={saving} className="min-w-0 space-y-4">
          {error && (
            <div className="px-3 py-2 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Role Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              autoFocus
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. Store Manager"
              className="w-full px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-honey-500/30 focus:border-honey-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short summary of what this role is for..."
              rows={3}
              className="w-full px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-honey-500/30 focus:border-honey-500 transition-all resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              aria-busy={saving}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-900 bg-honey-500 rounded-lg hover:bg-honey-600 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {saving ? (role ? 'Saving…' : 'Creating…') : role ? 'Save' : 'Create Role'}
            </button>
          </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
};

/* ---------------- Small helpers ---------------- */
const StatTile: React.FC<{ icon: React.ReactNode; bg: string; value: number; label: string }> = ({
  icon,
  bg,
  value,
  label,
}) => (
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

const MiniStat: React.FC<{ icon: React.ReactNode; value: number; label: string }> = ({
  icon,
  value,
  label,
}) => (
  <div className="flex items-center gap-2">
    <div className="flex items-center justify-center h-7 w-7 rounded-md bg-gray-50 text-gray-500 border border-gray-100">
      {icon}
    </div>
    <div>
      <p className="text-sm font-semibold text-gray-900 tabular-nums leading-tight">{value}</p>
      <p className="text-[10px] text-gray-500 leading-tight">{label}</p>
    </div>
  </div>
);
