'use client';

// "Staff login" card on the employee profile: shows the linked login (e-mail +
// role) or lets the owner / a manager create one for this employee in one step
// (POST /api/employees/:id/login). Unlink = DELETE /api/employees/:id/login.
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Check, Eye, EyeOff, KeyRound, Loader2, Shield, Unlink, Wand2 } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage } from '@/lib/storeApi';
import { ErrorBox, Field, Modal, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { SectionCard } from './EmployeeBits';
import { employeeApi, type Employee, type EmployeeLogin } from '../services/employeeApi';
import { roleService } from '../../../roles/service/roleService';
import type { Role } from '../../../roles/rolesStore';
import { assignableRoles } from '../../../staff/services/staffService';
import { SearchSelect } from '@/components/ui/SearchSelect';

const MIN_PASSWORD = 8;
// No look-alike characters (0/O, 1/l/I) so the password is easy to read out.
const PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

function generatePassword(length = 10): string {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => PASSWORD_CHARS[b % PASSWORD_CHARS.length]).join('');
}

const OBJECT_ID = /^[a-f0-9]{24}$/i;
const ACCOUNT_TYPES = ['admin', 'user', 'moderator'];

/** Role name of a linked login, whatever shape the API sent (populated, id or name). */
function loginRoleName(user: EmployeeLogin, roles: Role[]): string | null {
  const ref = user.staffRole ?? user.role;
  if (!ref) return null;
  if (typeof ref === 'object') {
    const id = ref._id || ref.id;
    return ref.name || roles.find((r) => r.id === id)?.name || null;
  }
  const byId = roles.find((r) => r.id === ref);
  if (byId) return byId.name;
  if (OBJECT_ID.test(ref) || ACCOUNT_TYPES.includes(ref)) return null;
  return ref;
}

/** Suggest a role from the designation, e.g. "Cashier" -> Cashier. */
function suggestRole(employee: Employee, roles: Role[]): string {
  const job = `${employee.designation || ''} ${employee.position || ''}`.toLowerCase();
  const find = (name: string) => roles.find((r) => r.name.toLowerCase() === name)?.id;
  const guess =
    (/cash/.test(job) && find('cashier')) ||
    (/purchas|buyer/.test(job) && find('purchaser')) ||
    (/warehouse|store ?keeper|stock|packer/.test(job) && find('warehouse assistant')) ||
    (/manager|supervisor/.test(job) && find('manager'));
  return guess || find('cashier') || roles.find((r) => !r.isSystem)?.id || roles[0]?.id || '';
}

export default function EmployeeLoginCard({ employee, onChange }: { employee: Employee; onChange: (e: Employee) => void }) {
  const { access, can, isSuperAdmin } = useAccess();
  const canManage = can('staff', 'create') && can('employees', 'edit');
  const canSeeStaff = can('staff', 'view');
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const lock = useRef(false);
  const user = employee.user || null;

  // Roles: for the role select and to show the linked login's role name.
  useEffect(() => {
    if (!canManage && !canSeeStaff) return;
    let live = true;
    setRolesLoading(true);
    roleService
      .getRoles({ limit: 200 })
      .then(({ items }) => live && setRoles(items))
      .catch(() => live && setRoles([]))
      .finally(() => live && setRolesLoading(false));
    return () => {
      live = false;
    };
  }, [canManage, canSeeStaff]);

  const giveable = useMemo(() => assignableRoles(roles, access, isSuperAdmin), [roles, access, isSuperAdmin]);
  const roleName = user ? loginRoleName(user, roles) : null;

  const unlink = async () => {
    if (!user || lock.current) return;
    if (
      !window.confirm(
        `Unlink the login ${user.email} from ${employee.name}?\n\nThe login itself is not deleted — to stop them signing in, turn it off on the Staff Logins page.`,
      )
    )
      return;
    lock.current = true;
    setUnlinking(true);
    try {
      const updated = await employeeApi.unlinkLogin(employee._id);
      onChange(updated?._id ? updated : { ...employee, user: null });
      toast.success('Login unlinked');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not unlink the login.'), { duration: 6000 });
    } finally {
      lock.current = false;
      setUnlinking(false);
    }
  };

  return (
    <SectionCard
      title="Staff login"
      icon={<KeyRound className="h-4 w-4" />}
      action={
        canSeeStaff ? (
          <Link href="/admin/staff" className="text-xs font-medium text-honey-700 hover:text-honey-800">
            Staff logins
          </Link>
        ) : undefined
      }
    >
      {user ? (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 break-all">{user.email}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              {roleName ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 font-medium bg-honey-50 text-honey-700 border border-honey-200 rounded-full">
                  <Shield className="h-3 w-3" /> {roleName}
                </span>
              ) : rolesLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
              ) : null}
              {user.isActive === false ? (
                <span className="text-amber-700">Login turned off</span>
              ) : (
                <span className="text-green-700">Can sign in</span>
              )}
            </div>
          </div>
          {canManage && (
            <button type="button" onClick={unlink} disabled={unlinking} aria-busy={unlinking} className={`${secondaryBtn} self-start sm:self-auto`}>
              {unlinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />} {unlinking ? 'Unlinking…' : 'Unlink'}
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm text-gray-500">
            No login yet
            {canManage ? ' — create one so this person can sign in with their own e-mail and password.' : '.'}
          </p>
          {canManage && (
            <button type="button" onClick={() => setOpen(true)} className={`${primaryBtn} self-start sm:self-auto`}>
              <KeyRound className="h-4 w-4" /> Create login
            </button>
          )}
        </div>
      )}

      {open && (
        <CreateLoginModal
          employee={employee}
          roles={giveable}
          rolesLoading={rolesLoading}
          onClose={() => setOpen(false)}
          onCreated={(updated, email) => {
            setOpen(false);
            onChange(updated);
            toast.success(`Login created. ${employee.firstName || employee.name} can now sign in with ${email}.`, { duration: 6000 });
          }}
        />
      )}
    </SectionCard>
  );
}

function CreateLoginModal({
  employee,
  roles,
  rolesLoading,
  onClose,
  onCreated,
}: {
  employee: Employee;
  roles: Role[];
  rolesLoading: boolean;
  onClose: () => void;
  onCreated: (updated: Employee, email: string) => void;
}) {
  const [email, setEmail] = useState(employee.email || '');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [roleId, setRoleId] = useState(() => suggestRole(employee, roles));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  // The role list may arrive after the modal opened.
  useEffect(() => {
    if (!roleId && roles.length) setRoleId(suggestRole(employee, roles));
  }, [roles, roleId, employee]);

  const generate = () => {
    setPassword(generatePassword());
    setShow(true);
  };

  const submit = async () => {
    if (lock.current) return;
    const cleanEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) return setError('Please enter a valid e-mail.');
    if (password.length < MIN_PASSWORD) return setError(`Password must be at least ${MIN_PASSWORD} characters.`);
    if (!roleId) return setError('Please choose a role.');
    lock.current = true;
    setSaving(true);
    setError(null);
    try {
      const updated = await employeeApi.createLogin(employee._id, { email: cleanEmail, password, roleId });
      const role = roles.find((r) => r.id === roleId);
      onCreated(
        updated?._id
          ? updated
          : { ...employee, user: { _id: '', email: cleanEmail, isActive: true, staffRole: role ? { _id: role.id, name: role.name } : roleId } },
        cleanEmail,
      );
    } catch (e) {
      // 409: this employee already has a login, or the e-mail is used by another login.
      setError(apiErrorMessage(e, 'Could not create the login.'));
      lock.current = false;
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Create login"
      subtitle={employee.name}
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
            {saving ? 'Creating…' : 'Create login'}
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
          <Field label="E-mail (used to sign in)" required>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className={inputClass}
              autoComplete="off"
              autoFocus
            />
          </Field>
          <Field label="Password" required hint={`At least ${MIN_PASSWORD} characters. Tell it to ${employee.firstName || 'them'}.`}>
            <div className="flex gap-2">
              <div className="relative flex-1 min-w-0">
                <input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputClass} pr-10 ${show ? 'font-mono' : ''}`}
                  autoComplete="new-password"
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
              <button type="button" onClick={generate} className={`${secondaryBtn} flex-shrink-0`} title="Make a random password">
                <Wand2 className="h-4 w-4" /> <span className="hidden sm:inline">Generate</span>
              </button>
            </div>
          </Field>
          <Field label="Role" required hint="What this person may do.">
            <SearchSelect value={roleId} onChange={(e) => setRoleId(e.target.value)} className={inputClass} disabled={rolesLoading && !roles.length}>
              <option value="">{rolesLoading && !roles.length ? 'Loading roles…' : 'Choose a role…'}</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </SearchSelect>
          </Field>
          {!rolesLoading && roles.length === 0 && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              No roles to choose from yet. The owner can add Manager, Cashier, Warehouse Assistant and Purchaser with
              &ldquo;Add default roles&rdquo; on the{' '}
              <Link href="/admin/roles" className="font-semibold underline">
                Roles
              </Link>{' '}
              page.
            </p>
          )}
          <button type="submit" className="hidden" />
        </fieldset>
      </form>
    </Modal>
  );
}
