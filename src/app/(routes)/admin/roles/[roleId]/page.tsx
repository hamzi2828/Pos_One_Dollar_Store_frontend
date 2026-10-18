'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import {
  Shield,
  ArrowLeft,
  Check,
  Lock,
  LayoutDashboard,
  Package,
  Users as UsersIcon,
  FileText,
  Settings,
  Save,
  RotateCcw,
  AlertCircle,
  Key,
  BarChart3,
  Wallet,
  Briefcase,
  ChevronDown,
  Loader2,
  Truck,
  Warehouse,
} from 'lucide-react';
import {
  type Role,
  type PermissionAction,
  type PermissionSection,
  ACTION_COLORS,
} from '../rolesStore';
import { roleService } from '../service/roleService';
import { usePermissionCatalogue } from '../useCatalogue';
import { useAccess } from '@/context/AccessContext';

const SECTION_ICONS: Record<string, React.ReactNode> = {
  main: <LayoutDashboard className="h-4 w-4" />,
  reports: <BarChart3 className="h-4 w-4" />,
  products: <Package className="h-4 w-4" />,
  customers: <UsersIcon className="h-4 w-4" />,
  content: <FileText className="h-4 w-4" />,
  finance: <Wallet className="h-4 w-4" />,
  hr: <Briefcase className="h-4 w-4" />,
  system: <Settings className="h-4 w-4" />,
  purchasing: <Truck className="h-4 w-4" />,
  inventory: <Warehouse className="h-4 w-4" />,
};

export default function RolePermissionsPage() {
  const params = useParams();
  const router = useRouter();
  const roleId = String(params?.roleId ?? '');
  const { isSuperAdmin } = useAccess();
  // Live catalogue (sections -> groups -> actions) from the backend.
  const { sections: PERMISSION_SECTIONS, groups: PERMISSION_GROUPS } = usePermissionCatalogue();

  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [permissions, setPermissions] = useState<Record<string, PermissionAction[]>>({});
  const [initialSnapshot, setInitialSnapshot] = useState<string>('{}');
  const [saveFlash, setSaveFlash] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const abortRef = useRef<AbortController | null>(null);
  const saveLockRef = useRef(false);

  const fetchRole = useCallback(async () => {
    if (!roleId) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      setLoading(true);
      setLoadError(null);
      const fetched = await roleService.getRole(roleId, controller.signal);
      setRole(fetched);
      const perms = fetched?.permissions || {};
      setPermissions(perms);
      setInitialSnapshot(JSON.stringify(perms));
    } catch (e: unknown) {
      if (axios.isCancel(e)) return;
      if (axios.isAxiosError(e) && e.response?.status === 404) {
        setRole(null);
      } else {
        console.error(e);
        setLoadError('Failed to load role.');
      }
    } finally {
      setLoading(false);
    }
  }, [roleId]);

  useEffect(() => {
    fetchRole();
    return () => abortRef.current?.abort();
  }, [fetchRole]);

  const dirty = useMemo(
    () => JSON.stringify(permissions) !== initialSnapshot,
    [permissions, initialSnapshot],
  );

  // Count only keys/actions that exist in the catalogue.
  const totalSelected = PERMISSION_GROUPS.reduce(
    (a, g) => a + (permissions[g.key] || []).filter((x) => g.actions.includes(x)).length,
    0,
  );
  const totalPossible = PERMISSION_GROUPS.reduce((a, g) => a + g.actions.length, 0);
  const coverage = totalPossible === 0 ? 0 : Math.round((totalSelected / totalPossible) * 100);

  const locked = !!role?.isSystem || !isSuperAdmin;

  const toggleAction = (groupKey: string, action: PermissionAction) => {
    if (locked || saveLockRef.current) return;
    setPermissions((prev) => {
      const current = prev[groupKey] || [];
      const exists = current.includes(action);
      const next = exists ? current.filter((a) => a !== action) : [...current, action];
      return { ...prev, [groupKey]: next };
    });
  };

  const toggleAllInGroup = (groupKey: string) => {
    if (locked) return;
    const group = PERMISSION_GROUPS.find((g) => g.key === groupKey);
    if (!group) return;
    setPermissions((prev) => {
      const current = prev[groupKey] || [];
      const allSelected = group.actions.every((a) => current.includes(a));
      return { ...prev, [groupKey]: allSelected ? [] : [...group.actions] };
    });
  };

  const toggleAllInSection = (section: PermissionSection) => {
    if (locked) return;
    setPermissions((prev) => {
      const allFull = section.groups.every((g) => {
        const cur = prev[g.key] || [];
        return g.actions.every((a) => cur.includes(a));
      });
      const next = { ...prev };
      section.groups.forEach((g) => {
        next[g.key] = allFull ? [] : [...g.actions];
      });
      return next;
    });
  };

  const toggleSectionCollapsed = (key: string) => {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const selectAll = () => {
    if (locked) return;
    setPermissions(
      PERMISSION_GROUPS.reduce<Record<string, PermissionAction[]>>((acc, g) => {
        acc[g.key] = [...g.actions];
        return acc;
      }, {}),
    );
  };

  const clearAll = () => {
    if (locked) return;
    setPermissions({});
  };

  const resetChanges = () => {
    try {
      setPermissions(JSON.parse(initialSnapshot));
    } catch {
      setPermissions({});
    }
  };

  const handleSave = async () => {
    if (!role || locked || saving || saveLockRef.current) return;
    saveLockRef.current = true;
    try {
      setSaving(true);
      setSaveError(null);
      const updated = await roleService.updatePermissions(role.id, permissions);
      setRole(updated);
      setPermissions(updated.permissions || {});
      setInitialSnapshot(JSON.stringify(updated.permissions || {}));
      setSaveFlash(true);
      setTimeout(() => setSaveFlash(false), 1800);
    } catch (e: unknown) {
      console.error(e);
      const msg = axios.isAxiosError(e) ? e.response?.data?.message : undefined;
      setSaveError(msg || 'Failed to save permissions.');
    } finally {
      saveLockRef.current = false;
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 text-center">
          <Loader2 className="h-8 w-8 text-honey-700 mx-auto mb-3 animate-spin" />
          <p className="text-sm text-gray-500">Loading role…</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-xl border border-red-200 p-8 text-center">
            <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-gray-900 mb-1">{loadError}</h2>
            <button
              onClick={fetchRole}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-900 bg-honey-500 rounded-lg hover:bg-honey-600 transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Role not found</h2>
            <p className="text-sm text-gray-500 mb-5">
              This role may have been deleted or the link is invalid.
            </p>
            <button
              onClick={() => router.push('/admin/roles')}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-900 bg-honey-500 rounded-lg hover:bg-honey-600 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Roles
            </button>
          </div>
        </div>
      </div>
    );
  }

  const readOnly = locked;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1400px] mx-auto px-3 sm:px-5 lg:px-8 py-4 sm:py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
          <Link href="/admin/roles" className="hover:text-honey-700 transition-colors">
            Roles
          </Link>
          <span>/</span>
          <span className="text-gray-700 font-medium truncate">{role.name}</span>
        </div>

        {/* Header */}
        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5 mb-4 sm:mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
              <Link
                href="/admin/roles"
                className="flex items-center justify-center h-9 w-9 rounded-lg text-gray-400 hover:text-honey-700 hover:bg-honey-50 border border-gray-200 hover:border-honey-200 transition-colors flex-shrink-0"
                title="Back to roles"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div
                className={`flex items-center justify-center h-11 w-11 rounded-lg flex-shrink-0 ${
                  role.isSystem ? 'bg-purple-50 text-purple-600' : 'bg-honey-50 text-honey-700'
                }`}
              >
                {role.isSystem ? <Lock className="h-5 w-5" /> : <Shield className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
                    {role.name}
                  </h1>
                  {role.isSystem && (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-700 rounded">
                      SYSTEM
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-gray-500 mt-0.5 line-clamp-2">
                  {role.description || 'No description provided.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {dirty && !readOnly && (
                <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-md">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Unsaved changes
                </span>
              )}
              {saveFlash && (
                <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-green-700 bg-green-50 border border-green-200 rounded-md">
                  <Check className="h-3 w-3" />
                  Saved
                </span>
              )}
              <button
                onClick={resetChanges}
                disabled={!dirty || readOnly || saving}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </button>
              <button
                onClick={handleSave}
                disabled={!dirty || readOnly || saving}
                aria-busy={saving}
                className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-gray-900 bg-honey-500 rounded-lg hover:bg-honey-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                )}
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>

          {readOnly && (
            <div className="mt-4 flex items-start gap-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <Lock className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-purple-700">
                {role.isSystem
                  ? 'This is the built-in Admin role. It can do everything and cannot be changed.'
                  : 'Only the super admin can change permissions. You can only look.'}
              </p>
            </div>
          )}
          {!readOnly && (
            <p className="mt-3 text-[11px] sm:text-xs text-gray-500">
              Tick what staff with this role may do. <strong>View</strong> = open the page,{' '}
              <strong>Create</strong> = add new, <strong>Edit</strong> = change, <strong>Delete</strong> = remove,{' '}
              <strong>Export</strong> = download. Changes apply to everyone with this role within about a minute.
            </p>
          )}

          {saveError && (
            <div className="mt-4 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-700">{saveError}</p>
            </div>
          )}
        </div>

        {/* Coverage Summary */}
        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5 mb-4 sm:mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center h-8 w-8 rounded-md bg-honey-50 text-honey-700">
                <Key className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Permission Coverage</p>
                <p className="text-[11px] text-gray-500">
                  {totalSelected} of {totalPossible} permissions granted
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={selectAll}
                disabled={readOnly || saving}
                className="px-2.5 py-1 text-[11px] font-medium text-honey-700 bg-honey-50 rounded-md hover:bg-honey-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Select all
              </button>
              <button
                onClick={clearAll}
                disabled={readOnly || saving}
                className="px-2.5 py-1 text-[11px] font-medium text-gray-600 bg-gray-50 rounded-md hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
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
          <p className="text-right text-[10px] text-gray-500 mt-1 tabular-nums">{coverage}%</p>
        </div>

        {/* Sections (mirror the sidebar structure) */}
        <div className="space-y-4 sm:space-y-5">
          {PERMISSION_SECTIONS.map((section) => {
            const sectionTotalActions = section.groups.reduce((a, g) => a + g.actions.length, 0);
            const sectionGranted = section.groups.reduce(
              (a, g) => a + (permissions[g.key]?.length || 0),
              0,
            );
            const allFull = section.groups.every((g) => {
              const cur = permissions[g.key] || [];
              return g.actions.every((a) => cur.includes(a));
            });
            const sectionHasAny = sectionGranted > 0;
            const isCollapsed = !!collapsedSections[section.key];

            return (
              <section
                key={section.key}
                className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 overflow-hidden"
              >
                {/* Section Heading — styled like sidebar section headers */}
                <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 sm:py-3.5 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
                  <button
                    type="button"
                    onClick={() => toggleSectionCollapsed(section.key)}
                    className="flex items-center gap-2.5 min-w-0 flex-1 text-left group"
                    aria-expanded={!isCollapsed}
                  >
                    <span
                      className={`flex items-center justify-center w-7 h-7 rounded-md transition-colors flex-shrink-0 ${
                        sectionHasAny
                          ? 'bg-honey-500 text-gray-900'
                          : 'bg-white text-gray-400 border border-gray-200 group-hover:text-honey-700 group-hover:border-honey-300'
                      }`}
                    >
                      {SECTION_ICONS[section.iconKey] ?? <Settings className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0">
                      <h2 className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.08em] text-gray-700 truncate">
                        {section.label}
                      </h2>
                      <p className="text-[10px] sm:text-[11px] text-gray-500 tabular-nums mt-0.5">
                        {sectionGranted}/{sectionTotalActions} permissions ·{' '}
                        {section.groups.length} {section.groups.length === 1 ? 'tab' : 'tabs'}
                      </p>
                    </div>
                    <ChevronDown
                      className={`ml-1 h-4 w-4 text-gray-400 transition-transform ${
                        isCollapsed ? '-rotate-90' : ''
                      }`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleAllInSection(section)}
                    disabled={readOnly || saving}
                    className={`px-3 py-1.5 text-[11px] font-medium rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 ${
                      allFull
                        ? 'bg-honey-500 text-gray-900 hover:bg-honey-600'
                        : sectionHasAny
                        ? 'bg-honey-50 text-honey-700 hover:bg-honey-100 border border-honey-200'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    {allFull ? 'All selected' : sectionHasAny ? 'Partial' : 'Select all'}
                  </button>
                </div>

                {/* Section Tabs/Groups — dense grid, more cards per row */}
                {!isCollapsed && (
                  <div className="p-3 sm:p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5 sm:gap-3">
                    {section.groups.map((group) => {
                      const granted = permissions[group.key] || [];
                      const allSelected = group.actions.every((a) => granted.includes(a));
                      const someSelected = granted.length > 0 && !allSelected;

                      return (
                        <div
                          key={group.key}
                          className={`rounded-lg border transition-colors overflow-hidden ${
                            allSelected
                              ? 'border-honey-200 bg-honey-50/30'
                              : someSelected
                              ? 'border-gray-200 bg-white'
                              : 'border-gray-200 bg-gray-50/40'
                          }`}
                        >
                          {/* Tab header */}
                          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-100 bg-white/60">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={`inline-block h-2 w-2 rounded-full flex-shrink-0 ${
                                  allSelected
                                    ? 'bg-honey-500'
                                    : someSelected
                                    ? 'bg-honey-300'
                                    : 'bg-gray-300'
                                }`}
                              />
                              <p className="text-[13px] font-semibold text-gray-900 truncate">
                                {group.label}
                              </p>
                              <span className="text-[10px] font-medium text-gray-400 tabular-nums flex-shrink-0">
                                {granted.length}/{group.actions.length}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleAllInGroup(group.key)}
                              disabled={readOnly || saving}
                              className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 ${
                                allSelected
                                  ? 'bg-honey-500 text-gray-900 hover:bg-honey-600'
                                  : someSelected
                                  ? 'bg-honey-50 text-honey-700 hover:bg-honey-100 border border-honey-200'
                                  : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'
                              }`}
                            >
                              {allSelected ? 'Clear' : 'All'}
                            </button>
                          </div>

                          {/* Action chips — compact */}
                          <div className="flex flex-wrap gap-1.5 p-2.5">
                            {group.actions.map((action) => {
                              const active = granted.includes(action);
                              return (
                                <button
                                  key={action}
                                  type="button"
                                  onClick={() => toggleAction(group.key, action)}
                                  disabled={readOnly || saving}
                                  className={`inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium rounded-md border capitalize transition-all disabled:cursor-not-allowed ${
                                    active
                                      ? ACTION_COLORS[action] + ' shadow-sm'
                                      : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                                  } ${readOnly ? 'opacity-60' : ''}`}
                                >
                                  <span
                                    className={`flex items-center justify-center h-3 w-3 rounded-sm border flex-shrink-0 ${
                                      active ? 'bg-current border-current' : 'border-gray-300 bg-white'
                                    }`}
                                  >
                                    {active && (
                                      <Check className="h-2 w-2 text-white" strokeWidth={4} />
                                    )}
                                  </span>
                                  <span>{action}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        {/* Sticky bottom save bar */}
        {dirty && !readOnly && (
          <div className="sticky bottom-4 mt-6 flex items-center justify-between gap-2 p-3 bg-gray-900 text-white rounded-xl shadow-xl">
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <AlertCircle className="h-4 w-4 text-amber-400" />
              <span>You have unsaved changes.</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={resetChanges}
                disabled={saving}
                className="px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Discard
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                aria-busy={saving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-900 bg-white rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
